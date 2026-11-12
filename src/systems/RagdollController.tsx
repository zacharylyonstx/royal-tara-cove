import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useNightStore } from '../state/nightStore';
import { useCombatStore } from '../state/combatStore';
import { useNetStore } from '../state/netStore';
import { startRagdollWhoosh, tickRagdollWhoosh, stopRagdollWhoosh, wilhelmScream } from '../audio';
import { usePlayStore } from '../state/playStore';
import { broadcastPark } from '../net/room';
import { clampToStreet } from './PlayerController';
import { isIndoors } from '../world/indoors';
import {
  STALKER_TOSS_DURATION, STALKER_TOSS_PEAK, STALKER_TOSS_DIST, STALKER_TOSS_MIN_DIST,
} from '../world/stalkerLayout';
import type { RectCollider } from '../types';

/** Is a ground point inside any solid (non-passable, ground-touching) collider? */
function pointBlocked(x: number, z: number, colliders: RectCollider[]): boolean {
  for (const c of colliders) {
    if (c.passable) continue;
    if ((c.minY ?? 0) > 0.6) continue;
    let inside: boolean;
    if (c.yaw) {
      const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
      const hX = (c.maxX - c.minX) / 2 + 0.6, hZ = (c.maxZ - c.minZ) / 2 + 0.6;
      const cn = Math.cos(-c.yaw), sn = Math.sin(-c.yaw);
      const lx = (x - cx) * cn - (z - cz) * sn;
      const lz = (x - cx) * sn + (z - cz) * cn;
      inside = lx > -hX && lx < hX && lz > -hZ && lz < hZ;
    } else {
      inside = x > c.minX - 0.6 && x < c.maxX + 0.6 && z > c.minZ - 0.6 && z < c.maxZ + 0.6;
    }
    if (inside) return true;
  }
  return false;
}

/** Pick where the yeet lands: as far as STALKER_TOSS_DIST along `dir`, pulled
 *  back until the spot is on the drivable street region and not inside a
 *  house/fence/prop — so you never land stuck in a wall. */
function findLanding(ox: number, oz: number, dirX: number, dirZ: number, colliders: RectCollider[]): { x: number; z: number } {
  for (let d = STALKER_TOSS_DIST; d >= STALKER_TOSS_MIN_DIST; d -= 2) {
    const px = ox + dirX * d, pz = oz + dirZ * d;
    const c = clampToStreet(px, pz);
    const x = c ? c.x : px, z = c ? c.z : pz;
    if (!pointBlocked(x, z, colliders) && !isIndoors(x, z)) return { x, z };
  }
  return { x: ox + dirX * STALKER_TOSS_MIN_DIST, z: oz + dirZ * STALKER_TOSS_MIN_DIST };
}

// Defeat-throw cinematic. Active only while gameStore.ragdoll != null.
// Drives:
//   • active character position into a rising spiral that shrinks to 0
//   • yaw into a fast spin
//   • cinematic camera orbiting the character so it's clearly visible
//   • whooshing audio with rising pitch
// After 4 seconds, clears ragdoll state; the defeat HUD takes over.

const THROW_DURATION = 4;

// Siren Head Night: a short, comedic "BONK + whoosh launch" instead of the
// tornado's wild first-person tumble — kid-friendly. Runs on the LOCAL caught
// client (which may be a non-host guest), animating only the local character;
// the arc propagates to everyone via the normal position broadcast.
const NIGHT_SWAT_DURATION = 2.4;  // a big, satisfying "tossed across the street" arc
const NIGHT_SWAT_PEAK = 14;       // launched way up (was 6.5) — like the tornado yeet
const NIGHT_SWAT_DIST = 20;       // hurled this far from where Siren Head whacked you

