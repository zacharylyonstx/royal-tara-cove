import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useMunchiesStore } from '../state/munchiesStore';
import { useNetStore } from '../state/netStore';
import { loadBestScore } from '../world/munchiesScoreStorage';
import type { PlayableCharacter } from '../world/munchiesConfig';

export function MunchiesHud() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const score = useMunchiesStore((s) => s.score);
  const lives = useMunchiesStore((s) => s.lives);
  const level = useMunchiesStore((s) => s.level);
  const pelletsLeft = useMunchiesStore((s) => Object.keys(s.pellets).length);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const localChar: PlayableCharacter = (myCharacterId === 'penny' ? 'penny' : myCharacterId === 'dad' ? 'dad' : 'luke');
  const [best, setBest] = useState<number>(() => loadBestScore(localChar));
  useEffect(() => { setBest(loadBestScore(localChar)); }, [localChar]);
  useEffect(() => {
    if (score > best) setBest(score);
  }, [score, best]);

  if (gameMode !== 'munchies') return null;
  if (phase === 'munchies-intro') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 50,
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          background: 'rgba(20, 16, 30, 0.78)',
          color: '#fff7e6',
          padding: '10px 22px',
          borderRadius: 16,
          display: 'flex',
          gap: 26,
          alignItems: 'center',
          border: '2px solid #7a5cad',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          fontWeight: 700,
        }}
      >
        <span>🍪 {pelletsLeft}</span>
        <span>⭐ {score} <span style={{ opacity: 0.65, fontWeight: 500, fontSize: 13 }}>· Best {best}</span></span>
        <span>Level {level}</span>
        {phase === 'munchies-powered' && <MilkTimer />}
        {/* Lives are hearts — 🥛 is the power-up, and showing it here read as "milks collected". */}
        <span>{Array.from({ length: lives }).map((_, i) => <span key={i}>❤️</span>)}</span>
      </div>
    </div>
  );
}

/** Countdown bar while the milk power is on, so the kids can SEE it running out
 *  (it used to just end, mid-chase, with no warning). */
function MilkTimer() {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let full = 0;
    const tick = () => {
      const left = Math.max(0, useMunchiesStore.getState().poweredUntil - performance.now() / 1000);
      if (left > full) full = left;
      const el = barRef.current;
      if (el) {
        el.style.width = `${full > 0 ? Math.round((left / full) * 100) : 0}%`;
        // Flash for the last two seconds.
        el.style.opacity = left < 2 && Math.floor(left * 6) % 2 === 0 ? '0.35' : '1';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      🥛
      <span style={{ display: 'inline-block', width: 90, height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
        <div ref={barRef} style={{ height: '100%', width: '100%', background: '#8acfff', borderRadius: 6 }} />
      </span>
    </span>
  );
}
