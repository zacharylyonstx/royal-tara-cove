import { create } from 'zustand';
import {
  MAX_LEVEL,
  STARTING_LIVES,
  COOKIE_POINTS,
  MILK_POINTS,
  BONUS_POINTS,
  TUCK_POINTS_BASE,
  TUCK_POINTS_COMBO_MULT,
  POWERED_DURATION_S,
} from '../world/munchiesConfig';
import type { Difficulty } from '../world/munchiesConfig';
import { loadDifficulty, saveDifficulty } from '../world/munchiesScoreStorage';

export type SleepwalkerId = 'dad' | 'penny' | 'dog' | 'schmorgesblob';
export type SleepwalkerMode = 'normal' | 'powered' | 'tucked';

export interface PelletPosition {
  id: string;
  x: number;
  z: number;
}

export interface SleepwalkerState {
  id: SleepwalkerId;
  /** Live position (mutated in-place by SleepwalkerController; do not read in selectors). */
  x: number;
  z: number;
  yaw: number;
  /** Graph node the walker is heading toward. */
  targetNodeId: string;
  /** Anti-backtrack hint. */
  lastNodeId: string;
  mode: SleepwalkerMode;
  /** seconds (now()) when 'tucked' began. */
  tuckedAt: number;
}

interface MunchiesStore {
  level: number;                          // 1-based; ends at MAX_LEVEL
  score: number;
  lives: number;
  pellets: Record<string, PelletPosition>;
  milks: Record<string, PelletPosition>;
  bonus: { x: number; z: number; spawnedAt: number; eaten: boolean } | null;
  bonusSpawnsRemaining: number;           // counts down from 2 each level
  poweredUntil: number;                   // perf seconds; 0 if not powered
  poweredCombo: number;                   // tuck-in count this powered window
  sleepwalkers: Record<SleepwalkerId, SleepwalkerState>;
  caughtAt: number | null;                // perf seconds when player was caught
  caughtBy: SleepwalkerId | null;
  lastCaughtBy: SleepwalkerId | null;     // persists through clearCaught so game-over UI can read it
  difficulty: Difficulty;
  activeRoster: SleepwalkerId[];

  // Setters / actions
  setLevelData: (
    level: number,
    pellets: Record<string, PelletPosition>,
    milks: Record<string, PelletPosition>,
    sleepwalkers: Record<SleepwalkerId, SleepwalkerState>,
  ) => void;
  eatPellet: (id: string) => void;
  eatMilk: (id: string, now: number) => void;
  spawnBonus: (x: number, z: number, now: number) => void;
  eatBonus: () => void;
  clearBonus: () => void;
  startPowered: (now: number) => void;
  endPowered: () => void;
  tuckIn: (sleepwalkerId: SleepwalkerId, now: number) => number;
  resumeSleepwalker: (sleepwalkerId: SleepwalkerId) => void;
  setCaught: (sleepwalkerId: SleepwalkerId, now: number) => void;
  clearCaught: () => void;
  loseLife: () => void;
  setDifficulty: (d: Difficulty) => void;
  addScore: (n: number) => void;
  setActiveRoster: (ids: SleepwalkerId[]) => void;
  reset: () => void;
}

