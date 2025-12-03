<script lang="ts">
  import { user, setUser } from "./lib/stores/user";
  import { loginOrRegister } from "./lib/api/userService";
  import RoomSetup from "./lib/components/RoomSetup.svelte";
  import RoomView from "./lib/components/RoomView.svelte";
  import { get } from "svelte/store";

  let loginName = "";
  let currentRoomId: string | null = null;
  // Room status and ready UI handled inside RoomView

  async function handleContinue() {
    const name = (loginName || "").trim();
    if (!name) return alert("Please enter a username");
    try {
      const res = await loginOrRegister(name);
      setUser(res);
    } catch (err: any) {
      console.error(err);
      alert("Login/register failed: " + (err?.message ?? err));
    }
  }

  function handleEntered(e: CustomEvent) {
    currentRoomId = e.detail.roomId;
  }

  function handleLeaveRoom() {
    currentRoomId = null;
  }
</script>

<main class="app-root">
  <div class="card">
    <header class="card-header">
      <div>
        <h1 class="title">Memory Race</h1>
        <div class="subtitle">Web Client</div>
      </div>
    </header>

    <section class="connection">
      {#if !$user.userId}
        <div class="connect-form">
          <div class="inputs">
            <label class="field">
              <div class="label">Username</div>
              <input class="input" bind:value={loginName} placeholder="Choose a username" />
            </label>
          </div>
          <div class="actions">
            <button class="btn btn-primary" on:click={handleContinue}>Continue</button>
          </div>
        </div>
      {:else}
        {#if !currentRoomId}
          <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
            <div>Logged in as <strong>{$user.username}</strong></div>
            <RoomSetup on:entered={handleEntered} />
          </div>
        {:else}
          <RoomView roomId={currentRoomId} />
        {/if}
      {/if}
    </section>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
    background: linear-gradient(180deg, #eef2ff 0%, #e6f0ff 50%, #f6f9ff 100%);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    height: 100vh;
  }

  .app-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    box-sizing: border-box;
  }

  .card {
    width: 100%;
    max-width: 780px;
    background: #ffffff;
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(20, 24, 40, 0.08);
    padding: 1.5rem;
    box-sizing: border-box;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .title {
    margin: 0;
    font-size: 1.25rem;
    color: #1e293b;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .winner-badge {
    background: linear-gradient(90deg,#7c3aed,#06b6d4);
    color: white;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .connection {
    margin-bottom: 1rem;
  }

  .connect-form {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .inputs {
    display: flex;
    gap: 0.75rem;
    flex: 1 1 auto;
    min-width: 220px;
  }

  .field { flex: 1 1 160px; }
  .label { font-size: 0.8rem; color: #475569; margin-bottom: 0.25rem; }
  .input { width: 100%; padding: 0.5rem 0.6rem; border-radius: 8px; border: 1px solid #e6eef8; }

  .actions { display:flex; align-items:center; }

  .connected-badge { background:#eef2ff; color:#1e3a8a; padding:0.45rem 0.7rem; border-radius:8px; display:inline-block; }

  .game { margin: 1rem 0; text-align: center; }
  .round { font-size: 1.6rem; font-weight: 700; color:#0f172a; margin-bottom: 0.75rem; }

  .sequence-box { background: #fbfbff; border: 1px solid #eef2ff; padding: 1rem; border-radius: 10px; display:flex; gap:1rem; justify-content:center; flex-wrap:wrap; }
  .symbol-lg { font-size: 3rem; line-height:1; }

  .input-area { display:flex; flex-direction:column; gap:0.75rem; align-items:center; }
  .symbols-grid { display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center; }
  .symbol-btn { font-size:1.6rem; padding:0.6rem 0.8rem; border-radius:10px; background:#f8fafc; border:1px solid #e6eef8; cursor:pointer; transition:transform .08s ease, box-shadow .08s; }
  .symbol-btn:hover { transform:translateY(-3px); box-shadow:0 6px 18px rgba(16,24,40,0.06); }

  .input-row { display:flex; gap:0.75rem; align-items:center; }
  .pill { background:#f1f5f9; padding:0.45rem 0.75rem; border-radius:999px; min-width:120px; text-align:center; }

  .btn { padding:0.5rem 0.8rem; border-radius:10px; border:none; cursor:pointer; }
  .btn-primary { background: linear-gradient(90deg,#7c3aed,#06b6d4); color:white; font-weight:600; box-shadow:0 6px 18px rgba(99,102,241,0.12); }
  .btn-primary:hover { filter:brightness(.98); transform:translateY(-2px); }

  .waiting { color:#64748b; }

  .scores { margin-top:1rem; }
  .score-list { list-style:none; padding:0; margin:0; display:flex; gap:0.5rem; flex-wrap:wrap; }
  .score-item { background:#f8fafc; padding:0.45rem 0.6rem; border-radius:8px; display:flex; gap:0.6rem; align-items:center; }
  .player { font-weight:600; color:#0f172a; }
  .score { background:#e6eef8; color:#0f172a; padding:0.25rem 0.45rem; border-radius:6px; font-weight:700; }

  /* Responsive */
  @media (max-width: 640px) {
    .card { padding: 1rem; }
    .inputs { flex-direction: column; }
    .actions { width:100%; }
    .symbol-lg { font-size:2.4rem; }
  }
</style>
