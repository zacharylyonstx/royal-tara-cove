// LocalStorage for wardrobe choices — one JSON blob, all three characters'
// appearances. Mirrors treehouseStorage. Defensive load (bad/missing → defaults).
import type { CharacterId } from '../types';
import { type Appearance, defaultAppearance, SLOTS, getItem } from './wardrobe';

const KEY = 'wardrobe.v1';
const IDS: CharacterId[] = ['dad', 'penny', 'luke'];

type Persisted = Record<CharacterId, Appearance>;

function sanitize(id: CharacterId, raw: unknown): Appearance {
  const base = defaultAppearance(id);
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;
  for (const slot of SLOTS) {
    const choice = r[slot];
    if (typeof choice === 'object' && choice !== null) {
      const c = choice as Record<string, unknown>;
      if (typeof c.item === 'string') {
        // Only accept item ids that exist in the catalog for this slot.
        const item = getItem(slot, c.item);
        base[slot].item = item.id;
        if (typeof c.color === 'string') base[slot].color = c.color;
      }
    }
  }
  return base;
}

export function loadWardrobe(): Persisted {
  const out = {} as Persisted;
  let parsed: Record<string, unknown> = {};
  try {
    const rawStr = localStorage.getItem(KEY);
    if (rawStr) parsed = JSON.parse(rawStr) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  for (const id of IDS) out[id] = sanitize(id, parsed[id]);
  return out;
}

export function saveWardrobe(appearances: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(appearances));
  } catch {
    /* quota / blocked — silent no-op */
  }
}
