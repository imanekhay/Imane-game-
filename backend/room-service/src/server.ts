import express, { Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import fetch from "node-fetch";
import { WebSocketServer, WebSocket } from "ws";
import {
  SymbolChar,
  ClientToServerMessage,
  ServerToClientMessage,
  ErrorMessage,
  RoomStateMessage,
  RoundStartMessage,
  EnterSequenceMessage,
  RoundResultMessage,
  MatchEndMessage,
} from "./types";

interface Player {
  userId: string;
  score: number;
  ws?: WebSocket;
}

type RoomStatus = "waiting" | "in_round" | "finished";

interface Room {
  roomId: string;
  hostUserId: string;
  players: Player[];
  status: RoomStatus;
  currentRound: number;
  currentSequence?: SymbolChar[];
  answers: { userId: string; sequence: SymbolChar[]; timeMs: number }[];
  ready?: Set<string>;
}

const rooms = new Map<string, Room>();

let nextRoomNumber = 1;

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

// Create HTTP server and WebSocket server
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.post("/rooms", (req: Request, res: Response) => {
  const { hostUserId, roomId: requestedRoomId } = req.body as {
    hostUserId?: string;
    roomId?: string;
  };
  if (!hostUserId || typeof hostUserId !== "string") {
    return res.status(400).json({ error: "hostUserId is required" });
  }
  // allow client to request a specific roomId (if not already taken)
  let roomId: string;
  if (requestedRoomId && typeof requestedRoomId === "string") {
    if (rooms.has(requestedRoomId))
      return res.status(400).json({ error: "room id already exists" });
    roomId = requestedRoomId;
  } else {
    roomId = `room-${nextRoomNumber++}`;
  }
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

app.post("/rooms/:roomId/start", async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: "room not found" });
  if (room.players.length !== 2)
    return res.status(400).json({ error: "need 2 players" });
  room.status = "in_round";
  room.currentRound = 1;
  room.answers = [];
  rooms.set(roomId, room);
  // start the first round (async)
  startRound(room).catch((err: any) => console.error("startRound error:", err));
  return res
    .status(200)
    .json({ ok: true, roomId: room.roomId, currentRound: room.currentRound });
});

// mark a player ready via HTTP
app.post("/rooms/:roomId/ready", (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { userId } = req.body as { userId?: string };
  if (!userId || typeof userId !== "string")
    return res.status(400).json({ error: "userId required" });
  const room = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: "room not found" });

  // Allow restarting a finished match by resetting the room back to waiting
  if (room.status === "finished") {
    room.status = "waiting";
    room.currentRound = 0;
    room.currentSequence = undefined;
    room.answers = [];
    // reset scores for a new match
    for (const p of room.players) p.score = 0;
    room.ready = new Set<string>();
    rooms.set(room.roomId, room);
    // broadcast fresh room state after reset
    const resetState: RoomStateMessage = {
      type: "room_state",
      roomId: room.roomId,
      players: room.players.map((p) => ({ userId: p.userId, score: p.score })),
      status: room.status,
    };
    broadcast(room, resetState as unknown as ServerToClientMessage);
  }
  room.ready = room.ready ?? new Set<string>();
  room.ready.add(userId);
  rooms.set(roomId, room);
  // broadcast player_ready
  const readyMsg = { type: "player_ready", userId } as any;
  broadcast(room, readyMsg);

  // debug log
  // eslint-disable-next-line no-console
  console.log(
    `[room-service] ready: ${userId} in ${roomId} (readyCount=${room.ready.size})`
  );

  // if all players ready and still waiting, start the room (startRound will set status and broadcast)
  if (room.status === "waiting" && room.players.length > 0) {
    const allReady = room.players.every((p) => room.ready!.has(p.userId));
    if (allReady && room.players.length === 2) {
      // async start; startRound will update status and broadcast
      startRound(room).catch((err: any) =>
        console.error("startRound error:", err)
      );
    }
  }

  return res.status(200).json({ ok: true });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3002;
// Helper: send JSON message over ws
function send(ws: WebSocket, msg: ServerToClientMessage) {
  try {
    ws.send(JSON.stringify(msg));
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("send error", err);
  }
}

