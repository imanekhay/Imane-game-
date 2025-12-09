export async function createRoom(hostUserId: string, requestedRoomId?: string) {
  const body: any = { hostUserId };
  if (requestedRoomId) body.roomId = requestedRoomId;
  const res = await fetch("http://localhost:3002/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Create room failed: " + res.status);
  return res.json();
}

export async function joinRoom(roomId: string, userId: string) {
  const res = await fetch(
    `http://localhost:3002/rooms/${encodeURIComponent(roomId)}/join`,
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
    `http://localhost:3002/rooms/${encodeURIComponent(roomId)}/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok) throw new Error("Start room failed: " + res.status);
  return res.json();
}

export default { createRoom, joinRoom, startRoom };
