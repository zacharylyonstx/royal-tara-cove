import { useEffect, useState } from 'react';
import { useZoneStore } from '../state/zoneStore';
import { useNetStore } from '../state/netStore';
import { useGameStore } from '../state/gameStore';
import { CHARACTERS } from '../world/characters';
import { FRIEND_LEVELS } from '../world/petStorage';
import { petChime } from '../audio';

const PET_NAMES: Record<string, string> = { sparky: 'Sparky' };
function petName(id: string): string {
  if (PET_NAMES[id]) return PET_NAMES[id];
  if (id.startsWith('duck-')) return 'the duck';
  return id;
}

/** "Penny and Sparky are Best Friends now! 💕" — shown to the petter only. */
export function FriendshipToast() {
  const lastLevelUp = useZoneStore((s) => s.lastLevelUp);
  const me = useNetStore((s) => s.myCharacterId);
  const fallbackMe = useGameStore((s) => s.activeCharacterId);
  // Derive the message from the store; a timer only marks it as dismissed.
  const [dismissedAt, setDismissedAt] = useState<number>(-1);
  const mine = !!lastLevelUp && lastLevelUp.by === (me ?? fallbackMe);
  useEffect(() => {
    if (!lastLevelUp || !mine) return;
    petChime();
    const t = setTimeout(() => setDismissedAt(lastLevelUp.at), 2600);
    return () => clearTimeout(t);
  }, [lastLevelUp, mine]);

  if (!lastLevelUp || !mine || dismissedAt === lastLevelUp.at) return null;
  const who = CHARACTERS[lastLevelUp.by]?.name ?? 'You';
  const lvl = FRIEND_LEVELS[lastLevelUp.level]?.name ?? 'Friends';
  const msg = `${who} and ${petName(lastLevelUp.petId)} are ${lvl === 'Friend' ? 'Friends' : lvl + 's'} now! 💕`;
  return (
    <div
      style={{
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 28px',
        background: 'rgba(214, 74, 122, 0.92)',
        color: 'white',
        borderRadius: 16,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 26,
        fontWeight: 800,
        zIndex: 200,
        pointerEvents: 'none',
        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
        animation: 'pop-in 0.35s ease-out',
      }}
    >
      {msg}
    </div>
  );
}
