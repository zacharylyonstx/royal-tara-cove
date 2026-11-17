import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNightStore } from '../state/nightStore';
import { useHideSeekStore } from '../state/hideSeekStore';
import { useNetStore } from '../state/netStore';
import { railSafe } from '../world/redLine';

/**
 * Free Play Siren Head toasts: "he's out there" at dusk, "BONK" when you get
 * swatted, "back into the woods" at dawn. Local-only feel; each client shows
 * its own.
 */
export function StalkerToast() {
  const gameMode = useGameStore((s) => s.gameMode);
  const event = useNightStore((s) => s.stalkerEvent);
  const [dismissed, setDismissed] = useState(-1);
  const hsOn = useHideSeekStore((s) => s.phase === 'counting' || s.phase === 'seeking');
  useEffect(() => {
    if (!event) return;
    const t = setTimeout(() => setDismissed(event.at), event.kind === 'swat' ? 3200 : 4500);
    return () => clearTimeout(t);
  }, [event]);
  // No Siren Head warnings over a hide-and-seek game (he's sitting it out).
  if (gameMode !== 'freeplay' || !event || dismissed === event.at || hsOn) return null;
  // Away down the Red Line (or on the train / at the station) he can't reach
  // you — say so, instead of telling a kid at the Domain to find a house.
  const g = useGameStore.getState();
  const p = g.positions[useNetStore.getState().myCharacterId ?? g.activeCharacterId];
  const away = railSafe(p.x, p.y, p.z);
  if (away && event.kind === 'dawn') return null;
  const msg =
    event.kind === 'arrive' ? (away ? '🌙 Night-time! Siren Head is out back home — he never comes near the train or the Domain.' : '🚨 Siren Head is out there… get inside a house!') :
    event.kind === 'swat' ? '💥 BONK! Siren Head swatted you across the block!' :
    '☀️ Siren Head went back into the woods.';
  const bg = event.kind === 'dawn' ? 'rgba(60, 120, 80, 0.92)' : away && event.kind === 'arrive' ? 'rgba(30, 44, 78, 0.92)' : 'rgba(140, 20, 20, 0.92)';
  return (
    <div
      style={{
        position: 'fixed',
        top: '28%',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 28px',
        background: bg,
        color: 'white',
        borderRadius: 16,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: away ? 19 : 24,
        fontWeight: 800,
        zIndex: 200,
        pointerEvents: 'none',
        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
        animation: 'pop-in 0.35s ease-out',
        textAlign: 'center',
        maxWidth: '86vw',
      }}
    >
      {msg}
    </div>
  );
}
