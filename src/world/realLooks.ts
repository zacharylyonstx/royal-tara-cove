import type { CharacterId } from '../types';

// Cosmetics that LAYER onto the photo-real "Real Me" avatar — procedural 3D
// meshes attached to the head/body and tintable to ANY colour at runtime. Keeps
// the real face + figure 100% untouched; adds trendy hair, headwear, eyewear and
// back items, Roblox-style. (Research: a static avatar with no rig can't take
// skinned clothing, but non-skinned cosmetics parented to head/body + runtime
// material tint is the robust path — see project_photoreal_characters memory.)

export type RealSlot = 'hair' | 'headwear' | 'face' | 'back';
export const REAL_SLOTS: RealSlot[] = ['hair', 'headwear', 'face', 'back'];
export const REAL_SLOT_LABEL: Record<RealSlot, string> = {
  hair: 'Hair', headwear: 'Headwear', face: 'Eyewear', back: 'Back',
};
export const REAL_SLOT_EMOJI: Record<RealSlot, string> = {
  hair: '💇', headwear: '🧢', face: '🕶️', back: '🪽',
};

export interface RealItem {
  id: string;
  label: string;
  emoji: string;
  /** Selectable colors; [0] is default. Empty = no color choice (e.g. "none"). */
  colors: string[];
}

// Bold, trendy Roblox-y palette (purple/pink/cyber-blue lead).
export const TRENDY = [
  '#a64bf4', '#ff4fa3', '#3aa0ff', '#39e0c8', '#7ddf3a',
  '#ffd23f', '#ff7a3c', '#ff3b3b', '#ffffff', '#1a1a1a',
];
// Hair gets the trendy dyes PLUS a few natural tones.
const HAIRC = [
  '#a64bf4', '#ff4fa3', '#3aa0ff', '#39e0c8', '#ff7a3c',
  '#2a1c12', '#5a3216', '#caa24a', '#1a1a1a', '#ececec',
];

export const REAL_CATALOG: Record<RealSlot, RealItem[]> = {
  hair: [
    { id: 'none', label: 'Natural', emoji: '🧑', colors: [] },
    { id: 'swoop', label: 'Swoop', emoji: '💇', colors: HAIRC },
    { id: 'spikes', label: 'Spikes', emoji: '⚡', colors: HAIRC },
    { id: 'long', label: 'Long', emoji: '💁', colors: HAIRC },
    { id: 'buns', label: 'Space Buns', emoji: '🧁', colors: HAIRC },
    { id: 'mohawk', label: 'Mohawk', emoji: '🦅', colors: HAIRC },
    { id: 'ponytail', label: 'Ponytail', emoji: '🎀', colors: HAIRC },
    { id: 'puffs', label: 'Puffs', emoji: '🦱', colors: HAIRC },
  ],
  headwear: [
    { id: 'none', label: 'None', emoji: '🚫', colors: [] },
    { id: 'beanie', label: 'Beanie', emoji: '🧶', colors: TRENDY },
    { id: 'cap', label: 'Cap', emoji: '🧢', colors: TRENDY },
    { id: 'headband', label: 'Headband', emoji: '🎀', colors: TRENDY },
    { id: 'halo', label: 'Halo', emoji: '😇', colors: ['#ffe680', '#aef6ff', '#ff9ed8'] },
    { id: 'catears', label: 'Cat Ears', emoji: '🐱', colors: TRENDY },
    { id: 'crown', label: 'Crown', emoji: '👑', colors: ['#ffd23f', '#a64bf4', '#ff4fa3'] },
  ],
  face: [
    { id: 'none', label: 'None', emoji: '🚫', colors: [] },
    { id: 'glasses', label: 'Glasses', emoji: '👓', colors: ['#1a1a1a', '#a64bf4', '#3aa0ff', '#ff4fa3'] },
    { id: 'shades', label: 'Shades', emoji: '🕶️', colors: ['#1a1a1a', '#3aa0ff', '#ff4fa3', '#39e0c8'] },
    { id: 'visor', label: 'Visor', emoji: '🥽', colors: ['#39e0c8', '#a64bf4', '#ff7a3c', '#3aa0ff'] },
  ],
  back: [
    { id: 'none', label: 'None', emoji: '🚫', colors: [] },
    { id: 'wings', label: 'Wings', emoji: '🪽', colors: ['#ffffff', '#ff4fa3', '#a64bf4', '#39e0c8'] },
    { id: 'cape', label: 'Cape', emoji: '🦸', colors: TRENDY },
    { id: 'backpack', label: 'Backpack', emoji: '🎒', colors: TRENDY },
  ],
};

export interface RealChoice { item: string; color: string }
export type RealLook = Record<RealSlot, RealChoice>;

export function getRealItem(slot: RealSlot, id: string): RealItem {
  const list = REAL_CATALOG[slot];
  return list.find((i) => i.id === id) ?? list[0];
}

const none: RealChoice = { item: 'none', color: '' };
/** Everyone starts as their plain real self — cosmetics are opt-in. */
export function defaultRealLook(): RealLook {
  return { hair: { ...none }, headwear: { ...none }, face: { ...none }, back: { ...none } };
}

// One-tap trendy looks for the dresser.
export interface RealLookPreset { id: string; label: string; emoji: string; look: RealLook }
const c = (item: string, color: string): RealChoice => ({ item, color });
export const REAL_LOOK_PRESETS: RealLookPreset[] = [
  { id: 'galaxy', label: 'Galaxy', emoji: '🌌', look: { hair: c('swoop', '#a64bf4'), face: c('shades', '#3aa0ff'), headwear: none, back: none } },
  { id: 'angel', label: 'Angel', emoji: '😇', look: { hair: c('long', '#ececec'), headwear: c('halo', '#ffe680'), back: c('wings', '#ffffff'), face: none } },
  { id: 'punk', label: 'Punk', emoji: '🤘', look: { hair: c('mohawk', '#ff4fa3'), face: c('shades', '#1a1a1a'), headwear: none, back: none } },
  { id: 'street', label: 'Street', emoji: '🛹', look: { headwear: c('cap', '#1a1a1a'), face: c('shades', '#1a1a1a'), back: c('backpack', '#ff7a3c'), hair: none } },
  { id: 'fairy', label: 'Fairy', emoji: '🧚', look: { hair: c('buns', '#ff4fa3'), back: c('wings', '#ff9ed8'), headwear: c('headband', '#ff4fa3'), face: none } },
  { id: 'royal', label: 'Royalty', emoji: '👑', look: { hair: c('long', '#caa24a'), headwear: c('crown', '#ffd23f'), back: c('cape', '#a64bf4'), face: none } },
  { id: 'gamer', label: 'Gamer', emoji: '🎮', look: { hair: c('spikes', '#3aa0ff'), face: c('visor', '#39e0c8'), headwear: none, back: none } },
  { id: 'kitty', label: 'Kitty', emoji: '🐱', look: { hair: c('puffs', '#1a1a1a'), headwear: c('catears', '#a64bf4'), face: none, back: none } },
];

export type { CharacterId };
