import WebSocket from "ws";
import readline from "readline";
import {
  SymbolChar,
  ClientToServerMessage,
  ServerToClientMessage,
  RoundStartMessage,
  EnterSequenceMessage,
  RoundResultMessage,
  MatchEndMessage,
  ErrorMessage,
  RoomStateMessage,
} from "./types";

const roomId = process.argv[2] ?? "room-1";
const userId =
  process.argv[3] ?? "cli-user-" + Math.floor(Math.random() * 1000);

const ws = new WebSocket("ws://localhost:3002");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let roundStartTime = 0;

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

ws.on("open", () => {
  const joinMsg: ClientToServerMessage = {
    type: "join_room",
    roomId,
    userId,
  } as any;
  ws.send(JSON.stringify(joinMsg));
  console.log(`Connected as ${userId} to room ${roomId}`);
});

ws.on("message", async (data) => {
  try {
    const msg = JSON.parse(data.toString()) as ServerToClientMessage;
    if (msg.type === "room_state") {
      const m = msg as RoomStateMessage;
      console.log("\n[Room State] roomId:", m.roomId, "status:", m.status);
      console.log("Players:");
      for (const p of m.players) {
        console.log(` - ${p.userId}: ${p.score}`);
      }
    } else if (msg.type === "round_start") {
      const m = msg as RoundStartMessage;
      console.clear();
      console.log(`\nROUND ${m.round}`);
      console.log("Sequence:", m.sequence.join(" "));
      setTimeout(() => {
        console.log("Sequence hidden, wait for input...");
      }, m.displayMs);
    } else if (msg.type === "enter_sequence") {
      const m = msg as EnterSequenceMessage;
      roundStartTime = Date.now();
      const answer = await ask("Enter sequence (space-separated symbols): ");
      const sequence = answer.trim().split(/\s+/) as SymbolChar[];
      const timeMs = Date.now() - roundStartTime;
      const submit: ClientToServerMessage = {
        type: "submit_sequence",
        round: m.round,
        userId,
        sequence,
        timeMs,
      } as any;
      ws.send(JSON.stringify(submit));
    } else if (msg.type === "round_result") {
      const m = msg as RoundResultMessage;
      console.log("\n[Round Result] Round", m.round);
      console.log("Correct sequence:", m.correctSequence.join(" "));
      console.log("Winner:", m.roundWinnerUserId ?? "(none)");
      console.log("Scores:", m.scores);
    } else if (msg.type === "match_end") {
      const m = msg as MatchEndMessage;
      console.log("\n[MATCH END] Winner:", m.winnerUserId);
      console.log("Final scores:", m.scores);
      rl.close();
      ws.close();
      process.exit(0);
    } else if (msg.type === "error") {
      const m = msg as ErrorMessage;
      console.error("[Error]", m.message);
    }
  } catch (err) {
    console.error("Invalid server message", err);
  }
});

ws.on("close", () => {
  console.log("Disconnected from room server");
  try {
    rl.close();
  } catch {}
});

ws.on("error", (err) => {
  console.error("WebSocket error", err);
});
