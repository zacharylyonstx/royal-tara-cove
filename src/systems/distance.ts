import { useGameStore } from '../state/gameStore';

/**
 * True when the world XZ point is within `r` meters of the active character.
 * Used to gate per-frame work in distant decorative components — we don't
 * need to animate the cat across the street if you're at the cul-de-sac.
 */
export function isNearPlayer(x: number, z: number, r = 40): boolean {
  const id = useGameStore.getState().activeCharacterId;
  const p = useGameStore.getState().positions[id];
  const dx = x - p.x;
  const dz = z - p.z;
  return dx * dx + dz * dz < r * r;
}