const EMPTY_SLEEPWALKERS: Record<SleepwalkerId, SleepwalkerState> = {
  dad:           { id: 'dad',           x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
  penny:         { id: 'penny',         x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
  dog:           { id: 'dog',           x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
  schmorgesblob: { id: 'schmorgesblob', x: 0, z: 0, yaw: 0, targetNodeId: '', lastNodeId: '', mode: 'normal', tuckedAt: 0 },
};

export const useMunchiesStore = create<MunchiesStore>((set, get) => ({
  level: 1,
  score: 0,
  lives: STARTING_LIVES,
  pellets: {},
  milks: {},
  bonus: null,
  bonusSpawnsRemaining: 2,
  poweredUntil: 0,
  poweredCombo: 0,
  sleepwalkers: EMPTY_SLEEPWALKERS,
  caughtAt: null,
  caughtBy: null,
  lastCaughtBy: null,
  difficulty: loadDifficulty(),
  activeRoster: ['dad', 'dog', 'penny'],

  setLevelData: (level, pellets, milks, sleepwalkers) => set({
    level, pellets, milks, sleepwalkers,
    bonus: null,
    bonusSpawnsRemaining: 2,
    poweredUntil: 0,
    poweredCombo: 0,
    caughtAt: null,
    caughtBy: null,
    lastCaughtBy: null,
  }),

  eatPellet: (id) => set((s) => {
    if (!s.pellets[id]) return s;
    const { [id]: _gone, ...rest } = s.pellets;
    return { pellets: rest, score: s.score + COOKIE_POINTS };
  }),

  eatMilk: (id, now) => set((s) => {
    if (!s.milks[id]) return s;
    const { [id]: _gone, ...rest } = s.milks;
    return {
      milks: rest,
      score: s.score + MILK_POINTS,
      poweredUntil: now + POWERED_DURATION_S,
      poweredCombo: 0,
    };
  }),

  spawnBonus: (x, z, now) => set((s) => ({
    bonus: { x, z, spawnedAt: now, eaten: false },
    bonusSpawnsRemaining: Math.max(0, s.bonusSpawnsRemaining - 1),
  })),
  eatBonus: () => set((s) => {
    if (!s.bonus || s.bonus.eaten) return s;
    return { bonus: { ...s.bonus, eaten: true }, score: s.score + BONUS_POINTS };
  }),
  clearBonus: () => set({ bonus: null }),

  startPowered: (now) => set({ poweredUntil: now + POWERED_DURATION_S, poweredCombo: 0 }),
  endPowered: () => set({ poweredUntil: 0, poweredCombo: 0 }),

  tuckIn: (sleepwalkerId, now) => {
    const s = get();
    const combo = s.poweredCombo;
    const points = TUCK_POINTS_BASE * Math.pow(TUCK_POINTS_COMBO_MULT, combo);
    set({
      sleepwalkers: {
        ...s.sleepwalkers,
        [sleepwalkerId]: { ...s.sleepwalkers[sleepwalkerId], mode: 'tucked', tuckedAt: now },
      },
      score: s.score + points,
      poweredCombo: combo + 1,
    });
    return points;
  },
  resumeSleepwalker: (sleepwalkerId) => set((s) => ({
    sleepwalkers: {
      ...s.sleepwalkers,
      [sleepwalkerId]: { ...s.sleepwalkers[sleepwalkerId], mode: 'normal', tuckedAt: 0 },
    },
  })),

  setCaught: (sleepwalkerId, now) => set({ caughtAt: now, caughtBy: sleepwalkerId, lastCaughtBy: sleepwalkerId }),
  clearCaught: () => set({ caughtAt: null, caughtBy: null }),

  loseLife: () => set((s) => ({ lives: Math.max(0, s.lives - 1) })),

  setDifficulty: (d) => {
    saveDifficulty(d);
    set({ difficulty: d });
  },
  addScore: (n) => set((s) => ({ score: s.score + n })),
  setActiveRoster: (ids) => set({ activeRoster: ids }),

  reset: () => set((s) => ({
    level: 1,
    score: 0,
    lives: STARTING_LIVES,
    pellets: {},
    milks: {},
    bonus: null,
    bonusSpawnsRemaining: 2,
    poweredUntil: 0,
    poweredCombo: 0,
    sleepwalkers: EMPTY_SLEEPWALKERS,
    caughtAt: null,
    caughtBy: null,
    lastCaughtBy: null,
    // keep difficulty + activeRoster (session-level)
    activeRoster: s.activeRoster,
    difficulty: s.difficulty,
  })),
}));

// Counts of remaining pellets / milks are derived; expose helpers.
export function selectPelletCount(s: MunchiesStore): number {
  return Object.keys(s.pellets).length;
}
export function selectIsPowered(s: MunchiesStore, now: number): boolean {
  return s.poweredUntil > now;
}
export const MUNCHIES_MAX_LEVEL = MAX_LEVEL;

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__munchies = useMunchiesStore;
}
