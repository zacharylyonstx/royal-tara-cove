import { useNetStore } from '../state/netStore';
import { CHARACTERS } from '../world/characters';

/**
 * Small HUD chip showing room mode, peer count, and your character (or
 * "spectating"). Hidden until a room is joined.
 */
export function RoomBadge() {
  const mode = useNetStore((s) => s.mode);
  const peers = useNetStore((s) => s.peers);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const spectator = useNetStore((s) => s.spectator);
  const isHost = useNetStore((s) => s.isHost);
  const status = useNetStore((s) => s.connectionStatus);

  if (!mode) return null;

  const peerCount = Object.keys(peers).length;
  const modeLabel = mode === 'aliens' ? '👽 Aliens' : '🌪️ Tornado';
  const myDef = myCharacterId ? CHARACTERS[myCharacterId] : null;

  const statusDot =
    status === 'connected' ? '#5cb85c'
    : status === 'connecting' ? '#f0ad4e'
    : status === 'error' ? '#d9534f'
    : '#888';

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        background: 'rgba(20, 30, 40, 0.78)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: 10,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backdropFilter: 'blur(6px)',
        zIndex: 50,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: statusDot,
          flexShrink: 0,
        }}
      />
      <span>{modeLabel}</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>👥 {peerCount}</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>
        {spectator ? (
          '👀 Spectating'
        ) : myDef ? (
          <>
            {myDef.emoji} {myDef.name}
            {isHost && peerCount > 1 && <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 10 }}>· host</span>}
          </>
        ) : (
          'no character'
        )}
      </span>
    </div>
  );
}
