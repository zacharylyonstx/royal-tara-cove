# Hero house projector (v12)

## Goal

Make the great room of 10600 feel alive by mounting a **video projector** that loops `Luke-I-guess-we-have-to-die.MOV` on the east wall. The projector autoplays silently from the moment the game loads (browser-safe). When the player enters the hero house, the audio fades up; when they walk away or leave the house, it fades down. The illusion is a real projector you can walk past, sit in front of, or hear from the next room.

This is a "cool moment" feature — replaces the existing TV in `LivingRoom.tsx`.

## Non-goals

- Subtitles / overlay UI.
- Pause / play controls for the player.
- Multiple videos / playlist support.
- Replacing any other house's TV.
- Full 3D spatial audio (left/right panning). Volume falloff only — simpler, robust across browsers, plenty for a single-room media moment.

## Asset

- Source: `/Users/zak/Luke-I-guess-we-have-to-die.MOV` (4.5MB QuickTime, typical iPhone export → h.264/AAC).
- Move to: `public/luke.mov`. Vite serves `public/*` from web root, so the URL becomes `/luke.mov`.
- Vite's `assetsInclude` does not need to change — `public/` files are not bundled, just served as-is.
- Browsers MIME-sniff the bytes; the `.mov` extension is fine for h.264-in-MOV. If the user's browser refuses to decode it, the screen goes black silently (no crash) — fallback is to transcode with `ffmpeg -i luke.mov -c:v libx264 -c:a aac -movflags +faststart luke.mp4` and rename the import. We'll see this in playtest.

## Architecture

Three new files. Single source of truth: the video element lives in one module so playback state is shared cleanly.

### `src/world/projectorMedia.ts` — media singleton

Creates exactly one `HTMLVideoElement` and one Three.js `VideoTexture` for the whole app. Subsequent calls return the same instances.

Public API:
```ts
export function getProjectorVideo(): HTMLVideoElement;
export function getProjectorTexture(): THREE.VideoTexture;
export function unmuteProjector(): void;  // call from a user-gesture handler
```

Internal setup on first call:
```ts
const v = document.createElement('video');
v.src = '/luke.mov';
v.loop = true;
v.muted = true;          // required for autoplay
v.autoplay = true;
v.playsInline = true;    // iOS Safari
v.crossOrigin = 'anonymous';  // safe default for same-origin VideoTexture
v.volume = 0;            // volume controlled by ProjectorController
void v.play();           // fire-and-forget; ignored if blocked
```

`unmuteProjector()`:
```ts
v.muted = false;
// Volume stays at whatever the controller last set.
```

The element is NOT mounted in the DOM. Three.js' `VideoTexture` reads pixel data from the detached element just fine.

### `src/components/hero/ProjectorScreen.tsx` — visible objects

A single React component, rendered once inside `Interior10600`. Renders:

**Orientation reminder:** the great room is west of the great-kitchen wall (x=-1.5). The couch is at house-local (-5.25, -4) and **faces east** toward this wall. So the screen surface must **face west** (its normal points in -X) to be visible from the couch.

