# Hero House Projector (v12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount a cinematic video projector on the great-room wall of 10600 — autoplays muted, audio fades up when the player enters the house and down when they leave.

**Architecture:** One asset (`public/luke.mov`). One media singleton (`projectorMedia.ts`) holding the `HTMLVideoElement` + `VideoTexture`. One scene component (`ProjectorScreen.tsx`) rendering the screen, border, projector body, lens, LED, and light cone. One headless controller (`ProjectorController.tsx`) running a `useFrame` loop that lerps `video.volume` based on player distance. Audio is unmuted via the existing `unlockAudio()` first-gesture handler.

**Tech Stack:** React 19, React Three Fiber, Three.js (`VideoTexture`, `AdditiveBlending`), HTMLVideoElement, Vite. No test framework; verification is `npm run build` + manual playtest at `http://localhost:5175/`.

---

## File Structure

**New:**
- `public/luke.mov` — the video asset (moved from `/Users/zak/Luke-I-guess-we-have-to-die.MOV`)
- `src/world/projectorMedia.ts` — media singleton: video element + texture + unmute helper
- `src/components/hero/ProjectorScreen.tsx` — scene: screen, border, body, lens, LED, light cone, flicker
- `src/systems/ProjectorController.tsx` — headless `useFrame` audio falloff

**Modified:**
- `src/audio.ts` — `unlockAudio()` calls `unmuteProjector()`
- `src/components/hero/Interior10600.tsx` — render `<ProjectorScreen />` once
- `src/components/hero/LivingRoom.tsx` — delete TVStand mesh + function
- `src/components/Game.tsx` — mount `<ProjectorController />`

---

## Task 1: Move the asset into `public/`

**Files:**
- Move: `/Users/zak/Luke-I-guess-we-have-to-die.MOV` → `/Users/zak/Game/public/luke.mov`

- [ ] **Step 1: Move the file**

Run:

```bash
mv "/Users/zak/Luke-I-guess-we-have-to-die.MOV" "/Users/zak/Game/public/luke.mov"
```

- [ ] **Step 2: Verify it's served**

The dev server (already running at `http://localhost:5175/`) reloads `public/` automatically. Open a new tab in any browser and visit:

```
http://localhost:5175/luke.mov
```

Expected: the video plays in the browser's built-in video viewer (or downloads, depending on browser). Either response confirms Vite is serving it. If the browser shows a "Can't play" error, the codec is incompatible — fall back: install ffmpeg (`brew install ffmpeg`), transcode with `ffmpeg -i "/Users/zak/Game/public/luke.mov" -c:v libx264 -c:a aac -movflags +faststart "/Users/zak/Game/public/luke.mp4"`, and update the URL in Task 2 from `/luke.mov` to `/luke.mp4`.

- [ ] **Step 3: Commit**

```bash
cd /Users/zak/Game && git add public/luke.mov && git commit -m "Royal Tara Cove: v12 — add projector video asset"
```

Note: this commits a 4.5MB binary. Acceptable given the project's solo-developer / shipped-asset usage. If `.gitattributes` later sets up LFS, this can be migrated.

---

## Task 2: Create the projector media singleton

**Files:**
- Create: `src/world/projectorMedia.ts`

- [ ] **Step 1: Create `src/world/projectorMedia.ts`**

