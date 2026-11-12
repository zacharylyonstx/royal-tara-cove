import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { useMunchiesStore } from '../state/munchiesStore';
import { defeatSting } from '../audio';
import type { SleepwalkerId } from '../state/munchiesStore';
import { requestMunchies } from '../net/room';

function caughtByLine(who: SleepwalkerId | null): string {
  switch (who) {
    case 'dad':           return 'Dad walked you back to bed.';
    case 'penny':         return 'Penny mumbled "shhh" and walked you back to bed.';
    case 'luke':          return 'Luke sleep-shuffled you right back to bed.';
    case 'dog':           return 'The dog gently herded you back to bed.';
    case 'schmorgesblob': return 'A leftover Schmorgesblob slimed you back to bed!';
    default:              return 'You got tucked back in.';
  }
}

export function MunchiesGameOver() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const score = useMunchiesStore((s) => s.score);
  const lastCaughtBy = useMunchiesStore((s) => s.lastCaughtBy);
  const cookiesEaten = useMunchiesStore((s) => s.cookiesEaten);

  // Losing the last life used to land in total silence while the lullaby
  // looped on — give it a gentle punctuation mark.
  const showing = gameMode === 'munchies' && phase === 'munchies-game-over';
  useEffect(() => {
    if (showing) defeatSting();
  }, [showing]);

  if (!showing) return null;

  // The host owns the phase — a guest's tap is relayed (it used to do nothing).
  const tryAgain = () => requestMunchies('again');

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20, 10, 20, 0.78)', zIndex: 140,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #3a2f4a, #5a3a6c)', borderRadius: 22,
        padding: '28px 36px', color: '#fff7e6', textAlign: 'center',
        border: '3px solid #c8a8ff', boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
        animation: 'pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}>
        <div style={{ fontSize: 64 }}>😴</div>
        <h2 style={{ margin: '6px 0', fontSize: 28 }}>Caught!</h2>
        <p style={{ margin: '6px 0' }}>{caughtByLine(lastCaughtBy)}</p>
        <p style={{ margin: '12px 0', fontSize: 16 }}>Cookies eaten: <strong>{cookiesEaten}</strong> · Score: <strong>{score}</strong></p>
        <button
          onClick={tryAgain}
          style={{
            marginTop: 8, padding: '12px 28px', fontSize: 16, fontWeight: 700,
            background: '#7a5cad', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
            minHeight: 48, touchAction: 'manipulation',
          }}
        >Try again ▶</button>
      </div>
    </div>
  );
}
