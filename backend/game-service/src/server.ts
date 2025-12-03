import express from "express";
import cors from "cors";
type SymbolChar = "★" | "●" | "♥" | "■" | "▲" | "◆" | "☀" | "☂";

const SYMBOLS: SymbolChar[] = ["★", "●", "♥", "■", "▲", "◆", "☀", "☂"];

function generateSequence(length: number): SymbolChar[] {
  const seq: SymbolChar[] = [];
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * SYMBOLS.length);
    seq.push(SYMBOLS[idx]);
  }
  return seq;
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/games/create-round", (req, res) => {
  const body = req.body as { round?: number; difficulty?: number };
  const round = typeof body.round === "number" ? body.round : 0;
  const base = body.difficulty ?? round ?? 0;
  let length = 3 + base;
  if (length < 3) length = 3;
  if (length > 7) length = 7;
  const sequence = generateSequence(length);
  return res.json({ round, sequence, displayMs: 1000 });
});

app.post("/games/validate", (req, res) => {
  type Answer = { userId: string; sequence: SymbolChar[]; timeMs: number };
  const body = req.body as {
    round: number;
    sequence: SymbolChar[];
    answers: Answer[];
  };

  const { round, sequence, answers } = body;
  const results: { userId: string; correct: boolean; timeMs: number }[] = (
    answers ?? []
  ).map((a) => {
    const correct =
      Array.isArray(a.sequence) &&
      a.sequence.length === sequence.length &&
      a.sequence.every((s, i) => s === sequence[i]);
    return { userId: a.userId, correct, timeMs: a.timeMs };
  });

  const correctAnswers = results.filter((r) => r.correct);
  let roundWinnerUserId: string | null = null;
  if (correctAnswers.length > 0) {
    correctAnswers.sort((a, b) => a.timeMs - b.timeMs);
    roundWinnerUserId = correctAnswers[0].userId;
  }

  return res.json({
    round,
    correctSequence: sequence,
    results,
    roundWinnerUserId,
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3003;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Game service running at http://localhost:${PORT}`);
});