```typescript
import * as THREE from 'three';

// Singleton HTMLVideoElement + Three.js VideoTexture for the hero house projector.
// One instance shared across the whole app: the screen mesh, the audio
// controller, and any future consumers all read from the same playback state.
//
// The element is NOT mounted in the DOM. VideoTexture reads frames from a
// detached <video> just fine, and detaching keeps the element invisible to
// any browser UI (no PiP / context menu surprises).
//
// Autoplay rules:
//   - muted + autoplay + playsInline → allowed by every modern browser
//   - sound requires a user gesture → unmuted by unmuteProjector(), called
//     from audio.ts::unlockAudio() on the player's first interaction

const VIDEO_URL = '/luke.mov';

let videoEl: HTMLVideoElement | null = null;
let texture: THREE.VideoTexture | null = null;

function ensure(): { video: HTMLVideoElement; texture: THREE.VideoTexture } {
  if (videoEl && texture) return { video: videoEl, texture };
  const v = document.createElement('video');
  v.src = VIDEO_URL;
  v.loop = true;
  v.muted = true;
  v.autoplay = true;
  v.playsInline = true;
  v.crossOrigin = 'anonymous';
  v.volume = 0;
  // Fire-and-forget; browsers reject the Promise if autoplay is blocked
  // even with muted=true (rare). The first unmuteProjector() call retries.
  v.play().catch(() => {});

  const t = new THREE.VideoTexture(v);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;

  videoEl = v;
  texture = t;
  return { video: v, texture: t };
}

export function getProjectorVideo(): HTMLVideoElement {
  return ensure().video;
}

export function getProjectorTexture(): THREE.VideoTexture {
  return ensure().texture;
}

/** Called from a user-gesture handler. Lets the video produce audio. */
export function unmuteProjector(): void {
  const { video } = ensure();
  video.muted = false;
  // Volume stays where the controller set it; if it's currently 0, audio
  // stays inaudible until the controller raises it (e.g. player walks in).
  // Retry play() in case autoplay was blocked at construction.
  video.play().catch(() => {});
}
```

- [ ] **Step 2: Verify the file compiles**

Run from `/Users/zak/Game`: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
cd /Users/zak/Game && git add src/world/projectorMedia.ts && git commit -m "Royal Tara Cove: v12 — add projector media singleton"
```

---

## Task 3: Build the projector scene component

**Files:**
- Create: `src/components/hero/ProjectorScreen.tsx`

- [ ] **Step 1: Create `src/components/hero/ProjectorScreen.tsx`**

```typescript
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getProjectorTexture } from '../../world/projectorMedia';

// House-local coordinates. Great-kitchen wall sits at x = -1.5 (wall mesh
// thickness 0.15 → spans x = -1.575..-1.425). Couch is at (-5.25, -4) in
// the great room and faces east toward this wall. The screen surface
// must therefore point WEST (its normal in -X) to be visible from the couch.

const SCREEN_W = 2.5;
const SCREEN_H = 1.4;
const SCREEN_X = -1.58;   // 0.005m west of the wall surface (-1.575)
const SCREEN_Y = 1.8;     // eye level
const SCREEN_Z = -4;      // centered in the great room (z = -8..0)

const PROJECTOR_X = -3.5;
const PROJECTOR_Y = 2.78; // just below ceiling (2.95) so the lens reads
const PROJECTOR_Z = -4;
const PROJECTOR_BODY_W = 0.35; // along X
const PROJECTOR_BODY_H = 0.18; // along Y
const PROJECTOR_BODY_D = 0.5;  // along Z
const LENS_LEN = 0.08;
const LENS_RAD = 0.07;
const LENS_TIP_X = PROJECTOR_X + PROJECTOR_BODY_W / 2 + LENS_LEN; // -3.245

