import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { floorAt, resolveMotion } from './collision';
import { useCombatStore } from '../state/combatStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useNetStore } from '../state/netStore';
import { useChatStore } from '../state/chatStore';
import { usePlayStore, ballPositions } from '../state/playStore';
import { HOUSES } from '../world/houses';
import { buildLots } from '../world/lots';
import { MUNCHIES_PLAYER_SPEED } from '../world/munchiesConfig';
import { useTreehouseStore } from '../state/treehouseStore';
import { liveOakPosition, treehouseSpawnPoint } from '../world/treehouseMissions';
import { treehousePickup } from '../audio';

const SPEED = 5.5;
const RUN_SPEED = 10.0;
const JUMP_VELOCITY = 7.5;
const GRAVITY = 22;
const INTERACT_RADIUS = 2.5;
// Tornado wind drag — sucks the player toward the funnel. Falls off with
// distance but never zero while close. Capped to prevent rocket-launching.
const WIND_PULL_STRENGTH = 4.5;
const WIND_MAX_VELOCITY = 8;
const WIND_FALLOFF_REF = 6;

interface HeroBox {
  pivotX: number; pivotZ: number;
  halfW: number; halfD: number;
  cosNeg: number; sinNeg: number;
}

function computeHeroBox(): HeroBox | null {
  const hero = HOUSES.find((h) => h.isHero);
  if (!hero) return null;
  const lots = buildLots(HOUSES);
  const lot = lots.find((l) => l.address === hero.address);
  if (!lot) return null;
  return {
    pivotX: lot.housePivot[0],
    pivotZ: lot.housePivot[1],
    halfW: hero.width / 2,
    halfD: hero.depth / 2,
    cosNeg: Math.cos(-lot.houseYaw),
    sinNeg: Math.sin(-lot.houseYaw),
  };
}

function isInsideHeroBox(box: HeroBox | null, x: number, z: number): boolean {
  if (!box) return false;
  const relX = x - box.pivotX;
  const relZ = z - box.pivotZ;
  const lx = relX * box.cosNeg - relZ * box.sinNeg;
  const lz = relX * box.sinNeg + relZ * box.cosNeg;
  return lx > -box.halfW && lx < box.halfW && lz > -box.halfD && lz < box.halfD;
}

