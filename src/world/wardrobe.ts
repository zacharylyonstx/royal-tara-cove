import type { CharacterId } from '../types';

// The Wardrobe catalog + appearance model. Pure data — CharacterModel reads an
// Appearance and renders each slot by its item `kind`. Adding an outfit = adding
// a catalog entry + (if a new kind) a render branch in CharacterModel.

export type Slot = 'hair' | 'top' | 'bottom' | 'shoes' | 'hat' | 'accessory';

export const SLOTS: Slot[] = ['hair', 'top', 'bottom', 'shoes', 'hat', 'accessory'];

export const SLOT_LABEL: Record<Slot, string> = {
  hair: 'Hair', top: 'Tops', bottom: 'Bottoms', shoes: 'Shoes', hat: 'Hats', accessory: 'Extras',
};
export const SLOT_EMOJI: Record<Slot, string> = {
  hair: '💇', top: '👕', bottom: '👖', shoes: '👟', hat: '🧢', accessory: '🎒',
};

export interface WardrobeItem {
  id: string;
  label: string;
  emoji: string;
  /** Render style key understood by CharacterModel. */
  kind: string;
  /** Selectable colors; [0] is the default. Empty = item has no color choice. */
  colors: string[];
}

export interface SlotChoice { item: string; color: string }
export type Appearance = Record<Slot, SlotChoice>;

// Shared kid-friendly color palette (used by most slots).
export const PALETTE = [
  '#e8463f', '#f0883a', '#f6c945', '#5cb85c', '#3aa6a0',
  '#3a6db0', '#7a52c8', '#e26aa1', '#f6f2e8', '#2c2f3a',
];
const HAIR_COLORS = ['#5a3216', '#2a1c12', '#1a1a1a', '#caa24a', '#cf8a4e', '#b5532a', '#d8d4cc'];
const DENIM = ['#3a4d6b', '#2b2f3a', '#6b7280', '#1f1f1f', '#5a3aa6', '#e26aa1', '#3aa6a0'];
const SHOE_COLORS = ['#ffffff', '#d4d4d4', '#1f1f1f', '#e8463f', '#3a6db0', '#5cb85c', '#f6c945'];

const C = PALETTE;

