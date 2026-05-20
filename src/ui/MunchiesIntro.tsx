import { useGameStore } from '../state/gameStore';

export function MunchiesIntro() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);

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
        <p style={{ margin: '6px 0 14px', fontSize: 18 }}>It's midnight. <strong>SHHHH.</strong></p>

        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '8px 14px', textAlign: 'left', maxWidth: 430, margin: '0 auto 14px', alignItems: 'center' }}>
          <div style={{ fontSize: 28, textAlign: 'center' }}>🍪</div>
          <div style={{ fontSize: 14 }}>Eat <strong>every cookie</strong> in the house to win.</div>

          <div style={{ fontSize: 28, textAlign: 'center' }}>😴</div>
          <div style={{ fontSize: 14 }}>Don't let sleepwalkers tag you — they'll walk you back to bed and you lose a life.</div>

          <div style={{ fontSize: 28, textAlign: 'center' }}>🥛</div>
          <div style={{ fontSize: 14 }}>Drink a <strong>glowing milk</strong> in the corner and they all turn <span style={{ color: '#8acfff', fontWeight: 700 }}>BLUE</span> for a few seconds.</div>

          <div style={{ fontSize: 28, textAlign: 'center' }}>💥</div>
          <div style={{ fontSize: 14 }}>While they're blue, <strong>tap them</strong> to tuck them back in bed for big points!</div>
        </div>

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