export function PlayerController() {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const yVel = useRef(0);

  // In multiplayer the local browser only controls its claimed character.
  // Fallback to gameStore.activeCharacterId only if no net character is set
  // (shouldn't happen in normal flow but keeps single-window dev workable).
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);
  const spectator = useNetStore((s) => s.spectator);
  const activeId = myCharacterId ?? fallbackActive;
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const staticColliders = useGameStore((s) => s.staticColliders);
  const floors = useGameStore((s) => s.floors);
  const doors = useGameStore((s) => s.doors);
  const toggleDoor = useGameStore((s) => s.toggleDoor);
  const setHoverDoor = useGameStore((s) => s.setHoverDoor);

  const interactPressedRef = useRef(false);
  const shootRef = useRef(false);
  const heroBox = useMemo(() => computeHeroBox(), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't react to typing in the chat input.
      if (useChatStore.getState().inputOpen) return;
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      // Space shoots a held ball (edge-triggered so a single press = one shot).
      if (k === ' ' && !e.repeat) shootRef.current = true;
      // 1/2/3 character swap disabled in multiplayer — character is fixed
      // to whatever you claimed in CharacterSelect.
      if (k === 'r') {
        // reset to spawn (mode-aware)
        const pos = positions[activeId];
        const modeForReset = useGameStore.getState().gameMode;
        if (modeForReset === 'munchies') {
          // Munchies spawn is the great-room couch, not the cul-de-sac.
          pos.set(-5.0, 0, -3.0);
        } else if (modeForReset === 'treehouse') {
          // Treehouse spawn is 10600's backyard near the live oak.
          const sp = treehouseSpawnPoint();
          pos.set(sp.x, 0, sp.z);
        } else {
          pos.set(0, 0, -90);
        }
      }
      if (k === 'e') interactPressedRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    // Mouse click also shoots a held ball (only acted on when holding).
    const onMouseDown = () => { shootRef.current = true; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [activeId, positions]);

  useFrame((_, dtRaw) => {
    if (welcomeOpen) return;
    // Spectators don't move anything.
    if (spectator) return;
    // While chat is open, the textbox owns the keyboard.
    if (useChatStore.getState().inputOpen) return;

    const modeNow = useGameStore.getState().gameMode;
    if (modeNow === 'munchies') {
      munchiesTick(positions[activeId], yaws, activeId, keys.current, dtRaw, staticColliders, doors);
      return;
    }

    if (modeNow === 'treehouse') {
      // The Treehouse Club is the free-roam neighborhood mode, so bikes +
      // basketball are available here (always — no combat to conflict with).
      // This mirrors the aliens free-roam play layer; TreehouseCamera already
      // follows behind the player, which doubles as the bike chase cam.
      const pos = positions[activeId];
      const dt = Math.min(dtRaw, 0.1);
      const k = keys.current;
      const play = usePlayStore.getState();
      const myRiding = play.riding[activeId];

      // Contextual hover (bike / ball).
      if (myRiding) {
        play.setHover('getoff', myRiding.bikeId, null);
      } else if (play.heldBall && play.heldBall.by === activeId) {
        play.setHover('shoot', null, play.heldBall.ballId);
      } else {
        let bBike: string | null = null; let bBikeD = 2.0;
        for (const b of Object.values(play.bikes)) {
          const d = Math.hypot(b.x - pos.x, b.z - pos.z);
          if (d < bBikeD) { bBikeD = d; bBike = b.id; }
        }
        let bBall: string | null = null; let bBallD = 1.5;
        for (const [bid, bp] of Object.entries(ballPositions)) {
          const d = Math.hypot(bp.x - pos.x, bp.z - pos.z);
          if (d < bBallD) { bBallD = d; bBall = bid; }
        }
        if (bBall && (!bBike || bBallD <= bBikeD)) play.setHover('pickup', null, bBall);
        else if (bBike) play.setHover('ride', bBike, null);
        else play.setHover(null, null, null);
      }

      // Ride movement (replaces walking while mounted).
      if (myRiding) {
        rideBikeTick(myRiding, pos, yaws, activeId, k, dt, staticColliders, doors);
      }

      // E interaction: play takes priority; otherwise fall through to the
      // treehouse ladder / mission-item interact (we leave the ref set).
      if (interactPressedRef.current) {
        if (play.heldBall && play.heldBall.by === activeId) { interactPressedRef.current = false; play.dropBall(); }
        else if (play.hoverPlay === 'pickup' && play.hoverBallId) { interactPressedRef.current = false; play.pickUpBall(play.hoverBallId, activeId); }
        else if (play.hoverPlay === 'ride' && play.hoverBikeId) { interactPressedRef.current = false; mountBike(activeId, play.hoverBikeId, play.bikes[play.hoverBikeId]?.color ?? '#3a6db0', yaws[activeId]); }
        else if (play.hoverPlay === 'getoff') { interactPressedRef.current = false; dismountBike(activeId, pos, staticColliders); }
      }

      // Shoot a held ball (space / click).
      if (shootRef.current) {
        shootRef.current = false;
        const p2 = usePlayStore.getState();
        if (p2.heldBall && p2.heldBall.by === activeId) doShoot(p2, activeId, pos, yaws[activeId]);
      }

      if (play.riding[activeId]) {
        // Riding: keep a carried mission item following us; skip walking.
        const mi = useTreehouseStore.getState().missionItem;
        if (mi && mi.carriedBy === activeId) useTreehouseStore.getState().setMissionItemPos(pos.x, pos.z);
      } else {
        treehouseTick(pos, yaws, activeId, k, dtRaw, staticColliders, doors, interactPressedRef);
      }
      return;
    }

    const slowFactor = useCombatStore.getState().slowMo;
    const dt = Math.min(dtRaw, 0.1) * slowFactor;

    const k = keys.current;
    let dx = 0;
    let dz = 0;
    if (k['w'] || k['arrowup']) dz -= 1;
    if (k['s'] || k['arrowdown']) dz += 1;
    if (k['a'] || k['arrowleft']) dx -= 1;
    if (k['d'] || k['arrowright']) dx += 1;

    const pos = positions[activeId];

    // ---- Riding a bike? Bike movement replaces walking (non-combat only) ----
    const myRiding = usePlayStore.getState().riding[activeId];
    if (myRiding) {
      rideBikeTick(myRiding, pos, yaws, activeId, k, dt, staticColliders, doors);
    }

    // ---- Tornado wind drag ----
    // During approach phases, the funnel pulls the player. We compute a
    // wind-displacement delta and bake it into desired XZ along with normal
    // movement, so resolveMotion handles collisions cleanly.
    let windDX = 0;
    let windDZ = 0;
    const gs = useGameStore.getState();
    if (gs.gameMode === 'tornado') {
      const ts = useTornadoStore.getState();
      const phase = gs.phase;
      const windActive = (phase === 'tornado-approach' || phase === 'tornado-arrived') && ts.tornadoOpacity > 0.1;
      if (windActive) {
        const toTornadoX = ts.tornadoX - pos.x;
        const toTornadoZ = ts.tornadoZ - pos.z;
        const dist = Math.hypot(toTornadoX, toTornadoZ);
        if (dist > 0.1) {
          // Falloff: ~1.0 at WIND_FALLOFF_REF, decays beyond. Inside hero house, no wind.
          const insideHero = isInsideHeroBox(heroBox, pos.x, pos.z);
          if (!insideHero) {
            const falloff = 1 / Math.max(1, dist / WIND_FALLOFF_REF);
            const force = Math.min(WIND_MAX_VELOCITY, WIND_PULL_STRENGTH * falloff * ts.windStrength);
            const dirX = toTornadoX / dist;
            const dirZ = toTornadoZ / dist;
            windDX = dirX * force * dt;
            windDZ = dirZ * force * dt;
          }
        }
      }
    }

    if (!myRiding && (dx !== 0 || dz !== 0 || windDX !== 0 || windDZ !== 0)) {
      let moveX = 0;
      let moveZ = 0;
      let moveDir: Vector3 | null = null;

      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz);
        dx /= len;
        dz /= len;

        const camDir = new Vector3();
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();
        const camRight = new Vector3().crossVectors(camDir, new Vector3(0, 1, 0)).normalize();

        const isRunning = !!k['shift'];
        const speed = isRunning ? RUN_SPEED : SPEED;

        moveDir = new Vector3()
          .addScaledVector(camDir, -dz)
          .addScaledVector(camRight, dx)
          .normalize();

        moveX = moveDir.x * speed * dt;
        moveZ = moveDir.z * speed * dt;
      }

      const desiredX = pos.x + moveX + windDX;
      const desiredZ = pos.z + moveZ + windDZ;

      // Combine static colliders with door AABBs (closed doors block, open ones don't).
      const allColliders = [...staticColliders];
      for (const door of Object.values(doors)) {
        if (door.open) continue;
        allColliders.push(door.aabbWhenClosed);
      }
      const resolved = resolveMotion(pos.x, pos.z, desiredX, desiredZ, allColliders);
      pos.x = resolved.x;
      pos.z = resolved.z;

      // Rotate character to face movement direction (smoother lerp = finer turning).
      if (moveDir) {
        const targetYaw = Math.atan2(-moveDir.x, -moveDir.z);
        let diff = targetYaw - yaws[activeId];
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        yaws[activeId] = yaws[activeId] + diff * Math.min(1, 8 * dt);
      }
    }

    // Floor + jump + gravity (skipped while riding — the bike stays grounded).
    if (!myRiding) {
      const standingFloorY = floorAt(pos.x, pos.z, pos.y, floors);
      // Jump (only when on the floor under us). Space also shoots a held ball,
      // but you can't hold a ball and jump at the same time, so no conflict.
      if ((k[' '] || k['space']) && pos.y - standingFloorY < 0.05 && !usePlayStore.getState().heldBall) {
        yVel.current = JUMP_VELOCITY;
      }
      yVel.current -= GRAVITY * dt;
      pos.y += yVel.current * dt;
      if (pos.y < standingFloorY) {
        pos.y = standingFloorY;
        yVel.current = 0;
      }
    }

    // Door interaction: find nearest door within INTERACT_RADIUS.
    let nearestId: string | null = null;
    let nearestDist = INTERACT_RADIUS;
    for (const [id, door] of Object.entries(doors)) {
      const d = Math.hypot(door.centerX - pos.x, door.centerZ - pos.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = id;
      }
    }
    setHoverDoor(nearestId);

    // ---- Free-roam play hover (bikes + basketball), non-combat only ----
    const phaseNow = useGameStore.getState().phase;
    const playActive =
      modeNow === 'freeplay' ||
      (modeNow === 'aliens' &&
        (phaseNow === 'free-play' || phaseNow === 'pre-intro' || phaseNow === 'victory'));
    const play = usePlayStore.getState();
    if (playActive) {
      const riding = play.riding[activeId];
      if (riding) {
        play.setHover('getoff', riding.bikeId, null);
      } else if (play.heldBall && play.heldBall.by === activeId) {
        play.setHover('shoot', null, play.heldBall.ballId);
      } else {
        let bestBike: string | null = null;
        let bestBikeD = 2.0;
        for (const b of Object.values(play.bikes)) {
          const d = Math.hypot(b.x - pos.x, b.z - pos.z);
          if (d < bestBikeD) { bestBikeD = d; bestBike = b.id; }
        }
        let bestBall: string | null = null;
        let bestBallD = 1.5;
        for (const [bid, bp] of Object.entries(ballPositions)) {
          const d = Math.hypot(bp.x - pos.x, bp.z - pos.z);
          if (d < bestBallD) { bestBallD = d; bestBall = bid; }
        }
        if (bestBall && (!bestBike || bestBallD <= bestBikeD)) play.setHover('pickup', null, bestBall);
        else if (bestBike) play.setHover('ride', bestBike, null);
        else play.setHover(null, null, null);
      }
    } else {
      // Left free-roam (combat started / mode changed): cancel local play.
      if (play.hoverPlay) play.setHover(null, null, null);
      if (play.riding[activeId]) play.dismount(activeId);
      if (play.heldBall && play.heldBall.by === activeId) play.dropBall();
    }

    if (interactPressedRef.current) {
      interactPressedRef.current = false;
      // Play interactions take precedence over doors when both are in range.
      const ph = usePlayStore.getState();
      if (playActive && ph.heldBall && ph.heldBall.by === activeId) {
        ph.dropBall();
      } else if (playActive && ph.hoverPlay === 'pickup' && ph.hoverBallId) {
        ph.pickUpBall(ph.hoverBallId, activeId);
      } else if (playActive && ph.hoverPlay === 'ride' && ph.hoverBikeId) {
        mountBike(activeId, ph.hoverBikeId, ph.bikes[ph.hoverBikeId]?.color ?? '#3a6db0', yaws[activeId]);
      } else if (playActive && ph.hoverPlay === 'getoff') {
        dismountBike(activeId, pos, staticColliders);
      } else if (nearestId) {
        toggleDoor(nearestId);
      }
    }

    // ---- Shoot a held ball (space or click) ----
    if (shootRef.current) {
      shootRef.current = false;
      const ph = usePlayStore.getState();
      if (playActive && ph.heldBall && ph.heldBall.by === activeId) {
        doShoot(ph, activeId, pos, yaws[activeId]);
      }
    }
  });

  return null;
}

