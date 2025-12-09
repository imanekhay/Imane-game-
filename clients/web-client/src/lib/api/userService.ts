export type UserResponse = { userId: string; username: string };

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

function resolveUserBase() {
  const envBase = (import.meta as any).env?.VITE_BASE_URL as string | undefined;
  const port = (import.meta as any).env?.VITE_USER_PORT || "3001";
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const baseHost = isLocal ? "http://localhost" : envBase || "http://localhost";
  return `${baseHost.replace(/\/$/, "")}:${port}`;
}

const USER_BASE = resolveUserBase();

export async function loginOrRegister(username: string): Promise<UserResponse> {
  // try to register first
  const registerRes = await postJson(`${USER_BASE}/users`, { username });
  if (registerRes.ok) {
    const body = (await registerRes.json()) as UserResponse;
    return body;
  }

  if (registerRes.status === 409) {
    // user already exists — login
    const loginRes = await postJson(`${USER_BASE}/login`, { username });
    if (loginRes.ok) {
      const body = (await loginRes.json()) as UserResponse;
      return body;
    }
    throw new Error("Login failed: " + loginRes.status);
  }

  throw new Error("Registration failed: " + registerRes.status);
}

export default { loginOrRegister };
