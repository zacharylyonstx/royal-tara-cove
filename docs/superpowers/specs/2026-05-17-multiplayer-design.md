# Multiplayer Co-op — Design

**Date:** 2026-05-17
**Target ship time:** ~4 hours (Zoom call with kids tonight)
**Status:** Design approved by user

## Goal

Two or three people open `royal-tara-cove.netlify.app` from different computers,
pick the same game mode, each pick a different family member (Dad / Penny / Luke),
and play together — seeing each other run around the neighborhood and sharing
the same enemies / tornado / HP.

## Non-goals

- No accounts, no usernames, no chat.
- No private rooms / invite codes. Two global rooms, one per mode.
- No host-transfer logic. Host disconnect = game over, refresh to play again.
- No reconnection / state replay. If your tab loses connection, refresh.
- Mobile not in scope. Desktop browsers only.

## Architecture

**Backend:** Supabase Realtime (channels + presence). No tables. No server code.

**Rooms:** Two global channels — `room:aliens` and `room:tornado`. Picking a
mode joins the corresponding channel.

**Presence record per client:**

```ts
{
  playerId: string,        // random uuid generated in-browser
  characterId: 'dad' | 'penny' | 'luke' | null,  // null until chosen
  joinedAt: number,        // epoch ms; used for host election
}
```

**Host election:** Every client computes host locally as the presence record
with the smallest `joinedAt` (ties broken by `playerId` sort). When presence
changes, every client recomputes — no election protocol needed.

**Character claim:** When a client picks a character, it updates its presence
record with `characterId`. Other clients see the update in the next presence
sync and gray out that character. Race condition: if two clients pick the
same character within ~100 ms, both will appear claimed for a moment, then
Supabase reconciles to the most-recent update. We treat that as good enough —
if a client sees its claim invalidated (someone else now owns the character it
thought it had), it bumps back to selection.

**Two broadcast channels (inside each room channel):**

| Event | Sender | Rate | Payload |
|---|---|---|---|
| `player_state` | every client (about its own character) | 15 Hz | `{characterId, x, y, z, yaw, running, jumping}` |
| `world_state` | host only | 10 Hz | snapshot of: `combatStore.blobs`, `gameStore.playerHp`, `gameStore.phase`, `tornadoStore.phase`, `gameStore.destroyedHouses`, `combatStore.waveIndex`, `combatStore.waveState`, `combatStore.beams`, `combatStore.gooSplats`, `combatStore.activePowerUps` |

For now we **don't** sync: particles, audio cues, individual hit numbers, projectile
positions, ragdoll start (deemed too high-frequency or not gameplay-critical for
the demo). Each client renders its own ephemera based on world_state changes.

**Non-host clients skip simulation:** Every controller that mutates a synced
store (WaveController, BlobController, ProjectileController, TornadoController,
NPCController, SidekickController, RagdollController, PowerUpController) starts
its `useFrame` body with `if (!isHost) return`. They become passive renderers
of host-driven state.

**Local input controls only own character:** PlayerController reads from
`netStore.myCharacterId` instead of `gameStore.activeCharacterId`. The 1/2/3
key swap is disabled in multiplayer.

**Spectator mode (4th+ player):** Camera follows the host's character. No
controls. Small "spectating" badge in the HUD.

## UI changes

1. **WelcomeScreen** unchanged — still picks game mode.
2. **NEW: CharacterSelect** screen appears after mode pick, before world
   loads. Shows three character cards. Taken ones are grayed out with the
   owner's playerId-prefix shown ("👤 abc12"). Updates live via presence.
   Has a small "players in room" header.
3. **NEW: RoomBadge** small HUD chip showing connection status, room name,
   and player count. Top-left.
4. If all 3 characters taken when you arrive, the CharacterSelect shows
   "All characters taken — joining as spectator" with a "Spectate" button.

## State module layout

- `src/net/supabase.ts` — supabase client singleton, env-driven config.
- `src/net/realtime.ts` — `joinRoom(mode)`, `leaveRoom()`, presence helpers,
  broadcast helpers, `isHost()` computation.
- `src/state/netStore.ts` — zustand: `playerId`, `mode`, `myCharacterId`,
  `roomPlayers[]` (presence list), `isHost`, `connectionStatus`,
  `spectator` boolean.
- `src/ui/CharacterSelect.tsx` — character claim screen.
- `src/ui/RoomBadge.tsx` — connection / room info chip.

## Game logic changes

- `gameStore.positions` becomes the canonical render source for all 3
  characters. Local player writes its own; remote players' positions are
  written by an incoming `player_state` subscriber.
- `gameStore.activeCharacterId` stays but is sourced from
  `netStore.myCharacterId`. Existing `setActiveCharacter` calls in
  `PlayerController` (the 1/2/3 keys) are removed when in multiplayer.
- A new `NetSyncController` component runs once at the root. On every frame
  it broadcasts the local character's pos/yaw at 15 Hz; if host, it
  broadcasts the world snapshot at 10 Hz.

## Environment / deployment

- New env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Set in Netlify project env. Set in local `.env.local` for `npm run dev`.
- Supabase project provisioned via MCP at the start of implementation.
  Realtime is enabled by default; no auth required (anonymous public
  channels via the publishable key).

## What we cut for time

- Reconnection logic — refresh on drop.
- Host transfer — host leaving ends the game.
- Synced projectiles / ray beam timing exactness — close enough is fine.
- Synced ragdoll throw position — non-host clients see the player snap-back
  to host's position once the throw finishes.
- Latency compensation / client-side prediction for remote players. We
  render remote pos directly without interpolation for v1. If it looks too
  jumpy, add lerp-to-target in a follow-up.

## Risk areas

1. **Refactoring controllers to be host-gated** without breaking single-player.
   Mitigation: `isHost` defaults to `true` when no room is joined (single-player
   mode is just "you're the host of an empty room").
2. **CombatStore is 629 lines and has many actions.** We don't refactor it.
   Host calls actions as today; non-host's incoming snapshot just *replaces*
   the relevant slices in one batched `set()`.
3. **Performance of 10Hz full-snapshot broadcasts.** Snapshots include
   the blobs array (~20 enemies × ~12 fields ≈ small, well under 4KB). Should
   be fine.

## Testing plan

- Single browser: ensure single-player still works (no regressions). Game
  starts, you control Dad, can swap to Penny/Luke as before (we keep 1/2/3
  swap when alone in room).
  - Actually correction: in MP we disable 1/2/3 swap always; in solo we
    still treat user as host but lock to chosen character. Decision: solo
    player still picks one character, the other two stand at spawn. Simpler
    code path, consistent with MP.
- Two browsers: open in two tabs/windows. Pick same mode. Each picks a
  different character. Verify both see each other move. Verify HP/aliens/
  tornado are shared (host's stats reflected on other).
- Three browsers: same as above with all three claimed.
- Four browsers: 4th lands in spectator. Verify camera follows host.
- Host disconnect: close host tab. Verify other clients see "game over,
  please refresh."
