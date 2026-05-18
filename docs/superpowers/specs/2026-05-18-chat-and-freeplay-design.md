# Chat + Free-Play — Design

**Date:** 2026-05-18
**Scope:** Two features bundled in one spec because both are small.

## Feature 1: Free-play after alien victory

Add new game phase `'free-play'`. Triggered by host clicking a new
**Keep playing →** button on the VictoryScreen (aliens mode only).

- `WaveController` already exits on `phase !== 'combat'`, so no new waves.
- `BlobController` extended to early-return on `phase === 'free-play'`.
- `VictoryScreen` hides when `phase === 'free-play'`.
- Celebration components (`Fireworks`, `Confetti`, `DiscoLights`,
  `DancingBlobs`) extended to render on `phase === 'victory' || phase === 'free-play'`.
- Phase flows through existing `WorldStateMsg.phase` snapshot — non-hosts
  transition automatically when host's snapshot arrives.
- Non-hosts see the **Keep playing** button but it's disabled with text
  "(host decides)" — only the host transitions the room.

## Feature 2: Chat

Each peer can press **T** during gameplay to open a chat input. Type a
message, press **Enter** to send. Message broadcasts to every peer over a
new trystero action. Each peer renders received messages in two places: a
floating speech bubble above the sender's character (in 3D, ~6 second
duration), and a sliding chat log in the bottom-left corner (last 5 messages).

### Data

```ts
// New action payload (over trystero):
interface ChatMsg {
  id: number;          // sender-local monotonic id; combined with characterId acts as a globally unique key
  characterId: CharacterId;  // sender's claimed character
  text: string;        // up to 120 chars, trimmed
  sentAt: number;      // sender Date.now()
}

// New zustand store: chatStore
interface ChatStore {
  inputOpen: boolean;
  messages: ChatMsg[];        // last 30 received, newest last
  openInput: () => void;
  closeInput: () => void;
  appendMessage: (m: ChatMsg) => void;
  /** Returns the most recent message for a character within the last 6 seconds, or null. */
  recentBubbleFor: (characterId: CharacterId) => ChatMsg | null;
}
```

### Net layer changes (`src/net/room.ts`)

- New action `chat` registered in `joinRoom`.
- New export `broadcastChat(text: string)`. Constructs a ChatMsg using
  `useNetStore.getState().myCharacterId`, appends to local store, broadcasts.
- Spectators (no `myCharacterId`) cannot send. They can still receive.
- Receiver: `chatStore.appendMessage(msg)`.

### UI components

- **`ChatInput`** — fixed-position bottom-center input element. Renders
  only when `chatStore.inputOpen === true`. Auto-focuses on mount. Press
  Enter to send (if non-empty), Escape to cancel. Both close the input.
  When closing, `document.exitPointerLock` is no-op (PlayerController
  re-acquires on canvas click).
- **`ChatLog`** — fixed bottom-left list of last 5 messages. Each message
  fades out over 1s after 12s of life. Format: `[emoji] [name]: [text]`.
- **`SpeechBubbles`** — rendered inside the R3F Canvas. For each
  CHARACTER_ORDER, look up `chatStore.recentBubbleFor(id)`. If present,
  render a drei `<Html>` element attached at `positions[id]` + ~2.4m
  vertical offset, with a CSS bubble (white bg, rounded, point down).

### Input suppression

While `chatStore.inputOpen === true`:
- `PlayerController` early-returns in `useFrame` (no movement / no door
  toggle).
- `CombatController` early-returns (no firing).
- `CameraRig` pointer-lock click handler early-returns.

The **T** key press is captured in a global window keydown listener
mounted by `ChatInput` (registered on the `App` level so it works
regardless of focus). It only opens chat when:
- The welcome screen is closed
- The character select is closed
- The user is in a room (mode set)
- Chat isn't already open
- The key target isn't an input element (avoid recursion)

### Speech bubble visual

Above each character, an HTML billboard:

```
┌─────────────────┐
│  hi dad! 👋     │
└────────┬────────┘
         ▼      ← points at character
```

CSS pseudo-element creates the pointer. White background, 12px font,
max-width ~180px, word-wrap. Drei `<Html>` with `transform`, `distanceFactor={8}`
keeps it readable at any distance, fades nicely with depth.

## Multiplayer / network considerations

- Chat is **peer-to-peer**, not host-authoritative. Each peer sends; each
  peer receives directly. No host approval, no relay.
- Chat is **not** part of `WorldStateMsg` (which is host-broadcast). A
  late joiner won't see chat history from before they joined — acceptable
  for a family demo.
- Echo prevention: senders don't append their OWN message twice. The
  sender adds it to local store inside `broadcastChat`, before sending.
  Receivers only append messages whose `characterId !== myCharacterId`.

## What we cut

- No `/commands` (only plain text).
- No timestamps in log (just relative "ago" — actually skip even that for now).
- No persistence across reload (chat log clears).
- No emoji autocomplete (system emojis work via OS).
- No mute/block. Family use, no need.

## Risk areas

1. **Pointer lock + input focus race.** When you press T while pointer
   locked, the browser doesn't release lock automatically — but ESC does,
   and clicking elsewhere does. We'll call `document.exitPointerLock()`
   inside `openInput` so the textbox is usable.
2. **T conflicting with other keys.** WASD/Shift/Space/E/R already in use.
   T is currently free.
3. **Bubble layout when characters overlap.** Multiple bubbles stacked
   could clip. Acceptable for now.

## Testing plan

- Playwright e2e: open two tabs, claim Dad + Penny, send a chat from each.
  Verify both tabs show both messages in the log and bubble above sender.
- Aliens mode: win all three waves (or stub it). Click "Keep playing" on
  host. Verify free-play state across both tabs (no more blob spawn,
  party effects continue).
