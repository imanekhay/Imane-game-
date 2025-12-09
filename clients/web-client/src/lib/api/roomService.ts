function resolveRoomBase() {
  const envBase = (import.meta as any).env?.VITE_BASE_URL as string | undefined;
  const port = (import.meta as any).env?.VITE_ROOM_PORT || "3002";
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const baseHost = isLocal ? "http://localhost" : envBase || "http://localhost";
  return `${baseHost.replace(/\/$/, "")}:${port}`;
}
const ROOM_BASE = resolveRoomBase();

export async function createRoom(hostUserId: string, requestedRoomId?: string) {
  const body: any = { hostUserId };
  if (requestedRoomId) body.roomId = requestedRoomId;
  const res = await fetch(`${ROOM_BASE}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Create room failed: " + res.status);
  return res.json();
}

export async function joinRoom(roomId: string, userId: string) {
  const res = await fetch(
    `${ROOM_BASE}/rooms/${encodeURIComponent(roomId)}/join`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }
  );
  if (!res.ok) throw new Error("Join room failed: " + res.status);
  return res.json();
}

export async function startRoom(roomId: string) {
  const res = await fetch(
    `${ROOM_BASE}/rooms/${encodeURIComponent(roomId)}/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok) throw new Error("Start room failed: " + res.status);
  return res.json();
}

export default { createRoom, joinRoom, startRoom };