export function RagdollController() {
  const startedRef = useRef(false);
  const nightLaunch = useRef<{ dirX: number; dirZ: number; oy: number } | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    return () => {
      stopRagdollWhoosh();
      // Make sure the cinematic override is cleared on unmount
      const cs = useCombatStore.getState();
      if (cs.cinematic.active) {
        cs.endCinematic();
      }
      // The tumble rolls the camera; never leave it tilted for the next mode.
      camera.up.set(0, 1, 0);
    };
  }, [camera]);

  useFrame(() => {
    const g = useGameStore.getState();

    // ---- Free Play: Siren Head's after-dark swat = tornado-style yeet ----
    // Runs on the LOCAL caught client (host or guest); the arc reaches everyone
    // through the normal position broadcast. You land on your feet, alive.
    if (g.gameMode === 'freeplay') {
      const rag = g.ragdoll;
      if (!rag || !rag.active) {
        if (nightLaunch.current) {
          nightLaunch.current = null;
          stopRagdollWhoosh();
          useCombatStore.getState().endCinematic();
          camera.up.set(0, 1, 0);
        }
        return;
      }
      const localId = useNetStore.getState().myCharacterId ?? g.activeCharacterId;
      const player = g.positions[localId];
      if (!player) return;
      if (!nightLaunch.current) {
        const ns = useNightStore.getState();
        const ax = rag.originX - ns.sirenX;
        const az = rag.originZ - ns.sirenZ;
        const al = Math.hypot(ax, az) || 1;
        const dirX = ax / al, dirZ = az / al;
        const land = findLanding(rag.originX, rag.originZ, dirX, dirZ, g.staticColliders);
        nightLaunch.current = { dirX: land.x - rag.originX, dirZ: land.z - rag.originZ, oy: rag.originY };
        // Swatted out of the car: park it right here for everyone, hop out.
        const ph = usePlayStore.getState();
        const rid = ph.riding[localId];
        if (rid) {
          if (rid.vehicle === 'car' && !rid.passengerOf) {
            ph.parkCar(rid.bikeId, player.x, player.z, rid.heading);
            void broadcastPark([{ id: rid.bikeId, x: player.x, z: player.z, yaw: rid.heading }]);
          }
          ph.dismount(localId);
        }
        useCombatStore.getState().addShake(0.8);
        startRagdollWhoosh();
        wilhelmScream();
        ns.setStalkerEvent({ kind: 'swat', at: performance.now() / 1000 });
      }
      const L = nightLaunch.current;
      const now = performance.now() / 1000;
      const t = Math.min(STALKER_TOSS_DURATION, now - rag.startedAt);
      const p = t / STALKER_TOSS_DURATION;
      // ease the horizontal travel so it launches hard and settles
      const ph = 1 - Math.pow(1 - p, 1.6);
      const x = rag.originX + L.dirX * ph;
      const z = rag.originZ + L.dirZ * ph;
      const y = Math.max(0, L.oy + Math.sin(p * Math.PI) * STALKER_TOSS_PEAK);
      player.x = x; player.y = y; player.z = z;
      const yaw = t * 7;
      const pitch = Math.sin(t * 7.5) * 0.6 + Math.sin(t * 2.7) * 0.3;
      const roll = Math.sin(t * 5.1) * 0.5;
      const lookDir = new Vector3(0, 0, -1).applyEuler(new Euler(pitch, yaw, roll, 'YXZ'));
      const headY = y + 0.4;
      useCombatStore.setState({
        cinematic: {
          active: true,
          cameraX: x, cameraY: headY, cameraZ: z,
          targetX: x + lookDir.x * 5, targetY: headY + lookDir.y * 5, targetZ: z + lookDir.z * 5,
          endsAt: now + STALKER_TOSS_DURATION,
        },
      });
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      g.yaws[localId] = yaw;
      tickRagdollWhoosh(t);
      if (t >= STALKER_TOSS_DURATION) {
        player.y = 0;
        g.clearRagdoll();
        nightLaunch.current = null;
        stopRagdollWhoosh();
        useCombatStore.getState().endCinematic();
        camera.up.set(0, 1, 0);
      }
      return;
    }

    // ---- Siren Head Night swat (runs on the local caught client, any peer) ----
    if (g.gameMode === 'night') {
      const rag = g.ragdoll;
      if (!rag || !rag.active) { nightLaunch.current = null; return; }
      const localId = useNetStore.getState().myCharacterId ?? g.activeCharacterId;
      const player = g.positions[localId];
      if (!player) return;
      if (!nightLaunch.current) {
        const ns = useNightStore.getState();
        const ax = rag.originX - ns.sirenX;
        const az = rag.originZ - ns.sirenZ;
        const al = Math.hypot(ax, az) || 1;
        nightLaunch.current = { dirX: ax / al, dirZ: az / al, oy: rag.originY };
        useCombatStore.getState().addShake(0.7); // hard WHAM
      }
      const L = nightLaunch.current;
      const now = performance.now() / 1000;
      const t = Math.min(NIGHT_SWAT_DURATION, now - rag.startedAt);
      const p = t / NIGHT_SWAT_DURATION;
      const x = rag.originX + L.dirX * p * NIGHT_SWAT_DIST;
      const z = rag.originZ + L.dirZ * p * NIGHT_SWAT_DIST;
      const y = Math.max(0, L.oy + Math.sin(p * Math.PI) * NIGHT_SWAT_PEAK);
      player.x = x; player.y = y; player.z = z;
      // Tumbling first-person view — the "tossed by the tornado" feel, a bit
      // tamer than the tornado spin so it's fun, not nauseating. Honored on every
      // client in night mode (CameraRig relaxes its host-gate for night).
      const yaw = t * 6;
      const pitch = Math.sin(t * 6.5) * 0.5;
      const roll = Math.sin(t * 4.5) * 0.45;
      const lookDir = new Vector3(0, 0, -1).applyEuler(new Euler(pitch, yaw, roll, 'YXZ'));
      const headY = y + 0.4;
      useCombatStore.setState({
        cinematic: {
          active: true,
          cameraX: x, cameraY: headY, cameraZ: z,
          targetX: x + lookDir.x * 5, targetY: headY + lookDir.y * 5, targetZ: z + lookDir.z * 5,
          endsAt: now + NIGHT_SWAT_DURATION,
        },
      });
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      g.yaws[localId] = yaw; // body spins too (others see you tumble)
      if (t >= NIGHT_SWAT_DURATION) {
        player.y = 0;
        g.clearRagdoll();
        nightLaunch.current = null;
        useCombatStore.getState().endCinematic();
        camera.up.set(0, 1, 0);
      }
      return;
    }

    // ---- Tornado defeat throw (host-only) ----
    if (!useNetStore.getState().isHost) return;
    if (g.gameMode !== 'tornado') return;
    const rag = g.ragdoll;
    const cs = useCombatStore.getState();

    if (!rag || !rag.active) {
      if (startedRef.current) {
        startedRef.current = false;
        stopRagdollWhoosh();
        if (cs.cinematic.active) cs.endCinematic();
        camera.up.set(0, 1, 0);
      }
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
      startRagdollWhoosh();
      wilhelmScream();
    }

    const now = performance.now() / 1000;
    const t = Math.min(THROW_DURATION, now - rag.startedAt);
    const ts = useTornadoStore.getState();
    const tornadoZ = ts.tornadoZ;
    const tornadoX = ts.tornadoX;

    // Position: rising spiral around the tornado, scaling outward.
    const baseY = rag.originY + 22 * Math.sin((t / THROW_DURATION) * Math.PI);
    const theta = t * 4;
    const radius = 2 + t * 6;
    const x = tornadoX + Math.cos(theta) * radius;
    const z = tornadoZ + Math.sin(theta) * radius;
    // Ragdoll the LOCAL peer's claimed character (multiplayer-safe).
    // Each browser sees its own kid fly around the funnel during the defeat cinematic.
    const ragId = useNetStore.getState().myCharacterId ?? g.activeCharacterId;
    const player = g.positions[ragId];
    if (player) {
      player.x = x;
      player.y = Math.max(0, baseY);
      player.z = z;
    }
    g.yaws[ragId] = t * 8;

    // ---- v17 first-person ragdoll camera ----
    // Instead of an orbital cinematic, the camera lives AT the player's
    // position, spinning with their yaw + pitching wildly. The world
    // spins around the viewer — disorienting and funny.
    // We bypass the CameraRig by writing directly into a cinematic state
    // whose camera == player position and whose target is in-front-of-player.
    const headY = Math.max(0, baseY) + 0.4;
    // Tumble: yaw matches player spin, pitch oscillates wildly
    const tumbleYaw = g.yaws[ragId];
    const tumblePitch = Math.sin(t * 9) * 0.7 + Math.sin(t * 3.1) * 0.4;
    const tumbleRoll  = Math.sin(t * 5.3) * 0.6;

    const lookDir = new Vector3(0, 0, -1).applyEuler(new Euler(tumblePitch, tumbleYaw, tumbleRoll, 'YXZ'));
    const lookX = x + lookDir.x * 5;
    const lookY = headY + lookDir.y * 5;
    const lookZ = z + lookDir.z * 5;

    useCombatStore.setState({
      cinematic: {
        active: true,
        cameraX: x, cameraY: headY, cameraZ: z,
        targetX: lookX, targetY: lookY, targetZ: lookZ,
        endsAt: now + THROW_DURATION,
      },
    });
    // Roll: lookAt() uses camera.up, so tilting "up" gives us roll without
    // fighting the CameraRig's lookAt every frame.
    camera.up.set(Math.sin(tumbleRoll), Math.cos(tumbleRoll), 0);

    tickRagdollWhoosh(t);

    if (t >= THROW_DURATION) {
      g.clearRagdoll();
      stopRagdollWhoosh();
      cs.endCinematic();
      camera.up.set(0, 1, 0);
    }
  });

  return null;
}