export const CATALOG: Record<Slot, WardrobeItem[]> = {
  hair: [
    { id: 'short', label: 'Short', emoji: '✂️', kind: 'short', colors: HAIR_COLORS },
    { id: 'tousled', label: 'Tousled', emoji: '🌀', kind: 'tousled', colors: HAIR_COLORS },
    { id: 'long', label: 'Long', emoji: '💁', kind: 'long', colors: HAIR_COLORS },
    { id: 'ponytail', label: 'Ponytail', emoji: '🎀', kind: 'ponytail', colors: HAIR_COLORS },
    { id: 'buzz', label: 'Buzz', emoji: '🪒', kind: 'buzz', colors: HAIR_COLORS },
    { id: 'curly', label: 'Curly', emoji: '🦱', kind: 'curly', colors: HAIR_COLORS },
    { id: 'bun', label: 'Bun', emoji: '🧁', kind: 'bun', colors: HAIR_COLORS },
  ],
  top: [
    { id: 'tee', label: 'T-Shirt', emoji: '👕', kind: 'tee', colors: C },
    { id: 'hoodie', label: 'Hoodie', emoji: '🧥', kind: 'hoodie', colors: C },
    { id: 'jersey', label: 'Jersey', emoji: '🎽', kind: 'jersey', colors: C },
    { id: 'dress', label: 'Dress', emoji: '👗', kind: 'dress', colors: C },
    { id: 'tank', label: 'Tank', emoji: '🎽', kind: 'tank', colors: C },
    { id: 'plaid', label: 'Flannel', emoji: '🧶', kind: 'plaid', colors: ['#b5532a', '#3a6db0', '#5cb85c', '#7a52c8', '#2c2f3a'] },
    { id: 'stripe', label: 'Stripes', emoji: '🌈', kind: 'stripe', colors: C },
    { id: 'longsleeve', label: 'Long Sleeve', emoji: '👚', kind: 'longsleeve', colors: C },
  ],
  bottom: [
    { id: 'jeans', label: 'Jeans', emoji: '👖', kind: 'jeans', colors: DENIM },
    { id: 'shorts', label: 'Shorts', emoji: '🩳', kind: 'shorts', colors: DENIM },
    { id: 'skirt', label: 'Skirt', emoji: '🩱', kind: 'skirt', colors: C },
    { id: 'leggings', label: 'Leggings', emoji: '🦵', kind: 'leggings', colors: C },
    { id: 'cargo', label: 'Cargo', emoji: '🪖', kind: 'cargo', colors: ['#6b7045', '#5a4a32', '#2c2f3a', '#3a4d6b'] },
    { id: 'athletic', label: 'Athletic', emoji: '🏃', kind: 'athletic', colors: C },
  ],
  shoes: [
    { id: 'sneakers', label: 'Sneakers', emoji: '👟', kind: 'sneakers', colors: SHOE_COLORS },
    { id: 'hightops', label: 'High-Tops', emoji: '👟', kind: 'hightops', colors: SHOE_COLORS },
    { id: 'boots', label: 'Boots', emoji: '🥾', kind: 'boots', colors: ['#5a3a1a', '#2c2f3a', '#1f1f1f', '#8a4a2a'] },
    { id: 'sandals', label: 'Sandals', emoji: '🩴', kind: 'sandals', colors: SHOE_COLORS },
    { id: 'cleats', label: 'Cleats', emoji: '⚽', kind: 'cleats', colors: SHOE_COLORS },
  ],
  hat: [
    { id: 'none', label: 'None', emoji: '🚫', kind: 'none', colors: [] },
    { id: 'cap', label: 'Cap', emoji: '🧢', kind: 'cap', colors: C },
    { id: 'beanie', label: 'Beanie', emoji: '🧶', kind: 'beanie', colors: C },
    { id: 'cowboy', label: 'Cowboy', emoji: '🤠', kind: 'cowboy', colors: ['#8a5a2a', '#5a3a1a', '#2c2f3a', '#caa24a'] },
    { id: 'crown', label: 'Crown', emoji: '👑', kind: 'crown', colors: ['#f6c945', '#e8463f', '#7a52c8'] },
    { id: 'headband', label: 'Headband', emoji: '🎀', kind: 'headband', colors: C },
    { id: 'party', label: 'Party Hat', emoji: '🥳', kind: 'party', colors: C },
    { id: 'bow', label: 'Bow', emoji: '🎀', kind: 'bow', colors: C },
  ],
  accessory: [
    { id: 'none', label: 'None', emoji: '🚫', kind: 'none', colors: [] },
    { id: 'glasses', label: 'Glasses', emoji: '👓', kind: 'glasses', colors: ['#2c2f3a', '#b5532a', '#3a6db0', '#e26aa1'] },
    { id: 'sunglasses', label: 'Shades', emoji: '🕶️', kind: 'sunglasses', colors: ['#1a1a1a', '#3a6db0', '#e8463f'] },
    { id: 'backpack', label: 'Backpack', emoji: '🎒', kind: 'backpack', colors: C },
    { id: 'cape', label: 'Cape', emoji: '🦸', kind: 'cape', colors: C },
    { id: 'bandana', label: 'Bandana', emoji: '💠', kind: 'bandana', colors: C },
    { id: 'wings', label: 'Wings', emoji: '🧚', kind: 'wings', colors: ['#f6f2e8', '#e26aa1', '#3aa6a0', '#f6c945'] },
  ],
};

export function getItem(slot: Slot, id: string): WardrobeItem {
  const list = CATALOG[slot];
  return list.find((i) => i.id === id) ?? list[0];
}

/** Per-character starting looks (preserve the established pink/green/blue family). */
export const DEFAULT_APPEARANCE: Record<CharacterId, Appearance> = {
  dad: {
    hair: { item: 'short', color: '#5a3216' },
    top: { item: 'tee', color: '#3a6db0' },
    bottom: { item: 'jeans', color: '#2b2f3a' },
    shoes: { item: 'sneakers', color: '#1f1f1f' },
    hat: { item: 'none', color: '' },
    accessory: { item: 'none', color: '' },
  },
  penny: {
    hair: { item: 'long', color: '#cf8a4e' }, // long reddish-blonde
    top: { item: 'dress', color: '#e26aa1' },
    bottom: { item: 'leggings', color: '#5a3aa6' },
    shoes: { item: 'sneakers', color: '#ffffff' },
    hat: { item: 'none', color: '' },
    accessory: { item: 'none', color: '' },
  },
  luke: {
    hair: { item: 'tousled', color: '#5a3216' }, // short tousled brown
    top: { item: 'tee', color: '#5cb85c' },
    bottom: { item: 'shorts', color: '#324e6c' },
    shoes: { item: 'sneakers', color: '#d4d4d4' },
    hat: { item: 'none', color: '' },
    accessory: { item: 'none', color: '' },
  },
};

export function defaultAppearance(id: CharacterId): Appearance {
  // Deep clone so callers can mutate freely.
  const d = DEFAULT_APPEARANCE[id];
  return {
    hair: { ...d.hair }, top: { ...d.top }, bottom: { ...d.bottom },
    shoes: { ...d.shoes }, hat: { ...d.hat }, accessory: { ...d.accessory },
  };
}
