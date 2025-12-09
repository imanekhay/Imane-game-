<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { user } from "../stores/user";
  import { createRoom, joinRoom } from "../api/roomService";
  import { get } from "svelte/store";

  const dispatch = createEventDispatcher();

  let defaultCounter = Math.floor(Math.random() * 1000);
  let roomId = `room-${defaultCounter}`;

  // allow parent to provide a starter roomId via prop in future
  export let initialRoomId: string | null = null;
  if (initialRoomId) {
    roomId = initialRoomId;
  }

  async function handleCreate() {
    const cur = get(user);
    if (!cur.userId) return alert("You must be logged in to create a room");
    try {
      const created = await createRoom(cur.userId, roomId);
      // override backend id with our chosen roomId per instruction
      const finalRoomId = roomId || created.roomId || String(created.roomId);
      dispatch("entered", { roomId: finalRoomId, hostUserId: cur.userId });
    } catch (err: any) {
      console.error(err);
      alert("Create room failed: " + (err?.message ?? err));
    }
  }

  async function handleJoin() {
    const cur = get(user);
    if (!cur.userId) return alert("You must be logged in to join a room");
    try {
      await joinRoom(roomId, cur.userId);
      dispatch("entered", { roomId, hostUserId: null });
    } catch (err: any) {
      console.error(err);
      alert("Join room failed: " + (err?.message ?? err));
    }
  }
</script>

<div class="room-setup">
  <label class="label">Room ID</label>
  <div class="row">
    <input class="input" bind:value={roomId} />
    <button class="btn" on:click={handleCreate}>Create Room</button>
    <button class="btn btn-outline" on:click={handleJoin}>Join Room</button>
  </div>
</div>

<style>
  .row { display:flex; gap:0.5rem; align-items:center; }
  .input { padding:0.5rem; border-radius:8px; border:1px solid #e6eef8; }
  .btn { padding:0.5rem 0.75rem; border-radius:8px; background:linear-gradient(90deg,#7c3aed,#06b6d4); color:white; border:none; cursor:pointer; }
  .btn-outline { background: transparent; border:1px solid #cbd5e1; color:#111827; }
</style>
