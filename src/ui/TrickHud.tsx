import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { usePlayStore } from '../state/playStore';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Bike-trick popups + a session trick counter — shown only in non-combat free-roam. */
export function TrickHud() {
  const lastTrick = usePlayStore((s) => s.lastTrick);
  const trickCount = usePlayStore((s) => s.trickCount);
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const [popup, setPopup] = useState<{ text: string; key: number } | null>(null);

  useEffect(() => {
    if (!lastTrick) return;
    setPopup({ text: lastTrick.text, key: lastTrick.at });
    const t = setTimeout(() => setPopup(null), 1700);
    return () => clearTimeout(t);
  }, [lastTrick]);

  const show =
    gameMode === 'treehouse' ||
    gameMode === 'freeplay' ||
    (gameMode === 'aliens' && (phase === 'free-play' || phase === 'pre-intro' || phase === 'victory'));
  if (!show) return null;

  const wipeout = popup?.text.startsWith('Wipeout');

  return (
    <>
      <style>{`@keyframes trickpop{0%{opacity:0;transform:translateX(-50%) scale(0.6) rotate(-4deg)}
        18%{opacity:1;transform:translateX(-50%) scale(1.12) rotate(2deg)}
        32%{transform:translateX(-50%) scale(1) rotate(0)}
        78%{opacity:1}100%{opacity:0;transform:translateX(-50%) scale(1) translateY(-14px)}}`}</style>

      {trickCount > 0 && (
        <div
          style={{
            position: 'fixed', top: 16, right: 16,
            padding: '6px 14px', background: 'rgba(20,30,40,0.7)', color: 'white',
            borderRadius: 12, fontFamily: FONT, fontSize: 18, fontWeight: 700,
            backdropFilter: 'blur(6px)', zIndex: 100, pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          🤸 {trickCount}
        </div>
      )}

      {popup && (
        <div
          key={popup.key}
          style={{
            position: 'fixed', top: '32%', left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 26px',
            background: wipeout ? 'rgba(150,40,30,0.86)' : 'rgba(30,90,160,0.86)',
            color: 'white', borderRadius: 16, fontFamily: FONT,
            fontSize: 34, fontWeight: 800, letterSpacing: 0.5,
            textShadow: '0 2px 6px rgba(0,0,0,0.5)',
            zIndex: 101, pointerEvents: 'none',
            boxShadow: '0 6px 22px rgba(0,0,0,0.45)',
            animation: 'trickpop 1.7s ease-out forwards',
          }}
        >
          {popup.text}
        </div>
      )}
    </>
  );
}
