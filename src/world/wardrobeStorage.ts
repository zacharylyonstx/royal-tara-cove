// LocalStorage for wardrobe choices — one JSON blob with all three characters'
// dress-up appearances AND their Real-Me cosmetics. Defensive load (bad/missing
// → defaults). Backward-compatible with the old appearances-only format.
import type { CharacterId } from '../types';
import { type Appearance, defaultAppearance, SLOTS, getItem } from './wardrobe';
import { type RealLook, REAL_SLOTS, defaultRealLook, getRealItem } from './realLooks';

const KEY = 'wardrobe.v1';
const IDS: CharacterId[] = ['dad', 'penny', 'luke'];

type Persisted = Record<CharacterId, Appearance>;
export type PersistedReal = Record<CharacterId, RealLook>;

function sanitize(id: CharacterId, raw: unknown): Appearance {
  const base = defaultAppearance(id);
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;
  for (const slot of SLOTS) {
    const choice = r[slot];
    if (typeof choice === 'object' && choice !== null) {
      const c = choice as Record<string, unknown>;
      if (typeof c.item === 'string') {
        const item = getItem(slot, c.item);
        base[slot].item = item.id;
        if (typeof c.color === 'string') base[slot].color = c.color;
      }
    }
  }
  return base;
}

function sanitizeReal(raw: unknown): RealLook {
  const base = defaultRealLook();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;
  for (const slot of REAL_SLOTS) {
    const choice = r[slot];
    if (typeof choice === 'object' && choice !== null) {
      const c = choice as Record<string, unknown>;
      if (typeof c.item === 'string') {
        const item = getRealItem(slot, c.item);
        base[slot].item = item.id;
        if (typeof c.color === 'string') base[slot].color = c.color;
      }
    }
  }
  return base;
}

function readBlob(): Record<string, unknown> {
  try {
    const rawStr = localStorage.getItem(KEY);
    if (rawStr) return JSON.parse(rawStr) as Record<string, unknown>;
  } catch { /* ignore */ }
  return {};
}

export function loadWardrobe(): Persisted {
  const parsed = readBlob();
  // New format: { a: appearances, r: realLooks }. Legacy: appearances at root.
  const ap = (parsed.a && typeof parsed.a === 'object' ? parsed.a : parsed) as Record<string, unknown>;
  const out = {} as Persisted;
  for (const id of IDS) out[id] = sanitize(id, ap[id]);
  return out;
}

export function loadRealLooks(): PersistedReal {
  const parsed = readBlob();
  const rl = (parsed.r && typeof parsed.r === 'object' ? parsed.r : {}) as Record<string, unknown>;
  const out = {} as PersistedReal;
  for (const id of IDS) out[id] = sanitizeReal(rl[id]);
  return out;
}

export function saveWardrobe(appearances: Persisted, realLooks?: PersistedReal): void {
  try {
    // Preserve whichever half isn't being written this call.
    const existingReal = realLooks ?? loadRealLooks();
    localStorage.setItem(KEY, JSON.stringify({ a: appearances, r: existingReal }));
  } catch {
    /* quota / blocked — silent no-op */
  }
}
