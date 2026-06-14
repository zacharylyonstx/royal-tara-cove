import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useNightStore, type Lantern } from '../state/nightStore';
import { useNetStore } from '../state/netStore';
import type { CharacterId, RectCollider } from '../types';
import {
  BASE_ZONE, SIREN_BOUNDS, SIREN_SPAWN, LANTERN_GOAL,
  inZone, inAnyZone,
} from '../world/nightLayout';
import { resolveMotion } from './collision';
import { broadcastSirenCaught, isInRoom } from '../net/room';
import {
  startNightSiren, stopNightSiren, setNightSirenVolume,
  sirenAlertStab, sirenSpotStinger, setHorrorChase, bonkHit, heartbeat, blockLitFanfare,
  startHorrorTheme, stopHorrorTheme,
} from '../audio';

// ===========================================================================
// SIREN HEAD NIGHT — the orchestrator. Host-authoritative AI + round logic;
// every client also runs a local audio/proximity pass. Modeled on
// TornadoController (roaming street hazard) + BlobController (nearest-player).
// ===========================================================================

const INTRO_DURATION = 4.5;     // "make-believe" card before the hunt
const PATROL_SPEED = 2.6;
// SCARY-AF tuning: he SPRINTS when he spots you. 7.2 is faster than the player's
// walk (4.2) — so walking can't escape, you must sprint-burst (8.8) + hide — but
// still below sprint, so it stays escapable with effort. A short close-range
// lunge makes the final pounce feel vicious.
const CHASE_SPEED = 7.2;
const CHASE_LUNGE_MULT = 1.3;   // burst when he's right on top of you (<5m)
const ALERT_RADIUS_BASE = 22;   // spots you from much further (was 13)
const SPRINT_NOISE = 9;         // sprinting makes you detectable much farther
const CARRY_NOISE = 6;          // carrying a glowing lantern is risky
const CROUCH_QUIET = 8;         // crouching shrinks your detection radius
const CATCH_RADIUS = 2.0;
const ALERT_PAUSE = 0.6;        // short dread beat, then he commits (scarier)
const WHACK_WINDUP_RANGE = 3.6; // he raises his hand to swat at this range
const LOS_BREAK_DELAY = 2.2;    // grace before he loses interest
const REACQUIRE_COOLDOWN = 2.6; // after a catch, give the kid a head start
const AUTO_REVIVE_SECS = 6;
const REVIVE_RADIUS = 2.8;      // a teammate this close frees you instantly
const PICKUP_RADIUS = 1.5;

function claimedPlayers(): CharacterId[] {
  const net = useNetStore.getState();
  const ids: CharacterId[] = [];
  for (const p of Object.values(net.peers)) if (p.characterId) ids.push(p.characterId);
  if (ids.length === 0) ids.push(useGameStore.getState().activeCharacterId);
  return ids;
}

/** Coarse line-of-sight: march the XZ segment at chest height; blocked if any
 *  sample lands inside a tall collider (houses, fences). */
function hasLOS(ax: number, az: number, bx: number, bz: number, colliders: RectCollider[]): boolean {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const steps = Math.min(28, Math.max(6, Math.round(len / 1.2)));
  const y = 1.2;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = ax + dx * t, pz = az + dz * t;
    for (const c of colliders) {
      if (c.passable) continue;
      if (y < (c.minY ?? 0) || y > (c.maxY ?? 6)) continue;
      let inside: boolean;
      if (c.yaw) {
        const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
        const hX = (c.maxX - c.minX) / 2, hZ = (c.maxZ - c.minZ) / 2;
        const cn = Math.cos(-c.yaw), sn = Math.sin(-c.yaw);
        const lx = (px - cx) * cn - (pz - cz) * sn;
        const lz = (px - cx) * sn + (pz - cz) * cn;
        inside = lx > -hX && lx < hX && lz > -hZ && lz < hZ;
      } else {
        inside = px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ;
      }
      if (inside) return false;
    }
  }
  return true;
}

