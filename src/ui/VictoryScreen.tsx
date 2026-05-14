import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';

export function VictoryScreen() {
  const phase = useGameStore((s) => s.phase);
  const kills = useCombatStore((s) => s.kills);
  const shotsFired = useCombatStore((s) => s.shotsFired);
  const shotsHit = useCombatStore((s) => s.shotsHit);
  const startedAt = useCombatStore((s) => s.gameStartedAt);
  if (phase !== 'victory') return null;
  const elapsed = (performance.now() / 1000) - startedAt;
  const accuracy = shotsFired > 0 ? (shotsHit / shotsFired) * 100 : 0;
  let rating = 'C';
  if (accuracy >= 80 && elapsed < 90) rating = 'S';
  else if (accuracy >= 60 && elapsed < 120) rating = 'A';
  else if (accuracy >= 40) rating = 'B';
  const totalEnemies = 4 + 6 + 5;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20, 30, 40, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7e6, #ffe3a3)',
          border: '4px solid #5a8a3e', borderRadius: 24,
          padding: '32px 56px', textAlign: 'center', maxWidth: 560,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ fontSize: 64 }}>🛸 💥</div>
        <h1 style={{ fontSize: 42, margin: '10px 0', color: '#3a5a25' }}>Earth Saved!</h1>
        <p style={{ fontSize: 16, color: '#3a4030', marginBottom: 24 }}>
          You scrubbed the schmorgesblobs off Royal Tara Cove.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 18, maxWidth: 380, margin: '0 auto 18px' }}>
          <Stat label="Time" value={fmtTime(elapsed)} />
          <Stat label="Kills" value={`${kills} / ${totalEnemies}`} />
          <Stat label="Accuracy" value={`${accuracy.toFixed(1)}%`} />
          <Stat label="Shots" value={`${shotsHit} / ${shotsFired}`} />
        </div>
        <div
          style={{
            display: 'inline-block',
            padding: '6px 24px',
            background: ratingColor(rating),
            color: 'white',
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 36,
            marginBottom: 18,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          RANK: {rating}
        </div>
        <div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '14px 36px', fontSize: 18, fontWeight: 700,
              background: '#5a8a3e', color: 'white',
              border: 'none', borderRadius: 12,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            Play again ▶
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.7)', padding: '8px 12px', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: '#5a5a5a', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1c' }}>{value}</div>
    </div>
  );
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
}

function ratingColor(r: string): string {
  switch (r) {
    case 'S': return 'linear-gradient(135deg, #f5d35a, #c89a2a)';
    case 'A': return 'linear-gradient(135deg, #5cb85c, #3a8a3a)';
    case 'B': return 'linear-gradient(135deg, #5ac8e6, #3a6db0)';
    default:  return 'linear-gradient(135deg, #a0a0a0, #6a6a6a)';
  }
}
