import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';

export function MunchiesIntro() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const myCharacterId = useNetStore((s) => s.myCharacterId);

  if (gameMode !== 'munchies') return null;
  if (phase !== 'munchies-intro') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 16, 30, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120,
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#fff7e6',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #2a1f4a, #4a2c66)',
          border: '3px solid #c8a8ff',
          borderRadius: 22,
          padding: '24px 32px',
          textAlign: 'center',
          maxWidth: 540,
        }}
      >
        <div style={{ fontSize: 56 }}>🥛</div>
        <h1 style={{ margin: '6px 0 6px', fontSize: 30, letterSpacing: 1 }}>MIDNIGHT MUNCHIES</h1>
        <p style={{ margin: '6px 0', fontSize: 18 }}>It's midnight. <strong>SHHHH.</strong></p>
        <p style={{ margin: '12px 0', fontSize: 15, opacity: 0.85 }}>
          Sneak around the house, eat every cookie 🍪, and don't let{' '}
          {myCharacterId === 'penny'
            ? 'sleepwalking Dad, Doggie, and the Schmorgesblob catch you.'
            : 'sleepwalking Dad, Penny, or Doggie catch you.'}
          {' '}Drink the glowing milk 🥛 to turn the tables — tap them while they're dozy and tuck them back in!
        </p>
        <p style={{ margin: '14px 0 0', fontSize: 16, fontWeight: 700 }}>
          Press <kbd style={kbd}>W</kbd> <kbd style={kbd}>A</kbd> <kbd style={kbd}>S</kbd> <kbd style={kbd}>D</kbd> to start
        </p>
      </div>
    </div>
  );
}

const kbd: React.CSSProperties = {
  display: 'inline-block',
  background: '#fff7e6',
  color: '#2a1f4a',
  padding: '4px 10px',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontWeight: 800,
  margin: '0 2px',
};
