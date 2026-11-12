import { useGameStore } from '../state/gameStore';
import { requestMunchies } from '../net/room';
import { isTouchDevice } from '../systems/touchInput';

export function MunchiesIntro() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);

  if (gameMode !== 'munchies') return null;
  if (phase !== 'munchies-intro' || welcomeOpen) return null;
  const touch = isTouchDevice();

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
          pointerEvents: 'auto',
        }}
      >
        <div style={{ fontSize: 56 }}>🥛</div>
        <h1 style={{ margin: '6px 0 6px', fontSize: 30, letterSpacing: 1 }}>MIDNIGHT MUNCHIES</h1>
        <p style={{ margin: '6px 0 14px', fontSize: 18 }}>It's midnight. <strong>SHHHH.</strong></p>

        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '8px 14px', textAlign: 'left', maxWidth: 430, margin: '0 auto 14px', alignItems: 'center' }}>
          <div style={{ fontSize: 28, textAlign: 'center' }}>🍪</div>
          <div style={{ fontSize: 14 }}>Eat <strong>every cookie</strong> in the house to win.</div>

          <div style={{ fontSize: 28, textAlign: 'center' }}>😴</div>
          <div style={{ fontSize: 14 }}>Don't let the sleepwalkers tag you — they'll walk you back to the door and you lose a ❤️.</div>

          <div style={{ fontSize: 28, textAlign: 'center' }}>🥛</div>
          <div style={{ fontSize: 14 }}>Drink a <strong>glowing milk</strong> in the corner and they all turn <span style={{ color: '#8acfff', fontWeight: 700 }}>BLUE</span> for a few seconds.</div>

          <div style={{ fontSize: 28, textAlign: 'center' }}>💥</div>
          <div style={{ fontSize: 14 }}>While they're blue, <strong>bump into them</strong> to tuck them back in bed for big points!</div>
        </div>

        {/* A real button: the old "press WASD" was the ONLY way to start, which
            did nothing on an iPad (no keys) or for whoever wasn't the host. */}
        <button
          onClick={() => requestMunchies('start')}
          style={{
            marginTop: 6, padding: '14px 40px', fontSize: 20, fontWeight: 800,
            background: '#ffd86a', color: '#3a2a10', border: 'none', borderRadius: 14,
            cursor: 'pointer', minHeight: 52, touchAction: 'manipulation',
            boxShadow: '0 6px 0 #b8902a',
          }}
        >Start ▶</button>
        {!touch && (
          <p style={{ margin: '12px 0 0', fontSize: 13, opacity: 0.8 }}>
            …or press <kbd style={kbd}>W</kbd> <kbd style={kbd}>A</kbd> <kbd style={kbd}>S</kbd> <kbd style={kbd}>D</kbd>
          </p>
        )}
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