export function ProjectorScreen() {
  const projectorMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const coneMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const ledMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Build the screen video texture (singleton, shared with the audio controller).
  const videoTex = useMemo(() => getProjectorTexture(), []);

  // Build the light cone: 4 triangles fanning from the lens tip to the
  // four screen corners. Additive-blended, opacity ~7% for a dusty beam.
  const coneGeom = useMemo(() => buildConeGeometry(), []);

  // Subtle filmic flicker — bumps emissive on body + opacity on cone at 24Hz.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flicker = 1 + 0.04 * Math.sin(t * 24 * 2 * Math.PI);
    if (projectorMatRef.current) projectorMatRef.current.emissiveIntensity = 0.25 * flicker;
    if (coneMatRef.current) coneMatRef.current.opacity = 0.07 * flicker;
    if (ledMatRef.current) ledMatRef.current.emissiveIntensity = 1.0 * flicker;
  });

  return (
    <group>
      {/* Black matte border behind the screen (slightly larger so it peeks around) */}
      <mesh position={[SCREEN_X + 0.002, SCREEN_Y, SCREEN_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SCREEN_W + 0.12, SCREEN_H + 0.12]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.85} side={THREE.FrontSide} />
      </mesh>

      {/* The video screen itself — normal points -X (faces couch) */}
      <mesh position={[SCREEN_X, SCREEN_Y, SCREEN_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial map={videoTex} toneMapped={false} side={THREE.FrontSide} />
      </mesh>

      {/* Light cone — additive-blended dusty beam from lens to screen */}
      <mesh geometry={coneGeom}>
        <meshBasicMaterial
          ref={coneMatRef}
          color="#fff0c8"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Projector body */}
      <mesh position={[PROJECTOR_X, PROJECTOR_Y, PROJECTOR_Z]} castShadow>
        <boxGeometry args={[PROJECTOR_BODY_W, PROJECTOR_BODY_H, PROJECTOR_BODY_D]} />
        <meshStandardMaterial
          ref={projectorMatRef}
          color="#1a1a1c"
          roughness={0.7}
          emissive="#3a3a3c"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Lens cylinder — long axis along X, pointing east toward the screen */}
      <mesh
        position={[PROJECTOR_X + PROJECTOR_BODY_W / 2 + LENS_LEN / 2, PROJECTOR_Y, PROJECTOR_Z]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[LENS_RAD, LENS_RAD, LENS_LEN, 16]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Lens glass — tiny disc on the +X face of the cylinder */}
      <mesh
        position={[LENS_TIP_X + 0.001, PROJECTOR_Y, PROJECTOR_Z]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <circleGeometry args={[LENS_RAD * 0.85, 16]} />
        <meshStandardMaterial color="#fff0c8" emissive="#fff0c8" emissiveIntensity={1.4} />
      </mesh>

      {/* Power LED on top of the projector */}
      <mesh position={[PROJECTOR_X + 0.1, PROJECTOR_Y + PROJECTOR_BODY_H / 2 + 0.01, PROJECTOR_Z + 0.15]}>
        <boxGeometry args={[0.03, 0.01, 0.03]} />
        <meshStandardMaterial
          ref={ledMatRef}
          color="#e63a3a"
          emissive="#e63a3a"
          emissiveIntensity={1.0}
        />
      </mesh>
    </group>
  );
}

