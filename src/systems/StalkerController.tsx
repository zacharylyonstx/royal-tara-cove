import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useNightStore } from '../state/nightStore';
import { useNetStore } from '../state/netStore';
import { hsLive } from '../state/hideSeekStore';
import { useSkyStore } from '../state/skyStore';
import { useCombatStore } from '../state/combatStore';
import type { CharacterId } from '../types';
import { sunDirection } from '../world/dayNight';
import { isIndoors } from '../world/indoors';
import { railSafe } from '../world/redLine';
import {
  STALKER_ACTIVE_BELOW_EL, STALKER_ARRIVAL, STALKER_BOUNDS,
  STALKER_PATROL_SPEED, STALKER_CHASE_SPEED, STALKER_LUNGE_MULT,
  STALKER_DETECT_RADIUS, STALKER_RUN_NOISE, STALKER_CATCH_RADIUS, STALKER_WINDUP_RANGE,
  STALKER_ALERT_PAUSE, STALKER_LOS_BREAK, STALKER_FIRST_HUNT_DELAY,
  STALKER_COOLDOWN_MIN, STALKER_COOLDOWN_MAX, STALKER_FAIL_COOLDOWN, STALKER_IMMUNE_SECS,
  STALKER_LISTEN_MIN, STALKER_LISTEN_MAX,
  STALKER_HEAR_RADIUS, STALKER_HEARTBEAT_RADIUS, STALKER_THUD_RADIUS,
} from '../world/stalkerLayout';
import { resolveMotion } from './collision';
import { hasLOS } from './SirenHeadController';
import { broadcastSirenCaught, isInRoom } from '../net/room';
import {
  startNightSiren, stopNightSiren, setNightSirenVolume,
  sirenAlertStab, sirenSpotStinger, setHorrorChase, bonkHit, heartbeat, staticBurst, sirenFootThud,
  startHorrorTheme, stopHorrorTheme,
} from '../audio';

// ===========================================================================
// SIREN HEAD AFTER DARK — Free Play. Host-authoritative AI that reuses the
// nightStore siren fields (so the SirenHead mesh + the night snapshot work
// unchanged); every client runs the local dread pass (audio, thuds, toasts).
// Rules: he's out while the sun is well below the horizon, roams the whole
// street slowly, and "every once in a while" hunts anyone OUTDOORS — indoors
// is invisible + untouchable. A catch is a comedic tornado-style yeet.
// ===========================================================================

function claimedPlayers(): CharacterId[] {
  const net = useNetStore.getState();
  const ids: CharacterId[] = [];
  for (const p of Object.values(net.peers)) if (p.characterId) ids.push(p.characterId);
  if (ids.length === 0) ids.push(useGameStore.getState().activeCharacterId);
  return ids;
}

function rand(a: number, b: number): number { return a + Math.random() * (b - a); }

interface Runtime {
  phase: 'off' | 'arrive' | 'roam' | 'leave';
  huntAllowedAt: number;
  immuneUntil: Record<CharacterId, number>;
  patrolTX: number; patrolTZ: number; patrolPickedAt: number; pauseUntil: number;
  alertedAt: number; losLostAt: number; swung: boolean; detectFrame: number; prevState: string;
  leaveStartedAt: number;
  // local
  wasActive: boolean; audioOn: boolean; heartTimer: number; staticTimer: number;
  lastX: number; lastZ: number; stepAccum: number;
}

