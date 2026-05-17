import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useCombatStore } from '../state/combatStore';
import { HOUSES } from '../world/houses';
import { buildLots } from '../world/lots';
import {
  startRainLoop,
  startWindLoop,
  startSirenLoop,
  startRoarLoop,
  setRainVolume,
  setWindVolume,
  setSirenVolume,
  setRoarVolume,
  houseCollapse,
  fadeAllTornadoAudio,
  resetTornadoAudio,
} from '../audio';

// Tornado-mode orchestrator. Drives:
//   • phase transitions (calm → rain → hail → tornado-approach → arrived)
//   • stormIntensity + windStrength lerps
//   • tornadoZ position over time
//   • tornado opacity fade-in during the last 3s of hail
//   • per-house destruction triggers when funnel passes their pivot
//   • camera shake intensity scaled to tornado proximity
//   • audio loop volumes
// Headless: no rendering.

// Phase durations (seconds)
const CALM_DURATION = 10;
const RAIN_DURATION = 20;
const HAIL_DURATION = 15;
const APPROACH_DURATION = 60;

// Tornado path
const TORNADO_START_Z = -130;
const TORNADO_END_Z = 15; // ~2m short of 10600's front wall
const TORNADO_KILL_RADIUS = 6; // crossing this close to a house pivot destroys it

// Hero check uses the hero house AABB from world data
const HERO_AABB_PADDING = 0.2;

