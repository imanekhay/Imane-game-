import { fetch } from "undici";
import WebSocket from "ws";
import readline from "readline";

type Room = {
  roomId: string;
  players: { userId: string; score: number }[];
  status: "waiting" | "in_round" | "finished";
};

type User = { userId: string; username: string };

const USER_URL = process.env.USER_URL || "http://localhost:3001";
const ROOM_URL = process.env.ROOM_URL || "http://localhost:3002";
const ROOM_WS = process.env.ROOM_WS || "ws://localhost:3002";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q: string) =>
  new Promise<string>((res) => rl.question(q, (ans) => res(ans.trim())));

async function loginOrRegister(username: string): Promise<User> {
  // try register
  const reg = await fetch(`${USER_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (reg.ok) return (await reg.json()) as User;
  if (reg.status === 409) {
    const login = await fetch(`${USER_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (login.ok) return (await login.json()) as User;
  }
  throw new Error(`User register/login failed (${reg.status})`);
}

// Simple cache for userId -> username
const nameCache: Record<string, string> = {};

async function fetchUserName(userId: string): Promise<string> {
  if (nameCache[userId]) return nameCache[userId];
  try {
    const r = await fetch(`${USER_URL}/users/${encodeURIComponent(userId)}`);
    if (r.ok) {
      const data = (await r.json()) as User;
      if (data?.username) {
        nameCache[userId] = data.username;
        return data.username;
      }
    }
  } catch {}
  nameCache[userId] = userId;
  return userId;
}

async function ensureNames(userIds: string[]): Promise<void> {
  const misses = userIds.filter((id) => !nameCache[id]);
  if (misses.length === 0) return;
  await Promise.all(misses.map((id) => fetchUserName(id)));
}

async function createRoom(hostUserId: string): Promise<Room> {
  const r = await fetch(`${ROOM_URL}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostUserId }),
  });
  if (!r.ok) throw new Error(`Failed to create room: ${r.status}`);
  return (await r.json()) as Room;
}

async function joinRoom(roomId: string, userId: string): Promise<Room> {
  const r = await fetch(`${ROOM_URL}/rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!r.ok) throw new Error(`Failed to join room: ${r.status}`);
  return (await r.json()) as Room;
}

async function postReady(roomId: string, userId: string) {
  await fetch(`${ROOM_URL}/rooms/${encodeURIComponent(roomId)}/ready`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

async function main() {
  console.log("Welcome to Memory Race CLI");
  const username = await ask("Enter username: ");
  const user = await loginOrRegister(username);
  nameCache[user.userId] = user.username;

  console.log("\nWhat do you want to do?\n1) Create room\n2) Join room");
  const choice = await ask("Choice: ");

  let room: Room;
  if (choice === "1") {
    room = await createRoom(user.userId);
    console.log(`Created room: ${room.roomId}`);
  } else {
    const roomId = await ask("Room ID: ");
    room = await joinRoom(roomId, user.userId);
    console.log(`Joined room: ${room.roomId}`);
  }

  // Connect to Room WS for live updates and gameplay
  const roomWsUrl = `${ROOM_WS}`;
  const ws = new WebSocket(roomWsUrl);

  let currentRound: number | null = null;
  let inputOpen = false;
  let roundStartTime = 0;

  ws.on("open", () => {
    ws.send(
      JSON.stringify({
        type: "join_room",
        roomId: room.roomId,
        userId: user.userId,
      })
    );
    console.log("Connected to room service.");
    console.log(
      "Type 'ready' when you're ready to start.\nType 'quit' to exit."
    );
  });

  ws.on("message", async (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "room_state") {
        const playerIds = (msg.players || []).map((p: any) => p.userId);
        await ensureNames(playerIds);
        const playersStr = playerIds
          .map((id: string) => nameCache[id] || id)
          .join(", ");
        console.log(
          `Room ${msg.roomId}: players = [${playersStr}] status=${msg.status}`
        );
        if (msg.status === "waiting" && playerIds.length < 2) {
          console.log("Waiting for another player to join...");
        }
      }
      if (msg.type === "player_ready") {
        await ensureNames([msg.userId]);
        console.log(`Player ready: ${nameCache[msg.userId] || msg.userId}`);
      }
      if (msg.type === "round_start") {
        currentRound = msg.round;
        console.log(`Round ${msg.round} starting. Memorize:`);
        if (Array.isArray(msg.sequence)) {
          console.log(msg.sequence.join(" "));
        }
        inputOpen = false;
      }
      if (msg.type === "enter_sequence") {
        roundStartTime = Date.now();
        inputOpen = true;
        console.log("Enter the sequence (use spaces between symbols):");
      }
      if (msg.type === "round_result") {
        inputOpen = false;
        if (msg.roundWinnerUserId) await ensureNames([msg.roundWinnerUserId]);
        console.log(
          `Round ${msg.round} result: winner=${
            msg.roundWinnerUserId
              ? nameCache[msg.roundWinnerUserId] || msg.roundWinnerUserId
              : "none"
          }`
        );
        if (msg.scores) {
          const ids = Object.keys(msg.scores);
          await ensureNames(ids);
          const parts = Object.entries(msg.scores).map(
            ([uid, sc]) => `${nameCache[uid] || uid}:${sc}`
          );
          console.log(`Scores => ${parts.join(" | ")}`);
        }
      }
      if (msg.type === "match_end") {
        await ensureNames([msg.winnerUserId]);
        console.log(
          `Match over! Winner: ${
            nameCache[msg.winnerUserId] || msg.winnerUserId
          }`
        );
        rl.close();
        try {
          ws.close();
        } catch {}
        process.exit(0);
      }
      if (msg.type === "error") {
        console.error("Server error:", msg.message);
      }
    } catch {}
  });

  ws.on("error", (e) =>
    console.error("Room WS error:", (e as any)?.message ?? String(e))
  );

  // Simple input loop for commands and submitting sequence
  while (true) {
    const s = await ask("> ");
    const cmd = s.trim();
    if (!cmd) continue;
    if (cmd.toLowerCase() === "quit" || cmd.toLowerCase() === "exit") {
      break;
    }
    if (cmd.toLowerCase() === "ready") {
      try {
        await postReady(room.roomId, user.userId);
        // also notify via ws for UI parity
        try {
          ws.send(
            JSON.stringify({ type: "player_ready", userId: user.userId })
          );
        } catch {}
        console.log("Marked ready. Waiting for opponent...");
      } catch (e) {
        console.error("Failed to mark ready", e);
      }
      continue;
    }
    if (inputOpen && currentRound) {
      const sequence = cmd.split(/\s+/).filter(Boolean);
      const timeMs = Date.now() - roundStartTime;
      try {
        ws.send(
          JSON.stringify({
            type: "submit_sequence",
            round: currentRound,
            userId: user.userId,
            sequence,
            timeMs,
          })
        );
      } catch (e) {
        console.error("Failed to send sequence", e);
      }
      continue;
    }
    console.log("Unknown command. Type 'ready' or wait for 'enter_sequence'.");
  }

  rl.close();
  try {
    ws.close();
  } catch {}
  process.exit(0);
}

main().catch((err) => {
  console.error("CLI error:", err);
  rl.close();
  process.exit(1);
});
