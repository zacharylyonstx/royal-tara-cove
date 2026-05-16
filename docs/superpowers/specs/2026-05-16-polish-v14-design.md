# Polish v14

Surgical pass after the FPS conversion. Four small fixes, no new files.

## Fixes

1. **Remove the front-door wreath.** The low-poly green torus at `HeroHouse10600.tsx:178` reads as a "weird green circle" at game resolution. Delete the `<Wreath ...>` call and the `function Wreath()` definition (dead after the only call site is removed).

2. **Sync active character body yaw with camera yaw.** In `CameraRig.tsx::useFrame`, after computing `yaw.current` from mouse-look, write it to the store: `yaws[activeId] = yaw.current`. Then `CombatController.getAimVectors()` (which uses `yaws[activeId]`) fires bullets and auto-aims along the camera direction — fixing "shooting feels funny" because beams now go where you're looking.

3. **Raise muzzle origin to near eye level.** Change `muzzleY = 1.1` to `muzzleY = 1.55` in both `CombatController.tsx::getAimVectors` and `::castBeamForYaw`. Beams now emanate just below the camera (1.7m) for a natural FPS look.

4. **Hide own weapon, show kids' weapons.** In `RayGun.tsx`, `PennyBomber.tsx`, `LukeLegoLauncher.tsx`, flip the visibility check from `activeId !== <owner>` (hidden, current) to `activeId === <owner>` (hidden when self, visible when NPC). New rule: weapon visible if `phase === 'combat' && activeId !== <owner>`. You don't see your own weapon floating in your face, but you can see your kids carrying theirs.

## Non-fixes (intentional)

- Vertical aim (camera pitch) doesn't affect shot direction yet — beams still go horizontally. Bigger change; defer.
- Active-character ring above other heads stays (helps find Penny/Luke).
- Wreath wasn't lit/decorated to fix as a visual; user explicitly asked to remove it.

## Test plan

1. `npm run build` clean.
2. Refresh page. Click canvas to enter FPS.
3. Walk to 10600 door — no green circle / no floating gun in the doorway.
4. Press 2 to switch to Penny — see Dad holding the ray gun (visible). Press 1 — gun disappears (you're holding it, just don't see it).
5. Shoot at a Schmorgesblob — beam emerges from near your face, hits where you're looking.
6. Look around with mouse — body rotates so beams always fire where you aim.

## Files touched

- `src/components/hero/HeroHouse10600.tsx`
- `src/systems/CameraRig.tsx`
- `src/systems/CombatController.tsx`
- `src/components/weapons/RayGun.tsx`
- `src/components/weapons/PennyBomber.tsx`
- `src/components/weapons/LukeLegoLauncher.tsx`
