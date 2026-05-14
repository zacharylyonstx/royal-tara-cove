import type { HousePosition } from './world/streetLayout';

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
  position: HousePosition;
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
  /** When true, render via HeroHouse10600 with full interior. */
  isHero?: boolean;
  /** Use a hipped roof instead of pure gable. */
  hipped?: boolean;
  sqft?: number;
  yearBuilt?: number;
  source?: 'verified' | 'partial' | 'inferred';
}

export type Vec2 = [number, number]; // (x, z) world coords

/** A property's outline as a closed polygon plus metadata about which edge faces the street. */
export interface Lot {
  address: string;
  /** CCW polygon vertices in world XZ. */
  polygon: Vec2[];
  /** Index of the polygon edge that faces the sidewalk (no fence here). */
  frontEdgeIndex: number;
  /** Where to place the house body (world XZ). */
  housePivot: Vec2;
  /** House yaw so its front faces the street. */
  houseYaw: number;
  /** Two world points (one per side fence) where gates go. */
  gateSlots: Vec2[];
  /** True for cul-de-sac wedge lots, false for straight rectangles. */
  isWedge: boolean;
}

/** A simple axis-aligned-in-XZ blocker. minY/maxY default to (0, 6). */
export interface RectCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  /** When true, players pass through (open door, gate). */
  passable?: boolean;
  /** Tag for debugging or selective interaction. */
  tag?: string;
}

/** Tags for the door interaction system. */
export interface DoorState {
  id: string;
  open: boolean;
  /** Center of door in world XZ for proximity check. */
  center: Vec2;
  /** Radius for "press E" prompt. */
  promptRadius: number;
}
