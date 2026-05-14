import { useEffect, useRef, useState } from 'react';
import { useCombatStore } from '../state/combatStore';

/** Full-screen red overlay that fades in/out when player takes damage. */
export function DamageFlash() {
  const damageFlashAt = useCombatStore((s) => s.damageFlashAt);
  const [opacity, setOpacity] = useState(0);
  const triggeredAtRef = useRef(damageFlashAt);

  useEffect(() => {
    if (damageFlashAt <= triggeredAtRef.current) return;
    triggeredAtRef.current = damageFlashAt;
    setOpacity(0.5);
    const start = performance.now();
    const dur = 500;
    let raf = 0;
    const step = () => {
      const t = (performance.now() - start) / dur;
      if (t >= 1) {
        setOpacity(0);
        return;
      }
      setOpacity(0.5 * (1 - t));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [damageFlashAt]);

  if (opacity === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#a83a3a',
        opacity,
        pointerEvents: 'none',
        zIndex: 80,
        mixBlendMode: 'screen',
      }}
    />
  );
}
