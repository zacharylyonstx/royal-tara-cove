import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';

export function CombatHud() {
  const phase = useGameStore((s) => s.phase);
  const hp = useGameStore((s) => s.playerHp);
  const maxHp = useGameStore((s) => s.maxHp);
  const blobs = useCombatStore((s) => s.blobs);
  const blobsToSpawn = useCombatStore((s) => s.blobsToSpawn);
  const waveIndex = useCombatStore((s) => s.waveIndex);
  if (phase !== 'combat' && phase !== 'intro') return null;
  const aliveBlobs = blobs.filter((b) => b.alive).length;
  const queued = blobsToSpawn.reduce((s, x) => s + x.count, 0);

  return (
    <>
      <div
        style={{
          position: 'fixed', top: 16, left: 16,
          padding: '8px 14px',
          background: 'rgba(20, 30, 40, 0.65)', color: 'white',
          borderRadius: 10,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 13, fontWeight: 600,
          pointerEvents: 'none', backdropFilter: 'blur(6px)',
          zIndex: 90, minWidth: 220,
        }}
      >
        <div style={{ marginBottom: 4 }}>FAMILY HP <span style={{ fontWeight: 400, opacity: 0.7 }}>{hp}/{maxHp}</span></div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 240 }}>
          {Array.from({ length: maxHp }, (_, i) => (
            <div
              key={i}
              style={{
                width: 10, height: 18, borderRadius: 2,
                background: i < hp ? 'linear-gradient(135deg, #ff7474, #c83a3a)' : 'rgba(100,100,110,0.4)',
                boxShadow: i < hp ? '0 0 4px rgba(255,80,80,0.5)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'fixed', top: 16,
          left: '50%', transform: 'translateX(-50%)',
          padding: '8px 14px',
          background: 'rgba(20, 30, 40, 0.65)', color: 'white',
          borderRadius: 10,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 14, fontWeight: 600,
          pointerEvents: 'none', backdropFilter: 'blur(6px)',
          zIndex: 90,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 2 }}>WAVE {waveIndex || 1} / 3</div>
        <div>🛸 SCHMORGESBLOBS: <span style={{ color: '#a0e84a' }}>{aliveBlobs + queued}</span></div>
      </div>

      {phase === 'combat' && (
        <div
          style={{
            position: 'fixed', bottom: 80,
            left: '50%', transform: 'translateX(-50%)',
            padding: '6px 14px',
            background: 'rgba(20, 30, 40, 0.6)', color: 'white',
            borderRadius: 8,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 13,
            pointerEvents: 'none', backdropFilter: 'blur(6px)',
            zIndex: 90,
          }}
        >
          <kbd style={{ padding: '2px 8px', background: '#3a5a25', borderRadius: 4, marginRight: 6, fontWeight: 700 }}>
            CLICK
          </kbd>
          fire ray gun
        </div>
      )}
    </>
  );
}
