import { useMemo } from 'react';
import { useNetStore } from '../state/netStore';
import { CHARACTERS, CHARACTER_ORDER } from '../world/characters';
import type { CharacterId } from '../types';
import { useGameStore } from '../state/gameStore';
import { useTornadoStore } from '../state/tornadoStore';
import { claimCharacter, leaveRoom } from '../net/room';
import { unlockAudio } from '../audio';
import { MunchiesDifficultyToggle } from './MunchiesDifficultyToggle';

/**
 * Shown after a game mode is picked but before the game starts. Lets the
 * local player claim a free character. Updates live from net presence.
 */
export function CharacterSelect() {
  const mode = useNetStore((s) => s.mode);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const peers = useNetStore((s) => s.peers);
  const selfId = useNetStore((s) => s.selfId);
  const spectator = useNetStore((s) => s.spectator);
  const setSpectator = useNetStore((s) => s.setSpectator);

  const closeWelcome = useGameStore((s) => s.closeWelcome);
  const resetTornadoGame = useGameStore((s) => s.resetTornadoGame);
  const resetHp = useGameStore((s) => s.resetHp);
  const gameMode = useGameStore((s) => s.gameMode);

  const visibleChars = (gameMode === 'munchies' || gameMode === 'treehouse')
    ? CHARACTER_ORDER.filter((id) => id === 'luke' || id === 'penny')
    : CHARACTER_ORDER;

  // Picking shows the select; once myCharacterId or spectator chosen, hide.
  const visible = mode !== null && myCharacterId === null && !spectator;

  // Compute character → owning peer (or null if free).
  const owners = useMemo(() => {
    const m: Partial<Record<CharacterId, string>> = {};
    for (const p of Object.values(peers)) {
      if (p.characterId) m[p.characterId] = p.peerId;
    }
    return m;
  }, [peers]);

  const allTaken = CHARACTER_ORDER.every((id) => owners[id]);

  const handlePick = async (id: CharacterId) => {
    if (owners[id] && owners[id] !== selfId) return; // can't pick taken
    unlockAudio();
    await claimCharacter(id);
    const becameHost = useNetStore.getState().isHost;
    if (becameHost) {
      // First-to-join: fresh game. Reset local state and start phase.
      resetHp();
      resetTornadoGame();
      useTornadoStore.getState().reset();
      useTornadoStore.getState().setPhaseEnteredAt(performance.now() / 1000);
      closeWelcome();
    } else {
      // Joining a game in progress — don't touch shared state. Just hide
      // the modal; host's next snapshot fills everything in.
      useGameStore.setState({ welcomeOpen: false });
    }
  };

  const handleSpectate = () => {
    unlockAudio();
    setSpectator(true);
    // Spectators are by definition joining a game already in progress —
    // just hide the modal and let host snapshots drive everything.
    useGameStore.setState({ welcomeOpen: false });
  };

  const handleBack = async () => {
    await leaveRoom();
    // Re-open the welcome screen.
    useGameStore.getState().openWelcome();
  };

  if (!visible) return null;

  const modeLabel = mode === 'aliens' ? 'ALIEN INVASION' : mode === 'munchies' ? 'MIDNIGHT MUNCHIES' : 'TORNADO WARNING';
  const modeAccent = mode === 'aliens' ? '#5a8a3e' : mode === 'munchies' ? '#5a3a8a' : '#3a5a8a';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 30, 40, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
        padding: 16,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7e6, #ffe3a3)',
          border: `4px solid ${modeAccent}`,
          borderRadius: 24,
          padding: '28px 36px',
          maxWidth: 820,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ fontSize: 14, color: '#5a5040', marginBottom: 4 }}>
          Room: <strong>{modeLabel}</strong> · {Object.keys(peers).length}{' '}
          player{Object.keys(peers).length === 1 ? '' : 's'} here
        </div>
        <h1 style={{ fontSize: 32, margin: '4px 0 12px', color: modeAccent }}>
          {allTaken ? 'All characters are taken' : 'Pick your character'}
        </h1>

        {gameMode === 'munchies' && (
          <>
            <p style={{ fontSize: 14, color: '#5a5040', margin: '4px 0 8px' }}>
              Pick a sneaker. Penny and Luke can both play — or team up in two windows.
            </p>
            <MunchiesDifficultyToggle />
          </>
        )}
        {gameMode === 'treehouse' && (
          <p style={{ fontSize: 14, color: '#5a5040', margin: '4px 0 12px' }}>
            Pick a club member. Penny and Luke can both play — solo or in two windows.
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: visibleChars.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
            gap: 12,
            margin: '8px 0 18px',
          }}
        >
          {visibleChars.map((id) => {
            const def = CHARACTERS[id];
            const ownerId = owners[id];
            const taken = !!ownerId && ownerId !== selfId;
            const me = ownerId === selfId;
            return (
              <CharCard
                key={id}
                emoji={def.emoji}
                name={def.name}
                accent={def.bodyColor}
                taken={taken}
                me={me}
                onPick={() => handlePick(id)}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={handleBack}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              background: '#888',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          {allTaken && (
            <button
              onClick={handleSpectate}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 700,
                background: modeAccent,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              👀 Spectate
            </button>
          )}
        </div>

        <p style={{ fontSize: 12, color: '#5a5040', margin: '14px 0 0' }}>
          New players appear automatically — others on your call just go to the same URL and pick the same mode.
        </p>
      </div>
    </div>
  );
}

function CharCard({
  emoji,
  name,
  accent,
  taken,
  me,
  onPick,
}: {
  emoji: string;
  name: string;
  accent: string;
  taken: boolean;
  me: boolean;
  onPick: () => void;
}) {
  const disabled = taken;
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      style={{
        background: disabled ? 'rgba(180,180,180,0.55)' : 'rgba(255,255,255,0.85)',
        border: `3px solid ${disabled ? '#aaa' : accent}`,
        borderRadius: 16,
        padding: '18px 12px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        position: 'relative',
        transition: 'transform 0.08s ease',
      }}
      onMouseDown={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
      }}
    >
      <div style={{ fontSize: 52, lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent, letterSpacing: 0.5 }}>
        {name.toUpperCase()}
      </div>
      <div style={{ fontSize: 12, color: '#5a5040', minHeight: 18 }}>
        {me ? '✅ You' : disabled ? 'Taken' : 'Available'}
      </div>
    </button>
  );
}
