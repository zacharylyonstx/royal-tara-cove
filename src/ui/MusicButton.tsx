import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import { useMusicStore } from '../state/musicStore';
import { LOFI_TRACKS } from '../lofi';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/**
 * Free Play's radio button (under the speaker): tap to skip to the next lofi
 * track; after the last one comes "classic" (the original neighbourhood tune),
 * then round again. A chip names what's playing for a few seconds whenever it
 * changes — including when the playlist moves on by itself.
 */
export function MusicButton() {
  const gameMode = useGameStore((s) => s.gameMode);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const wardrobeOpen = useWardrobeStore((s) => s.open);
  const station = useMusicStore((s) => s.station);
  const track = useMusicStore((s) => s.track);
  const changedAt = useMusicStore((s) => s.changedAt);
  const cycle = useMusicStore((s) => s.cycle);
  const [chipFor, setChipFor] = useState(0);

  useEffect(() => {
    if (!changedAt) return;
    const id = setTimeout(() => setChipFor(changedAt), 4200);
    return () => clearTimeout(id);
  }, [changedAt]);

  // Stepping into Free Play: say what's on.
  const inGame = gameMode === 'freeplay' && !welcomeOpen;
  useEffect(() => { if (inGame) useMusicStore.getState().announce(); }, [inGame]);

  if (gameMode !== 'freeplay' || welcomeOpen || wardrobeOpen) return null;
  const showChip = changedAt > 0 && chipFor !== changedAt;
  const label = station === 'classic'
    ? 'Classic neighborhood tune'
    : `${LOFI_TRACKS[track].name} · lofi ${track + 1}/${LOFI_TRACKS.length}`;
  return (
    <>
      <button
        onClick={cycle}
        aria-label="Next song"
        title="Next song"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 116px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
          zIndex: 1001, width: 44, height: 44, borderRadius: 12,
          border: '2px solid rgba(255,255,255,0.4)', background: 'rgba(20,30,40,0.55)', color: '#fff',
          fontSize: 20, cursor: 'pointer', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >
        🎵
      </button>
      {showChip && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 122px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 68px)',
            zIndex: 1001, pointerEvents: 'none', padding: '6px 12px', borderRadius: 999,
            background: 'rgba(20,30,40,0.82)', color: '#fff', fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
            whiteSpace: 'nowrap', border: '1.5px solid rgba(255,255,255,0.25)',
          }}
        >
          ♪ {label}
        </div>
      )}
    </>
  );
}
