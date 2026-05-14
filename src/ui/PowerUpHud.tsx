import { useEffect, useState } from 'react';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { POWERUP_COLOR, POWERUP_DURATION, POWERUP_LABEL } from '../state/combatStore';

export function PowerUpHud() {
  const phase = useGameStore((s) => s.phase);
  const active = useCombatStore((s) => s.activePowerUps);
  const [, force] = useState(0);

  useEffect(() => {
    if (active.length === 0) return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [active.length]);

  if (phase !== 'combat' || active.length === 0) return null;
  const now = performance.now() / 1000;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 130, right: 16,
        display: 'flex', flexDirection: 'column', gap: 6,
        zIndex: 90, pointerEvents: 'none',
      }}
    >
      {active.map((p) => {
        const remaining = Math.max(0, p.expiresAt - now);
        const total = POWERUP_DURATION[p.kind];
        const pct = (remaining / total) * 100;
        const color = POWERUP_COLOR[p.kind];
        return (
          <div
            key={p.kind}
            style={{
              padding: '8px 14px',
              background: 'rgba(20, 30, 40, 0.75)', color: 'white',
              border: `2px solid ${color}`,
              borderRadius: 10,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: 13, fontWeight: 700,
              backdropFilter: 'blur(6px)',
              minWidth: 160,
              boxShadow: `0 0 14px ${color}55`,
              textAlign: 'right',
            }}
          >
            <div style={{ color, textShadow: `0 0 6px ${color}` }}>
              {POWERUP_LABEL[p.kind]}
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
              {remaining.toFixed(1)}s
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
                  width: `${pct}%`, height: '100%',
                  background: color, boxShadow: `0 0 6px ${color}`,
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
