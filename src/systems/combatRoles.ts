import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { usePlayStore } from '../state/playStore';
import type { CharacterId } from '../types';

/** The character this browser is playing. */
export function myCharacter(): CharacterId {
  return useNetStore.getState().myCharacterId ?? useGameStore.getState().activeCharacterId;
}

/** Is a real person (me or any peer) playing this character right now? The
 *  rest of the family are sidekicks: they wander and auto-zap. */
export function isHumanControlled(id: CharacterId): boolean {
  if (id === myCharacter()) return true;
  for (const p of Object.values(useNetStore.getState().peers)) {
    if (p.characterId === id) return true;
  }
  return false;
}

/** Should `id`'s hand-held weapon be drawn? Everyone else's always; my own
 *  only in the over-the-shoulder view (in first person it'd block the lens). */
export function showsWeapon(id: CharacterId): boolean {
  return id !== myCharacter() || usePlayStore.getState().thirdPerson;
}

/** Height of each character's weapon muzzle above their feet. */
export const WEAPON_Y: Record<CharacterId, number> = { dad: 1.1, penny: 0.95, luke: 0.88 };
