import express, { Request, Response } from "express";
import cors from "cors";
import { SymbolChar } from "./types";

interface Player {
  userId: string;
  score: number;
}

type RoomStatus = "waiting" | "in_game" | "finished";

interface Room {
  roomId: string;
  hostUserId: string;
  players: Player[];
  status: RoomStatus;
  currentRound: number;
  currentSequence?: SymbolChar[];
  answers: { userId: string; sequence: SymbolChar[]; timeMs: number }[];
}

const rooms = new Map<string, Room>();

function makeRoomId(): string {
  return (
    "room-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/rooms", (req: Request, res: Response) => {
  const { hostUserId } = req.body as { hostUserId?: string };
  if (!hostUserId || typeof hostUserId !== "string") {
    return res.status(400).json({ error: "hostUserId is required" });
  }

  const roomId = makeRoomId();
  const room: Room = {
    roomId,
    hostUserId,
    players: [{ userId: hostUserId, score: 0 }],
    status: "waiting",
    currentRound: 0,
    answers: [],
  };

  rooms.set(roomId, room);
  return res.status(201).json(room);
});

app.post("/rooms/:roomId/join", (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { userId } = req.body as { userId?: string };
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId is required" });
  }
  const room = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: "room not found" });
  if (room.players.length >= 2)
    return res.status(400).json({ error: "room full" });
  room.players.push({ userId, score: 0 });
  rooms.set(roomId, room);
  return res.status(200).json(room);
});

app.post("/rooms/:roomId/start", (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: "room not found" });
  if (room.players.length !== 2)
    return res.status(400).json({ error: "need 2 players" });
  room.status = "in_game";
  room.currentRound = 1;
  room.answers = [];
  rooms.set(roomId, room);
  return res
    .status(200)
    .json({ ok: true, roomId: room.roomId, currentRound: room.currentRound });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3002;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Room service running at http://localhost:${PORT}`);
});
