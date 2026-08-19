// LocalStorage for pet friendship ("Sparky… have levels of friendship" — Penny).
// One JSON blob: affection[petId][characterId] = count. Defensive load.
import type { CharacterId } from '../types';

const KEY = 'pets.v1';
const IDS: CharacterId[] = ['dad', 'penny', 'luke'];

export type Affection = Record<string, Partial<Record<CharacterId, number>>>;

export function loadAffection(): Affection {
  const out: Affection = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return out;
    const aff = (parsed as Record<string, unknown>).affection;
    if (typeof aff !== 'object' || aff === null) return out;
    for (const [petId, byRaw] of Object.entries(aff as Record<string, unknown>)) {
      if (typeof petId !== 'string' || petId.length > 40 || typeof byRaw !== 'object' || byRaw === null) continue;
      const entry: Partial<Record<CharacterId, number>> = {};
      for (const id of IDS) {
        const n = (byRaw as Record<string, unknown>)[id];
        if (typeof n === 'number' && Number.isFinite(n) && n >= 0) entry[id] = Math.min(9999, Math.floor(n));
      }
      out[petId] = entry;
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function saveAffection(affection: Affection): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ affection }));
  } catch {
    /* quota / blocked — silent no-op */
  }
}

/** Friendship tiers: New → Friend → Good Friend → Best Friend. */
export const FRIEND_LEVELS = [
  { min: 0, name: 'New', hearts: 0 },
  { min: 3, name: 'Friend', hearts: 1 },
  { min: 8, name: 'Good Friend', hearts: 2 },
  { min: 15, name: 'Best Friend', hearts: 3 },
] as const;

export function friendLevel(n: number): { level: number; name: string; hearts: number; next: number | null } {
  let level = 0;
  for (let i = 0; i < FRIEND_LEVELS.length; i++) if (n >= FRIEND_LEVELS[i].min) level = i;
  const next = level + 1 < FRIEND_LEVELS.length ? FRIEND_LEVELS[level + 1].min : null;
  return { level, name: FRIEND_LEVELS[level].name, hearts: FRIEND_LEVELS[level].hearts, next };
}

/** "♥♥♡" style badge for the prompt. */
export function heartBadge(hearts: number, max = 3): string {
  return '♥'.repeat(hearts) + '♡'.repeat(Math.max(0, max - hearts));
}
