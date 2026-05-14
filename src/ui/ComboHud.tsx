import { useEffect, useState } from 'react';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';

export function ComboHud() {
  const phase = useGameStore((s) => s.phase);
  const score = useCombatStore((s) => s.score);
  const comboCount = useCombatStore((s) => s.comboCount);
  const lastKillAt = useCombatStore((s) => s.lastKillAt);
  const [, force] = useState(0);

  useEffect(() => {
    if (comboCount === 0) return;
    const id = setInterval(() => force((n) => n + 1), 60);
    return () => clearInterval(id);
  }, [comboCount]);

  if (phase !== 'combat' && phase !== 'victory') return null;
  const now = performance.now() / 1000;
  const timeLeft = Math.max(0, 2.0 - (now - lastKillAt));
  const showCombo = comboCount >= 2 && timeLeft > 0;
  const comboColor = comboCount >= 8 ? '#fff15a' : comboCount >= 5 ? '#ff5a3a' : comboCount >= 3 ? '#3afff0' : '#a0e84a';

  return (
    <div
      style={{
        position: 'fixed',
        top: 110, left: 16,
        padding: '10px 16px',
        background: 'rgba(20, 30, 40, 0.7)', color: 'white',
        borderRadius: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        pointerEvents: 'none', backdropFilter: 'blur(6px)',
        zIndex: 90,
        textAlign: 'left',
        minWidth: 150,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 2 }}>SCORE</div>
      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: '#fff7d0' }}>
        {score.toLocaleString()}
      </div>
      {showCombo && (
        <>
          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7, letterSpacing: 2 }}>COMBO</div>
          <div
            style={{
              fontSize: 32, fontWeight: 900,
              color: comboColor,
              textShadow: `0 0 10px ${comboColor}, 0 2px 0 #000`,
              lineHeight: 1,
            }}
          >
            ×{comboCount}
          </div>
          <div
            style={{
              marginTop: 4,
              height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.15)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(timeLeft / 2.0) * 100}%`,
                height: '100%',
                background: comboColor,
                boxShadow: `0 0 6px ${comboColor}`,
                transition: 'width 0.06s linear',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