function broadcast(room: Room, msg: ServerToClientMessage) {
  for (const p of room.players) {
    // readyState === 1 means OPEN in ws
    if (p.ws && p.ws.readyState === 1) {
      send(p.ws, msg);
    }
  }
}

function findRoomByUser(userId: string): Room | undefined {
  for (const r of rooms.values()) {
    if (r.players.some((p) => p.userId === userId)) return r;
  }
  return undefined;
}

// Start a round by calling game-service
async function startRound(room: Room): Promise<void> {
  try {
    // set status to in_round and clear ready flags when a round starts
    room.status = "in_round";
    // ensure we have a positive round number (start at 1 if unset)
    if (!room.currentRound || room.currentRound < 1) room.currentRound = 1;
    room.ready = new Set<string>();
    rooms.set(room.roomId, room);
    // broadcast updated room state so clients hide Ready UI
    const stateMsg: RoomStateMessage = {
      type: "room_state",
      roomId: room.roomId,
      players: room.players.map((p) => ({ userId: p.userId, score: p.score })),
      status: room.status,
    };
    broadcast(room, stateMsg as unknown as ServerToClientMessage);
    // debug log
    // eslint-disable-next-line no-console
    console.log(
      `[room-service] startRound: room=${room.roomId} round=${room.currentRound}`
    );
    const resp = await fetch("http://localhost:3003/games/create-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round: room.currentRound }),
    });
    if (!resp.ok) throw new Error(`game-service responded ${resp.status}`);
    const data = (await resp.json()) as {
      round: number;
      sequence: SymbolChar[];
      displayMs: number;
    };
    // ensure room.currentRound reflects the round returned by game-service
    room.currentRound =
      typeof data.round === "number" ? data.round : room.currentRound || 1;
    room.currentSequence = data.sequence;
    room.answers = [];
    rooms.set(room.roomId, room);

    const startMsg: RoundStartMessage = {
      type: "round_start",
      round: room.currentRound,
      sequence: data.sequence,
      displayMs: data.displayMs,
    };
    broadcast(room, startMsg);

    setTimeout(() => {
      const enterMsg: EnterSequenceMessage = {
        type: "enter_sequence",
        round: room.currentRound,
      };
      broadcast(room, enterMsg);
    }, data.displayMs);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("startRound error", err);
    // revert status to waiting so players can ready again
    room.status = "waiting";
    rooms.set(room.roomId, room);
    const e: ErrorMessage = { type: "error", message: "Failed to start round" };
    broadcast(room, e as unknown as ServerToClientMessage);
    const stateMsg: RoomStateMessage = {
      type: "room_state",
      roomId: room.roomId,
      players: room.players.map((p) => ({ userId: p.userId, score: p.score })),
      status: room.status,
    };
    broadcast(room, stateMsg as unknown as ServerToClientMessage);
  }
}

// Finish a round by calling game-service validate
async function finishRound(room: Room): Promise<void> {
  if (!room.currentSequence) return;
  try {
    const resp = await fetch("http://localhost:3003/games/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        round: room.currentRound,
        sequence: room.currentSequence,
        answers: room.answers,
      }),
    });
    if (!resp.ok) throw new Error(`game-service responded ${resp.status}`);
    const data = (await resp.json()) as {
      round: number;
      correctSequence: SymbolChar[];
      results: { userId: string; correct: boolean; timeMs: number }[];
      roundWinnerUserId: string | null;
    };

    if (data.roundWinnerUserId) {
      const winner = room.players.find(
        (p) => p.userId === data.roundWinnerUserId
      );
      if (winner) winner.score += 1;
    }

    const scores: Record<string, number> = {};
    for (const p of room.players) scores[p.userId] = p.score;

    const resultMsg: RoundResultMessage = {
      type: "round_result",
      round: room.currentRound,
      correctSequence: data.correctSequence,
      roundWinnerUserId: data.roundWinnerUserId,
      scores,
    };
    broadcast(room, resultMsg);

    // Check for match end (first to 3)
    const winner = room.players.find((p) => p.score >= 3);
    if (winner) {
      room.status = "finished";
      rooms.set(room.roomId, room);
      const matchMsg: MatchEndMessage = {
        type: "match_end",
        winnerUserId: winner.userId,
        scores,
      };
      broadcast(room, matchMsg);
      return;
    }

    // Next round
    room.currentRound += 1;
    rooms.set(room.roomId, room);
    await startRound(room);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("finishRound error", err);
    const e: ErrorMessage = {
      type: "error",
      message: "Failed to finish round",
    };
    broadcast(room, e as unknown as ServerToClientMessage);
  }
}

