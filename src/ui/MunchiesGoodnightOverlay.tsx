import { useGameStore } from '../state/gameStore';

/**
 * Pre-victory cinematic: stars + moon fade-in over a dimmed sky.
 * Renders one z-layer BELOW MunchiesVictoryScreen so the card sits on top.
 */
export function MunchiesGoodnightOverlay() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  if (gameMode !== 'munchies' || phase !== 'munchies-victory') return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 145, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(20,20,50,0.45) 0%, rgba(8,5,22,0.92) 80%)',
        animation: 'munchies-goodnight-in 1.8s ease-out forwards',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '14%',
          right: '12%',
          fontSize: 96,
          opacity: 0,
          animation: 'munchies-moon-in 2.2s ease-out 0.4s forwards',
        }}
      >🌙</div>
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${(i * 53) % 90 + 4}%`,
            left: `${(i * 31) % 92 + 3}%`,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: '#fff7e6',
            opacity: 0,
            animation: `munchies-star-twinkle 2.6s ease-in-out ${0.6 + (i % 7) * 0.18}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes munchies-goodnight-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes munchies-moon-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes munchies-star-twinkle { 0%, 100% { opacity: 0.15; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
