<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { user } from "../stores/user";
  import { get } from "svelte/store";
  import { startRoom } from "../api/roomService";
  import { isReady } from "../stores/ready";

  export let roomId: string;

  let ws: WebSocket | null = null;
  let players: { userId: string; score: number }[] = [];
  let hostUserId: string | null = null;
  let status: string | null = null;

  // track which players are ready
  let playersReady: Record<string, boolean> = {};

  // cache userId -> display name
  let userNames: Record<string, string> = {};

  async function fetchUserName(userId: string) {
    try {
      const res = await fetch(`http://localhost:3001/users/${userId}`);
      if (res.ok) {
        const j = await res.json();
        userNames[userId] = j.username ?? userId;
      } else {
        userNames[userId] = userId;
      }
    } catch (err) {
      userNames[userId] = userId;
    }
  }

  let sequence: string[] = [];
  let showSequence = false;
  let currentRound: number | null = null;
  let inputSequence: string[] = [];
  let roundStartTime = 0;
  let winner: string | null = null;
  let scores: Record<string, number> = {};

  const symbols = ["★", "●", "♥", "■", "▲", "◆", "☀", "☂"];

  function connectWs() {
    ws = new WebSocket("ws://localhost:3002");
    ws.onopen = () => {
      const cur = get(user);
      if (!cur.userId) return;
      ws?.send(
        JSON.stringify({
          type: "join_room",
          roomId,
          userId: cur.userId,
        })
      );
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as any;
      if (msg.type === "room_state") {
        hostUserId = msg.hostUserId ?? hostUserId;
        players = (msg.players || []).map((p: any) => ({ userId: p.userId, score: p.score ?? 0 }));
        status = msg.status ?? status;
        // update scores map
        const s: Record<string, number> = {};
        for (const p of players) s[p.userId] = p.score;
        scores = s;

        // ensure playersReady entries exist and fetch display names
        for (const p of players) {
          if (!playersReady[p.userId]) playersReady[p.userId] = false;
          if (!userNames[p.userId]) fetchUserName(p.userId);
        }
      }

      if (msg.type === "player_ready") {
        // mark player ready
        if (msg.userId) {
          playersReady[msg.userId] = true;
        }
      }

      if (msg.type === "round_start") {
        currentRound = msg.round;
        if (Array.isArray(msg.sequence)) sequence = msg.sequence;
        showSequence = true;
        inputSequence = [];
        setTimeout(() => (showSequence = false), msg.displayMs);
        // hide local ready flag when round begins
        isReady.set(false);
      }

      if (msg.type === "enter_sequence") {
        roundStartTime = Date.now();
      }

      if (msg.type === "round_result") {
        if (msg.scores && typeof msg.scores === "object") {
          scores = msg.scores;
          // ensure display names for any userIds in scores
          for (const uid of Object.keys(scores)) {
            if (!userNames[uid]) fetchUserName(uid);
          }
        }
      }

      if (msg.type === "match_end") {
        if (typeof msg.winnerUserId === "string") winner = msg.winnerUserId;
      }

      if (msg.type === "error") {
        console.error("Room error:", msg.message);
        alert("Error: " + msg.message);
      }
    };

    ws.onclose = () => {
      ws = null;
    };

    ws.onerror = (e) => console.error("WS error", e);
  }

  function addSymbol(s: string) {
    if (showSequence || !currentRound) return;
    inputSequence = [...inputSequence, s];
  }

  function submit() {
    const cur = get(user);
    if (!cur.userId || !currentRound || !ws) return;
    const timeMs = Date.now() - roundStartTime;
    ws.send(
      JSON.stringify({ type: "submit_sequence", round: currentRound, userId: cur.userId, sequence: inputSequence, timeMs })
    );
  }

  async function pressReady() {
    const cur = get(user);
    if (!cur?.userId) return;
    try {
      await fetch(`http://localhost:3002/rooms/${encodeURIComponent(roomId)}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: cur.userId }),
      });
      isReady.set(true);
    } catch (err) {
      console.error('failed to set ready', err);
      alert('Failed to set ready');
    }
  }

  async function handleStart() {
    try {
      await startRoom(roomId);
    } catch (err: any) {
      console.error(err);
      alert("Start failed: " + (err?.message ?? err));
    }
  }

  onMount(() => {
    connectWs();
  });

  const readyUnsub = isReady.subscribe((v) => {
    const cur = get(user);
    if (cur?.userId) playersReady[cur.userId] = !!v;
    if (v && ws && cur?.userId) {
      try {
        ws.send(JSON.stringify({ type: 'player_ready', userId: cur.userId }));
      } catch (e) {}
    }
  });

  onDestroy(() => {
    try {
      readyUnsub();
    } catch {}
    try {
      ws?.close();
    } catch {}
  });
</script>

<section class="room-view">
  <div class="meta">
    <div>Logged in as: <strong>{$user.username}</strong></div>
    <div>Room: <strong>{roomId}</strong></div>
  </div>

  <div class="players">
    <h4>Players</h4>
    <ul>
      {#each players as p}
        <li>{userNames[p.userId] ?? p.userId} — {p.score} {#if playersReady[p.userId]} <span class="ready-indicator">(ready)</span>{/if}</li>
      {/each}
    </ul>
  </div>

  {#if status === 'waiting'}
    {#if $user?.userId && playersReady[String($user.userId)]}
      <div class="ready-wait">Waiting for other player...</div>
    {:else}
      <div class="host-actions">
        <button class="btn btn-primary" on:click={pressReady}>Ready</button>
      </div>
    {/if}
  {/if}

  <!-- Host start button removed: match starts when both players are ready -->

  <div class="game-area">
    <div class="round">Round {currentRound ?? '–'}</div>

    {#if showSequence}
      <div class="sequence-box">
        {#each sequence as s}
          <span class="symbol-lg">{s}</span>
        {/each}
      </div>
    {:else if currentRound}
      <div class="symbols-grid">
        {#each symbols as s}
          <button class="symbol-btn" on:click={() => addSymbol(s)}>{s}</button>
        {/each}
      </div>

      <div class="input-row">
        <div class="pill">{inputSequence.join(' ') || '—'}</div>
        <button class="btn btn-primary" on:click={submit}>Submit</button>
      </div>
    {/if}
  </div>

  <div class="scores">
    <h4>Scores</h4>
    <ul>
      {#each Object.entries(scores) as [uid, sc]}
        <li>{userNames[uid] ?? uid}: {sc}</li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .meta { display:flex; justify-content:space-between; gap:1rem; margin-bottom:0.75rem; }
  .players ul { margin:0; padding-left:1rem; }
  .sequence-box { display:flex; gap:1rem; justify-content:center; padding:0.75rem; border-radius:8px; background:#fbfbff; }
  .symbol-lg { font-size:2.6rem; }
  .symbols-grid { display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:center; margin:0.75rem 0; }
  .symbol-btn { padding:0.5rem; border-radius:8px; }
  .input-row { display:flex; gap:0.5rem; align-items:center; justify-content:center; }
  .pill { background:#f1f5f9; padding:0.35rem 0.6rem; border-radius:999px; }
  .ready-indicator { color: #059669; font-weight:700; margin-left:0.5rem }
</style>
