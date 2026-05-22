import { useGameStore } from '../state/gameStore';
import { useTreehouseStore } from '../state/treehouseStore';
import { MISSIONS } from '../world/treehouseMissions';

function renderInlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

export function TreehouseLetterOverlay() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const activeMissionId = useTreehouseStore((s) => s.activeMissionId);
  const pendingMissionId = useTreehouseStore((s) => s.pendingMissionId);

  if (gameMode !== 'treehouse') return null;
  if (phase !== 'treehouse-letter-open') return null;

  const id = activeMissionId ?? pendingMissionId;
  const mission = MISSIONS[id];
  if (!mission) {
    setTimeout(() => setPhase('treehouse-play'), 0);
    return null;
  }

  const close = () => setPhase('treehouse-play');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20, 24, 30, 0.7)', zIndex: 125,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }} onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff7e6',
          color: '#3a2010',
          padding: '28px 32px',
          borderRadius: 12,
          maxWidth: 540,
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
          border: '2px solid #a98654',
          fontFamily: '"Segoe UI", "Georgia", serif',
        }}>
        <div style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>
          📬 From: {mission.sender}
        </div>
        <h2 style={{ margin: '4px 0 14px', fontSize: 22 }}>{mission.title}</h2>
        <div style={{ fontSize: 15, lineHeight: 1.55 }}>
          {mission.bodyMarkdown.split('\n').map((line, i) => (
            <p key={i} style={{ margin: '0 0 8px' }}>
              {renderInlineMarkdown(line)}
            </p>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: '10px 12px', background: '#f0e2c2', borderRadius: 8, fontSize: 14 }}>
          {mission.goalHint}
        </div>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button
            onClick={close}
            style={{
              padding: '10px 22px', fontSize: 15, fontWeight: 700,
              background: '#2c5e3a', color: '#fff7e6', border: 'none', borderRadius: 8, cursor: 'pointer',
            }}>
            Got it! ▶
          </button>
        </div>
      </div>
    </div>
  );
}
