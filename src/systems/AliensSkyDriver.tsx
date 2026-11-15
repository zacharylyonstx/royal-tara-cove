import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSkyStore } from '../state/skyStore';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { legacyTimeOfDay, sunDirection } from '../world/dayNight';
import { WAVES } from '../world/blobWaves';

const INTRO_HOUR = 15.2;
const VICTORY_HOUR = 8.4;  // the sun comes up on a saved Earth
const DEFEAT_HOUR = 22.5;
// Cloud drift (uv units per real second) — same breeze as Free Play.
const WIND_X = 0.011;
const WIND_Y = 0.006;

/**
 * Alien Invasion borrows Free Play's sky (dome, sun/moon lighting, lit
 * windows, street lamps) instead of the old washed-out white one — but here
 * the clock isn't real time: the invasion runs from a sunny afternoon through
 * golden hour and sunset to a dusk boss fight, one step per wave. Winning
 * fast-forwards the night into sunrise.
 *
 * Driven purely by synced state (phase + wave number), so every screen shows
 * the same sky without anything extra on the wire.
 */
export function AliensSkyDriver() {
  useEffect(() => {
    useSkyStore.getState().setNetTarget(null);
    useSkyStore.getState().setHour(INTRO_HOUR);
    return () => {
      // Hand the legacy value back to the other modes' default (sunny).
      useCombatStore.setState({ timeOfDay: 0.06 });
    };
  }, []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.25);
    const sky = useSkyStore.getState();
    const phase = useGameStore.getState().phase;
    const wave = useCombatStore.getState().waveIndex;
    let f = sky.dayFraction;

    let hour = WAVES[Math.max(0, wave - 1)]?.hour ?? INTRO_HOUR;
    let rate = 0.3; // fraction of the remaining gap closed per second
    if (phase === 'intro' || phase === 'pre-intro') hour = INTRO_HOUR;
    else if (phase === 'victory' || phase === 'free-play') { hour = VICTORY_HOUR; rate = 0.42; }
    else if (phase === 'defeat') hour = DEFEAT_HOUR;

    const target = hour / 24;
    // Time only runs forward. A big "backward" gap means a fresh game
    // (replay from dusk back to the afternoon intro) — just cut there.
    const ahead = (((target - f) % 1) + 1) % 1;
    if (phase === 'intro' || phase === 'pre-intro' || ahead > 0.75) f = target;
    else if (ahead > 0.0002) f += Math.min(ahead, dt * Math.max(0.0015, ahead * rate));
    f = ((f % 1) + 1) % 1;

    useSkyStore.setState({
      dayFraction: f,
      cloudOffsetX: sky.cloudOffsetX + dt * WIND_X,
      cloudOffsetY: sky.cloudOffsetY + dt * WIND_Y,
    });

    // Legacy mirror for the bits that still read combatStore.timeOfDay
    // (fireflies, sun motes) — throttled so subscribers don't churn.
    const legacy = legacyTimeOfDay(sunDirection(f).elevationDeg);
    if (Math.abs(useCombatStore.getState().timeOfDay - legacy) > 0.004) useCombatStore.setState({ timeOfDay: legacy });
  });

  return null;
}
