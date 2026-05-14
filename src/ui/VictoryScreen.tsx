import { useGameStore } from '../state/gameStore';

export function VictoryScreen() {
  const phase = useGameStore((s) => s.phase);
  if (phase !== 'victory') return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 30, 40, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7e6, #ffe3a3)',
          border: '4px solid #5a8a3e',
          borderRadius: 24,
          padding: '32px 56px',
          textAlign: 'center',
          maxWidth: 560,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ fontSize: 64 }}>🛸 💥</div>
        <h1 style={{ fontSize: 40, margin: '10px 0', color: '#3a5a25' }}>Earth Saved!</h1>
        <p style={{ fontSize: 18, color: '#3a4030' }}>
          You scrubbed the schmorgesblobs off Royal Tara Cove. Good shooting, family!
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: '14px 36px',
            fontSize: 18,
            fontWeight: 700,
            background: '#5a8a3e',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          Play again ▶
        </button>
      </div>
    </div>
  );
}
