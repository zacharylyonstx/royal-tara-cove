import { useGameStore } from '../state/gameStore';
import { usePlayStore } from '../state/playStore';

/** Family basketball counter — shown only in non-combat free-roam. */
export function Scoreboard() {
  const familyBaskets = usePlayStore((s) => s.familyBaskets);
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const show =
    gameMode === 'aliens' &&
    (phase === 'free-play' || phase === 'pre-intro' || phase === 'victory');
  if (!show || familyBaskets <= 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 16px',
        background: 'rgba(20, 30, 40, 0.7)',
        color: 'white',
        borderRadius: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 18,
        fontWeight: 700,
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      🏀 {familyBaskets}
    </div>
  );
}
