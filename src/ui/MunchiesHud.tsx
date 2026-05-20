import { useGameStore } from '../state/gameStore';
import { useMunchiesStore } from '../state/munchiesStore';

export function MunchiesHud() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const score = useMunchiesStore((s) => s.score);
  const lives = useMunchiesStore((s) => s.lives);
  const level = useMunchiesStore((s) => s.level);
  const pelletsLeft = useMunchiesStore((s) => Object.keys(s.pellets).length);

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
        <span>⭐ {score}</span>
        <span>Level {level}</span>
        <span>{Array.from({ length: lives }).map((_, i) => <span key={i}>🥛</span>)}</span>
      </div>
    </div>
  );
}
