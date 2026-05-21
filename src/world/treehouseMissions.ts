// Mission definitions for The Treehouse Club.
// Each mission has a setup (called when activated), an isComplete predicate
// (called per frame by TreehouseController), and a sticker reward.

import { HOUSES } from './houses';
import { buildLots } from './lots';
import { useGameStore } from '../state/gameStore';
import { useTreehouseStore } from '../state/treehouseStore';

export interface MissionLetter {
  id: string;
  sender: string;
  title: string;
  bodyMarkdown: string;
  goalHint: string;
  sticker: { id: string; emoji: string; label: string };
  setup?: () => void;
  isComplete: () => boolean;
  teardown?: () => void;
}

/** Compute world position of a house's mailbox by address. */
function mailboxWorldPosition(address: string): { x: number; z: number } | null {
  const house = HOUSES.find((h) => h.address === address);
  if (!house) return null;
  const lots = buildLots(HOUSES);
  const lot = lots.find((l) => l.address === address);
  if (!lot) return null;
  const halfW = house.width / 2;
  const halfD = house.depth / 2;
  const localX = house.garageOnLeft ? halfW - 1.0 : -halfW + 1.0;
  const localZ = -halfD - 7;
  const cosY = Math.cos(lot.houseYaw);
  const sinY = Math.sin(lot.houseYaw);
  const wx = lot.housePivot[0] + localX * cosY + localZ * sinY;
  const wz = lot.housePivot[1] - localX * sinY + localZ * cosY;
  return { x: wx, z: wz };
}

/** Spawn position for the hero-house live oak (where the treehouse goes). */
export function liveOakPosition(): { x: number; z: number } {
  const hero = HOUSES.find((h) => h.isHero);
  if (!hero) return { x: 0, z: 0 };
  const lots = buildLots(HOUSES);
  const lot = lots.find((l) => l.address === hero.address);
  if (!lot) return { x: 0, z: 0 };
  const halfD = hero.depth / 2;
  // Same seed math as Game.tsx LotVegetation:
  const seed = hero.address.charCodeAt(0) * 131 + hero.address.charCodeAt(2) * 7;
  const backLocalX = (((seed % 7) - 3) * 0.7);
  const backLocalZ = halfD + 4 + (seed % 3);
  const cosY = Math.cos(lot.houseYaw);
  const sinY = Math.sin(lot.houseYaw);
  const wx = lot.housePivot[0] + backLocalX * cosY + backLocalZ * sinY;
  const wz = lot.housePivot[1] - backLocalX * sinY + backLocalZ * cosY;
  return { x: wx, z: wz };
}

const NEAR = 3.5;

// --- M1: Welcome to the Cove ---

const WELCOME_TARGET_ADDRESS = '10617';

function welcomeTargetPos(): { x: number; z: number } | null {
  const house = HOUSES.find((h) => h.address === WELCOME_TARGET_ADDRESS);
  if (!house) return null;
  const lots = buildLots(HOUSES);
  const lot = lots.find((l) => l.address === WELCOME_TARGET_ADDRESS);
  if (!lot) return null;
  const halfD = house.depth / 2;
  const localX = 0;
  const localZ = -halfD - 4;
  const cosY = Math.cos(lot.houseYaw);
  const sinY = Math.sin(lot.houseYaw);
  return {
    x: lot.housePivot[0] + localX * cosY + localZ * sinY,
    z: lot.housePivot[1] - localX * sinY + localZ * cosY,
  };
}

// --- M2: Missing Gnome ---

function gnomeHidingPosition(): { x: number; z: number } | null {
  const house = HOUSES.find((h) => h.address === '10609');
  if (!house) return null;
  const lots = buildLots(HOUSES);
  const lot = lots.find((l) => l.address === '10609');
  if (!lot) return null;
  const halfD = house.depth / 2;
  const localZ = halfD + 2.5;
  const cosY = Math.cos(lot.houseYaw);
  const sinY = Math.sin(lot.houseYaw);
  return {
    x: lot.housePivot[0] + 0 * cosY + localZ * sinY,
    z: lot.housePivot[1] - 0 * sinY + localZ * cosY,
  };
}

// --- M3: Where's Sparky? ---

function sparkyStartPosition(): { x: number; z: number } | null {
  const house = HOUSES.find((h) => h.address === '10621');
  if (!house) return null;
  const lots = buildLots(HOUSES);
  const lot = lots.find((l) => l.address === '10621');
  if (!lot) return null;
  const halfD = house.depth / 2;
  const localZ = -halfD - 2;
  const cosY = Math.cos(lot.houseYaw);
  const sinY = Math.sin(lot.houseYaw);
  return {
    x: lot.housePivot[0] + 0 * cosY + localZ * sinY,
    z: lot.housePivot[1] - 0 * sinY + localZ * cosY,
  };
}

