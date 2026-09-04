import { create } from 'zustand';
import { START_DAY_FRACTION } from '../world/dayNight';

/**
 * Free Play world clock. `dayFraction` 0..1 (0 = midnight, 0.5 = noon) is the
 * only value the visuals read; DayNightController advances it. Guests ease
 * toward `netTarget` (the host's clock, from the world snapshot).
 */
interface SkyStore {
  dayFraction: number;
  /** Host's dayFraction as last received (guests only); null = no sync yet. */
  netTarget: number | null;
  /** Real-time multiplier (1 = the normal 24-minute day). DEV/testing lever. */
  speed: number;
  /** Cloud shell wind offset (uv units), accumulated by the controller. */
  cloudOffsetX: number;
  cloudOffsetY: number;
  /** DEV/testing: force cloud cover (0..1); null = the slow natural drift. */
  cloudOverride: number | null;
  setDayFraction: (f: number) => void;
  setNetTarget: (f: number | null) => void;
  setSpeed: (s: number) => void;
  /** Jump straight to a game hour (0..24). */
  setHour: (h: number) => void;
}

export const useSkyStore = create<SkyStore>((set) => ({
  dayFraction: START_DAY_FRACTION,
  netTarget: null,
  speed: 1,
  cloudOffsetX: 0,
  cloudOffsetY: 0,
  cloudOverride: null,
  setDayFraction: (f) => set({ dayFraction: ((f % 1) + 1) % 1 }),
  setNetTarget: (f) => set({ netTarget: f }),
  setSpeed: (s) => set({ speed: s }),
  setHour: (h) => set({ dayFraction: (((h / 24) % 1) + 1) % 1 }),
}));

declare global {
  interface Window { __sky?: unknown; }
}
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__sky = useSkyStore;
}
