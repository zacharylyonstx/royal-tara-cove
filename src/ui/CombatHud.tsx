import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';

export function CombatHud() {
  const phase = useGameStore((s) => s.phase);
  const hp = useGameStore((s) => s.playerHp);
  const maxHp = useGameStore((s) => s.maxHp);
  const blobs = useCombatStore((s) => s.blobs);
  const blobsToSpawn = useCombatStore((s) => s.blobsToSpawn);
  if (phase !== 'combat' && phase !== 'intro') return null;
  const aliveBlobs = blobs.filter((b) => b.alive).length + blobsToSpawn;

  return (
    <>
      {/* HP bar */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          padding: '8px 14px',
          background: 'rgba(20, 30, 40, 0.65)',
          color: 'white',
          borderRadius: 10,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
          zIndex: 90,
          minWidth: 220,
        }}
      >
        <div style={{ marginBottom: 4 }}>FAMILY HP</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: maxHp }, (_, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                background: i < hp ? 'linear-gradient(135deg, #ff7474, #c83a3a)' : 'rgba(100,100,110,0.4)',
                boxShadow: i < hp ? '0 0 6px rgba(255,80,80,0.5)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Schmorgesblob counter */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 14px',
          background: 'rgba(20, 30, 40, 0.65)',
          color: 'white',
          borderRadius: 10,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
          zIndex: 90,
        }}
      >
        🛸 SCHMORGESBLOBS REMAINING: <span style={{ color: '#a0e84a' }}>{aliveBlobs}</span>
      </div>

      {/* Fire prompt */}
      {phase === 'combat' && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 14px',
            background: 'rgba(20, 30, 40, 0.6)',
            color: 'white',
            borderRadius: 8,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 13,
            pointerEvents: 'none',
            backdropFilter: 'blur(6px)',
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
