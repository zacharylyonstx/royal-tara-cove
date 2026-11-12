// A shared clock for scripted townsfolk. NPC routes are pure functions of TIME,
// so every player sees the mail carrier at the same house without syncing a
// single NPC position — the only shared input is the day clock that Free Play
// already syncs (skyStore.dayFraction).
//
// dayFraction doesn't advance at a constant rate (sunsets are slowed down for
// drama — see dayNight.clockRate), so walking speed measured against it would
// surge and crawl. realSecondsAt() integrates the rate once into a lookup table
// and returns "real seconds since midnight", which IS uniform.
import { DAY_LENGTH_REAL_SEC, clockRate, sunDirection } from './dayNight';

const N = 720;
const TABLE = new Float64Array(N + 1);
(() => {
  let acc = 0;
  for (let i = 0; i < N; i++) {
    TABLE[i] = acc;
    acc += DAY_LENGTH_REAL_SEC / N / Math.max(0.05, clockRate((i + 0.5) / N));
  }
  TABLE[N] = acc;
})();

/** Real seconds elapsed since midnight at this point of the game day. */
export function realSecondsAt(dayFraction: number): number {
  const f = ((dayFraction % 1) + 1) % 1;
  const x = f * N;
  const i = Math.min(N - 1, Math.floor(x));
  return TABLE[i] + (TABLE[i + 1] - TABLE[i]) * (x - i);
}

/** Sun elevation (degrees) — townsfolk plan their day around it. */
export function sunElevation(dayFraction: number): number {
  return sunDirection(dayFraction).elevationDeg;
}

/** Folks head indoors once the sun is this low (Siren Head comes out at −7°). */
export const NPC_HOME_BELOW_EL = -1.5;
/** …and start saying "it's getting dark" a little before that. */
export const NPC_DUSK_BELOW_EL = 6;

/** Tiny deterministic hash → [0, 1). */
export function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
