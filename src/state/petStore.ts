import { create } from 'zustand';
import type { CharacterId } from '../types';
import { pupById } from '../world/pets';

// Who adopted which pup. Local adoptions persist (adoptions.v1) so your dog is
// still yours tomorrow; peers' adoptions arrive in their PlayerStateMsg.

const KEY = 'adoptions.v1';
const IDS: CharacterId[] = ['dad', 'penny', 'luke'];
/** How many treats one scoop from the Woof Gang treat jar gives you. */
export const TREATS_PER_GRAB = 3;

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

/** Persist ONE owner's pup. Read-modify-write on that key only: the live `pets`
 *  map also carries friends' pups from the network, and saving the whole map
 *  used to write THEIR dogs into this device's storage (and could wipe a
 *  sibling's adoption made earlier on the same iPad). */
function saveOwner(owner: CharacterId, pupId: string | null): void {
  try {
    const stored = load();
    stored[owner] = pupId;
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch { /* no-op */ }
}

interface PetStore {
  pets: Pets;
  /** Adopt (or swap to) a pup. Returns false if the pup id is unknown. */
  adopt: (owner: CharacterId, pupId: string) => boolean;
  release: (owner: CharacterId) => void;
  /** From the network: what a peer's character currently has. */
  setRemotePet: (owner: CharacterId, pupId: string | null) => void;
  /** A peer left: their character goes back to what THIS device remembers. */
  clearRemotePet: (owner: CharacterId) => void;

  /** Dog treats in MY hand (from the Woof Gang treat jar). Not persisted. */
  treats: number;
  grabTreats: () => void;
  /** Spend one treat. Returns false when the hand is empty. */
  useTreat: () => boolean;
}

declare global {
  interface Window { __pets?: unknown; }
}

export const usePetStore = create<PetStore>((set, get) => ({
  pets: typeof localStorage !== 'undefined' ? load() : { dad: null, penny: null, luke: null },
  adopt: (owner, pupId) => {
    if (!pupById(pupId)) return false;
    set({ pets: { ...get().pets, [owner]: pupId } });
    saveOwner(owner, pupId);
    return true;
  },
  release: (owner) => {
    set({ pets: { ...get().pets, [owner]: null } });
    saveOwner(owner, null);
  },
  setRemotePet: (owner, pupId) => {
    const cur = get().pets[owner];
    const next = pupId && pupById(pupId) ? pupId : null;
    if (cur === next) return;
    // Remote state is NOT persisted here — it's their dog, saved in their browser.
    set({ pets: { ...get().pets, [owner]: next } });
  },
  clearRemotePet: (owner) => {
    const stored = typeof localStorage !== 'undefined' ? load()[owner] : null;
    if (get().pets[owner] === stored) return;
    set({ pets: { ...get().pets, [owner]: stored } });
  },

  treats: 0,
  grabTreats: () => set({ treats: TREATS_PER_GRAB }),
  useTreat: () => {
    const n = get().treats;
    if (n <= 0) return false;
    set({ treats: n - 1 });
    return true;
  },
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__pets = usePetStore;
}
