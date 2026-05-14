import { create } from 'zustand';

export type BlobKind = 'hopper' | 'sprinter' | 'splitter' | 'boss';

export interface Blob {
  id: number;
  kind: BlobKind;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  /** Visual scale multiplier. */
  scale: number;
  phase: number;
  hopCooldown: number;
  lastDamagedAt: number;
  variant: number;
  alive: boolean;
  deathAt: number;
  /** Boss-specific cooldowns (ignored for non-boss). */
  slamCooldown?: number;
  summonCooldown?: number;
  chargeCooldown?: number;
}

export interface GooSplat {
  id: number;
  x: number;
  z: number;
  variant: number;
  spawnedAt: number;
  /** Larger splat for boss kills. */
  scale?: number;
}

export interface Beam {
  id: number;
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
  spawnedAt: number;
  /** Color tint: 'cyan' (player), 'pink' (penny), 'green' (luke). */
  tint: 'cyan' | 'pink' | 'green';
}

export interface HitParticle {
  id: number;
  x: number; y: number; z: number;
  variant: number;
  spawnedAt: number;
}

export interface DialogueLine {
  id: number;
  speaker: 'dad' | 'penny' | 'luke';
  text: string;
  spawnedAt: number;
  duration: number;
}

export type WaveState = 'pre-waves' | 'spawning' | 'fighting' | 'cleared' | 'intermission' | 'won';

interface CombatStore {
  blobs: Blob[];
  splats: GooSplat[];
  beams: Beam[];
  hitParticles: HitParticle[];

  /** Wave manager state. */
  waveIndex: number;        // 0 before first wave, 1..3 during play
  waveState: WaveState;
  intermissionEndsAt: number;

  blobsToSpawn: { kind: BlobKind; count: number }[];
  nextBlobId: number;
  nextSplatId: number;
  nextBeamId: number;
  nextParticleId: number;
  nextDialogueId: number;
  spawnedBlobsCount: number;
  kills: number;

  /** Stats */
  gameStartedAt: number;
  shotsFired: number;
  shotsHit: number;

  /** Time-of-day 0..1, 0=noon, 0.5=sunset, 1=midnight. */
  timeOfDay: number;
  setTimeOfDay: (t: number) => void;

  /** Slow-motion factor — multiply dt by this to scale time. */
  slowMo: number;
  slowMoEndsAt: number;

  /** Dialogue queue. */
  dialogue: DialogueLine[];
  pushDialogue: (speaker: 'dad' | 'penny' | 'luke', text: string, duration?: number) => void;
  reapDialogue: (now: number) => void;

  spawnBlob: (kind: BlobKind, x: number, y: number, z: number, opts?: { variant?: number }) => void;
  damageBlob: (id: number, amount?: number) => void;
  reapDeadBlobs: (now: number) => void;
  setWave: (index: number, composition: { kind: BlobKind; count: number }[]) => void;
  setWaveState: (s: WaveState) => void;
  setIntermissionEnd: (t: number) => void;
  consumeBlobToSpawn: (kind: BlobKind) => void;

  spawnBeam: (from: [number, number, number], to: [number, number, number], tint?: Beam['tint']) => void;
  reapBeams: (now: number) => void;

  spawnHitParticle: (x: number, y: number, z: number, variant: number) => void;
  reapHitParticles: (now: number) => void;

  spawnSplat: (x: number, z: number, variant: number, scale?: number) => void;
  reapSplats: (now: number) => void;

  shake: number;
  addShake: (amount: number) => void;
  decayShake: (dt: number) => void;

  damageFlashAt: number;
  triggerDamageFlash: () => void;

  debris: { id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; spawnedAt: number; rot: number; rotSpeed: number }[];
  spawnDebris: (x: number, y: number, z: number, count?: number) => void;
  reapDebris: (now: number) => void;

  crashFlashAt: number;
  triggerCrashFlash: () => void;

  triggerSlowMo: (factor: number, duration: number) => void;
  decaySlowMo: () => void;

  recordShotFired: () => void;
  recordShotHit: () => void;

  startGame: () => void;
  reset: () => void;
}

