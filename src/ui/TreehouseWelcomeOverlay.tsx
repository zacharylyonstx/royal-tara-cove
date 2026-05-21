import { useGameStore } from '../state/gameStore';
import { useTreehouseStore } from '../state/treehouseStore';

export function TreehouseWelcomeOverlay() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const hasSeenWelcome = useTreehouseStore((s) => s.hasSeenWelcome);
  const markSeen = useTreehouseStore((s) => s.markWelcomeSeen);
  const setPhase = useGameStore((s) => s.setPhase);

  if (gameMode !== 'treehouse') return null;
  if (phase !== 'treehouse-welcome') return null;
  if (hasSeenWelcome) {
    setTimeout(() => setPhase('treehouse-play'), 0);
    return null;
  }

  const accept = () => {
    markSeen();
    setPhase('treehouse-play');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20, 24, 30, 0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #2c5e3a, #5fa86a)',
        border: '3px solid #fff7e6', borderRadius: 22, padding: '24px 32px',
        color: '#fff7e6', textAlign: 'center', maxWidth: 480,
        boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 56 }}>🌳</div>
        <h1 style={{ margin: '6px 0', fontSize: 28 }}>The Treehouse Club</h1>
        <p style={{ margin: '6px 0', fontSize: 16 }}>Welcome to your headquarters.</p>
        <div style={{ textAlign: 'left', fontSize: 14, margin: '14px 0' }}>
          <p>🪜 <strong>Climb the ladder</strong> in the backyard to enter the treehouse (press <kbd style={kbd}>E</kbd> near it).</p>
          <p>📬 Inside, <strong>click the letter board</strong> to read new mail.</p>
          <p>🎯 Each letter is a small adventure around the cove.</p>
          <p>🏅 Every adventure earns a sticker that stays on your shelf — forever.</p>
        </div>
        <button onClick={accept} style={{
          marginTop: 8, padding: '12px 28px', fontSize: 16, fontWeight: 700,
          background: '#fff7e6', color: '#2c5e3a', border: 'none', borderRadius: 10, cursor: 'pointer',
        }}>Let's go! ▶</button>
      </div>
    </div>
  );
}

const kbd: React.CSSProperties = {
  display: 'inline-block', background: '#fff7e6', color: '#2c5e3a',
  padding: '1px 7px', borderRadius: 4, fontFamily: 'inherit', fontWeight: 800, margin: '0 2px',
};
