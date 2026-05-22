import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { floorAt, resolveMotion } from './collision';
import { useCombatStore } from '../state/combatStore';
import { useTornadoStore } from '../state/tornadoStore';
import { useNetStore } from '../state/netStore';
import { useChatStore } from '../state/chatStore';
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
  const heroBox = useMemo(() => computeHeroBox(), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't react to typing in the chat input.
      if (useChatStore.getState().inputOpen) return;
      const k = e.key.toLowerCase();
      keys.current[k] = true;
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
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
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
      treehouseTick(positions[activeId], yaws, activeId, keys.current, dtRaw, staticColliders, doors, interactPressedRef);
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

    if (dx !== 0 || dz !== 0 || windDX !== 0 || windDZ !== 0) {
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

    // Floor under player (stairs / upper-story platforms; 0 elsewhere).
    const standingFloorY = floorAt(pos.x, pos.z, pos.y, floors);

    // Jump (only when on the floor under us)
    if ((k[' '] || k['space']) && pos.y - standingFloorY < 0.05) {
      yVel.current = JUMP_VELOCITY;
    }
    yVel.current -= GRAVITY * dt;
    pos.y += yVel.current * dt;
    if (pos.y < standingFloorY) {
      pos.y = standingFloorY;
      yVel.current = 0;
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

    if (interactPressedRef.current) {
      interactPressedRef.current = false;
      if (nearestId) toggleDoor(nearestId);
    }
  });

  return null;
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
