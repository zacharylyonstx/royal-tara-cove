import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { defeatSting } from '../audio';

export function DefeatScreen() {
  const phase = useGameStore((s) => s.phase);
  useEffect(() => {
    if (phase === 'defeat') defeatSting();
  }, [phase]);
  if (phase !== 'defeat') return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(60, 10, 10, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #2a1a1a, #4a2020)',
          border: '4px solid #c83a3a',
          borderRadius: 24,
          padding: '32px 56px',
          textAlign: 'center',
          maxWidth: 560,
          color: '#f5ecd9',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ fontSize: 64 }}>👽</div>
        <h1 style={{ fontSize: 40, margin: '10px 0', color: '#ffa0a0' }}>The Schmorgesblobs Got Us</h1>
        <p style={{ fontSize: 18 }}>
          They squished everyone in the cul-de-sac. Earth is lost. Probably.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: '14px 36px',
            fontSize: 18,
            fontWeight: 700,
            background: '#c83a3a',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          Try again ▶
        </button>
      </div>
    </div>
  );
}
