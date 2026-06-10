import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useNetStore } from '../state/netStore';

/** In-place aliens restart — keeps the P2P room and character claims alive
 *  (a page reload used to kick every peer and force a full re-join). */
export function replayAliens() {
  useCombatStore.getState().reset();
  const gs = useGameStore.getState();
  gs.resetHp();
  gs.resetFamilyPositions();
  // UFOCrash's phase-'intro' effect re-zeros its timers and replays the
  // crash cinematic; WaveController restarts the waves from there.
  gs.setPhase('intro');
}

export function VictoryScreen() {
  const phase = useGameStore((s) => s.phase);
  const gameMode = useGameStore((s) => s.gameMode);
  const isHost = useNetStore((s) => s.isHost);
  const peerCount = useNetStore((s) => Object.keys(s.peers).length);
  const kills = useCombatStore((s) => s.kills);
  const shotsFired = useCombatStore((s) => s.shotsFired);
  const shotsHit = useCombatStore((s) => s.shotsHit);
  const startedAt = useCombatStore((s) => s.gameStartedAt);
  const score = useCombatStore((s) => s.score);
  if (phase !== 'victory' || gameMode !== 'aliens') return null;
  const elapsed = (performance.now() / 1000) - startedAt;
  const accuracy = shotsFired > 0 ? (shotsHit / shotsFired) * 100 : 0;
  let rating = 'C';
  if (accuracy >= 80 && elapsed < 90) rating = 'S';
  else if (accuracy >= 60 && elapsed < 120) rating = 'A';
  else if (accuracy >= 40) rating = 'B';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 24,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(255,247,230,0.92), rgba(255,227,163,0.92))',
          border: '4px solid #5a8a3e', borderRadius: 24,
          padding: '20px 44px', textAlign: 'center', maxWidth: 560,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'auto',
          animation: 'pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        <div style={{ fontSize: 64 }}>🛸 💥</div>
        <h1 style={{ fontSize: 42, margin: '10px 0', color: '#3a5a25' }}>Earth Saved!</h1>
        <p style={{ fontSize: 16, color: '#3a4030', marginBottom: 24 }}>
          You scrubbed the schmorgesblobs off Royal Tara Cove.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18, maxWidth: 480, margin: '0 auto 18px' }}>
          <Stat label="Score" value={score.toLocaleString()} />
          <Stat label="Time" value={fmtTime(elapsed)} />
          <Stat label="Kills" value={String(kills)} />
          <Stat label="Accuracy" value={`${accuracy.toFixed(1)}%`} />
          <Stat label="Shots" value={`${shotsHit} / ${shotsFired}`} />
          <Stat label="Status" value="🎉 PARTY!" />
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
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {/* Phase is host-authoritative in co-op — a guest's restart would be
              overwritten by the next world snapshot, so only the host (or a
              solo player) gets the live button. */}
          {isHost ? (
            <button
              onClick={replayAliens}
              style={{
                padding: '14px 28px', fontSize: 16, fontWeight: 700,
                background: '#888', color: 'white',
                border: 'none', borderRadius: 12,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              Play again ↻
            </button>
          ) : null}
          {isHost ? (
            <button
              onClick={() => useGameStore.getState().setPhase('free-play')}
              style={{
                padding: '14px 36px', fontSize: 18, fontWeight: 700,
                background: '#5a8a3e', color: 'white',
                border: 'none', borderRadius: 12,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              Keep playing →
            </button>
          ) : peerCount > 1 ? (
            <button
              disabled
              style={{
                padding: '14px 36px', fontSize: 18, fontWeight: 700,
                background: 'rgba(120,120,120,0.4)', color: 'rgba(255,255,255,0.7)',
                border: 'none', borderRadius: 12,
                cursor: 'not-allowed',
              }}
            >
              Keep playing → (host decides)
            </button>
          ) : null}
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
