import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { startMusic, stopMusic, setMusicMix } from '../audio';

const MAX_BLOBS_FOR_INTENSITY = 8;

// Adaptive layered music for the Aliens + Free Play modes. Munchies and Treehouse
// run their own themes (lullaby / treehouse), so this stops when those start.
export function MusicController() {
  const startedRef = useRef(false);

  useFrame(() => {
    const mode = useGameStore.getState().gameMode;
    const phase = useGameStore.getState().phase;

    // Hand off to the mode-specific themes — stop the neighborhood/combat music.
    if (mode === 'munchies' || mode === 'treehouse') {
      if (startedRef.current) { stopMusic(); startedRef.current = false; }
      return;
    }

    // Aliens + Free Play: ensure the layered music is running (ctx is unlocked
    // by now — you clicked through the welcome to get here).
    if (!startedRef.current) { startMusic(); startedRef.current = true; }

    if (phase === 'victory') { setMusicMix({ peaceful: 0.0, combat: 0.0, victory: 0.6 }); return; }
    if (phase === 'defeat') { setMusicMix({ peaceful: 0.0, combat: 0.0, victory: 0.0 }); return; }
    if (mode === 'aliens' && phase === 'combat') {
      const blobs = useCombatStore.getState().blobs.filter((b) => b.alive);
      const intensity = Math.min(1, blobs.length / MAX_BLOBS_FOR_INTENSITY);
      setMusicMix({
        peaceful: 0.18 * (1 - intensity * 0.7),
        combat: 0.45 * (0.4 + intensity * 0.6),
        victory: 0.0,
      });
      return;
    }
    // Free Play + aliens intro/free-roam → calm neighborhood music.
    setMusicMix({ peaceful: 0.3, combat: 0.0, victory: 0.0 });
  });

  return null;
}
