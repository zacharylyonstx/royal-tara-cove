import { useFrame } from '@react-three/fiber';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';

const TARGETS_BY_WAVE: Record<number, number> = {
  0: 0.05,  // pre-combat / free exploration: bright sunny midday
  1: 0.18,  // wave 1: early afternoon (still bright)
  2: 0.55,  // wave 2: dusk
  3: 0.85,  // wave 3: night
};

/**
 * Tweens combatStore.timeOfDay toward a target tied to current wave.
 * Other components (Sun, Stars, lighting) read timeOfDay and react.
 */
export function SkyController() {
  const phase = useGameStore((s) => s.phase);
  const waveIndex = useCombatStore((s) => s.waveIndex);
  const timeOfDay = useCombatStore((s) => s.timeOfDay);
  const setTimeOfDay = useCombatStore((s) => s.setTimeOfDay);

  useFrame((_, dtRaw) => {
    if (useGameStore.getState().gameMode === 'munchies') return;
    const dt = Math.min(dtRaw, 0.1);
    let target = TARGETS_BY_WAVE[waveIndex] ?? 0.15;
    if (phase === 'victory') target = 0.05; // dawn
    if (phase === 'defeat') target = 0.95; // deep night
    if (timeOfDay !== target) {
      const k = Math.min(1, dt * 0.4);
      setTimeOfDay(timeOfDay + (target - timeOfDay) * k);
    }
  });

  return null;
}
