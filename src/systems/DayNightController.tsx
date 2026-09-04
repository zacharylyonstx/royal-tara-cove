import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSkyStore } from '../state/skyStore';
import { useCombatStore } from '../state/combatStore';
import {
  DAY_LENGTH_REAL_SEC,
  START_DAY_FRACTION,
  legacyTimeOfDay,
  sunDirection,
} from '../world/dayNight';

const STORAGE_KEY = 'sky.v1';
const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000;
const PERSIST_EVERY_SEC = 5;
// Cloud shell drift (uv units per real second) — slow, steady breeze from the SW.
const WIND_X = 0.011;
const WIND_Y = 0.006;

function loadClock(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return START_DAY_FRACTION;
    const v = JSON.parse(raw) as { f?: number; t?: number };
    if (typeof v.f !== 'number' || typeof v.t !== 'number') return START_DAY_FRACTION;
    const elapsed = Date.now() - v.t;
    if (elapsed < 0 || elapsed > RESUME_WINDOW_MS) return START_DAY_FRACTION;
    return (((v.f + elapsed / 1000 / DAY_LENGTH_REAL_SEC) % 1) + 1) % 1;
  } catch {
    return START_DAY_FRACTION;
  }
}

function saveClock(f: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ f, t: Date.now() }));
  } catch { /* private mode etc. */ }
}

/**
 * Advances the Free Play world clock. Solo/host: real time × speed. Guest:
 * eases toward the host's clock from the world snapshot (a phase value, so
 * machine clock skew never matters). Mirrors the legacy combatStore.timeOfDay
 * so Fireflies / sun motes / anything old keeps reacting, and persists the
 * clock so a reload mid-call resumes instead of resetting to morning.
 */
export function DayNightController() {
  useEffect(() => {
    const sky = useSkyStore.getState();
    sky.setNetTarget(null);
    sky.setDayFraction(loadClock());
    return () => {
      saveClock(useSkyStore.getState().dayFraction);
      // Hand the legacy value back to the other modes' default (sunny).
      useCombatStore.setState({ timeOfDay: 0.06 });
    };
  }, []);

  const persistAccum = useRef(0);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.25);
    const sky = useSkyStore.getState();
    let f = sky.dayFraction;
    if (sky.netTarget !== null) {
      // Guest: ease toward the host (shortest way around the day wrap).
      let d = sky.netTarget - f;
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      f = Math.abs(d) > 0.02 ? sky.netTarget : f + d * Math.min(1, dt * 2) + dt / DAY_LENGTH_REAL_SEC;
    } else {
      f += (dt * sky.speed) / DAY_LENGTH_REAL_SEC;
    }
    f = ((f % 1) + 1) % 1;
    useSkyStore.setState({
      dayFraction: f,
      cloudOffsetX: sky.cloudOffsetX + dt * WIND_X,
      cloudOffsetY: sky.cloudOffsetY + dt * WIND_Y,
    });

    // Legacy mirror (throttled so subscribers don't re-render every frame).
    const legacy = legacyTimeOfDay(sunDirection(f).elevationDeg);
    const cur = useCombatStore.getState().timeOfDay;
    if (Math.abs(cur - legacy) > 0.004) useCombatStore.setState({ timeOfDay: legacy });

    persistAccum.current += dt;
    if (persistAccum.current >= PERSIST_EVERY_SEC) {
      persistAccum.current = 0;
      saveClock(f);
    }
  });

  return null;
}
