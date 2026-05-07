export type CharacterId = 'dad' | 'penny' | 'luke';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  height: number;
  bodyColor: string;
  pantsColor: string;
  hairColor: string;
  skinTone: string;
  shoeColor: string;
}

export interface HouseConfig {
  address: string;
  angleDeg: number;
  width: number;
  depth: number;
  stories: 1 | 2;
  wallColor: string;
  trimColor: string;
  hasStone: boolean;
  stoneColor: string;
  roofColor: string;
  doorColor: string;
  garageOnLeft: boolean;
  sqft?: number;
  yearBuilt?: number;
  source?: 'verified' | 'partial' | 'inferred';
}
