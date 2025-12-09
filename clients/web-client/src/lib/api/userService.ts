export type UserResponse = { userId: string; username: string };

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

export async function loginOrRegister(username: string): Promise<UserResponse> {
  const base = "http://localhost:3001";

  // try to register first
  const registerRes = await postJson(`${base}/users`, { username });
  if (registerRes.ok) {
    const body = (await registerRes.json()) as UserResponse;
    return body;
  }

  if (registerRes.status === 409) {
    // user already exists — login
    const loginRes = await postJson(`${base}/login`, { username });
    if (loginRes.ok) {
      const body = (await loginRes.json()) as UserResponse;
      return body;
    }
    throw new Error("Login failed: " + loginRes.status);
  }

  throw new Error("Registration failed: " + registerRes.status);
}

export default { loginOrRegister };
