import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNpcStore } from '../state/npcStore';

/** Free Play: what I'm carrying for a neighbour + my helper-star count. */
export function ErrandHud() {
  const gameMode = useGameStore((s) => s.gameMode);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const carrying = useNpcStore((s) => s.carrying);
  const stars = useNpcStore((s) => s.stars);
  const lastStarAt = useNpcStore((s) => s.lastStarAt);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (!lastStarAt) return;
    const on = setTimeout(() => setPop(true), 0);
    const off = setTimeout(() => setPop(false), 2600);
    return () => { clearTimeout(on); clearTimeout(off); };
  }, [lastStarAt]);

  if (gameMode !== 'freeplay' || welcomeOpen) return null;
  if (!carrying && stars === 0 && !pop) return null;
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  return (
    <>
      <div style={{ position: 'fixed', top: 118, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, zIndex: 55, pointerEvents: 'none', fontFamily: font }}>
        {stars > 0 && (
          <div style={{ background: 'rgba(20,28,38,0.78)', color: '#ffe9a8', padding: '4px 12px', borderRadius: 999, fontSize: 15, fontWeight: 800, border: '2px solid #f6c945' }}>
            ⭐ {stars} helper {stars === 1 ? 'star' : 'stars'}
          </div>
        )}
        {carrying && (
          <div style={{ background: 'rgba(255,253,246,0.96)', color: '#2a2433', padding: '6px 12px', borderRadius: 14, fontSize: 14, fontWeight: 700, border: '2px solid #2a2433', maxWidth: 250, textAlign: 'right', lineHeight: 1.25 }}>
            <span style={{ fontSize: 20 }}>{carrying.item}</span> for <strong>{carrying.toName}</strong>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75 }}>{carrying.where}</div>
          </div>
        )}
      </div>
      {pop && (
        <div style={{ position: 'fixed', top: '26%', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#f6c945,#f0883a)', color: '#2a1a05', padding: '12px 26px', borderRadius: 18, fontSize: 24, fontWeight: 900, fontFamily: font, zIndex: 130, pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', animation: 'pop-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both', whiteSpace: 'nowrap' }}>
          ⭐ Helper star! Thanks for the delivery
        </div>
      )}
    </>
  );
}