function buildConeGeometry(): THREE.BufferGeometry {
  // 5 vertices: lens tip + 4 screen corners. 4 triangles fanning from tip
  // to adjacent corner pairs forming the lateral surface (open at the
  // screen end; no cap — the screen mesh covers it).
  const tip: [number, number, number] = [LENS_TIP_X, PROJECTOR_Y, PROJECTOR_Z];
  const halfW = SCREEN_W / 2;
  const halfH = SCREEN_H / 2;
  // Screen corners ordered: top-back (+Z), top-front (-Z), bottom-front (-Z), bottom-back (+Z)
  // (Z is the variable axis since the screen normal is -X.)
  const corners: Array<[number, number, number]> = [
    [SCREEN_X, SCREEN_Y + halfH, SCREEN_Z + halfW],
    [SCREEN_X, SCREEN_Y + halfH, SCREEN_Z - halfW],
    [SCREEN_X, SCREEN_Y - halfH, SCREEN_Z - halfW],
    [SCREEN_X, SCREEN_Y - halfH, SCREEN_Z + halfW],
  ];
  // 4 triangles: (tip, c0, c1), (tip, c1, c2), (tip, c2, c3), (tip, c3, c0)
  const pos: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    pos.push(...tip, ...a, ...b);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.computeVertexNormals();
  return geom;
}
```

- [ ] **Step 2: Verify the file compiles**

Run from `/Users/zak/Game`: `npm run build`
Expected: success. (No one renders `<ProjectorScreen />` yet — that lands in Task 5.)

- [ ] **Step 3: Commit**

```bash
cd /Users/zak/Game && git add src/components/hero/ProjectorScreen.tsx && git commit -m "Royal Tara Cove: v12 — projector scene component (screen, body, lens, light cone)"
```

---

## Task 4: Build the audio falloff controller

**Files:**
- Create: `src/systems/ProjectorController.tsx`

Read the existing position-tracking pattern from a neighboring system to be sure about the player-position API. Inspect, for example, the first ~80 lines of `src/systems/PlayerController.tsx` or one of the other systems:

```bash
grep -l "useCombatStore\|positions\[" /Users/zak/Game/src/systems/*.tsx | head -3
```

The codebase keeps mutable per-character positions in a Zustand store. The pattern used elsewhere is `useCombatStore.getState().positions[activeId]` returning a `{ x, y, z }`-like record (or a Three.js `Vector3`). Adopt the same pattern.

- [ ] **Step 1: Create `src/systems/ProjectorController.tsx`**

```typescript
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HOUSES } from '../world/houses';
import { buildLots } from '../world/lots';
import { getProjectorVideo } from '../world/projectorMedia';
import { useCombatStore } from '../state/combatStore';

// Audio falloff for the great-room projector. Headless: no rendering.
//
// Distance curve:
//   inside hero house: full (0.7) within 3m of screen → 0 at 16m, linear
//   outside hero house: faint bleed (max 0.2) within 8m, then silent
//
// Volume is lerped each frame for a smooth ~250ms fade.

const MAX_VOLUME_INSIDE = 0.7;
const MAX_VOLUME_BLEED = 0.2;
const INSIDE_FULL_RADIUS = 3;
const INSIDE_SILENT_RADIUS = 16;
const BLEED_SILENT_RADIUS = 8;
const FADE_RATE = 4; // per second

export function ProjectorController() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeId = useCombatStore((s) => s.activeId);
  const positions = useCombatStore((s) => s.positions);

  // Resolve the hero house lot and the screen's world position once.
  const setup = useMemo(() => {
    const hero = HOUSES.find((h) => h.isHero);
    if (!hero) return null;
    const lots = buildLots(HOUSES);
    const lot = lots.find((l) => l.address === hero.address);
    if (!lot) return null;

    // Screen plane center in house-local space (matches ProjectorScreen.tsx)
    const localScreen = new THREE.Vector3(-1.58, 1.8, -4);
    // Transform to world: rotate by houseYaw around Y, then translate by housePivot.
    const cy = Math.cos(lot.houseYaw);
    const sy = Math.sin(lot.houseYaw);
    const screenWorld = new THREE.Vector3(
      lot.housePivot[0] + localScreen.x * cy + localScreen.z * sy,
      localScreen.y,
      lot.housePivot[1] - localScreen.x * sy + localScreen.z * cy,
    );

    // House AABB in HOUSE-LOCAL space: x = -halfW..+halfW, z = -halfD..+halfD
    const halfW = hero.width / 2;
    const halfD = hero.depth / 2;
    return { lot, screenWorld, halfW, halfD };
  }, []);

  // Lazily resolve the video element once it exists.
  useEffect(() => {
    videoRef.current = getProjectorVideo();
  }, []);

  useFrame((_state, dt) => {
    const video = videoRef.current;
    if (!video || !setup) return;
    const pos = positions[activeId];
    if (!pos) return;

    const { lot, screenWorld, halfW, halfD } = setup;

    // World-space distance from player to screen.
    const dx = pos.x - screenWorld.x;
    const dy = (pos.y ?? 0) + 1.5 - screenWorld.y; // ear height
    const dz = pos.z - screenWorld.z;
    const dist = Math.hypot(dx, dy, dz);

    // Is the player inside the hero house? Transform world → house-local, AABB check.
    const lx = (pos.x - lot.housePivot[0]) * Math.cos(-lot.houseYaw) - (pos.z - lot.housePivot[1]) * Math.sin(-lot.houseYaw);
    const lz = (pos.x - lot.housePivot[0]) * Math.sin(-lot.houseYaw) + (pos.z - lot.housePivot[1]) * Math.cos(-lot.houseYaw);
    const inside = lx > -halfW && lx < halfW && lz > -halfD && lz < halfD;

    let target: number;
    if (inside && dist < INSIDE_SILENT_RADIUS) {
      const t = 1 - Math.max(0, dist - INSIDE_FULL_RADIUS) / (INSIDE_SILENT_RADIUS - INSIDE_FULL_RADIUS);
      target = MAX_VOLUME_INSIDE * Math.max(0, Math.min(1, t));
    } else if (!inside && dist < BLEED_SILENT_RADIUS) {
      const t = 1 - dist / BLEED_SILENT_RADIUS;
      target = MAX_VOLUME_BLEED * Math.max(0, Math.min(1, t));
    } else {
      target = 0;
    }

    const k = Math.min(1, dt * FADE_RATE);
    video.volume = THREE.MathUtils.lerp(video.volume, target, k);
  });

  return null;
}
```

- [ ] **Step 2: Resolve store shape**

The exact paths (`useCombatStore`, `state/combatStore`, `s.activeId`, `s.positions`) might differ. Confirm by grepping:

```bash
grep -rn "export.*useCombatStore\|state/combatStore\|state/" /Users/zak/Game/src/state/ /Users/zak/Game/src/systems/PlayerController.tsx /Users/zak/Game/src/systems/CameraRig.tsx 2>/dev/null | head -20
```

If the store path or field names differ, update the `import` and the field accesses in the code above. The pattern (resolve active character's position each frame, do distance math) doesn't change.

- [ ] **Step 3: Verify the file compiles**

Run from `/Users/zak/Game`: `npm run build`
Expected: success.

If TypeScript complains about the store shape (e.g., `positions` is not a Record but a Map, or `activeId` is named differently), fix inline using the actual store API. The neighboring `PlayerController.tsx` and `CameraRig.tsx` files are the source of truth.

- [ ] **Step 4: Commit**

```bash
cd /Users/zak/Game && git add src/systems/ProjectorController.tsx && git commit -m "Royal Tara Cove: v12 — projector audio falloff controller"
```

---

## Task 5: Wire everything into the existing scene + audio

**Files:**
- Modify: `src/audio.ts`
- Modify: `src/components/hero/Interior10600.tsx`
- Modify: `src/components/hero/LivingRoom.tsx`
- Modify: `src/components/Game.tsx`

Four small edits in one commit — they're a single logical change ("plug the projector in").

- [ ] **Step 1: Extend `audio.ts::unlockAudio` to unmute the projector**

In `src/audio.ts`, add the import and one line to `unlockAudio`.

Find this block (around lines 16-20):

```typescript
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
}
```

Replace with:

```typescript
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  unmuteProjector();
}
```

And add the import at the top of the file (after the existing imports — there may be none; if so, add as the first line):

```typescript
import { unmuteProjector } from './world/projectorMedia';
```

- [ ] **Step 2: Render the projector in `Interior10600.tsx`**

In `src/components/hero/Interior10600.tsx`, add the import:

```typescript
import { ProjectorScreen } from './ProjectorScreen';
```

Find the IIFE return where `<LivingRoom>`, `<Kitchen>`, `<Bedroom>`, `<Bathroom>` are rendered (added in Task 4 of the v11 plan). Inside the `<>` fragment, add `<ProjectorScreen />` right after `<LivingRoom ...>`:

```typescript
return (
  <>
    <LivingRoom origin={[greatC[0], 0.13, greatC[1]]} doorCenterX={doorCenterX} />
    <ProjectorScreen />
    <Kitchen origin={[kitchenOriginX, 0.13, kitchenOriginZ]} />
    {/* ...bedrooms, bathroom unchanged */}
  </>
);
```

- [ ] **Step 3: Delete the TV from `LivingRoom.tsx`**

Open `src/components/hero/LivingRoom.tsx`. Two edits:

(a) In the `LivingRoom` component body, delete the `<TVStand ... />` line (around line 14):

```typescript
      <TVStand position={[3.0, 0, 0]} rotation={-Math.PI / 2} />
