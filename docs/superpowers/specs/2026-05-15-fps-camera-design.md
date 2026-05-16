# First-person camera (v13)

## Goal

Replace the 3rd-person follow camera with a true first-person view: camera sits at the active character's eye level, mouse-look via Pointer Lock, the player's own body is hidden so it doesn't block the view. Goal is "easier to see and walk around" — particularly inside the hero house, where the 3rd-person camera fights with walls.

## Non-goals

- Toggle between 1st and 3rd person.
- Head bob / breathing animation.
- Visible held weapon / hands (existing weapons still render at their world positions; you just don't see your own arms).
- Cinematic intro / victory cam changes — those use the existing `cinematic` override in CameraRig and keep working unchanged.

## Architecture

Two file rewrites + one one-line tweak. No new files.

### `src/systems/CameraRig.tsx` (rewrite)

Replace the spherical orbit rig with a head-mounted FPS rig.

**State (refs):**
- `yaw`, `pitch` — mouse-accumulator angles (radians)
- `locked` — true when pointer is captured

**Event handlers (mounted on canvas via `useEffect`):**
- `click` on canvas → if `!locked`, call `gl.domElement.requestPointerLock()`. Skipped while the welcome screen is open (read `useGameStore.getState().welcomeOpen` first).
- `pointerlockchange` on document → update `locked.current` from `document.pointerLockElement === gl.domElement`.
- `mousemove` on document → if `locked.current`:
  - `yaw.current -= e.movementX * SENS` (SENS = 0.0022)
  - `pitch.current -= e.movementY * SENS`
  - clamp pitch to `[-π/2 + 0.1, π/2 - 0.1]`

Wheel zoom and drag-look listeners from the old rig are removed.

**`useFrame` body:**
1. **Cinematic override preserved verbatim** — first check. If `cinematic.active`, lerp camera to `cin.camera*` and `lookAt(cin.target*)`, return. (Identical to current behavior — copy this block as-is from the old CameraRig.)
2. Read active character position from store. Camera position = `(pos.x, pos.y + EYE_HEIGHT, pos.z)` where `EYE_HEIGHT = 1.7`.
3. Build the look quaternion from yaw + pitch using Euler `'YXZ'`:
   ```ts
   const e = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ');
   camera.quaternion.setFromEuler(e);
   ```
4. **Camera shake preserved** — apply `(randX, randY, randZ) * shake * 0.4` offset to position. (Lower amplitude than the old 0.6 because the camera is closer to the action in 1st person.)
5. Decay the shake via `decayShake(dt)`.

**`PlayerController` is unchanged.** It already uses `camera.getWorldDirection()` to compute the WASD forward vector, so movement automatically follows the new camera direction. (Confirmed by reading `src/systems/PlayerController.tsx:78`.)

**Removed:** distance, MIN_DIST, MAX_DIST, the wheel handler, the unclipCamera call, the relax-behind logic, the LERP_SPEED smoothing of cam state (mouse-look is unfiltered for crisp FPS feel — only the cinematic override lerps).

### `src/components/Character.tsx` (one-line edit)

Find the top-level `<group ref={groupRef}>` (around line 63) and add `visible={!isActive}`:

```tsx
<group ref={groupRef} visible={!isActive}>
```

The character still **exists** for animation refs, collision, weapon spawn origins, etc. — only the visual is hidden for the active POV. Switching characters with `1/2/3` re-shows the previously-active one and hides the newly-active one automatically.

### `src/App.tsx` (one-line edit)

Bump FOV from 55° to 80° for FPS comfort:

```tsx
camera={{ position: [0, 8, -100], fov: 80, near: 0.1, far: 600 }}
```

(55° is cinema-y; 80° is the FPS sweet spot. Near clip stays 0.1.)

### `src/ui/` (tiny hint)

Add a small fixed-position hint near the bottom of the screen: `🖱 click to look · WASD to move`. Visible only when pointer is NOT locked. Disappears the moment lock engages. Implementation: extend or create a small overlay component (whatever pattern the existing UI uses — e.g., the WaveBanner). Read `document.pointerLockElement` once per frame OR subscribe to `pointerlockchange`. Hidden during welcome screen too.

## Edge cases

| Concern | Handling |
|---------|----------|
| Welcome screen open at startup | Click handler bails early if `welcomeOpen` true. After welcome closes, the next click locks. |
| ESC during gameplay | Browser releases pointer lock automatically. `locked` becomes false. Hint reappears. Player clicks to re-engage. |
| Character switch (1/2/3) | New active character's body hides; old one re-appears. Yaw/pitch persist across switch — camera snaps to new head height. |
| Cinematic intro / victory | Preserved as-is (the cinematic block in useFrame is copied verbatim). When cinematic ends, the next frame uses the new FPS position. |
| Looking through walls | EYE_HEIGHT 1.7 sits well below ceiling (2.95) and well above floor. Player collider already prevents body from intersecting walls; eye is inside the player's head so no clipping. |
| Auto-aim / projectile firing | Unchanged — both use `camera.getWorldDirection()`. |
| Slow-mo, sky cycle, audio | Unchanged. |

## Files touched

**Modified:**
- `src/systems/CameraRig.tsx` (full rewrite)
- `src/components/Character.tsx` (one-line edit)
- `src/App.tsx` (FOV one-line edit)
- One UI file (existing or new) for the "click to look" hint

## Test plan

1. Load `localhost:5175/`. Welcome screen visible — mouse cursor visible, can interact normally with HTML.
2. Click "Let's play". Welcome closes.
3. Hint visible at bottom: `🖱 click to look · WASD to move`.
4. Click the canvas. Cursor disappears. Hint disappears. Now in pointer-lock FPS mode.
5. Move mouse — view turns freely in all directions (yaw + pitch). Pitch clamped (can't fully invert).
6. WASD walks in the direction you're looking.
7. Walk to 10600's front door, open it, walk in.
8. Look around the great room. Walk to the couch — see the projector screen at eye level.
9. Walk through doors into bedrooms; the body never blocks the view because the body is invisible.
10. Press `1/2/3` to switch character — head height stays, view stays smooth.
11. Press ESC. Cursor reappears, hint reappears.
12. Click again — back in pointer-lock.
13. UFO crash cinematic still plays correctly (cinematic block preserved).
14. `npm run build` clean.