// ---- Bike riding ----
const BIKE_MAX_SPEED = 13;
const BIKE_REVERSE_SPEED = 3.5;
const BIKE_ACCEL = 14;
const BIKE_BRAKE = 22;
const BIKE_FRICTION = 6;
const BIKE_TURN = 2.4;

type Colliders = import('../types').RectCollider[];
type Doors = Record<string, { open: boolean; centerX: number; centerZ: number; aabbWhenClosed: import('../types').RectCollider }>;

function mountBike(id: import('../types').CharacterId, bikeId: string, color: string, currentYaw: number) {
  usePlayStore.getState().mount(id, { bikeId, bikeColor: color, heading: currentYaw, speed: 0 });
}

function dismountBike(id: import('../types').CharacterId, pos: Vector3, colliders: Colliders) {
  // Nudge the rider to a clear spot beside the bike, else stay put.
  const offsets: [number, number][] = [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3], [1, 1], [-1, -1]];
  for (const [ox, oz] of offsets) {
    const tx = pos.x + ox;
    const tz = pos.z + oz;
    const r = resolveMotion(pos.x, pos.z, tx, tz, colliders);
    if (Math.hypot(r.x - tx, r.z - tz) < 0.05) { pos.x = r.x; pos.z = r.z; break; }
  }
  pos.y = 0;
  usePlayStore.getState().dismount(id);
}