```

(b) Delete the entire `function TVStand(...)` definition (the function starts with `function TVStand(...` and ends with the matching `}`). Removing the only call site means deleting it cleans up dead code.

- [ ] **Step 4: Mount the controller in `Game.tsx`**

In `src/components/Game.tsx`, find where the other top-level controllers are mounted (`<PlayerController />`, `<MusicController />`, etc., around lines 172-183). Add the import at the top:

```typescript
import { ProjectorController } from '../systems/ProjectorController';
```

And add the component next to the other controllers (order doesn't matter):

```typescript
      <MusicController />
      <ProjectorController />
      <CameraRig />
```

- [ ] **Step 5: Verify the build**

Run from `/Users/zak/Game`: `npm run build`
Expected: success.

If TypeScript complains about anything in the four files, fix inline.

- [ ] **Step 6: Commit**

```bash
cd /Users/zak/Game && git add src/audio.ts src/components/hero/Interior10600.tsx src/components/hero/LivingRoom.tsx src/components/Game.tsx && git commit -m "Royal Tara Cove: v12 — wire projector into scene + audio unlock"
```

---

## Task 6: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full TypeScript build**

Run: `npm run build`
Expected: builds without errors.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no NEW errors vs the pre-existing baseline (the codebase has pre-existing lint errors in `WaveBanner.tsx`, `materials.ts`, and `HeroHouse10600.tsx`; do not fix those).

To check for new errors specifically, filter the output by the files this plan touched:

```bash
npm run lint 2>&1 | grep -E "projectorMedia|ProjectorScreen|ProjectorController|audio\.ts|Interior10600|LivingRoom|components/Game\.tsx" | head -30
```

If any new errors appear in files this plan modified, fix them inline.

- [ ] **Step 3: Manual playtest at `http://localhost:5175/`**

