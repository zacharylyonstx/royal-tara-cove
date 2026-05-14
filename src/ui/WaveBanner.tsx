import { useEffect, useState } from 'react';
import { useCombatStore } from '../state/combatStore';

export function WaveBanner() {
  const waveState = useCombatStore((s) => s.waveState);
  const waveIndex = useCombatStore((s) => s.waveIndex);
  const intermissionEndsAt = useCombatStore((s) => s.intermissionEndsAt);
  const [now, setNow] = useState(performance.now() / 1000);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(performance.now() / 1000);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  // Show during intermission with countdown
  if (waveState === 'intermission') {
    const remain = Math.max(0, intermissionEndsAt - now);
    const next = waveIndex + 1;
    return (
      <div
        style={{
          position: 'fixed',
          top: '36%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(60, 10, 10, 0.85)',
          border: '3px solid #ff3a3a',
          borderRadius: 16,
          padding: '20px 36px',
          color: 'white',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
          boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
          zIndex: 95,
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 14, letterSpacing: 4, opacity: 0.7 }}>WAVE CLEARED</div>
        <div style={{ fontSize: 36, fontWeight: 800, marginTop: 6 }}>WAVE {next} INCOMING</div>
        <div style={{ fontSize: 18, marginTop: 8, color: '#ffa0a0' }}>in {remain.toFixed(1)}s</div>
      </div>
    );
  }

  // Briefly show new-wave banner when spawning starts
  if (waveState === 'spawning' && waveIndex >= 1) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(20, 30, 40, 0.7)',
          border: '2px solid #3afff0',
          borderRadius: 10,
          padding: '6px 18px',
          color: 'white',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 2,
          zIndex: 95,
          pointerEvents: 'none',
        }}
      >
        WAVE {waveIndex} / 3
      </div>
    );
  }

  return null;
}
