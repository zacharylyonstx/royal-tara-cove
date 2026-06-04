// Per-house tornado damage — a plain mutable singleton (NOT a zustand store) so
// the TornadoController can ramp it every frame and House.tsx can read it in its
// useFrame hot path WITHOUT triggering React re-renders. Mirrors the touchInput
// singleton pattern. Damage ratchets UP only (a house never heals mid-storm) and
// is cleared on tornado start / replay.

/** How close (m) the funnel center must come for a house to start shedding. */
export const DAMAGE_RADIUS = 18;
/** Within this radius the house takes a direct hit → full collapse. */
export const DIRECT_HIT_RADIUS = 6;

/** address → 0..1 accumulated damage (1 = funnel core passed through it). */
const damage = new Map<string, number>();

/** Raise a house's damage toward `v` (never lowers it). */
export function rampHouseDamage(address: string, v: number): void {
  const cur = damage.get(address) ?? 0;
  if (v > cur) damage.set(address, v);
}

export function getHouseDamage(address: string): number {
  return damage.get(address) ?? 0;
}

/** Wipe all damage (tornado mode start / replay / mode switch). */
export function resetHouseDamage(): void {
  damage.clear();
}

// DEV-only: drive house damage from the console / Playwright for screenshot
// verification (the real ramp only runs on the multiplayer host).
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __houseDamage?: unknown }).__houseDamage = {
    ramp: rampHouseDamage,
    get: getHouseDamage,
    reset: resetHouseDamage,
  };
}