interface Runtime {
  lastPhase: string;
  introStart: number;
  roundEndsAt: number;
  patrolTX: number;
  patrolTZ: number;
  patrolPickedAt: number;
  alertedAt: number;
  losLostAt: number;
  reacquireUntil: number;
  allDownSince: number;
  swungThisChase: boolean;
  detectFrame: number;
  prevState: string;
  // local audio
  heartTimer: number;
}

export function SirenHeadController() {
  const rt = useRef<Runtime>({
    lastPhase: '', introStart: 0, roundEndsAt: 0,
    patrolTX: SIREN_SPAWN.x, patrolTZ: SIREN_SPAWN.z, patrolPickedAt: 0,
    alertedAt: 0, losLostAt: 0, reacquireUntil: 0, allDownSince: 0, swungThisChase: false, detectFrame: 0,
    prevState: 'patrol', heartTimer: 0,
  });

  useEffect(() => {
    startNightSiren();
    startHorrorTheme();
    return () => { stopNightSiren(); stopHorrorTheme(); };
  }, []);

  // ---------- HOST SIM ----------
  useFrame((_, dtRaw) => {
    if (!useNetStore.getState().isHost) return;
    const g = useGameStore.getState();
    if (g.gameMode !== 'night') return;
    const ns = useNightStore.getState();
    const now = performance.now() / 1000;
    const dt = Math.min(dtRaw, 0.1);
    const r = rt.current;
    const phase = g.phase;

    if (phase !== r.lastPhase) {
      r.lastPhase = phase;
      if (phase === 'night-intro') r.introStart = now;
      if (phase === 'night-hunt') r.roundEndsAt = now + ns.roundEndsInSeconds;
    }

    // INTRO: hold Siren at spawn, slowly turning, then begin the hunt.
    if (phase === 'night-intro') {
      ns.setSiren(SIREN_SPAWN.x, SIREN_SPAWN.z, Math.sin(now * 0.4) * 0.6, 'patrol', null);
      if (now - r.introStart > INTRO_DURATION) {
        r.roundEndsAt = now + ns.roundEndsInSeconds;
        g.setPhase('night-hunt');
      }
      return;
    }

    // WIN: Siren retreats up the dark street; lanterns are lit; no more catches.
    if (phase === 'night-win') {
      const tx = 0, tz = -110;
      const dx = tx - ns.sirenX, dz = tz - ns.sirenZ;
      const d = Math.hypot(dx, dz) || 1;
      ns.setSiren(ns.sirenX + (dx / d) * 5 * dt, ns.sirenZ + (dz / d) * 5 * dt, Math.atan2(-dx, -dz), 'retreat', null);
      return;
    }

    if (phase !== 'night-hunt') return;

    // Siren Head is an ~11m giant — he steps OVER small props (the launch ramp,
    // bins, mailboxes, hydrants) and is only blocked by tall structures (houses,
    // fences). This also keeps LOS honest: hide behind a HOUSE, not a mailbox.
    // (Without this, his direct-chase pins on the street ramp and stalls.)
    const colliders = g.staticColliders.filter((c) => (c.maxY ?? 6) >= 3);
    const net = useNetStore.getState();
    const myId = net.myCharacterId ?? g.activeCharacterId;
    const ids = claimedPlayers();

    // ----- round timer → dawn (a guaranteed positive ending) -----
    const remaining = Math.max(0, r.roundEndsAt - now);
    ns.setRoundEndsInSeconds(remaining);

    // ----- per-player safe state from zones (host computes for everyone) -----
    const isCarrying = (id: CharacterId) => ns.lanterns.some((l) => l.state === 'carried' && l.carrier === id);
    const isRunning = (id: CharacterId) => id === myId ? ns.localRunning : (net.remotePlayers[id]?.running ?? false);
    const isCrouching = (id: CharacterId) => id === myId ? ns.crouching : (net.remotePlayers[id]?.crouching ?? false);
    for (const id of ids) {
      const st = ns.playerNightStates[id];
      if (st === 'down') continue; // down stays until revived
      const p = g.positions[id];
      if (!p) continue;
      const safe = inAnyZone(p.x, p.z, ns.safeZones) || inAnyZone(p.x, p.z, ns.hideZones);
      ns.setPlayerNightState(id, safe ? 'safe' : 'alive');
    }

    // ----- lanterns: auto pickup / carry-follow / deliver / drop-on-down -----
    let lanterns = ns.lanterns;
    let changed = false;
    let delivered = ns.lanternsDelivered;
    const next: Lantern[] = lanterns.map((l) => ({ ...l }));
    for (const l of next) {
      if (l.state === 'delivered') continue;
      if (l.state === 'carried' && l.carrier) {
        const cp = g.positions[l.carrier];
        const carrierDown = ns.playerNightStates[l.carrier] === 'down';
        if (carrierDown || !cp) {
          // dropped where they fell
          if (cp) { l.x = cp.x; l.z = cp.z; }
          l.state = 'idle'; l.carrier = null; changed = true;
          continue;
        }
        l.x = cp.x; l.z = cp.z;
        if (inZone(cp.x, cp.z, BASE_ZONE)) {
          // delivered! park it on the porch in a little row.
          l.state = 'delivered'; l.carrier = null;
          l.x = BASE_ZONE.x + (delivered - (LANTERN_GOAL - 1) / 2) * 1.0;
          l.z = BASE_ZONE.z + 1.5;
          delivered += 1; changed = true;
        }
      } else if (l.state === 'idle') {
        for (const id of ids) {
          if (ns.playerNightStates[id] === 'down') continue;
          if (isCarrying(id)) continue; // one at a time
          const p = g.positions[id];
          if (p && Math.hypot(p.x - l.x, p.z - l.z) < PICKUP_RADIUS) {
            l.state = 'carried'; l.carrier = id; changed = true;
            break;
          }
        }
      }
    }
    if (changed) {
      ns.setLanterns(next);
      if (delivered !== ns.lanternsDelivered) ns.setLanternsDelivered(delivered);
      lanterns = next;
    }

    // ----- WIN: all lanterns home, or dawn broke -----
    if (delivered >= LANTERN_GOAL || remaining <= 0) {
      blockLitFanfare();
      g.setPhase('night-win');
      return;
    }

    // ----- revive (auto after a few seconds, or instantly by a teammate) -----
    for (const id of ids) {
      if (ns.playerNightStates[id] !== 'down') continue;
      const downP = g.positions[id];
      let helped = false;
      if (downP) {
        for (const other of ids) {
          if (other === id) continue;
          if (ns.playerNightStates[other] === 'down') continue;
          const op = g.positions[other];
          if (op && Math.hypot(op.x - downP.x, op.z - downP.z) < REVIVE_RADIUS) { helped = true; break; }
        }
      }
      if (helped || now - (ns.downAt[id] ?? 0) > AUTO_REVIVE_SECS) {
        ns.setPlayerNightState(id, 'alive');
      }
    }

    // ----- REGROUP: everyone down at once → soft reset at base. Delayed ~2.5s
    // so the comedic swat launch (1.8s) always plays first — matters most in
    // solo play, where one catch means "everyone" is down. -----
    if (ids.every((id) => ns.playerNightStates[id] === 'down')) {
      if (r.allDownSince === 0) r.allDownSince = now;
      if (now - r.allDownSince > 2.5) {
        for (const id of ids) {
          const p = g.positions[id];
          if (p) { p.x = BASE_ZONE.x + (Math.random() - 0.5) * 4; p.z = BASE_ZONE.z; p.y = 0; }
          ns.setPlayerNightState(id, 'safe');
        }
        ns.setRegroupAt(now);
        g.clearRagdoll();
        r.allDownSince = 0;
      }
    } else {
      r.allDownSince = 0;
    }

    // ----- SIREN HEAD AI -----
    let sx = ns.sirenX, sz = ns.sirenZ, syaw = ns.sirenYaw;
    let sstate = ns.sirenState;
    let target = ns.sirenTargetId;

    // detection (throttled — LOS raycasts are not cheap)
    r.detectFrame = (r.detectFrame + 1) % 5;
    let detected: CharacterId | null = null;
    let detectedDist = Infinity;
    if (r.detectFrame === 0 && now >= r.reacquireUntil) {
      for (const id of ids) {
        const st = ns.playerNightStates[id];
        if (st === 'down' || st === 'safe') continue;
        const p = g.positions[id];
        if (!p) continue;
        const dist = Math.hypot(p.x - sx, p.z - sz);
        let eff = ALERT_RADIUS_BASE;
        if (isRunning(id)) eff += SPRINT_NOISE;
        if (isCarrying(id)) eff += CARRY_NOISE;
        if (isCrouching(id)) eff -= CROUCH_QUIET;
        if (dist < eff && dist < detectedDist && hasLOS(sx, sz, p.x, p.z, colliders)) {
          detected = id; detectedDist = dist;
        }
      }
    }

    if (sstate === 'chase') {
      // keep chasing current target if still valid; else count toward losing it
      const tp = target ? g.positions[target] : null;
      const tValid = target && tp && ns.playerNightStates[target] !== 'down' && ns.playerNightStates[target] !== 'safe';
      if (detected) { target = detected; r.losLostAt = 0; }
      else if (tValid && r.detectFrame === 0) {
        // re-check LOS/range to the locked target
        const d = Math.hypot(tp!.x - sx, tp!.z - sz);
        if (d > ALERT_RADIUS_BASE + 10 || !hasLOS(sx, sz, tp!.x, tp!.z, colliders)) {
          if (r.losLostAt === 0) r.losLostAt = now;
        } else r.losLostAt = 0;
      } else if (!tValid) {
        if (r.losLostAt === 0) r.losLostAt = now;
      }
      if (r.losLostAt > 0 && now - r.losLostAt > LOS_BREAK_DELAY) {
        sstate = 'patrol'; target = null; r.losLostAt = 0;
        r.patrolPickedAt = 0; // pick a fresh wander spot
      }
    } else { // patrol / alerted
      if (detected) {
        if (sstate !== 'alerted') { sstate = 'alerted'; r.alertedAt = now; }
        target = detected;
      }
    }

    // movement + per-state behavior
    if (sstate === 'alerted') {
      const tp = target ? g.positions[target] : null;
      if (tp) syaw = Math.atan2(-(tp.x - sx), -(tp.z - sz));
      if (now - r.alertedAt > ALERT_PAUSE) { sstate = 'chase'; r.swungThisChase = false; } // arm the swat
    } else if (sstate === 'chase') {
      const tp = target ? g.positions[target] : null;
      if (tp) {
        const dx = tp.x - sx, dz = tp.z - sz;
        const d = Math.hypot(dx, dz) || 1;
        const spd = CHASE_SPEED * (d < 5 ? CHASE_LUNGE_MULT : 1); // vicious close-range lunge
        const res = resolveMotion(sx, sz, sx + (dx / d) * spd * dt, sz + (dz / d) * spd * dt, colliders);
        sx = res.x; sz = res.z; syaw = Math.atan2(-dx, -dz);
        // HAND-SWAT WINDUP: raise the arm as he closes in (one-shot per chase).
        if (d < WHACK_WINDUP_RANGE && !r.swungThisChase && target && ns.playerNightStates[target] === 'alive') {
          ns.bumpSirenSwing();
          r.swungThisChase = true;
        }
        // CATCH
        if (d < CATCH_RADIUS && target && ns.playerNightStates[target] === 'alive') {
          const victim = target;
          const vp = g.positions[victim];
          ns.setPlayerNightState(victim, 'down');
          ns.setDownAt(victim, now);
          // drop a carried lantern
          const carried = lanterns.find((l) => l.state === 'carried' && l.carrier === victim);
          if (carried && vp) {
            const upd = lanterns.map((l) => l.id === carried.id ? { ...l, state: 'idle' as const, carrier: null, x: vp.x, z: vp.z } : l);
            ns.setLanterns(upd);
          }
          bonkHit();
          if (victim === myId && vp) g.startRagdoll(vp.x, vp.y, vp.z, now);
          if (isInRoom()) broadcastSirenCaught({ characterId: victim, result: 'down', t: Date.now() });
          sstate = 'patrol'; target = null; r.reacquireUntil = now + REACQUIRE_COOLDOWN;
          r.swungThisChase = false;
          r.patrolPickedAt = 0;
        }
      } else { sstate = 'patrol'; }
    }

    if (sstate === 'patrol') {
      // pick a wander target inside the bounds
      if (now - r.patrolPickedAt > 7 || Math.hypot(sx - r.patrolTX, sz - r.patrolTZ) < 2) {
        r.patrolTX = SIREN_BOUNDS.minX + Math.random() * (SIREN_BOUNDS.maxX - SIREN_BOUNDS.minX);
        r.patrolTZ = SIREN_BOUNDS.minZ + Math.random() * (SIREN_BOUNDS.maxZ - SIREN_BOUNDS.minZ);
        r.patrolPickedAt = now;
      }
      const dx = r.patrolTX - sx, dz = r.patrolTZ - sz;
      const d = Math.hypot(dx, dz) || 1;
      const res = resolveMotion(sx, sz, sx + (dx / d) * PATROL_SPEED * dt, sz + (dz / d) * PATROL_SPEED * dt, colliders);
      sx = res.x; sz = res.z; syaw = Math.atan2(-dx, -dz);
    }

    // clamp to bounds
    sx = Math.max(SIREN_BOUNDS.minX, Math.min(SIREN_BOUNDS.maxX, sx));
    sz = Math.max(SIREN_BOUNDS.minZ, Math.min(SIREN_BOUNDS.maxZ, sz));

    // alert "lock-on" wail when he first wakes; a louder "IT SEES YOU" stinger
    // the instant he commits to the chase.
    if (sstate === 'alerted' && r.prevState !== 'alerted' && r.prevState !== 'chase') sirenAlertStab();
    if (sstate === 'chase' && r.prevState !== 'chase') sirenSpotStinger();
    r.prevState = sstate;

    ns.setSiren(sx, sz, syaw, sstate, target);
  });

  // ---------- LOCAL AUDIO + PROXIMITY (every client) ----------
  useFrame((_, dtRaw) => {
    const g = useGameStore.getState();
    if (g.gameMode !== 'night') { setNightSirenVolume(0); setHorrorChase(0); return; }
    const ns = useNightStore.getState();
    const net = useNetStore.getState();
    const localId = net.myCharacterId ?? g.activeCharacterId;
    const p = g.positions[localId];
    if (!p) return;
    const dist = Math.hypot(p.x - ns.sirenX, p.z - ns.sirenZ);
    const prox = Math.max(0, Math.min(1, 1 - dist / 40));
    ns.setSirenProximity(prox);

    const hunting = g.phase === 'night-hunt';
    const chasing = ns.sirenState === 'chase' || ns.sirenState === 'alerted';
    // distant wail grows as he nears; spikes when he's hunting you
    setNightSirenVolume(hunting ? prox * (chasing ? 1 : 0.6) : 0);
    // music dread layer: slams in when he commits to the chase, eases to relief
    // the moment you break away (setHorrorChase ramps internally).
    setHorrorChase(!hunting ? 0 : ns.sirenState === 'chase' ? 1 : ns.sirenState === 'alerted' ? 0.5 : 0);

    // heartbeat tightens as he closes in (only when genuinely near)
    if (hunting && prox > 0.35 && ns.playerNightStates[localId] !== 'down') {
      const dt = Math.min(dtRaw, 0.1);
      rt.current.heartTimer -= dt;
      if (rt.current.heartTimer <= 0) {
        heartbeat(prox);
        rt.current.heartTimer = 1.1 * (1 - prox * 0.6);
      }
    }
  });

  return null;
}
