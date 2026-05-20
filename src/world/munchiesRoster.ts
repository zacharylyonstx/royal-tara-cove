// Roster + active-player helpers for Midnight Munchies v2.
// The ghost lineup depends on which characters are being played.

import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import type { CharacterId } from '../types';
import type { SleepwalkerId } from '../state/munchiesStore';

/** Returns the 3-ghost roster based on which kids are playing. */
export function ghostRosterFor(activeChars: CharacterId[]): SleepwalkerId[] {
  const pennyIsPlayer = activeChars.includes('penny');
  return pennyIsPlayer
    ? ['dad', 'dog', 'schmorgesblob']
    : ['dad', 'dog', 'penny'];
}

/** Returns the playable-character IDs currently claimed across all peers. */
export function activePlayers(): CharacterId[] {
  const claimed = new Set<CharacterId>();
  const peers = useNetStore.getState().peers;
  for (const p of Object.values(peers)) {
    if (p.characterId === 'luke' || p.characterId === 'penny') {
      claimed.add(p.characterId);
    }
  }
  // Single-window / dev-fallback: if no peer claimed, use gameStore.activeCharacterId.
  if (claimed.size === 0) {
    const ac = useGameStore.getState().activeCharacterId;
    if (ac === 'luke' || ac === 'penny') claimed.add(ac);
    else claimed.add('luke');
  }
  return Array.from(claimed);
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
