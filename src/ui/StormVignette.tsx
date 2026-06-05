import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useTornadoStore } from '../state/tornadoStore';

// Storm vignette — radial dark gradient overlay that intensifies as the player
// approaches the funnel. Activates only within 12m of the funnel center;
// closer = darker. Reads stores per-frame via rAF (no React re-renders).

const ACTIVE_RADIUS = 12;
const FULL_DARK_RADIUS = 4;
// As the funnel gets RIGHT on top of you, you're engulfed in its debris cloud —
// a churning brown-grey dust whiteout closes in.
const DUST_RADIUS = 16;
const DUST_FULL_RADIUS = 3;

export function StormVignette() {
  const ref = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      const dust = dustRef.current;
      if (!el || !dust) return;
      const g = useGameStore.getState();
      if (g.gameMode !== 'tornado') { el.style.opacity = '0'; dust.style.opacity = '0'; return; }
      const ts = useTornadoStore.getState();
      if (ts.tornadoOpacity < 0.05) { el.style.opacity = '0'; dust.style.opacity = '0'; return; }
      const myId = useNetStore.getState().myCharacterId ?? g.activeCharacterId;
      const player = g.positions[myId];
      if (!player) { el.style.opacity = '0'; dust.style.opacity = '0'; return; }
      const dist = Math.hypot(player.x - ts.tornadoX, player.z - ts.tornadoZ);
      const v = dist > ACTIVE_RADIUS ? 0
        : Math.max(0, Math.min(1, (ACTIVE_RADIUS - dist) / (ACTIVE_RADIUS - FULL_DARK_RADIUS)));
      el.style.opacity = v.toFixed(3);
      const d = dist > DUST_RADIUS ? 0
        : Math.max(0, Math.min(0.92, (DUST_RADIUS - dist) / (DUST_RADIUS - DUST_FULL_RADIUS)));
      dust.style.opacity = d.toFixed(3);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
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
      <div
        ref={dustRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0,
          zIndex: 901,
          background:
            'radial-gradient(ellipse at 50% 55%, rgba(120,108,92,0.7) 0%, rgba(92,82,68,0.85) 50%, rgba(70,62,52,0.96) 100%)',
          transition: 'opacity 80ms linear',
        }}
      />
    </>
  );
}