function rideBikeTick(
  riding: import('../state/playStore').RidingState,
  pos: Vector3,
  yaws: Record<string, number>,
  activeId: string,
  keys: Record<string, boolean>,
  dt: number,
  colliders: Colliders,
  doors: Doors,
) {
  const fwd = keys['w'] || keys['arrowup'];
  const back = keys['s'] || keys['arrowdown'];
  let speed = riding.speed;
  if (fwd) speed += BIKE_ACCEL * dt;
  else if (back) speed -= BIKE_BRAKE * dt;
  else {
    const f = BIKE_FRICTION * dt;
    speed = speed > 0 ? Math.max(0, speed - f) : Math.min(0, speed + f);
  }
  speed = Math.max(-BIKE_REVERSE_SPEED, Math.min(BIKE_MAX_SPEED, speed));

  // Steer only while moving; turn rate scales with speed; reverse flips it.
  const steer = (keys['a'] || keys['arrowleft'] ? 1 : 0) - (keys['d'] || keys['arrowright'] ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(speed) / 3);
  const dir = speed >= 0 ? 1 : -1;
  riding.heading += steer * BIKE_TURN * speedFactor * dir * dt;
  riding.speed = speed;

  const fx = -Math.sin(riding.heading);
  const fz = -Math.cos(riding.heading);
  const desiredX = pos.x + fx * speed * dt;
  const desiredZ = pos.z + fz * speed * dt;
  const all = [...colliders];
  for (const door of Object.values(doors)) { if (!door.open) all.push(door.aabbWhenClosed); }
  const resolved = resolveMotion(pos.x, pos.z, desiredX, desiredZ, all);
  if (Math.hypot(resolved.x - desiredX, resolved.z - desiredZ) > 0.02) riding.speed *= 0.4; // bumped something
  pos.x = resolved.x;
  pos.z = resolved.z;
  pos.y = 0;
  yaws[activeId] = riding.heading;

  // Soft cove boundary.
  const d = Math.hypot(pos.x, pos.z);
  if (d > COVE_BOUND_RADIUS) {
    const kk = COVE_BOUND_RADIUS / d;
    pos.x *= kk;
    pos.z *= kk;
    riding.speed *= 0.7;
  }
}