1. **Screen rectangle** — `planeGeometry(2.5, 1.4)` (width × height, 16:9), positioned at `(-1.58, 1.8, -4)` with rotation `[0, -π/2, 0]` so the plane normal points in -X (west, toward couch). The wall surface is at x=-1.575; the screen sits 0.005m in front of it. Material: `meshBasicMaterial({ map: getProjectorTexture(), toneMapped: false, side: THREE.FrontSide })` so the video color isn't crushed by tone mapping and you can't see it from inside the kitchen.
2. **Screen border** — `planeGeometry(2.62, 1.52)`, same orientation, mounted at `(-1.578, 1.8, -4)` (0.002m behind the screen so the border peeks around the screen's perimeter). Matte-black `meshStandardMaterial({ color: '#1a1a1c', roughness: 0.85 })`.
3. **Projector body** — Ceiling-mounted at `(-3.5, 2.78, -4)`. `boxGeometry(0.35, 0.18, 0.5)`, dark grey (`#1a1a1c`). With a chunky lens cylinder (`cylinderGeometry(0.07, 0.07, 0.08, 16)` rotated `[0, 0, π/2]` so its long axis runs along X) attached on the +X face pointing east at the screen.
4. **Power LED** — A tiny emissive red box on top of the projector (`#e63a3a`, `emissiveIntensity 1.0`) for the "it's on" cue.
5. **Light cone** — Custom `BufferGeometry` forming a 4-sided frustum from the lens tip at `(-3.32, 2.78, -4)` to the four corners of the screen plane. Material: `meshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })`. Creates the dusty-beam look without using the video texture (simpler + always-on visual that doesn't depend on the video successfully decoding).
6. **Subtle flicker** — In `useFrame`, modulate the projector body's `emissiveIntensity` and the cone's `opacity` by `1 + 0.04 * sin(t * 24 * 2π)` (24Hz filmic flicker, ±4%).

All these meshes live inside one `<group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>` so they ride along with the rotated hero house. (Actually `Interior10600` is already wrapped in that group via `HeroHouse10600`, so this component just inherits the transform.)

### `src/systems/ProjectorController.tsx` — audio falloff loop

Headless `useFrame` component. No rendering.

On mount: resolve the hero house lot + screen world position once, cache them.

Every frame:
```ts
const dist = distanceFromPlayerToScreen();  // world space
const insideHouse = isPlayerInsideHeroHouse();

let target: number;
if (insideHouse && dist < 16) {
  // Full volume within 3m; linear ramp to 0 by 16m.
  target = Math.max(0, Math.min(0.7, 0.7 * (1 - Math.max(0, dist - 3) / 13)));
} else if (!insideHouse && dist < 8) {
  // Bleeds quietly through the wall when you're right outside.
  target = Math.max(0, Math.min(0.2, 0.2 * (1 - dist / 8)));
} else {
  target = 0;
}

video.volume = THREE.MathUtils.lerp(video.volume, target, Math.min(1, dt * 4));
```

Notes:
- **Max volume 0.7**, not 1.0 — keeps the audio comfortable on laptop speakers (avoids the "wtf this is loud" comeback).
- **Wall bleed**: if you're standing right outside the front door, you hear a faint murmur. Cuts off cleanly past 8m. Adds realism without being aggressive.
- `isPlayerInsideHeroHouse()`: world-space AABB check against the hero house bounds (width=18, depth=16) transformed by lot.houseYaw. The hero is at angleDeg=90 → yaw=0 in current data, so the AABB is axis-aligned, but we do the rotated check anyway so it survives if the hero's angle ever changes.

### `audio.ts` extension

Add one line to `unlockAudio()`:
```ts
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  unmuteProjector();  // NEW: let the video have sound now that the user has gestured
}
```

Import `unmuteProjector` from `./world/projectorMedia`. This piggy-backs on the existing first-gesture handler — no new wiring.

### Wiring changes

- `src/components/hero/Interior10600.tsx` — render `<ProjectorScreen />` once inside the IIFE return, alongside the room components.
- `src/components/hero/LivingRoom.tsx` — delete the `<TVStand />` mesh + the `function TVStand(...)`. The projector replaces it. (Couch, coffee table, floor lamp, bookshelf, ceiling fan all stay.)
- `src/components/Game.tsx` — add `<ProjectorController />` next to the other top-level controllers (e.g., after `<MusicController />`).

## Coordinates summary (house-local)

| Object | Position | Notes |
|--------|----------|-------|
| Screen plane center | x = -1.58, y = 1.8, z = -4 | normal points -X (faces couch) |
| Screen size | 2.5 × 1.4 (16:9) | |
| Projector body | x = -3.5, y = 2.78, z = -4 | hangs from ceiling (ceiling at 2.95) |
| Projector lens tip | x = -3.32, y = 2.78, z = -4 | +X face of body |
| Light cone | lens tip → screen corners | additive blend, 7% opacity |

## Edge cases & answers

| Concern | Handling |
|---------|----------|
| Browser can't decode .mov | Screen renders black (texture has no frames); no crash. Light cone still visible. Fallback: transcode to .mp4 manually with `ffmpeg`. |
| Autoplay blocked entirely | `play()` returns rejected Promise → caught with `.catch(() => {})`. Video stays at first frame; resumes on next `unlockAudio()` gesture (we'll also call `v.play()` again inside `unmuteProjector()`). |
| iPhone rotation metadata | HTMLVideoElement handles orientation correctly; VideoTexture shows what the user sees on QuickTime. No manual flip needed. |
| Video on the projector body collider | Projector body is at y=2.78 with player height ~1.7; player can't walk into it. No collider needed. |
| Screen on the wall | Already covered by the existing great-kitchen interior collider; no separate screen collider needed. |
| Performance | VideoTexture uploads ~30 frames/sec to GPU. At 4.5MB and h.264, this is cheap on any modern device. Verified by `npm run build` + 60fps playtest. |
| Audio leak during combat phase | Out of scope. Future polish could fade projector volume to 0 when `combatPhase !== 'peaceful'`. YAGNI for v1. |
| Player loads game, hears nothing because no gesture yet | Expected & correct behavior. The very first `unlockAudio()` call (which happens on movement keypress / mouse click) unmutes. |

## Test plan

1. Start dev server. Open `localhost:5175/`. Click anywhere (movement, click) — that's the gesture.
2. Walk to the hero house front door. As you approach, no projector audio yet (you're still outside the falloff range).
3. Walk through the door. Audio fades up over ~250ms as you get closer to the screen.
4. Stand in front of the screen (couch position). Video should be visible, audio at full (0.7).
5. Walk to Luke's bedroom (~10m from screen). Audio drops to ~50%.
6. Walk out the patio slider into the back yard. Audio fades to 0 cleanly within 8m of the back wall.
7. Walk to the cul-de-sac. Silence.
8. Walk back inside. Audio fades back up.
9. Look up at the projector body — power LED is on, subtle flicker visible. Light cone visible from projector to screen.
10. `npm run build` clean.

## Files touched

**New:**
- `src/world/projectorMedia.ts`
- `src/components/hero/ProjectorScreen.tsx`
- `src/systems/ProjectorController.tsx`

**Modified:**
- `src/audio.ts` — `unlockAudio` calls `unmuteProjector`
- `src/components/hero/Interior10600.tsx` — render `<ProjectorScreen />`
- `src/components/hero/LivingRoom.tsx` — delete TVStand
- `src/components/Game.tsx` — mount `<ProjectorController />`

**Asset:**
- `public/luke.mov` (moved from `/Users/zak/Luke-I-guess-we-have-to-die.MOV`)
