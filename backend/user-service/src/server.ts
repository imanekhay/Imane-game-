import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

interface User {
  userId: string;
  username: string;
}

const app = express();
app.use(cors());
app.use(express.json());

const usersById = new Map<string, User>();
const usersByName = new Map<string, User>();

app.post("/users", (req, res) => {
  const { username } = req.body as { username?: string };
  if (!username) {
    return res.status(400).json({ message: "username is required" });
  }
  if (usersByName.has(username)) {
    return res.status(409).json({ message: "username already exists" });
  }
  const user: User = { userId: uuidv4(), username };
  usersById.set(user.userId, user);
  usersByName.set(username, user);
  return res.status(201).json(user);
});

app.post("/login", (req, res) => {
  const { username } = req.body as { username?: string };
  if (!username) {
    return res.status(400).json({ message: "username is required" });
  }
  const user = usersByName.get(username);
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }
  return res.json(user);
});

app.get("/users/:userId", (req, res) => {
  const { userId } = req.params;
  const user = usersById.get(userId);
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }
  return res.json(user);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`User service running at http://localhost:${PORT}`);
});