// ---- Basketball shooting (assisted arc to the nearest forward hoop) ----
const BALL_G = 18;

function doShoot(
  play: ReturnType<typeof usePlayStore.getState>,
  by: import('../types').CharacterId,
  pos: Vector3,
  yaw: number,
) {
  if (!play.heldBall) return;
  const ballId = play.heldBall.ballId;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const x0 = pos.x + fx * 0.5;
  const z0 = pos.z + fz * 0.5;
  const y0 = 1.3;

  // Pick the nearest hoop, biased toward the one you're facing.
  let best: import('../state/playStore').HoopReg | null = null;
  let bestScore = Infinity;
  for (const h of Object.values(play.hoops)) {
    const dx = h.x - x0;
    const dz = h.z - z0;
    const dist = Math.hypot(dx, dz) || 0.001;
    const fwdDot = (dx / dist) * fx + (dz / dist) * fz; // 1 = directly ahead
    const score = dist + (1 - fwdDot) * 8;
    if (score < bestScore) { bestScore = score; best = h; }
  }
  if (!best) { play.dropBall(); return; }

  const dist = Math.hypot(best.x - x0, best.z - z0);
  const T = Math.max(0.65, Math.min(1.4, dist / 7));
  const ty = best.rimY + 0.25;
  let vx = (best.x - x0) / T;
  let vz = (best.z - z0) / T;
  let vy = (ty - y0 + 0.5 * BALL_G * T * T) / T;
  // A tiny bit of error so it isn't robotic, but kids reliably make it.
  vx *= 1 + (Math.random() - 0.5) * 0.03;
  vz *= 1 + (Math.random() - 0.5) * 0.03;
  vy += (Math.random() - 0.5) * 0.25;

  play.shoot(ballId, by, vx, vy, vz, performance.now());
}