function blobDefaultsFor(kind: BlobKind): { hp: number; scale: number } {
  switch (kind) {
    case 'hopper': return { hp: 3, scale: 1 };
    case 'sprinter': return { hp: 1, scale: 0.85 };
    case 'splitter': return { hp: 2, scale: 1.1 };
    case 'boss': return { hp: 25, scale: 3 };
  }
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  blobs: [],
  splats: [],
  beams: [],
  hitParticles: [],
  waveIndex: 0,
  waveState: 'pre-waves',
  intermissionEndsAt: 0,
  blobsToSpawn: [],
  nextBlobId: 1,
  nextSplatId: 1,
  nextBeamId: 1,
  nextParticleId: 1,
  nextDialogueId: 1,
  spawnedBlobsCount: 0,
  kills: 0,
  gameStartedAt: 0,
  shotsFired: 0,
  shotsHit: 0,

  timeOfDay: 0.15,
  setTimeOfDay: (t) => set({ timeOfDay: t }),

  slowMo: 1,
  slowMoEndsAt: 0,

  dialogue: [],
  pushDialogue: (speaker, text, duration = 3.0) => {
    const id = get().nextDialogueId;
    set((s) => ({
      nextDialogueId: id + 1,
      dialogue: [
        ...s.dialogue.filter((d) => d.speaker !== speaker), // replace previous from same speaker
        { id, speaker, text, spawnedAt: performance.now() / 1000, duration },
      ],
    }));
  },
  reapDialogue: (now) => set((s) => ({ dialogue: s.dialogue.filter((d) => now - d.spawnedAt < d.duration) })),

  spawnBlob: (kind, x, y, z, opts) => {
    const { hp, scale } = blobDefaultsFor(kind);
    const id = get().nextBlobId;
    const variant = opts?.variant ?? get().spawnedBlobsCount % 4;
    set((s) => ({
      nextBlobId: id + 1,
      spawnedBlobsCount: s.spawnedBlobsCount + 1,
      blobs: [
        ...s.blobs,
        {
          id, kind, x, y, z, hp, maxHp: hp, scale,
          phase: Math.random() * Math.PI * 2,
          hopCooldown: Math.random() * 0.5,
          lastDamagedAt: -999,
          variant, alive: true, deathAt: 0,
          slamCooldown: kind === 'boss' ? 5 : undefined,
          summonCooldown: kind === 'boss' ? 6 : undefined,
          chargeCooldown: kind === 'boss' ? 8 : undefined,
        },
      ],
    }));
  },
  damageBlob: (id, amount = 1) => {
    const now = performance.now() / 1000;
    set((s) => {
      let newKills = s.kills;
      const updated = s.blobs.map((b) => {
        if (b.id !== id || !b.alive) return b;
        const hp = Math.max(0, b.hp - amount);
        if (hp <= 0) {
          newKills++;
          return { ...b, hp: 0, alive: false, deathAt: now };
        }
        return { ...b, hp, lastDamagedAt: now };
      });
      return { blobs: updated, kills: newKills };
    });
  },
  reapDeadBlobs: (now) => {
    set((s) => ({
      blobs: s.blobs.filter((b) => b.alive || now - b.deathAt < 4),
    }));
  },
  setWave: (index, composition) =>
    set({ waveIndex: index, blobsToSpawn: composition.map((c) => ({ ...c })), spawnedBlobsCount: 0, waveState: 'spawning' }),
  setWaveState: (waveState) => set({ waveState }),
  setIntermissionEnd: (t) => set({ intermissionEndsAt: t }),
  consumeBlobToSpawn: (kind) => {
    set((s) => ({
      blobsToSpawn: s.blobsToSpawn
        .map((c) => (c.kind === kind ? { ...c, count: c.count - 1 } : c))
        .filter((c) => c.count > 0),
    }));
  },

  spawnBeam: (from, to, tint = 'cyan') => {
    const id = get().nextBeamId;
    set((s) => ({
      nextBeamId: id + 1,
      beams: [...s.beams, { id, fromX: from[0], fromY: from[1], fromZ: from[2], toX: to[0], toY: to[1], toZ: to[2], spawnedAt: performance.now() / 1000, tint }],
    }));
  },
  reapBeams: (now) => set((s) => ({ beams: s.beams.filter((b) => now - b.spawnedAt < 0.14) })),

  spawnHitParticle: (x, y, z, variant) => {
    const id = get().nextParticleId;
    set((s) => ({
      nextParticleId: id + 1,
      hitParticles: [...s.hitParticles, { id, x, y, z, variant, spawnedAt: performance.now() / 1000 }],
    }));
  },
  reapHitParticles: (now) => set((s) => ({ hitParticles: s.hitParticles.filter((p) => now - p.spawnedAt < 0.5) })),

  spawnSplat: (x, z, variant, scale = 1) => {
    const id = get().nextSplatId;
    set((s) => ({
      nextSplatId: id + 1,
      splats: [...s.splats, { id, x, z, variant, spawnedAt: performance.now() / 1000, scale }],
    }));
  },
  reapSplats: (now) => set((s) => ({ splats: s.splats.filter((p) => now - p.spawnedAt < 14) })),

  shake: 0,
  addShake: (n) => set((s) => ({ shake: Math.min(1, s.shake + n) })),
  decayShake: (dt) => {
    const cur = get().shake;
    if (cur <= 0) return;
    set({ shake: Math.max(0, cur - dt * 2.5) });
  },

  damageFlashAt: -999,
  triggerDamageFlash: () => set({ damageFlashAt: performance.now() / 1000 }),

  debris: [],
  spawnDebris: (x, y, z, count = 8) => {
    const now = performance.now() / 1000;
    set((s) => {
      const fresh = Array.from({ length: count }, (_, i) => {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 4 + Math.random() * 5;
        return {
          id: s.nextParticleId + i + 100000,
          x, y, z,
          vx: Math.cos(ang) * speed,
          vy: 6 + Math.random() * 4,
          vz: Math.sin(ang) * speed,
          spawnedAt: now,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 12,
        };
      });
      return { debris: [...s.debris, ...fresh], nextParticleId: s.nextParticleId + count };
    });
  },
  reapDebris: (now) => set((s) => ({ debris: s.debris.filter((d) => now - d.spawnedAt < 2.5) })),

  crashFlashAt: -999,
  triggerCrashFlash: () => set({ crashFlashAt: performance.now() / 1000 }),

  triggerSlowMo: (factor, duration) => set({ slowMo: factor, slowMoEndsAt: performance.now() / 1000 + duration }),
  decaySlowMo: () => {
    const now = performance.now() / 1000;
    if (get().slowMo !== 1 && now > get().slowMoEndsAt) set({ slowMo: 1 });
  },

  recordShotFired: () => set((s) => ({ shotsFired: s.shotsFired + 1 })),
  recordShotHit: () => set((s) => ({ shotsHit: s.shotsHit + 1 })),

  startGame: () => set({ gameStartedAt: performance.now() / 1000, shotsFired: 0, shotsHit: 0, kills: 0 }),

  reset: () => set({
    blobs: [], splats: [], beams: [], hitParticles: [],
    blobsToSpawn: [], spawnedBlobsCount: 0, kills: 0,
    shake: 0, damageFlashAt: -999, debris: [], crashFlashAt: -999,
    waveIndex: 0, waveState: 'pre-waves', intermissionEndsAt: 0,
    timeOfDay: 0.15, slowMo: 1, slowMoEndsAt: 0, dialogue: [],
    shotsFired: 0, shotsHit: 0, gameStartedAt: 0,
  }),
}));

export const BLOB_COLORS: { body: string; glow: string }[] = [
  { body: '#a0e84a', glow: '#5cb85c' }, // lime (hopper)
  { body: '#e26aa1', glow: '#a83a3a' }, // magenta (hopper variant)
  { body: '#5ac8e6', glow: '#3a6db0' }, // cyan (hopper variant)
  { body: '#c89adf', glow: '#7a3aa6' }, // lavender (hopper variant)
  { body: '#ff6a3a', glow: '#a82a08' }, // sprinter (orange-red)
  { body: '#a832c8', glow: '#5a1080' }, // splitter (poison purple)
  { body: '#3afff0', glow: '#1a8090' }, // boss (cyan-king)
];

export const BLOB_COLOR_FOR_KIND = (kind: BlobKind, variantIdx: number): { body: string; glow: string } => {
  if (kind === 'sprinter') return BLOB_COLORS[4];
  if (kind === 'splitter') return BLOB_COLORS[5];
  if (kind === 'boss') return BLOB_COLORS[6];
  return BLOB_COLORS[variantIdx % 4];
};

declare global {
  interface Window { __combat?: unknown; }
}
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__combat = useCombatStore;
}
