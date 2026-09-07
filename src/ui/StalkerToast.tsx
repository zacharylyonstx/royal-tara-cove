import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNightStore } from '../state/nightStore';

/**
 * Free Play Siren Head toasts: "he's out there" at dusk, "BONK" when you get
 * swatted, "back into the woods" at dawn. Local-only feel; each client shows
 * its own.
 */
export function StalkerToast() {
  const gameMode = useGameStore((s) => s.gameMode);
  const event = useNightStore((s) => s.stalkerEvent);
  const [dismissed, setDismissed] = useState(-1);
  useEffect(() => {
    if (!event) return;
    const t = setTimeout(() => setDismissed(event.at), event.kind === 'swat' ? 3200 : 4500);
    return () => clearTimeout(t);
  }, [event]);
  if (gameMode !== 'freeplay' || !event || dismissed === event.at) return null;
  const msg =
    event.kind === 'arrive' ? '🚨 Siren Head is out there… get inside a house!' :
    event.kind === 'swat' ? '💥 BONK! Siren Head swatted you across the block!' :
    '☀️ Siren Head went back into the woods.';
  const bg = event.kind === 'dawn' ? 'rgba(60, 120, 80, 0.92)' : 'rgba(140, 20, 20, 0.92)';
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
        fontSize: 24,
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