Refresh the browser. As Dad:

1. **First click anywhere** (or first key press) — this unlocks audio. `unlockAudio()` fires and the projector unmutes (volume still 0 — controller hasn't ramped yet).
2. **Walk to the hero house front door.** Stand 5m outside it. Listen — there should be a faint murmur (the wall-bleed, up to 20% volume).
3. **Walk through the door.** Audio fades up to ~60% as you stand in the foyer.
4. **Walk to the couch in the great room.** Audio at full (70%) because you're within 3m of the screen. Look at the screen — video should be playing, looping. Look up at the ceiling above the couch — projector body visible, with a faint dusty light cone reaching from lens to screen, subtle 24Hz flicker, red LED on top.
5. **Walk through the hallway to Luke's room.** Audio drops to roughly 30%.
6. **Open the patio slider, walk out to the deck.** Audio fades smoothly to 0 within ~3 seconds.
7. **Walk back inside.** Audio fades back up.
8. **Look at the screen from the kitchen side** (through the wall in spirit) — you should NOT see the video bleeding into the kitchen (back face is culled).

- [ ] **Step 4: Smoke test for regressions**

Walk through the rest of the v11 work to confirm nothing broke:

- All four back-row bedrooms still accessible from the hallway.
- Bath not in the garage.
- Trees outside every house.
- Loft above the great room not overhanging the master.

- [ ] **Step 5: If everything passes, no commit needed**

If you find a regression in steps 1-4, return to the relevant earlier Task, fix, recommit. Don't bundle multiple fixes into the verification commit.

---

## Self-review notes

- **Spec coverage:**
  - Asset move → Task 1.
  - Media singleton + autoplay rules → Task 2.
  - Screen, border, body, lens, LED, light cone, flicker → Task 3.
  - Audio falloff (max 0.7 inside, 0.2 bleed, lerp at dt*4) → Task 4.
  - `unlockAudio()` calls `unmuteProjector()` → Task 5 Step 1.
  - Render `<ProjectorScreen />` in Interior10600 → Task 5 Step 2.
  - Delete TVStand → Task 5 Step 3.
  - Mount `<ProjectorController />` in Game → Task 5 Step 4.
  - Build + walkthrough → Task 6.

- **Placeholder scan:** no TBDs. The store-shape resolution in Task 4 Step 2 is conditional, but both the happy path and the fallback (grep + adapt) are spelled out concretely. Code blocks are complete.

- **Type consistency:** `getProjectorVideo()` and `getProjectorTexture()` and `unmuteProjector()` are referenced in Tasks 3, 4, and 5 with the exact signatures defined in Task 2. `ProjectorScreen` and `ProjectorController` are exported as named values matching the import statements in Task 5.
