import { useGameStore } from '../state/gameStore';
import { CHARACTERS } from '../world/characters';
import { unlockAudio } from '../audio';

export function WelcomeScreen() {
  const open = useGameStore((s) => s.welcomeOpen);
  const close = useGameStore((s) => s.closeWelcome);
  const handleClose = () => {
    unlockAudio();
    close();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 30, 40, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7e6, #ffe3a3)',
          border: '4px solid #5a8a3e',
          borderRadius: 24,
          padding: '32px 48px',
          maxWidth: 560,
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <h1 style={{ fontSize: 42, margin: 0, color: '#3a5a25' }}>🏡 Royal Tara Cove</h1>
        <p style={{ fontSize: 22, color: '#3a4030', margin: '14px 0 6px' }}>
          Hi <strong>Penny</strong> &amp; <strong>Luke</strong>!
        </p>
        <p style={{ fontSize: 17, color: '#4a4a4a', margin: '6px 0 18px' }}>
          Welcome back to the old neighborhood. Pick who you want to play, then
          walk around — visit the houses, peek in the backyards, explore!
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            margin: '12px 0 22px',
          }}
        >
          {(['dad', 'penny', 'luke'] as const).map((id, i) => (
            <div
              key={id}
              style={{
                flex: 1,
                padding: '12px 8px',
                background: 'rgba(255,255,255,0.65)',
                borderRadius: 12,
                fontSize: 14,
                color: '#3a4030',
              }}
            >
              <div style={{ fontSize: 32 }}>{CHARACTERS[id].emoji}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{CHARACTERS[id].name}</div>
              <div style={{ fontSize: 16, marginTop: 6 }}>
                Press{' '}
                <kbd
                  style={{
                    padding: '3px 10px',
                    background: '#3a5a25',
                    color: 'white',
                    borderRadius: 6,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </kbd>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: '#5a5040', marginBottom: 20 }}>
          Move with <strong>WASD</strong> · <strong>Shift</strong> to run ·{' '}
          <strong>Space</strong> jump · <strong>E</strong> open doors ·{' '}
          <strong>R</strong> reset · drag the mouse to look · scroll to zoom
        </p>
        <p style={{ fontSize: 14, color: '#5a3a25', marginBottom: 16, fontWeight: 600 }}>
          ⚠️ A UFO is about to crash in your backyard. Schmorgesblobs will
          attack — <strong>click to fire your ray gun!</strong>
        </p>
        <p style={{ fontSize: 13, color: '#5a5040', marginBottom: 20, fontStyle: 'italic' }}>
          The big two-story at the end of the street (10600) — that's home.
        </p>
        <button
          onClick={handleClose}
          style={{
            padding: '14px 36px',
            fontSize: 20,
            fontWeight: 700,
            background: '#5a8a3e',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          Let's play! ▶
        </button>
      </div>
    </div>
  );
}