export function TornadoController() {
  const startedHere = useRef(false);

  const setStormIntensity = useTornadoStore((s) => s.setStormIntensity);
  const setWindStrength = useTornadoStore((s) => s.setWindStrength);
  const setTornadoZ = useTornadoStore((s) => s.setTornadoZ);
  const setTornadoX = useTornadoStore((s) => s.setTornadoX);
  const setTornadoOpacity = useTornadoStore((s) => s.setTornadoOpacity);
  const setPhaseEnteredAt = useTornadoStore((s) => s.setPhaseEnteredAt);
  // Force-subscribe so this component participates in zustand updates
  // when external code (TornadoHud retry) resets the store.
  void useTornadoStore((s) => s.phaseEnteredAt);

  const addShake = useCombatStore((s) => s.addShake);

  // Pre-compute non-hero house world positions (sorted by Z descending so we
  // destroy from north to south — same direction as the tornado walks).
  const housePath = useMemo(() => {
    const lots = buildLots(HOUSES);
    const items: { address: string; x: number; z: number }[] = [];
    for (const h of HOUSES) {
      if (h.isHero) continue;
      const lot = lots.find((l) => l.address === h.address);
      if (!lot) continue;
      items.push({ address: h.address, x: lot.housePivot[0], z: lot.housePivot[1] });
    }
    // Sort by Z ascending (north→south = low to high Z in this game; STRAIGHT
    // is negative Z, bulb is around 0..+30). Tornado walks from low to high.
    items.sort((a, b) => a.z - b.z);
    return items;
  }, []);

  // Hero house AABB for inside check
  const heroBox = useMemo(() => {
    const hero = HOUSES.find((h) => h.isHero);
    const lots = buildLots(HOUSES);
    if (!hero) return null;
    const lot = lots.find((l) => l.address === hero.address);
    if (!lot) return null;
    const cosNeg = Math.cos(-lot.houseYaw);
    const sinNeg = Math.sin(-lot.houseYaw);
    return {
      pivotX: lot.housePivot[0],
      pivotZ: lot.housePivot[1],
      halfW: hero.width / 2 + HERO_AABB_PADDING,
      halfD: hero.depth / 2 + HERO_AABB_PADDING,
      cosNeg,
      sinNeg,
    };
  }, []);

  // Start storm audio loops once on mount (they're silent until volume is set).
  useEffect(() => {
    startRainLoop();
    startWindLoop();
    startSirenLoop();
    startRoarLoop();
    startedHere.current = true;
    return () => {
      resetTornadoAudio();
    };
  }, []);

  // On phase change, set phaseEnteredAt
  const lastPhase = useRef<string>('');
  useFrame(() => {
    const g = useGameStore.getState();
    if (g.gameMode !== 'tornado') return;
    if (g.phase !== lastPhase.current) {
      lastPhase.current = g.phase;
      setPhaseEnteredAt(performance.now() / 1000);
    }
  });

  // Main phase machine + per-frame storm + tornado motion
  useFrame(() => {
    const g = useGameStore.getState();
    if (g.gameMode !== 'tornado') return;
    const ts = useTornadoStore.getState();
    const now = performance.now() / 1000;
    const elapsed = now - ts.phaseEnteredAt;
    const phase = g.phase;

    // Update storm intensity + wind + tornado position by phase
    if (phase === 'calm') {
      setStormIntensity(0);
      setWindStrength(0);
      setTornadoZ(-200);
      setTornadoOpacity(0);
      if (elapsed >= CALM_DURATION) g.setPhase('rain');
    } else if (phase === 'rain') {
      // Ramp intensity 0 → 0.55 over 5s, then hold
      const t = Math.min(1, elapsed / 5);
      setStormIntensity(t * 0.55);
      setWindStrength(t * 0.3);
      if (elapsed >= RAIN_DURATION) g.setPhase('hail');
    } else if (phase === 'hail') {
      // Ramp 0.55 → 0.9 across the phase. Tornado materializes last 3s.
      const t = Math.min(1, elapsed / HAIL_DURATION);
      setStormIntensity(0.55 + t * 0.35);
      setWindStrength(0.3 + t * 0.4);
      const remaining = HAIL_DURATION - elapsed;
      if (remaining < 3) {
        setTornadoZ(TORNADO_START_Z);
        setTornadoOpacity(1 - remaining / 3);
      }
      if (elapsed >= HAIL_DURATION) g.setPhase('tornado-approach');
    } else if (phase === 'tornado-approach') {
      setStormIntensity(0.95);
      setWindStrength(1.0);
      setTornadoOpacity(1);
      const t = Math.min(1, elapsed / APPROACH_DURATION);
      const z = TORNADO_START_Z + (TORNADO_END_Z - TORNADO_START_Z) * t;
      // Wobble: multi-frequency sway, decays as we approach 10600 so it
      // lands roughly centered.
      const wobbleAmp = 5 * (1 - Math.pow(t, 2));
      const x = Math.sin(t * 4 * Math.PI) * wobbleAmp +
                Math.sin(t * 9.3 * Math.PI + 1.7) * wobbleAmp * 0.3;
      setTornadoZ(z);
      setTornadoX(x);

      // Trigger destruction on houses near the funnel center (not just Z-pass)
      for (const h of housePath) {
        if (g.destroyedHouses[h.address] != null) continue;
        const dist = Math.hypot(h.x - x, h.z - z);
        if (dist < TORNADO_KILL_RADIUS) {
          g.markHouseDestroyed(h.address, now);
          const player = g.positions[g.activeCharacterId];
          const distToPlayer = player
            ? Math.hypot(player.x - h.x, player.z - h.z)
            : 30;
          houseCollapse(Math.min(1, distToPlayer / 60));
          break; // one per frame to keep audio uncluttered
        }
      }

      // PLAYER KILL ZONE — walking into the funnel triggers ragdoll throw.
      const player = g.positions[g.activeCharacterId];
      const KILL_RADIUS = 4;
      if (player) {
        const dx = player.x - x;
        const dz = player.z - z;
        const distToFunnel = Math.hypot(dx, dz);
        if (distToFunnel < KILL_RADIUS) {
          g.startRagdoll(player.x, player.y, player.z, now);
          g.setPhase('defeat');
          return;
        }
        // Camera shake by proximity
        const shake = Math.min(0.06, 0.05 / Math.max(1, distToFunnel / 8));
        addShake(shake);
      }
      // NPCs near the funnel get yeeted offscreen (no clutter)
      for (const id of ['penny', 'luke'] as const) {
        const p = g.positions[id];
        if (!p) continue;
        const dist = Math.hypot(p.x - x, p.z - z);
        if (dist < KILL_RADIUS) {
          p.x = x + (Math.random() - 0.5) * 60;
          p.z = z + 80 + Math.random() * 20;
          p.y = 0;
        }
      }

      if (elapsed >= APPROACH_DURATION || z >= TORNADO_END_Z - 0.5) {
        g.setPhase('tornado-arrived');
      }
    } else if (phase === 'tornado-arrived') {
      // One-shot evaluation: inside hero house → victory, else → defeat + ragdoll
      setTornadoZ(TORNADO_END_Z);
      const player = g.positions[g.activeCharacterId];
      if (!player || !heroBox) {
        g.setPhase('defeat');
        return;
      }
      const relX = player.x - heroBox.pivotX;
      const relZ = player.z - heroBox.pivotZ;
      const lx = relX * heroBox.cosNeg - relZ * heroBox.sinNeg;
      const lz = relX * heroBox.sinNeg + relZ * heroBox.cosNeg;
      const inside = lx > -heroBox.halfW && lx < heroBox.halfW && lz > -heroBox.halfD && lz < heroBox.halfD;
      if (inside) {
        g.setPhase('victory');
        fadeAllTornadoAudio(6);
      } else {
        g.startRagdoll(player.x, player.y, player.z, now);
        g.setPhase('defeat');
      }
    } else if (phase === 'victory' || phase === 'defeat') {
      // Decay environment over time on victory; defeat keeps the storm going.
      if (phase === 'victory') {
        const t = Math.min(1, elapsed / 6);
        setStormIntensity(0.95 * (1 - t));
        setWindStrength(1 - t);
        setTornadoOpacity(1 - t);
      }
    }

    // Drive audio volumes from current state. When the player is INSIDE the
    // hero house during approach, halve roar + wind for the audible "safe"
    // cue ("you made it").
    const playerAudio = g.positions[g.activeCharacterId];
    let insideHeroAudio = false;
    if (playerAudio && heroBox) {
      const relX = playerAudio.x - heroBox.pivotX;
      const relZ = playerAudio.z - heroBox.pivotZ;
      const lx = relX * heroBox.cosNeg - relZ * heroBox.sinNeg;
      const lz = relX * heroBox.sinNeg + relZ * heroBox.cosNeg;
      insideHeroAudio = lx > -heroBox.halfW && lx < heroBox.halfW && lz > -heroBox.halfD && lz < heroBox.halfD;
    }
    const safeAtten = insideHeroAudio ? 0.45 : 1;
    setRainVolume(useTornadoStore.getState().stormIntensity * safeAtten);
    setWindVolume(useTornadoStore.getState().windStrength * safeAtten);
    setSirenVolume(phase === 'hail' || phase === 'tornado-approach' ? 1 : 0);
    if (playerAudio && useTornadoStore.getState().tornadoOpacity > 0) {
      const tx = useTornadoStore.getState().tornadoX;
      const tz = useTornadoStore.getState().tornadoZ;
      const dist = Math.hypot(playerAudio.x - tx, playerAudio.z - tz);
      const roar = Math.max(0, Math.min(1, 1 - dist / 60));
      setRoarVolume(roar * useTornadoStore.getState().tornadoOpacity * safeAtten);
    } else {
      setRoarVolume(0);
    }
  });

  return null;
}
