import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useSkyStore } from '../state/skyStore';
import { clockIcon, clockLabel, hourOfDay, sunDirection } from '../world/dayNight';

/**
 * Tiny Free Play clock pill ("🌇 7:42 PM"). Polls the world clock once a
 * second (no per-frame React churn). Sits under the top-right avatar badge.
 */
export function DayClock() {
  const gameMode = useGameStore((s) => s.gameMode);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('☀️');
  useEffect(() => {
    if (gameMode !== 'freeplay') return;
    const tick = () => {
      const f = useSkyStore.getState().dayFraction;
      setLabel(clockLabel(f));
      setIcon(clockIcon(sunDirection(f).elevationDeg, hourOfDay(f)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gameMode]);
  if (gameMode !== 'freeplay' || welcomeOpen || !label) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 66px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 66px)',
        padding: '6px 12px',
        background: 'rgba(20, 30, 40, 0.72)',
        color: 'white',
        borderRadius: 999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 14,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        whiteSpace: 'nowrap',
      }}
    >
      {icon} {label}
    </div>
  );
}
