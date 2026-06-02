import { useGameStore } from '../state/gameStore';
import { usePlayStore } from '../state/playStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import type { CharacterId } from '../types';

const IDS: CharacterId[] = ['dad', 'penny', 'luke'];

// "Back to the game picker" — Treehouse and Free Play had no way out (you were
// stuck until reload). Shown only in those two modes; reopens the welcome screen
// after tidying transient play state.
export function MenuButton() {
  const gameMode = useGameStore((s) => s.gameMode);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  if (welcomeOpen || (gameMode !== 'freeplay' && gameMode !== 'treehouse')) return null;

  const back = () => {
    useWardrobeStore.getState().close();
    const ps = usePlayStore.getState();
    for (const id of IDS) if (ps.riding[id]) ps.dismount(id);
    ps.dropBall();
    useGameStore.getState().openWelcome();
  };

  return (
    <button
      onClick={back}
      aria-label="Back to games"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 52px)',
        left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        zIndex: 200,
        padding: '8px 14px',
        borderRadius: 12,
        border: '2px solid rgba(255,255,255,0.4)',
        background: 'rgba(20,30,40,0.55)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      🏠 Games
    </button>
  );
}