// WebSocket connection handling
wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (data: any) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientToServerMessage;
      if (msg.type === "join_room") {
        const { roomId, userId } = msg;
        const room = rooms.get(roomId);
        if (!room) {
          const err: ErrorMessage = {
            type: "error",
            message: "Room or user not found",
          };
          return send(ws, err as unknown as ServerToClientMessage);
        }
        const player = room.players.find((p) => p.userId === userId);
        if (!player) {
          const err: ErrorMessage = {
            type: "error",
            message: "Room or user not found",
          };
          return send(ws, err as unknown as ServerToClientMessage);
        }
        player.ws = ws;
        // Broadcast room_state
        const state: RoomStateMessage = {
          type: "room_state",
          roomId: room.roomId,
          players: room.players.map((p) => ({
            userId: p.userId,
            score: p.score,
          })),
          status: room.status,
        };
        broadcast(room, state as unknown as ServerToClientMessage);
      } else if (msg.type === "submit_sequence") {
        const { round, userId, sequence, timeMs } = msg;
        const room = findRoomByUser(userId);
        if (!room) {
          const err: ErrorMessage = {
            type: "error",
            message: "Room not found for user",
          };
          return send(ws, err as unknown as ServerToClientMessage);
        }
        if (round !== room.currentRound) {
          // ignore wrong round
          return;
        }
        room.answers.push({ userId, sequence, timeMs });
        rooms.set(room.roomId, room);
        if (room.answers.length === room.players.length) {
          // finish round
          finishRound(room).catch((e: any) =>
            console.error("finishRound error", e)
          );
        }
      } else if ((msg as any).type === "player_ready") {
        const { userId } = msg as any;
        const room = findRoomByUser(userId);
        if (!room) {
          const err: ErrorMessage = {
            type: "error",
            message: "Room not found for user",
          };
          return send(ws, err as unknown as ServerToClientMessage);
        }
        // If previous match finished, reset the room for a new match on first ready
        if (room.status === "finished") {
          room.status = "waiting";
          room.currentRound = 0;
          room.currentSequence = undefined;
          room.answers = [];
          for (const p of room.players) p.score = 0;
          room.ready = new Set<string>();
          rooms.set(room.roomId, room);
          const resetState: RoomStateMessage = {
            type: "room_state",
            roomId: room.roomId,
            players: room.players.map((p) => ({
              userId: p.userId,
              score: p.score,
            })),
            status: room.status,
          };
          broadcast(room, resetState as unknown as ServerToClientMessage);
        }
        room.ready = room.ready ?? new Set<string>();
        room.ready.add(userId);
        rooms.set(room.roomId, room);
        // broadcast to all clients
        const readyMsg = { type: "player_ready", userId } as any;
        broadcast(room, readyMsg);
        // debug log
        // eslint-disable-next-line no-console
        console.log(
          `[room-service] ws ready: ${userId} in ${room.roomId} (readyCount=${room.ready.size})`
        );

        // auto-start when all ready (startRound will set status and broadcast)
        if (room.status === "waiting") {
          const allReady = room.players.every((p) => room.ready!.has(p.userId));
          if (allReady && room.players.length === 2) {
            startRound(room).catch((err: any) =>
              console.error("startRound error:", err)
            );
          }
        }
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("ws message parse error", err);
      const e: ErrorMessage = { type: "error", message: "Invalid message" };
      try {
        send(ws, e as unknown as ServerToClientMessage);
      } catch (e2) {
        // ignore
      }
    }
  });

  ws.on("close", () => {
    // detach ws from any player
    for (const room of rooms.values()) {
      for (const p of room.players) {
        if (p.ws === ws) p.ws = undefined;
      }
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Room service + WebSocket running at http://localhost:${PORT}`);
});
