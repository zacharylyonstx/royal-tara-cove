import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { startMusic, setMusicMix } from '../audio';

const MAX_BLOBS_FOR_INTENSITY = 8;

export function MusicController() {
  const phase = useGameStore((s) => s.phase);
  const startedRef = useRef(false);

  // Kick off music as soon as combat starts (audio context is unlocked)
  useEffect(() => {
    if (useGameStore.getState().gameMode === 'munchies') return;
    if ((phase === 'combat' || phase === 'intro' || phase === 'victory') && !startedRef.current) {
      startedRef.current = true;
      startMusic();
    }
  }, [phase]);

  // Adjust mix based on phase + combat intensity
  useFrame(() => {
    if (useGameStore.getState().gameMode === 'munchies') return;
    if (!startedRef.current) return;
    const gameMode = useGameStore.getState().gameMode;
    if (phase === 'victory') {
      setMusicMix({ peaceful: 0.0, combat: 0.0, victory: 0.6 });
      return;
    }
    if (phase === 'defeat') {
      setMusicMix({ peaceful: 0.0, combat: 0.0, victory: 0.0 });
      return;
    }
    if (phase === 'combat' && gameMode === 'aliens') {
      const blobs = useCombatStore.getState().blobs.filter((b) => b.alive);
      const intensity = Math.min(1, blobs.length / MAX_BLOBS_FOR_INTENSITY);
      setMusicMix({
        peaceful: 0.18 * (1 - intensity * 0.7),
        combat: 0.45 * (0.4 + intensity * 0.6),
        victory: 0.0,
      });
      return;
    }
    // intro / pre-combat / wandering
    setMusicMix({ peaceful: 0.3, combat: 0.0, victory: 0.0 });
  });

  return null;
}
