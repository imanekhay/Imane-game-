import { writable } from "svelte/store";

export type UserState = {
  userId: string | null;
  username: string | null;
};

const initial: UserState = { userId: null, username: null };

export const user = writable<UserState>(initial);

export function setUser(u: { userId: string; username: string }) {
  user.set({ userId: u.userId, username: u.username });
}

export function clearUser() {
  user.set(initial);
}

export default {
  user,
  setUser,
  clearUser,
};
