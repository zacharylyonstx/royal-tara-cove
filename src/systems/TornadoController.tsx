import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useCombatStore } from '../state/combatStore';
import { useNetStore } from '../state/netStore';
import type { CharacterId } from '../types';
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

// v17 cinematic intro — 8s sweep over the cul-de-sac before calm ends.
const CINEMATIC_INTRO_DURATION = 8;
// Slow-mo proximity thresholds
const SLOWMO_ENTER_RADIUS = 6;
const SLOWMO_EXIT_RADIUS = 7.5;

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
  const cinematicStartedRef = useRef(false);
  const slowMoActiveRef = useRef(false);

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
    if (!useNetStore.getState().isHost) return;
    const g = useGameStore.getState();
    if (g.gameMode !== 'tornado') return;
    if (g.phase !== lastPhase.current) {
      if (g.phase === 'calm') cinematicStartedRef.current = false;
      lastPhase.current = g.phase;
      setPhaseEnteredAt(performance.now() / 1000);
    }
  });

  // Main phase machine + per-frame storm + tornado motion
  useFrame(() => {
    if (!useNetStore.getState().isHost) return;
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

      // ---- v17 cinematic intro pan ----
      // Starts on first calm-phase frame: 8s sweep from high above the
      // cul-de-sac (south, looking down), circling 180°, descending to
      // the player's eye level. Restores FPS control on completion.
      const cs = useCombatStore.getState();
      if (!cinematicStartedRef.current && elapsed < 0.1) {
        cinematicStartedRef.current = true;
        cs.startCinematic([0, 1.5, 0], [0, 40, -100], CINEMATIC_INTRO_DURATION);
      }
      if (cinematicStartedRef.current && cs.cinematic.active) {
        const tIntro = Math.min(1, elapsed / CINEMATIC_INTRO_DURATION);
        // Camera sweeps in an arc around the cul-de-sac, descending y=40→1.7.
        // Sweep starts south and circles to face north (around the bulb at z≈+20).
        const arcCenterX = 0;
        const arcCenterZ = 0;
        const startAngle = -Math.PI / 2;   // facing player from south (z = -R)
        const endAngle   =  Math.PI / 2;   // facing player from north (z = +R)
        const angle = startAngle + (endAngle - startAngle) * tIntro;
        const radius = 90 - tIntro * 75;
        const camX = arcCenterX + Math.cos(angle) * radius;
        const camZ = arcCenterZ + Math.sin(angle) * radius;
        const camY = 40 - tIntro * 38;
        // Lookat sweeps toward the player's spawn near (0, -90)
        // Cinematic camera looks at the host's own character (host-authoritative).
        const hostChar = g.positions[g.activeCharacterId];
        const targetX = hostChar ? hostChar.x : 0;
        const targetY = 1.5;
        const targetZ = hostChar ? hostChar.z : -90;
        useCombatStore.setState({
          cinematic: {
            active: true,
            cameraX: camX, cameraY: camY, cameraZ: camZ,
            targetX, targetY, targetZ,
            endsAt: now + CINEMATIC_INTRO_DURATION,
          },
        });
        if (tIntro >= 1) {
          cs.endCinematic();
        }
      }

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
          // Use host's own character for the nearby-sound cue (host-only audio).
          const hostPlayer = g.positions[g.activeCharacterId];
          const distToPlayer = hostPlayer
            ? Math.hypot(hostPlayer.x - h.x, hostPlayer.z - h.z)
            : 30;
          houseCollapse(Math.min(1, distToPlayer / 60));
          break; // one per frame to keep audio uncluttered
        }
      }

      // PLAYER KILL ZONE — walking into the funnel triggers ragdoll throw.
      // Check all claimed characters (multiplayer-safe). If ANY claimed character
      // walks into the funnel, it's a defeat for the whole family.
      const KILL_RADIUS = 4;
      const net = useNetStore.getState();
      const claimedIds = new Set<CharacterId>();
      for (const p of Object.values(net.peers)) {
        if (p.characterId) claimedIds.add(p.characterId);
      }
      if (claimedIds.size === 0) claimedIds.add(g.activeCharacterId);

      // Use host's nearest claimed character for slow-mo / camera shake
      // (these are local host-side effects, not broadcast).
      const hostPlayer = g.positions[g.activeCharacterId];
      const hostDx = hostPlayer ? hostPlayer.x - x : 0;
      const hostDz = hostPlayer ? hostPlayer.z - z : 0;
      const hostDistToFunnel = Math.hypot(hostDx, hostDz);

      {
        const cs = useCombatStore.getState();
        if (!slowMoActiveRef.current && hostDistToFunnel < SLOWMO_ENTER_RADIUS) {
          slowMoActiveRef.current = true;
          cs.triggerSlowMo(0.5, 999);
        } else if (slowMoActiveRef.current && hostDistToFunnel > SLOWMO_EXIT_RADIUS) {
          slowMoActiveRef.current = false;
          useCombatStore.setState({ slowMo: 1, slowMoEndsAt: 0 });
        } else if (slowMoActiveRef.current) {
          useCombatStore.setState({ slowMoEndsAt: now + 1 });
        }
        const shake = Math.min(0.06, 0.05 / Math.max(1, hostDistToFunnel / 8));
        addShake(shake);
      }

      // Check all claimed players for kill zone entry.
      for (const id of claimedIds) {
        const player = g.positions[id];
        if (!player) continue;
        const distToFunnel = Math.hypot(player.x - x, player.z - z);
        if (distToFunnel < KILL_RADIUS) {
          if (slowMoActiveRef.current) {
            slowMoActiveRef.current = false;
            useCombatStore.setState({ slowMo: 1, slowMoEndsAt: 0 });
          }
          // Ragdoll uses the host's character for the visual (host-authoritative cinematic).
          const ragPlayer = g.positions[g.activeCharacterId];
          g.startRagdoll(ragPlayer?.x ?? player.x, ragPlayer?.y ?? player.y, ragPlayer?.z ?? player.z, now);
          g.setPhase('defeat');
          return;
        }
      }

      // NPCs (unclaimed characters) near the funnel get yeeted offscreen.
      for (const id of ['dad', 'penny', 'luke'] as const) {
        if (claimedIds.has(id)) continue; // skip human-controlled characters
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
      // One-shot evaluation: inside hero house → victory, else → defeat + ragdoll.
      // In multiplayer ALL claimed characters must be inside for victory.
      setTornadoZ(TORNADO_END_Z);
      if (!heroBox) {
        g.setPhase('defeat');
        return;
      }
      const netArrived = useNetStore.getState();
      const claimedArrived = new Set<CharacterId>();
      for (const p of Object.values(netArrived.peers)) {
        if (p.characterId) claimedArrived.add(p.characterId);
      }
      if (claimedArrived.size === 0) claimedArrived.add(g.activeCharacterId);

      const isInsideHeroBox = (px: number, pz: number): boolean => {
        if (!heroBox) return false;
        const relX = px - heroBox.pivotX;
        const relZ = pz - heroBox.pivotZ;
        const lx = relX * heroBox.cosNeg - relZ * heroBox.sinNeg;
        const lz = relX * heroBox.sinNeg + relZ * heroBox.cosNeg;
        return lx > -heroBox.halfW && lx < heroBox.halfW && lz > -heroBox.halfD && lz < heroBox.halfD;
      };

      let allInside = true;
      let firstOutsidePlayer = g.positions[g.activeCharacterId];
      for (const id of claimedArrived) {
        const p = g.positions[id];
        if (!p || !isInsideHeroBox(p.x, p.z)) {
          allInside = false;
          if (p) firstOutsidePlayer = p;
          break;
        }
      }
      if (allInside) {
        g.setPhase('victory');
        fadeAllTornadoAudio(6);
      } else {
        g.startRagdoll(firstOutsidePlayer?.x ?? 0, firstOutsidePlayer?.y ?? 0, firstOutsidePlayer?.z ?? 0, now);
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
