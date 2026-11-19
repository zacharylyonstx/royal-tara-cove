import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useNightStore } from '../state/nightStore';
import { startMusic, stopMusic, setMusicMix } from '../audio';
import { lofiOff, lofiOn, useMusicStore } from '../state/musicStore';

const MAX_BLOBS_FOR_INTENSITY = 8;

// Adaptive layered music for the Aliens + Free Play modes (Free Play normally
// plays the lofi radio instead — src/lofi.ts). Munchies runs its
// own theme (the lullaby), so this stops when that starts.
export function MusicController() {
  const startedRef = useRef(false);

  useFrame(() => {
    const mode = useGameStore.getState().gameMode;
    const phase = useGameStore.getState().phase;

    // Hand off to the mode-specific themes — stop the neighborhood/combat music.
    // The tornado carries its own dread (storm roar, sirens, hail); the
    // cheerful C-major pad plinking under it broke the spell.
    // Siren Head Night runs its own horror theme (started by SirenHeadController).
    if (mode === 'munchies' || mode === 'tornado' || mode === 'night') {
      if (startedRef.current) { stopMusic(); startedRef.current = false; }
      lofiOff();
      return;
    }

    // Aliens + Free Play: ensure the layered music is running (ctx is unlocked
    // by now — you clicked through the welcome to get here).
    if (!startedRef.current) { startMusic(); startedRef.current = true; }

    // Free Play's radio: the lofi playlist plays INSTEAD of the neighbourhood
    // pad (unless the 🎵 button is on "classic"). With Siren Head out after
    // dark it drops to a murmur so the siren owns the night.
    if (mode === 'freeplay' && useMusicStore.getState().station === 'lofi') {
      lofiOn(useNightStore.getState().stalkerActive ? 0.1 : 1);
      setMusicMix({ peaceful: 0.0, combat: 0.0, victory: 0.0 });
      return;
    }
    lofiOff();

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
    // Free Play with Siren Head out after dark: the cheerful pad ducks right
    // down so the siren wail + horror bed own the night.
    if (mode === 'freeplay' && useNightStore.getState().stalkerActive) { setMusicMix({ peaceful: 0.04, combat: 0.0, victory: 0.0 }); return; }
    // Free Play ("classic" station) + aliens intro/free-roam → calm neighborhood
    // music. (Was 0.3 — so quiet it was barely there.)
    setMusicMix({ peaceful: 0.5, combat: 0.0, victory: 0.0 });
  });

  return null;
}
