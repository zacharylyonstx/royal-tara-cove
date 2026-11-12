// Tiny builders for NPC looks (their own module so both the neighbourhood and
// school rosters can use them without importing each other).
import type { CharacterId } from '../types';
import type { Appearance } from './wardrobe';

export interface NpcLook {
  /** Which family rig to borrow face details from ('dad' = bearded). */
  base: CharacterId;
  height: number;
  skin: string;
  appearance: Appearance;
}

const A = (
  hair: [string, string], top: [string, string], bottom: [string, string], shoes: [string, string],
  hat: [string, string] = ['none', ''], accessory: [string, string] = ['none', ''],
): Appearance => ({
  hair: { item: hair[0], color: hair[1] }, top: { item: top[0], color: top[1] },
  bottom: { item: bottom[0], color: bottom[1] }, shoes: { item: shoes[0], color: shoes[1] },
  hat: { item: hat[0], color: hat[1] }, accessory: { item: accessory[0], color: accessory[1] },
});
export const npcLook = (base: CharacterId, height: number, skin: string, appearance: Appearance): NpcLook => ({ base, height, skin, appearance });
export const npcAppearance = A;
