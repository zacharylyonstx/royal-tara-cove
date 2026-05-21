import { useGameStore } from '../state/gameStore';
import { useTreehouseStore } from '../state/treehouseStore';
import { MISSIONS } from '../world/treehouseMissions';

export function TreehouseHud() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const activeMissionId = useTreehouseStore((s) => s.activeMissionId);
  const carrying = useTreehouseStore((s) => s.missionItem?.carriedBy ?? null);
  const stickerCount = useTreehouseStore((s) => Object.keys(s.souvenirs).length);

  if (gameMode !== 'treehouse') return null;
  if (phase === 'treehouse-welcome' || phase === 'treehouse-letter-open') return null;

  const mission = activeMissionId ? MISSIONS[activeMissionId] : null;

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 12, zIndex: 50, pointerEvents: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {mission && (
        <div style={{
          background: 'rgba(20,24,30,0.78)', color: '#fff7e6', padding: '8px 14px',
          borderRadius: 12, border: '2px solid #5fa86a', fontSize: 14, fontWeight: 700,
        }}>
          {mission.goalHint}
          {carrying && <span style={{ marginLeft: 8, opacity: 0.85 }}>· carrying</span>}
        </div>
      )}
      <div style={{
        background: 'rgba(20,24,30,0.78)', color: '#fff7e6', padding: '8px 14px',
        borderRadius: 12, border: '2px solid #ffd86a', fontSize: 14, fontWeight: 700,
      }}>
        🏅 {stickerCount}
      </div>
    </div>
  );
}
