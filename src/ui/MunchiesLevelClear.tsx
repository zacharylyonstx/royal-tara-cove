import { useGameStore } from '../state/gameStore';
import { useMunchiesStore } from '../state/munchiesStore';

export function MunchiesLevelClear() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const level = useMunchiesStore((s) => s.level);

  if (gameMode !== 'munchies') return null;
  if (phase !== 'munchies-level-clear') return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 130, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #2c5e3a, #5fa86a)',
        border: '3px solid #fff7e6', borderRadius: 22, padding: '20px 36px',
        color: '#fff7e6', textAlign: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 48 }}>🍪</div>
        <h2 style={{ margin: '4px 0', fontSize: 28 }}>Level {level} cleared!</h2>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>Get ready, they're waking up…</p>
      </div>
    </div>
  );
}
