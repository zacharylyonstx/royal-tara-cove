import { create } from 'zustand';
import type { CharacterId } from '../types';
import { pupById } from '../world/pets';

// Who adopted which pup. Local adoptions persist (adoptions.v1) so your dog is
// still yours tomorrow; peers' adoptions arrive in their PlayerStateMsg.

const KEY = 'adoptions.v1';
const IDS: CharacterId[] = ['dad', 'penny', 'luke'];

type Pets = Record<CharacterId, string | null>;

function load(): Pets {
  const out: Pets = { dad: null, penny: null, luke: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const id of IDS) {
      const v = parsed[id];
      if (typeof v === 'string' && pupById(v)) out[id] = v;
    }
  } catch {
    /* ignore */
  }
  return out;
}
function save(p: Pets): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* no-op */ }
}

interface PetStore {
  pets: Pets;
  /** Adopt (or swap to) a pup. Returns false if the pup id is unknown. */
  adopt: (owner: CharacterId, pupId: string) => boolean;
  release: (owner: CharacterId) => void;
  /** From the network: what a peer's character currently has. */
  setRemotePet: (owner: CharacterId, pupId: string | null) => void;
}

declare global {
  interface Window { __pets?: unknown; }
}

export const usePetStore = create<PetStore>((set, get) => ({
  pets: typeof localStorage !== 'undefined' ? load() : { dad: null, penny: null, luke: null },
  adopt: (owner, pupId) => {
    if (!pupById(pupId)) return false;
    const pets = { ...get().pets, [owner]: pupId };
    set({ pets });
    save(pets);
    return true;
  },
  release: (owner) => {
    const pets = { ...get().pets, [owner]: null };
    set({ pets });
    save(pets);
  },
  setRemotePet: (owner, pupId) => {
    const cur = get().pets[owner];
    const next = pupId && pupById(pupId) ? pupId : null;
    if (cur === next) return;
    // Remote state is NOT persisted here — it's their dog, saved in their browser.
    set({ pets: { ...get().pets, [owner]: next } });
  },
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__pets = usePetStore;
}
