// Roster + active-player helpers for Midnight Munchies.
// Anyone in the family can be a cookie sneaker; whoever ISN'T playing becomes a
// sleepwalker, joined by the dog (and a leftover Schmorgesblob when the house
// would otherwise be too quiet).

import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import type { CharacterId } from '../types';
import type { SleepwalkerId } from '../state/munchiesStore';

const FAMILY: CharacterId[] = ['dad', 'penny', 'luke'];
/** How many sleepwalkers roam the house. */
const ROSTER_SIZE = 3;

/** The sleepwalker lineup for a given set of players. */
export function ghostRosterFor(activeChars: CharacterId[]): SleepwalkerId[] {
  const roster: SleepwalkerId[] = FAMILY.filter((id) => !activeChars.includes(id));
  roster.push('dog');
  if (roster.length < ROSTER_SIZE) roster.push('schmorgesblob');
  return roster.slice(0, ROSTER_SIZE);
}

/** Returns the playable-character IDs currently claimed across all peers. */
export function activePlayers(): CharacterId[] {
  const claimed = new Set<CharacterId>();
  const peers = useNetStore.getState().peers;
  for (const p of Object.values(peers)) {
    if (p.characterId) claimed.add(p.characterId);
  }
  // Single-window / dev-fallback: if no peer claimed, use gameStore.activeCharacterId.
  if (claimed.size === 0) claimed.add(useGameStore.getState().activeCharacterId);
  // Stable family order so host + guests agree on who is "player 1".
  return FAMILY.filter((id) => claimed.has(id));
}

export interface PlayerSnapshot {
  characterId: CharacterId;
  x: number;
  z: number;
  yaw: number;
}

/** Snapshot of every active player's current position. */
export function playerSnapshots(): PlayerSnapshot[] {
  const gs = useGameStore.getState();
  return activePlayers().map((id) => ({
    characterId: id,
    x: gs.positions[id].x,
    z: gs.positions[id].z,
    yaw: gs.yaws[id],
  }));
}