function sparkyTargetPosition(): { x: number; z: number } | null {
  const house = HOUSES.find((h) => h.address === '10600');
  if (!house) return null;
  const lots = buildLots(HOUSES);
  const lot = lots.find((l) => l.address === '10600');
  if (!lot) return null;
  const halfD = house.depth / 2;
  const localZ = -halfD - 5;
  const cosY = Math.cos(lot.houseYaw);
  const sinY = Math.sin(lot.houseYaw);
  return {
    x: lot.housePivot[0] + 0 * cosY + localZ * sinY,
    z: lot.housePivot[1] - 0 * sinY + localZ * cosY,
  };
}

export const MISSIONS: Record<string, MissionLetter> = {
  'welcome-to-the-cove': {
    id: 'welcome-to-the-cove',
    sender: 'Dad',
    title: 'Welcome, Treehouse Club!',
    bodyMarkdown: `Hi kids! 🌳

Welcome to your new treehouse! It's all yours.

To kick things off — head over to the front yard at **10617** and stand by the big basketball hoop area for a moment. I'll send you something nice when you get there.

Love,
Dad`,
    goalHint: '🎯 Walk to the front yard at 10617',
    sticker: { id: 'founder', emoji: '🌳', label: 'Treehouse Founder' },
    isComplete: () => {
      const target = welcomeTargetPos();
      if (!target) return false;
      const positions = useGameStore.getState().positions;
      const luke = positions.luke;
      const penny = positions.penny;
      return (
        Math.hypot(luke.x - target.x, luke.z - target.z) < NEAR ||
        Math.hypot(penny.x - target.x, penny.z - target.z) < NEAR
      );
    },
  },

  'missing-gnome': {
    id: 'missing-gnome',
    sender: 'Mrs. Patel from 10625',
    title: 'The Missing Gnome',
    bodyMarkdown: `Dear Treehouse Club,

My garden gnome went missing AGAIN. I think Mr. Whiskers (the cat) was sniffing around near the mailboxes yesterday.

If you can find **Gnomey** and bring him to my mailbox at **10625**, I have a sticker for your treehouse.

Thank you,
Mrs. Patel`,
    goalHint: '🎯 Find Gnomey and drop him in 10625\'s mailbox',
    sticker: { id: 'gnome-rescuer', emoji: '🪻', label: 'Gnome Rescuer' },
    setup: () => {
      const pos = gnomeHidingPosition();
      if (pos) useTreehouseStore.getState().spawnMissionItem('gnome', pos.x, pos.z);
    },
    isComplete: () => {
      const item = useTreehouseStore.getState().missionItem;
      if (!item || item.id !== 'gnome') return false;
      if (item.carriedBy !== null) return false;
      const target = mailboxWorldPosition('10625');
      if (!target) return false;
      return Math.hypot(item.x - target.x, item.z - target.z) < NEAR;
    },
  },

  'wheres-sparky': {
    id: 'wheres-sparky',
    sender: 'the cul-de-sac',
    title: "Where's Sparky?",
    bodyMarkdown: `Treehouse Club,

A friendly little dog named **Sparky** is wandering the cove and needs to find home. Get close to him — he'll follow you.

Lead him to the front walkway of **10600** (your house).

You can do it!`,
    goalHint: '🎯 Find Sparky and lead him to 10600',
    sticker: { id: 'dog-whisperer', emoji: '🐕', label: 'Dog Whisperer' },
    setup: () => {
      const pos = sparkyStartPosition();
      if (pos) useTreehouseStore.getState().spawnMissionItem('sparky', pos.x, pos.z);
    },
    isComplete: () => {
      const item = useTreehouseStore.getState().missionItem;
      if (!item || item.id !== 'sparky') return false;
      const target = sparkyTargetPosition();
      if (!target) return false;
      return Math.hypot(item.x - target.x, item.z - target.z) < NEAR;
    },
  },

  'thank-you': {
    id: 'thank-you',
    sender: 'the cul-de-sac',
    title: 'Thank You',
    bodyMarkdown: `Treehouse Club,

You did it! Three missions done, three stickers earned. The cove is lucky to have you.

More letters will arrive soon. For now — enjoy your treehouse. It's yours.

❤️`,
    goalHint: '🎯 Free play! Explore the cove.',
    sticker: { id: 'finisher', emoji: '🏅', label: 'Club Charter Member' },
    isComplete: () => false,
  },
};

/** Ordered sequence of missions; next mission after completion. */
export const MISSION_ORDER = ['welcome-to-the-cove', 'missing-gnome', 'wheres-sparky', 'thank-you'];

export function getNextMissionId(currentId: string): string | null {
  const idx = MISSION_ORDER.indexOf(currentId);
  if (idx < 0 || idx >= MISSION_ORDER.length - 1) return null;
  return MISSION_ORDER[idx + 1];
}

/** Treehouse spawn point — backyard of hero house, near the live oak. */
export function treehouseSpawnPoint(): { x: number; z: number } {
  const oak = liveOakPosition();
  return { x: oak.x, z: oak.z - 3 };
}

/** Helpers exposed for UI / renderers. */
export { welcomeTargetPos, mailboxWorldPosition, sparkyTargetPosition };