export function StalkerController() {
  const rt = useRef<Runtime>({
    phase: 'off', huntAllowedAt: 0, immuneUntil: { dad: 0, penny: 0, luke: 0 },
    patrolTX: 0, patrolTZ: -60, patrolPickedAt: 0, pauseUntil: 0,
    alertedAt: 0, losLostAt: 0, swung: false, detectFrame: 0, prevState: 'patrol', leaveStartedAt: 0,
    wasActive: false, audioOn: false, heartTimer: 0, staticTimer: 6, lastX: 0, lastZ: 0, stepAccum: 0,
  });

  useEffect(() => {
    const r = rt.current;
    return () => {
      if (r.audioOn) { stopNightSiren(); stopHorrorTheme(); }
      setHorrorChase(0);
      useNightStore.getState().setStalkerActive(false);
      useNightStore.getState().setStalkerEvent(null);
    };
  }, []);

  // ---------- HOST SIM ----------
  useFrame((_, dtRaw) => {
    if (!useNetStore.getState().isHost) return;
    const g = useGameStore.getState();
    if (g.gameMode !== 'freeplay' || g.welcomeOpen) return;
    const ns = useNightStore.getState();
    const now = performance.now() / 1000;
    const dt = Math.min(dtRaw, 0.1);
    const r = rt.current;

    const sunEl = sunDirection(useSkyStore.getState().dayFraction).elevationDeg;
    // He sits out hide-and-seek: no patrols, no swats while a game is on (if
    // he's already out when one starts, he turns round and walks off).
    const dark = sunEl < STALKER_ACTIVE_BELOW_EL && !hsLive();

    // ----- activate / deactivate with the sky -----
    if (r.phase === 'off') {
      if (!dark) {
        // A NEW host starts 'off' but may inherit stalkerActive=true from the old
        // host's last snapshot (host changed during the dawn walk-off) — clear it
        // or Siren Head stands frozen with the siren wailing all day.
        if (ns.stalkerActive) ns.setStalkerActive(false);
        return;
      }
      r.phase = 'arrive';
      r.huntAllowedAt = now + STALKER_FIRST_HUNT_DELAY;
      r.patrolTX = 0; r.patrolTZ = -120; r.patrolPickedAt = now; r.pauseUntil = 0;
      ns.setSiren(STALKER_ARRIVAL.x, STALKER_ARRIVAL.z, 0, 'patrol', null);
      ns.setStalkerActive(true);
      return;
    }
    if (!dark && r.phase !== 'leave') {
      r.phase = 'leave';
      r.leaveStartedAt = now;
    }

    let sx = ns.sirenX, sz = ns.sirenZ, syaw = ns.sirenYaw;
    let sstate = ns.sirenState;
    let target = ns.sirenTargetId;
    // Only tall structures block him (houses, fences) — he steps over props.
    const colliders = g.staticColliders.filter((c) => (c.maxY ?? 6) >= 3);

    if (r.phase === 'leave') {
      const dx = STALKER_ARRIVAL.x - sx, dz = STALKER_ARRIVAL.z - sz;
      const d = Math.hypot(dx, dz) || 1;
      const res = resolveMotion(sx, sz, sx + (dx / d) * 3.2 * dt, sz + (dz / d) * 3.2 * dt, colliders);
      ns.setSiren(res.x, res.z, Math.atan2(-dx, -dz), 'retreat', null);
      if (d < 4 || now - r.leaveStartedAt > 60) {
        r.phase = 'off';
        ns.setStalkerActive(false);
        ns.setSiren(STALKER_ARRIVAL.x, STALKER_ARRIVAL.z, 0, 'patrol', null);
      }
      return;
    }

    const net = useNetStore.getState();
    const myId = net.myCharacterId ?? g.activeCharacterId;
    const ids = claimedPlayers();
    const isRunning = (id: CharacterId) => id === myId ? ns.localRunning : (net.remotePlayers[id]?.running ?? false);
    const outdoors = (id: CharacterId) => {
      const p = g.positions[id];
      // …and so does waiting for, or riding, the train (and everywhere down the line).
      return !!p && !isIndoors(p.x, p.z) && p.y < 3.5 && !railSafe(p.x, p.y, p.z); // upstairs counts as indoors
    };
    const huntable = (id: CharacterId) => outdoors(id) && now >= r.immuneUntil[id] && !(g.ragdoll?.active && id === myId);

    // ----- detection (throttled: LOS marches are not free) -----
    r.detectFrame = (r.detectFrame + 1) % 5;
    let detected: CharacterId | null = null;
    let detectedDist = Infinity;
    if (r.detectFrame === 0 && now >= r.huntAllowedAt) {
      for (const id of ids) {
        if (!huntable(id)) continue;
        const p = g.positions[id];
        const dist = Math.hypot(p.x - sx, p.z - sz);
        const eff = STALKER_DETECT_RADIUS + (isRunning(id) ? STALKER_RUN_NOISE : 0);
        if (dist < eff && dist < detectedDist && hasLOS(sx, sz, p.x, p.z, colliders)) {
          detected = id; detectedDist = dist;
        }
      }
    }

    if (sstate === 'chase') {
      const tp = target ? g.positions[target] : null;
      const tValid = !!target && !!tp && huntable(target);
      if (detected) { target = detected; r.losLostAt = 0; }
      else if (tValid && r.detectFrame === 0) {
        const d = Math.hypot(tp.x - sx, tp.z - sz);
        if (d > STALKER_DETECT_RADIUS + 12 || !hasLOS(sx, sz, tp.x, tp.z, colliders)) {
          if (r.losLostAt === 0) r.losLostAt = now;
        } else r.losLostAt = 0;
      } else if (!tValid) {
        // ducked inside a house (or got immune) → he loses you fast
        if (r.losLostAt === 0) r.losLostAt = now - STALKER_LOS_BREAK * 0.6;
      }
      if (r.losLostAt > 0 && now - r.losLostAt > STALKER_LOS_BREAK) {
        sstate = 'patrol'; target = null; r.losLostAt = 0; r.patrolPickedAt = 0;
        r.huntAllowedAt = now + STALKER_FAIL_COOLDOWN;
      }
    } else if (sstate !== 'retreat') {
      if (detected) {
        if (sstate !== 'alerted') { sstate = 'alerted'; r.alertedAt = now; }
        target = detected;
      }
    }

    if (sstate === 'alerted') {
      const tp = target ? g.positions[target] : null;
      if (tp) syaw = Math.atan2(-(tp.x - sx), -(tp.z - sz));
      if (now - r.alertedAt > STALKER_ALERT_PAUSE) { sstate = 'chase'; r.swung = false; }
    } else if (sstate === 'chase') {
      const tp = target ? g.positions[target] : null;
      if (tp) {
        const dx = tp.x - sx, dz = tp.z - sz;
        const d = Math.hypot(dx, dz) || 1;
        const spd = STALKER_CHASE_SPEED * (d < 5 ? STALKER_LUNGE_MULT : 1);
        const res = resolveMotion(sx, sz, sx + (dx / d) * spd * dt, sz + (dz / d) * spd * dt, colliders);
        sx = res.x; sz = res.z; syaw = Math.atan2(-dx, -dz);
        if (d < STALKER_WINDUP_RANGE && !r.swung && target && huntable(target)) {
          ns.bumpSirenSwing();
          r.swung = true;
        }
        if (d < STALKER_CATCH_RADIUS && target && huntable(target)) {
          // ---- SWAT ----
          const victim = target;
          const vp = g.positions[victim];
          bonkHit();
          r.immuneUntil[victim] = now + STALKER_IMMUNE_SECS;
          if (victim === myId && vp) g.startRagdoll(vp.x, vp.y, vp.z, now);
          if (isInRoom()) broadcastSirenCaught({ characterId: victim, result: 'down', t: Date.now() });
          sstate = 'patrol'; target = null; r.swung = false;
          r.huntAllowedAt = now + rand(STALKER_COOLDOWN_MIN, STALKER_COOLDOWN_MAX);
          // wander off somewhere far so he doesn't loom over the landing
          r.patrolTX = rand(STALKER_BOUNDS.minX, STALKER_BOUNDS.maxX);
          r.patrolTZ = sz + (Math.random() < 0.5 ? -50 : 50);
          r.patrolPickedAt = now;
          r.pauseUntil = now + 2.5;
        }
      } else { sstate = 'patrol'; }
    }

    if (sstate === 'patrol') {
      if (now < r.pauseUntil) {
        // "listening" — stands still, horns swivel (the mesh does that)
      } else {
        const arrived = Math.hypot(sx - r.patrolTX, sz - r.patrolTZ) < 2.5;
        if (arrived || now - r.patrolPickedAt > 28) {
          if (arrived && r.phase === 'roam') r.pauseUntil = now + rand(STALKER_LISTEN_MIN, STALKER_LISTEN_MAX);
          if (r.phase === 'arrive') r.phase = 'roam';
          // A third of the time he drifts toward wherever an outdoor kid is —
          // "he knows". Otherwise a random spot on the street.
          const outdoorIds = ids.filter(outdoors);
          if (outdoorIds.length && Math.random() < 0.35 && now >= r.huntAllowedAt) {
            const p = g.positions[outdoorIds[Math.floor(Math.random() * outdoorIds.length)]];
            r.patrolTX = p.x + rand(-12, 12); r.patrolTZ = p.z + rand(-12, 12);
          } else {
            r.patrolTX = rand(STALKER_BOUNDS.minX, STALKER_BOUNDS.maxX);
            r.patrolTZ = rand(STALKER_BOUNDS.minZ, STALKER_BOUNDS.maxZ);
          }
          r.patrolPickedAt = now;
        }
        if (now >= r.pauseUntil) {
          const dx = r.patrolTX - sx, dz = r.patrolTZ - sz;
          const d = Math.hypot(dx, dz) || 1;
          const res = resolveMotion(sx, sz, sx + (dx / d) * STALKER_PATROL_SPEED * dt, sz + (dz / d) * STALKER_PATROL_SPEED * dt, colliders);
          sx = res.x; sz = res.z; syaw = Math.atan2(-dx, -dz);
        }
      }
    }

    sx = Math.max(STALKER_BOUNDS.minX, Math.min(STALKER_BOUNDS.maxX, sx));
    sz = Math.max(STALKER_BOUNDS.minZ, Math.min(STALKER_BOUNDS.maxZ, sz));

    if (sstate === 'alerted' && r.prevState !== 'alerted' && r.prevState !== 'chase') sirenAlertStab();
    if (sstate === 'chase' && r.prevState !== 'chase') sirenSpotStinger();
    r.prevState = sstate;
    ns.setSiren(sx, sz, syaw, sstate, target);
  });

  // ---------- LOCAL DREAD PASS (every client) ----------
  useFrame((_, dtRaw) => {
    const g = useGameStore.getState();
    const ns = useNightStore.getState();
    const r = rt.current;
    // (…and not while I'm sitting on the game picker — the siren + heartbeat used
    // to keep wailing over the menu.)
    const active = g.gameMode === 'freeplay' && ns.stalkerActive && !g.welcomeOpen;
    const now = performance.now() / 1000;
    if (active !== r.wasActive) {
      r.wasActive = active;
      ns.setStalkerEvent({ kind: active ? 'arrive' : 'dawn', at: now });
      if (active) {
        if (!r.audioOn) { startNightSiren(); startHorrorTheme(); r.audioOn = true; }
        sirenAlertStab(); // the long wail rolls down the street
        r.lastX = ns.sirenX; r.lastZ = ns.sirenZ; r.stepAccum = 0; r.staticTimer = 4;
      } else if (r.audioOn) {
        stopNightSiren(); stopHorrorTheme(); r.audioOn = false; setHorrorChase(0);
      }
    }
    if (!active) return;
    const dt = Math.min(dtRaw, 0.1);
    const localId = useNetStore.getState().myCharacterId ?? g.activeCharacterId;
    const p = g.positions[localId];
    if (!p) return;
    const dist = Math.hypot(p.x - ns.sirenX, p.z - ns.sirenZ);
    const prox = Math.max(0, Math.min(1, 1 - dist / STALKER_HEAR_RADIUS));
    ns.setSirenProximity(prox);
    const chasing = ns.sirenState === 'chase';
    const alerted = ns.sirenState === 'alerted';
    const indoors = isIndoors(p.x, p.z);
    // Wail carries down the street; muffled a little indoors.
    setNightSirenVolume(prox * (chasing ? 1 : 0.7) * (indoors ? 0.55 : 1));
    setHorrorChase(chasing ? 1 : alerted ? 0.5 : 0);

    // heartbeat when he's genuinely close and you're outside
    if (!indoors && dist < STALKER_HEARTBEAT_RADIUS) {
      r.heartTimer -= dt;
      if (r.heartTimer <= 0) {
        const k = 1 - dist / STALKER_HEARTBEAT_RADIUS;
        heartbeat(0.4 + 0.6 * k);
        r.heartTimer = 1.1 - 0.5 * k;
      }
    }
    // radio static / garbled broadcast from the horns, now and then
    r.staticTimer -= dt;
    if (r.staticTimer <= 0) {
      if (dist < 45) staticBurst();
      r.staticTimer = rand(7, 18);
    }
    // ground thud + shake on each of his steps when he's near
    const moved = Math.hypot(ns.sirenX - r.lastX, ns.sirenZ - r.lastZ);
    r.lastX = ns.sirenX; r.lastZ = ns.sirenZ;
    if (moved > 0.001 && dist < STALKER_THUD_RADIUS) {
      r.stepAccum += moved;
      const stride = chasing ? 2.4 : 3.2;
      if (r.stepAccum >= stride) {
        r.stepAccum = 0;
        const amp = 1 - dist / STALKER_THUD_RADIUS;
        sirenFootThud(amp);
        useCombatStore.getState().addShake(0.05 + 0.12 * amp);
      }
    }
  });

  return null;
}
