import { useGameStore } from '../state/gameStore';
import { usePlayStore } from '../state/playStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import { useCombatStore } from '../state/combatStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useMunchiesStore } from '../state/munchiesStore';
import { resetTornadoAudio, stopCrackleLoop } from '../audio';
import type { CharacterId } from '../types';

const IDS: CharacterId[] = ['dad', 'penny', 'luke'];

/**
 * Tidy the current mode's transient state and reopen the game picker, keeping
 * the P2P room (and everyone's character claims) alive. Also used by the
 * aliens end screens, so "back to games" behaves identically everywhere.
 */
export function backToGames() {
  useWardrobeStore.getState().close();
  const ps = usePlayStore.getState();
  for (const id of IDS) if (ps.riding[id]) ps.dismount(id);
  ps.dropBall();

  const gs = useGameStore.getState();
  const mode = gs.gameMode;
  if (mode === 'aliens') {
    // Crash-site crackle otherwise loops behind the menu; UFOCrash restarts
    // it fresh on the next intro. combatStore.reset() clears blobs/waves/FX.
    stopCrackleLoop();
    useCombatStore.getState().reset();
    gs.resetHp();
    gs.resetFamilyPositions();
  } else if (mode === 'tornado') {
    resetTornadoAudio();
    useTornadoStore.getState().reset();
    gs.resetTornadoGame();
    gs.resetHp();
  } else if (mode === 'munchies') {
    // The lullaby is intentionally NOT stopped here: MunchiesController stays
    // mounted while gameMode is 'munchies' and only re-starts it on mount, so
    // stopping it would leave a silent re-entry. Mode switch unmounts + stops.
    useMunchiesStore.getState().reset();
    gs.resetFamilyPositions();
  }
  gs.setPhase('pre-intro');
  gs.openWelcome();
}

// "Back to the game picker" — every mode needs a way out (kids change their
// minds constantly; a page reload would tear down the P2P room and force
// everyone to re-join over Zoom).
export function MenuButton() {
  const gameMode = useGameStore((s) => s.gameMode);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const phase = useGameStore((s) => s.phase);
  // The aliens defeat screen covers the whole viewport with its own buttons
  // (including Games) — hide the floating one so they don't double up.
  if (welcomeOpen || (gameMode === 'aliens' && phase === 'defeat')) return null;

  // During aliens combat the FAMILY HP panel owns the top-left corner
  // (top 16, ~95px tall) — sit below it instead of on it.
  const top = gameMode === 'aliens' && (phase === 'combat' || phase === 'intro') ? 116 : 52;

  return (
    <button
      onClick={backToGames}
      aria-label="Back to games"
      style={{
        position: 'fixed',
        top: `calc(env(safe-area-inset-top, 0px) + ${top}px)`,
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
