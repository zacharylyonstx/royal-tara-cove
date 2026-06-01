import { create } from 'zustand';
import type { CharacterId } from '../types';
import { type Appearance, type Slot, getItem, defaultAppearance } from '../world/wardrobe';
import { loadWardrobe, saveWardrobe } from '../world/wardrobeStorage';

export interface DresserReg {
  owner: CharacterId;
  x: number;
  y: number;
  z: number;
}

interface WardrobeStore {
  /** Appearance for every character (local saved looks + remote-synced looks). */
  appearances: Record<CharacterId, Appearance>;
  /** Bumped on a LOCAL change to a character (net layer watches this to sync). */
  rev: Record<CharacterId, number>;
  /** Dress-up overlay state. */
  open: boolean;
  openFor: CharacterId | null;
  /** Registered dressers (world pos + owner) for proximity interaction. */
  dressers: DresserReg[];
  /** Owner of the dresser the player is currently standing at (for the prompt). */
  hoverDresser: CharacterId | null;

  openWardrobe: (owner: CharacterId) => void;
  close: () => void;
  setHoverDresser: (owner: CharacterId | null) => void;
  equip: (id: CharacterId, slot: Slot, itemId: string) => void;
  setColor: (id: CharacterId, slot: Slot, color: string) => void;
  resetLook: (id: CharacterId) => void;
  registerDresser: (reg: DresserReg) => void;
  /** Apply a peer's appearance (no persist, no rev bump → no echo). */
  setRemoteAppearance: (id: CharacterId, appearance: Appearance) => void;
}

const initial = loadWardrobe();

function persist(appearances: Record<CharacterId, Appearance>) {
  saveWardrobe(appearances);
}

export const useWardrobeStore = create<WardrobeStore>((set, get) => ({
  appearances: initial,
  rev: { dad: 0, penny: 0, luke: 0 },
  open: false,
  openFor: null,
  dressers: [],
  hoverDresser: null,

  openWardrobe: (owner) => set({ open: true, openFor: owner, hoverDresser: null }),
  close: () => set({ open: false, openFor: null }),
  setHoverDresser: (owner) => {
    if (get().hoverDresser !== owner) set({ hoverDresser: owner });
  },

  equip: (id, slot, itemId) => {
    const cur = get().appearances;
    const item = getItem(slot, itemId);
    const prevColor = cur[id][slot].color;
    // Keep the current color if the new item supports it, else use its default.
    const color = item.colors.includes(prevColor) ? prevColor : (item.colors[0] ?? '');
    const next = { ...cur, [id]: { ...cur[id], [slot]: { item: item.id, color } } };
    persist(next);
    set((s) => ({ appearances: next, rev: { ...s.rev, [id]: s.rev[id] + 1 } }));
  },

  setColor: (id, slot, color) => {
    const cur = get().appearances;
    const next = { ...cur, [id]: { ...cur[id], [slot]: { ...cur[id][slot], color } } };
    persist(next);
    set((s) => ({ appearances: next, rev: { ...s.rev, [id]: s.rev[id] + 1 } }));
  },

  resetLook: (id) => {
    const cur = get().appearances;
    const next = { ...cur, [id]: defaultAppearance(id) };
    persist(next);
    set((s) => ({ appearances: next, rev: { ...s.rev, [id]: s.rev[id] + 1 } }));
  },

  registerDresser: (reg) => set((s) =>
    s.dressers.some((d) => d.owner === reg.owner)
      ? { dressers: s.dressers.map((d) => (d.owner === reg.owner ? reg : d)) }
      : { dressers: [...s.dressers, reg] }),

  setRemoteAppearance: (id, appearance) =>
    set((s) => ({ appearances: { ...s.appearances, [id]: appearance } })),
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __wardrobe?: unknown }).__wardrobe = useWardrobeStore;
}
