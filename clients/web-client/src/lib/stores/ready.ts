import { writable } from "svelte/store";

// Per-client ready flag
export const isReady = writable(false);

export default { isReady };