function munchiesTick(
  pos: Vector3,
  yaws: Record<string, number>,
  activeId: string,
  keys: Record<string, boolean>,
  dtRaw: number,
  staticColliders: import('../types').RectCollider[],
  doors: Record<string, { open: boolean; centerX: number; centerZ: number; aabbWhenClosed: import('../types').RectCollider }>,
) {
  const dt = Math.min(dtRaw, 0.1);
  // 4-direction movement, world-axis, no diagonal.
  let dx = 0;
  let dz = 0;
  if (keys['w'] || keys['arrowup']) dz -= 1;
  if (keys['s'] || keys['arrowdown']) dz += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  // Prefer X-axis when both axes pressed (no diagonal drift).
  if (dx !== 0 && dz !== 0) {
    dz = 0;
  }

  if (dx === 0 && dz === 0) return;

  const moveX = dx * MUNCHIES_PLAYER_SPEED * dt;
  const moveZ = dz * MUNCHIES_PLAYER_SPEED * dt;
  const desiredX = pos.x + moveX;
  const desiredZ = pos.z + moveZ;
  const allColliders = [...staticColliders];
  for (const door of Object.values(doors)) {
    if (door.open) continue;
    allColliders.push(door.aabbWhenClosed);
  }
  const resolved = resolveMotion(pos.x, pos.z, desiredX, desiredZ, allColliders);
  pos.x = resolved.x;
  pos.z = resolved.z;
  // Belt-and-suspenders: clamp to hero house interior bounds (matches floorPlan.ts).
  // Even if a door collider has a gap, this guarantees Luke can't escape the maze.
  const HOUSE_MIN_X = -8.8;
  const HOUSE_MAX_X = 1.9;     // exclude garage (x>=2)
  const HOUSE_MIN_Z = -7.8;
  const HOUSE_MAX_Z = 7.8;
  if (pos.x < HOUSE_MIN_X) pos.x = HOUSE_MIN_X;
  if (pos.x > HOUSE_MAX_X) pos.x = HOUSE_MAX_X;
  if (pos.z < HOUSE_MIN_Z) pos.z = HOUSE_MIN_Z;
  if (pos.z > HOUSE_MAX_Z) pos.z = HOUSE_MAX_Z;
  // Snap yaw to movement direction (Pac-Man-feel).
  yaws[activeId] = Math.atan2(-dx, -dz);
}

