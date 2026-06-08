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
  /** true = show the real photo-real "you" GLB model; false = the dress-up avatar. */
  realMode: Record<CharacterId, boolean>;
  /** true = show the rigged "Action Me" walking character (takes precedence over realMode). */
  actionMode: Record<CharacterId, boolean>;
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
  /** Apply a one-tap preset look (merges over current; keeps omitted slots like hair). */
  applyOutfit: (id: CharacterId, look: Partial<Appearance>) => void;
  resetLook: (id: CharacterId) => void;
  /** Toggle the real "you" GLB vs the dress-up avatar (bumps rev → syncs). */
  setRealMode: (id: CharacterId, real: boolean) => void;
  /** Toggle the rigged "Action Me" walking character (bumps rev → syncs). */
  setActionMode: (id: CharacterId, action: boolean) => void;
  registerDresser: (reg: DresserReg) => void;
  /** Apply a peer's appearance + modes (no persist, no rev bump → no echo). */
  setRemoteAppearance: (id: CharacterId, appearance: Appearance, real?: boolean, action?: boolean) => void;
}

const initial = loadWardrobe();

function persist(appearances: Record<CharacterId, Appearance>) {
  saveWardrobe(appearances);
}

export const useWardrobeStore = create<WardrobeStore>((set, get) => ({
  appearances: initial,
  realMode: { dad: true, penny: true, luke: true },
  actionMode: { dad: false, penny: false, luke: false },
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

  applyOutfit: (id, look) => {
    const cur = get().appearances;
    const merged = { ...cur[id] };
    (Object.keys(look) as Slot[]).forEach((slot) => {
      const choice = look[slot];
      if (!choice) return;
      const item = getItem(slot, choice.item);
      const color = item.colors.includes(choice.color) ? choice.color : (item.colors[0] ?? choice.color ?? '');
      merged[slot] = { item: item.id, color };
    });
    const next = { ...cur, [id]: merged };
    persist(next);
    set((s) => ({ appearances: next, rev: { ...s.rev, [id]: s.rev[id] + 1 } }));
  },

  resetLook: (id) => {
    const cur = get().appearances;
    const next = { ...cur, [id]: defaultAppearance(id) };
    persist(next);
    set((s) => ({ appearances: next, rev: { ...s.rev, [id]: s.rev[id] + 1 } }));
  },

  setRealMode: (id, real) =>
    set((s) => ({ realMode: { ...s.realMode, [id]: real }, rev: { ...s.rev, [id]: s.rev[id] + 1 } })),

  setActionMode: (id, action) =>
    set((s) => ({ actionMode: { ...s.actionMode, [id]: action }, rev: { ...s.rev, [id]: s.rev[id] + 1 } })),

  registerDresser: (reg) => set((s) =>
    s.dressers.some((d) => d.owner === reg.owner)
      ? { dressers: s.dressers.map((d) => (d.owner === reg.owner ? reg : d)) }
      : { dressers: [...s.dressers, reg] }),

  setRemoteAppearance: (id, appearance, real, action) =>
    set((s) => ({
      appearances: { ...s.appearances, [id]: appearance },
      realMode: real === undefined ? s.realMode : { ...s.realMode, [id]: real },
      actionMode: action === undefined ? s.actionMode : { ...s.actionMode, [id]: action },
    })),
}));

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __wardrobe?: unknown }).__wardrobe = useWardrobeStore;
}
