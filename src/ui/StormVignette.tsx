import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { useTornadoStore } from '../state/tornadoStore';

// Storm vignette — radial dark gradient overlay that intensifies as the player
// approaches the funnel. Activates only within 12m of the funnel center;
// closer = darker. Reads stores per-frame via rAF (no React re-renders).

const ACTIVE_RADIUS = 12;
const FULL_DARK_RADIUS = 4;

export function StormVignette() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;
      const g = useGameStore.getState();
      if (g.gameMode !== 'tornado') { el.style.opacity = '0'; return; }
      const ts = useTornadoStore.getState();
      if (ts.tornadoOpacity < 0.05) { el.style.opacity = '0'; return; }
      const player = g.positions[g.activeCharacterId];
      if (!player) { el.style.opacity = '0'; return; }
      const dist = Math.hypot(player.x - ts.tornadoX, player.z - ts.tornadoZ);
      if (dist > ACTIVE_RADIUS) { el.style.opacity = '0'; return; }
      // 0 at ACTIVE_RADIUS, 1 at FULL_DARK_RADIUS or closer
      const t = Math.max(0, Math.min(1, (ACTIVE_RADIUS - dist) / (ACTIVE_RADIUS - FULL_DARK_RADIUS)));
      el.style.opacity = String(t.toFixed(3));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0,
        zIndex: 900,
        background: 'radial-gradient(ellipse at center, transparent 28%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.95) 100%)',
        transition: 'opacity 120ms linear',
      }}
    />
  );
}