const TREEHOUSE_SPEED = 5.0;
const TREEHOUSE_RUN_SPEED = 8.5;
const LADDER_INTERACT_RADIUS = 2.5;
const ITEM_INTERACT_RADIUS = 2.0;
const TREEHOUSE_FLOOR_Y = 8.0;
const COVE_BOUND_RADIUS = 75;

function treehouseTick(
  pos: Vector3,
  yaws: Record<string, number>,
  activeId: string,
  keys: Record<string, boolean>,
  dtRaw: number,
  staticColliders: import('../types').RectCollider[],
  doors: Record<string, { open: boolean; centerX: number; centerZ: number; aabbWhenClosed: import('../types').RectCollider }>,
  interactPressedRef: { current: boolean },
) {
  const dt = Math.min(dtRaw, 0.1);

  // --- Movement (world-axis WASD) ---
  let dx = 0;
  let dz = 0;
  if (keys['w'] || keys['arrowup']) dz -= 1;
  if (keys['s'] || keys['arrowdown']) dz += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
    const isRunning = !!keys['shift'];
    const speed = isRunning ? TREEHOUSE_RUN_SPEED : TREEHOUSE_SPEED;
    const moveX = dx * speed * dt;
    const moveZ = dz * speed * dt;
    const desiredX = pos.x + moveX;
    const desiredZ = pos.z + moveZ;
    const allColliders = [...staticColliders];
    for (const door of Object.values(doors)) {
      if (door.open) continue;
      allColliders.push(door.aabbWhenClosed);
    }
    const resolved = resolveMotion(pos.x, pos.z, desiredX, desiredZ, allColliders);
    pos.x = resolved.x;
    pos.z = resolved.z;
    // Smoothly lerp yaw toward movement direction (no snap → no camera jumps).
    const targetYaw = Math.atan2(-dx, -dz);
    let diff = targetYaw - yaws[activeId];
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    yaws[activeId] = yaws[activeId] + diff * Math.min(1, 8 * dt);
  }

  // --- Soft cove boundary ---
  const distFromCenter = Math.hypot(pos.x, pos.z);
  if (distFromCenter > COVE_BOUND_RADIUS) {
    const k = COVE_BOUND_RADIUS / distFromCenter;
    pos.x *= k;
    pos.z *= k;
  }

  // --- Interact ---
  if (interactPressedRef.current) {
    interactPressedRef.current = false;
    handleTreehouseInteract(pos, activeId);
  }

  // Carry mission item: when carried, item follows player.
  const mi = useTreehouseStore.getState().missionItem;
  if (mi && mi.carriedBy === activeId) {
    useTreehouseStore.getState().setMissionItemPos(pos.x, pos.z);
  }
}

function handleTreehouseInteract(pos: Vector3, activeId: string) {
  const oak = liveOakPosition();

  // 1) Ladder up: ground level near tree
  if (pos.y < 0.5 && Math.hypot(pos.x - oak.x, pos.z - oak.z) < LADDER_INTERACT_RADIUS) {
    pos.y = TREEHOUSE_FLOOR_Y + 0.05;
    return;
  }

  // 2) Ladder down: inside treehouse
  if (pos.y > TREEHOUSE_FLOOR_Y - 0.5 && Math.hypot(pos.x - oak.x, pos.z - oak.z) < LADDER_INTERACT_RADIUS + 0.5) {
    pos.y = 0;
    return;
  }

  // 3) Mission item pickup (on ground, not yet carried)
  const ts = useTreehouseStore.getState();
  const item = ts.missionItem;
  if (item && item.carriedBy === null) {
    if (Math.hypot(pos.x - item.x, pos.z - item.z) < ITEM_INTERACT_RADIUS) {
      ts.pickUpMissionItem(activeId as 'luke' | 'penny');
      treehousePickup();
      return;
    }
  }

  // 4) Mission item drop (currently carrying)
  if (item && item.carriedBy === activeId) {
    ts.dropMissionItem(pos.x, pos.z);
    return;
  }
}
