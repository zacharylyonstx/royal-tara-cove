import { create } from 'zustand';

export interface Blob {
  id: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  /** Wobble phase for animation. */
  phase: number;
  /** Cooldown until next hop. */
  hopCooldown: number;
  /** Last damage time for red-flash effect. */
  lastDamagedAt: number;
  /** Color variant 0..3 */
  variant: number;
  /** Alive flag. When false, ready to be cleaned up. */
  alive: boolean;
  /** Time-of-death used to fade out splat. */
  deathAt: number;
}

export interface GooSplat {
  id: number;
  x: number;
  z: number;
  variant: number;
  spawnedAt: number;
}

export interface Beam {
  id: number;
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
  spawnedAt: number;
}

export interface HitParticle {
  id: number;
  x: number; y: number; z: number;
  variant: number;
  spawnedAt: number;
}

interface CombatStore {
  blobs: Blob[];
  splats: GooSplat[];
  beams: Beam[];
  hitParticles: HitParticle[];
  blobsToSpawn: number;
  nextBlobId: number;
  nextSplatId: number;
  nextBeamId: number;
  nextParticleId: number;
  spawnedBlobsCount: number;
  /** Mutable kill counter for UI. */
  kills: number;

  spawnBlob: (x: number, y: number, z: number) => void;
  damageBlob: (id: number) => void;
  reapDeadBlobs: (now: number) => void;
  setBlobsToSpawn: (n: number) => void;
  consumeBlobToSpawn: () => void;

  spawnBeam: (from: [number, number, number], to: [number, number, number]) => void;
  reapBeams: (now: number) => void;

  spawnHitParticle: (x: number, y: number, z: number, variant: number) => void;
  reapHitParticles: (now: number) => void;

  spawnSplat: (x: number, z: number, variant: number) => void;
  reapSplats: (now: number) => void;

  /** Camera shake amount (0..1). Decays naturally each frame. */
  shake: number;
  addShake: (amount: number) => void;
  decayShake: (dt: number) => void;

  /** Timestamp of last player damage (for screen flash). */
  damageFlashAt: number;
  triggerDamageFlash: () => void;

  /** Crash debris — spawned at impact, flies radially. */
  debris: { id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; spawnedAt: number; rot: number; rotSpeed: number }[];
  spawnDebris: (x: number, y: number, z: number) => void;
  reapDebris: (now: number) => void;

  /** Crash flash + shock ring trigger time. */
  crashFlashAt: number;
  triggerCrashFlash: () => void;

  reset: () => void;
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  blobs: [],
  splats: [],
  beams: [],
  hitParticles: [],
  blobsToSpawn: 0,
  nextBlobId: 1,
  nextSplatId: 1,
  nextBeamId: 1,
  nextParticleId: 1,
  spawnedBlobsCount: 0,
  kills: 0,

  spawnBlob: (x, y, z) => {
    const id = get().nextBlobId;
    const variant = get().spawnedBlobsCount % 4;
    set((s) => ({
      nextBlobId: id + 1,
      spawnedBlobsCount: s.spawnedBlobsCount + 1,
      blobs: [
        ...s.blobs,
        {
          id, x, y, z, hp: 3, phase: Math.random() * Math.PI * 2,
          hopCooldown: Math.random() * 0.5, lastDamagedAt: -999,
          variant, alive: true, deathAt: 0,
        },
      ],
    }));
  },
  damageBlob: (id) => {
    const now = performance.now() / 1000;
    set((s) => ({
      blobs: s.blobs.map((b) => {
        if (b.id !== id || !b.alive) return b;
        const hp = b.hp - 1;
        if (hp <= 0) {
          return { ...b, hp: 0, alive: false, deathAt: now };
        }
        return { ...b, hp, lastDamagedAt: now };
      }),
      kills: s.blobs.find((b) => b.id === id && b.hp === 1) ? s.kills + 1 : s.kills,
    }));
  },
  reapDeadBlobs: (now) => {
    set((s) => ({
      blobs: s.blobs.filter((b) => b.alive || now - b.deathAt < 4),
    }));
  },
  setBlobsToSpawn: (n) => set({ blobsToSpawn: n, spawnedBlobsCount: 0 }),
  consumeBlobToSpawn: () => set((s) => ({ blobsToSpawn: Math.max(0, s.blobsToSpawn - 1) })),

  spawnBeam: (from, to) => {
    const id = get().nextBeamId;
    set((s) => ({
      nextBeamId: id + 1,
      beams: [...s.beams, { id, fromX: from[0], fromY: from[1], fromZ: from[2], toX: to[0], toY: to[1], toZ: to[2], spawnedAt: performance.now() / 1000 }],
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

  spawnSplat: (x, z, variant) => {
    const id = get().nextSplatId;
    set((s) => ({
      nextSplatId: id + 1,
      splats: [...s.splats, { id, x, z, variant, spawnedAt: performance.now() / 1000 }],
    }));
  },
  reapSplats: (now) => set((s) => ({ splats: s.splats.filter((p) => now - p.spawnedAt < 12) })),

  shake: 0,
  addShake: (n) => set((s) => ({ shake: Math.min(1, s.shake + n) })),
  decayShake: (dt) => {
    const cur = get().shake;
    if (cur <= 0) return;
    const next = Math.max(0, cur - dt * 2.5);
    set({ shake: next });
  },

  damageFlashAt: -999,
  triggerDamageFlash: () => set({ damageFlashAt: performance.now() / 1000 }),

  debris: [],
  spawnDebris: (x, y, z) => {
    const now = performance.now() / 1000;
    set((s) => {
      const fresh = Array.from({ length: 8 }, (_, i) => {
        const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
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
      return { debris: [...s.debris, ...fresh], nextParticleId: s.nextParticleId + 8 };
    });
  },
  reapDebris: (now) => set((s) => ({ debris: s.debris.filter((d) => now - d.spawnedAt < 2.5) })),

  crashFlashAt: -999,
  triggerCrashFlash: () => set({ crashFlashAt: performance.now() / 1000 }),

  reset: () => set({
    blobs: [], splats: [], beams: [], hitParticles: [],
    blobsToSpawn: 0, spawnedBlobsCount: 0, kills: 0,
    shake: 0, damageFlashAt: -999, debris: [], crashFlashAt: -999,
  }),
}));

export const BLOB_COLORS: { body: string; glow: string }[] = [
  { body: '#a0e84a', glow: '#5cb85c' }, // lime
  { body: '#e26aa1', glow: '#a83a3a' }, // magenta
  { body: '#5ac8e6', glow: '#3a6db0' }, // cyan
  { body: '#c89adf', glow: '#7a3aa6' }, // lavender
];

declare global {
  interface Window { __combat?: unknown; }
}
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__combat = useCombatStore;
}
