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
import { STRAIGHT_START_Z, STRAIGHT_END_Z } from '../world/streetLayout';
import { MUNCHIES_PLAYER_SPEED } from '../world/munchiesConfig';
import { useTreehouseStore } from '../state/treehouseStore';
import { liveOakPosition, treehouseSpawnPoint } from '../world/treehouseMissions';
import { treehousePickup, hopSound, trampolineBoing } from '../audio';
import { touchInput, TOUCH_RUN_THRESHOLD, TOUCH_DIR_THRESHOLD } from './touchInput';
import { useWardrobeStore } from '../state/wardrobeStore';
import { useZoneStore } from '../state/zoneStore';
import { useNightStore } from '../state/nightStore';
import { sendEmote, sendChat, broadcastDoor, broadcastPark, broadcastPet, isInRoom } from '../net/room';
import { icecreamJingle, petChime } from '../audio';
import { usePetStore } from '../state/petStore';
import { ZONE_HALF_X, ZONE_MIN_Z, ZONE_MAX_Z } from '../world/acrossBlvd';
import { selectInteractable, facingFromYaw, type InteractCandidate } from './interactSelect';
import { SEATS, seatWorld, seatCandidateId, parseSeatCandidateId } from '../world/seats';
import { CHARACTER_ORDER } from '../world/characters';
import type { CharacterId } from '../types';
import type { RidingState } from '../state/playStore';

/** Free Play "go home" spots (hold R) — the family's cul-de-sac spawn in front of 10600. */
const FREEPLAY_HOME: Record<CharacterId, [number, number]> = {
  dad: [-2.5, 10],
  penny: [0, 11],
  luke: [2.5, 10],
};
const R_HOLD_MS = 900;

function isCarDriven(riding: Record<CharacterId, RidingState | null>, carId: string): boolean {
  for (const r of Object.values(riding)) if (r && r.vehicle === 'car' && r.bikeId === carId) return true;
  return false;
}

/** Fire a pass-1 interactable (dresser → wardrobe UI; zone spot → pet / treat). */
function fireHouseOrZoneInteract(c: InteractCandidate, by: CharacterId) {
  if (c.kind === 'dresser') {
    useWardrobeStore.getState().openWardrobe(c.id as CharacterId);
    return;
  }
  if (c.kind === 'zone') {
    const zs = useZoneStore.getState();
    const it = zs.interactables[c.id];
    if (it?.kind === 'adopt') {
      // Woof Gang: the pup becomes YOURS (follows you, rides along, pettable);
      // peers learn via PlayerStateMsg.pet.
      const pupId = c.id.replace(/^pup-/, '');
      if (usePetStore.getState().adopt(by, pupId)) { petChime(); void sendChat('🐶'); }
      return;
    }
    if (it?.kind === 'shop') {
      // The Plaza boutique: same dress-up UI as the bedroom dresser, opened for
      // whoever is shopping (free — "buying" is pretend).
      useWardrobeStore.getState().openWardrobe(by, 'boutique');
      return;
    }
    zs.fireInteract(c.id, by);
    if (it?.kind === 'pet') void broadcastPet(c.id, by); // hearts on every screen
    if (it?.kind === 'icecream') {
      // The treat is a shared moment: jingle + a 🍦 bubble over your head
      // on every screen (rides the chat channel like the emotes).
      icecreamJingle();
      void sendChat('🍦');
    }
  }
}

const SPEED = 5.5;
const RUN_SPEED = 10.0;
// Siren Head Night locomotion. Walk is a touch slower than Siren's chase (4.7)
// so plain walking can't outrun him — you sprint in bursts (stamina-limited,
// noisy) and hide. Crouch is slow + quiet.
const NIGHT_WALK_SPEED = 4.2;
const NIGHT_SPRINT_SPEED = 8.8;   // clearly faster than Siren's chase (7.2) so a sprint-burst escapes
const NIGHT_CROUCH_SPEED = 2.4;
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
  const trampCharge = useRef(0); // builds while jumping on the trampoline → higher bounces

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
  const jumpPressedRef = useRef(false); // edge-triggered Space, for bike hop/flip
  const touchWasActive = useRef(false); // tracks joystick engagement for clean release
  const rHoldStart = useRef(0); // performance.now() when R went down in Free Play (0 = not held)
  const heroBox = useMemo(() => computeHeroBox(), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't react to typing in the chat input or while the dress-up overlay
      // owns the screen (else stale shoot/interact edges fire on close).
      if (useChatStore.getState().inputOpen) return;
      if (useWardrobeStore.getState().open) return;
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      // Space shoots a held ball OR hops/flips on a bike (edge-triggered: one press = one action).
      if ((k === ' ' || k === 'space') && !e.repeat) { shootRef.current = true; jumpPressedRef.current = true; }
      // 1-4 fire one-tap emotes (👋 ❤️ 😂 🤩) — pops a speech bubble over
      // your head on every screen. (Character swap stays disabled in MP.)
      if (!e.repeat && (k === '1' || k === '2' || k === '3' || k === '4')) {
        if (!useGameStore.getState().welcomeOpen) sendEmote(Number(k) - 1);
      }
      if (k === 'r') {
        // Ignore while the menu is open (the controller is gated but this
        // branch mutates positions directly) and while driving — teleporting
        // a mounted rider leaves the vehicle snapped under them mid-street.
        if (useGameStore.getState().welcomeOpen) return;
        if (usePlayStore.getState().riding[activeId]) return;
        // reset to spawn (mode-aware)
        const pos = positions[activeId];
        const modeForReset = useGameStore.getState().gameMode;
        if (modeForReset === 'freeplay') {
          // Free Play: R is a HOLD (≈1 s, see useFrame) that walks you home to
          // the 10600 front yard. A tap used to hard-teleport to (0,0,-90) —
          // mid-street, 100 m from the house — which the kids experienced as
          // "I got shot down to the end of the street" (R sits next to E).
          if (!e.repeat && !rHoldStart.current) rHoldStart.current = performance.now();
          return;
        }
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
      // Siren Head Night: F toggles the flashlight (reveals you AND the way).
      if (k === 'f' && !e.repeat && useGameStore.getState().gameMode === 'night') {
        useNightStore.getState().toggleFlashlight();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current[k] = false;
      if (k === 'r') rHoldStart.current = 0;
    };
    // Mouse click also shoots a held ball (only acted on when holding).
    const onMouseDown = () => {
      if (useWardrobeStore.getState().open) return; // overlay clicks must not arm a shot
      shootRef.current = true;
    };
    // Dad alt-tabs to Zoom constantly while screen-sharing: a key held at that
    // moment never gets its keyup, so the character sprints off on its own.
    // Clear ALL input state whenever the window loses focus or the tab hides.
    const clearAllInput = () => {
      keys.current = {};
      shootRef.current = false;
      jumpPressedRef.current = false;
      interactPressedRef.current = false;
      rHoldStart.current = 0;
      touchInput.active = false;
      touchInput.moveX = 0;
      touchInput.moveY = 0;
      touchInput.jumpQueued = false;
      touchInput.actionQueued = false;
    };
    const onVisibility = () => {
      if (document.hidden) clearAllInput();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('blur', clearAllInput);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('blur', clearAllInput);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeId, positions]);

  useFrame((_, dtRaw) => {
    if (welcomeOpen) return;
    // Spectators don't move anything.
    if (spectator) return;
    // Still on the character picker (or bounced off a duplicate claim): don't
    // puppet the fallback Dad around while the kid is choosing.
    if (!myCharacterId && isInRoom()) return;
    // While chat is open, the textbox owns the keyboard.
    if (useChatStore.getState().inputOpen) return;
    // The dress-up overlay owns input while open.
    if (useWardrobeStore.getState().open) return;

    // Fold on-screen touch controls into the SAME signals the keyboard drives,
    // so every movement path below (walk / munchies / treehouse / bike) works on
    // touch with no extra plumbing. Writes only while engaged, then clears once
    // on release so it never clobbers keyboard play on hybrid devices. Must run
    // before jumpedThisFrame is captured so the jump edge lands this frame.
    {
      const ti = touchInput;
      if (ti.active) {
        keys.current['w'] = ti.moveY < -TOUCH_DIR_THRESHOLD;
        keys.current['s'] = ti.moveY > TOUCH_DIR_THRESHOLD;
        keys.current['a'] = ti.moveX < -TOUCH_DIR_THRESHOLD;
        keys.current['d'] = ti.moveX > TOUCH_DIR_THRESHOLD;
        keys.current['shift'] = Math.hypot(ti.moveX, ti.moveY) > TOUCH_RUN_THRESHOLD;
        touchWasActive.current = true;
      } else if (touchWasActive.current) {
        keys.current['w'] = keys.current['s'] = keys.current['a'] = keys.current['d'] = false;
        keys.current['shift'] = false;
        touchWasActive.current = false;
      }
      if (ti.jumpQueued) { ti.jumpQueued = false; jumpPressedRef.current = true; shootRef.current = true; }
      if (ti.actionQueued) { ti.actionQueued = false; interactPressedRef.current = true; }
    }

    // Consume the one-frame Space edge (bike hop/flip). Captured once so it can't
    // leak across mode branches or fire twice.
    const jumpedThisFrame = jumpPressedRef.current;
    jumpPressedRef.current = false;

    const modeNow = useGameStore.getState().gameMode;

    // ---- Interactables, pass 1: house + zone spots (freeplay / treehouse) ----
    // Dressers (open wardrobe) and zone spots (pet Sparky, pet a duck, ice
    // cream…) are collected as CANDIDATES. In Free Play the single best one is
    // picked further down TOGETHER with doors/vehicles/balls by distance AND
    // facing (interactSelect.ts) — so Sparky heeling at your feet can no longer
    // steal "open door". Treehouse keeps its own interact chain, so it picks here.
    const earlyCands: InteractCandidate[] = [];
    if (modeNow === 'freeplay' || modeNow === 'treehouse') {
      const p = positions[activeId];
      const ws = useWardrobeStore.getState();
      const zs = useZoneStore.getState();
      if (!usePlayStore.getState().riding[activeId]) {
        for (const dr of ws.dressers) {
          if (Math.abs(p.y - dr.y) > 1.6) continue; // must be on the same floor
          earlyCands.push({ kind: 'dresser', id: dr.owner, x: dr.x, z: dr.z, radius: 1.9 });
        }
        for (const it of Object.values(zs.interactables)) {
          earlyCands.push({ kind: 'zone', id: it.id, x: it.x, z: it.z, radius: it.radius });
        }
      }
      if (modeNow === 'treehouse') {
        const { fx, fz } = facingFromYaw(yaws[activeId]);
        const best = selectInteractable(p.x, p.z, fx, fz, earlyCands);
        ws.setHoverDresser(best?.kind === 'dresser' ? (best.id as CharacterId) : null);
        zs.setHover(best?.kind === 'zone' ? best.id : null);
        if (best && interactPressedRef.current) {
          interactPressedRef.current = false;
          fireHouseOrZoneInteract(best, activeId);
          return;
        }
      }
    } else {
      if (useWardrobeStore.getState().hoverDresser) useWardrobeStore.getState().setHoverDresser(null);
      if (useZoneStore.getState().hoverId) useZoneStore.getState().setHover(null);
    }

    // Free Play: HOLD R (~1 s) to walk home to the 10600 front yard. Never
    // while driving (the vehicle would snap under you mid-street).
    if (modeNow === 'freeplay' && rHoldStart.current) {
      if (!keys.current['r']) {
        rHoldStart.current = 0;
      } else if (performance.now() - rHoldStart.current > R_HOLD_MS) {
        rHoldStart.current = 0;
        if (!usePlayStore.getState().riding[activeId]) {
          const home = FREEPLAY_HOME[activeId];
          positions[activeId].set(home[0], 0, home[1]);
          yVel.current = 0;
        }
      }
    }

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
        rideBikeTick(myRiding, pos, yaws, activeId, k, dt, staticColliders, doors, jumpedThisFrame);
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

    // ---- Siren Head Night: sprint stamina, crouch, and down-lock ----
    let nightDown = false;
    let nightSpeedOverride: number | null = null;
    if (modeNow === 'night') {
      const ns = useNightStore.getState();
      nightDown = ns.playerNightStates[activeId] === 'down';
      if (nightDown) {
        // Swatted — the SwatController owns your position (the comedic launch)
        // until a teammate (or the auto-timer) helps you up. Don't move, jump,
        // or apply gravity; just let stamina recover.
        ns.setCrouching(false);
        ns.setLocalRunning(false);
        ns.setStamina(Math.min(1, ns.stamina + dt / 5.0));
        return;
      }
      const crouch = !!k['c'] || !!k['control'];
      ns.setCrouching(crouch);
      const moving = dx !== 0 || dz !== 0;
      const wantSprint = !!k['shift'] && !crouch;
      const sprinting = wantSprint && ns.stamina > 0 && moving;
      const stam = sprinting
        ? Math.max(0, ns.stamina - dt / 3.6)   // ~3.6s of sprint
        : Math.min(1, ns.stamina + dt / 4.0);  // ~4s to refill
      ns.setStamina(stam);
      ns.setLocalRunning(sprinting);
      nightSpeedOverride = crouch ? NIGHT_CROUCH_SPEED : sprinting ? NIGHT_SPRINT_SPEED : NIGHT_WALK_SPEED;
    }

    const pos = positions[activeId];

    // ---- Riding a bike? Bike movement replaces walking (non-combat only) ----
    const myRiding = usePlayStore.getState().riding[activeId];
    if (myRiding?.passengerOf) {
      // Passenger: I go where the driver's vehicle goes (no sim of my own).
      passengerTick(myRiding, pos, yaws, activeId, staticColliders);
    } else if (myRiding) {
      rideBikeTick(myRiding, pos, yaws, activeId, k, dt, staticColliders, doors, jumpedThisFrame);
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
        const speed = nightSpeedOverride ?? (isRunning ? RUN_SPEED : SPEED);

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
      const resolved = resolveMotion(pos.x, pos.z, desiredX, desiredZ, allColliders, pos.y);
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
      // jumpedThisFrame folds in the touch Jump button (edge-triggered): one tap
      // = one jump/bounce, alongside held Space on keyboard.
      const jumpHeld = (k[' '] || k['space'] || jumpedThisFrame) && !usePlayStore.getState().heldBall && !nightDown;
      const tramp = usePlayStore.getState().trampoline;
      const onTramp = !!tramp && Math.abs(pos.x - tramp.x) < tramp.half && Math.abs(pos.z - tramp.z) < tramp.half;

      if (onTramp && tramp) {
        // Trampoline: press jump to bounce higher and higher; auto-springs otherwise.
        const grounded = pos.y - tramp.padY < 0.12;
        if (jumpHeld && grounded) {
          trampCharge.current = Math.min(1, trampCharge.current + 0.34);
          yVel.current = JUMP_VELOCITY * (1.5 + trampCharge.current * 1.1);
          trampolineBoing(trampCharge.current);
        }
        yVel.current -= GRAVITY * dt;
        pos.y += yVel.current * dt;
        if (pos.y < tramp.padY) {
          const impact = -yVel.current;
          pos.y = tramp.padY;
          if (impact > 2.5 && !jumpHeld) {
            yVel.current = impact * 0.68; // bouncy auto-spring (decays without input)
            trampolineBoing(trampCharge.current);
          } else {
            yVel.current = 0;
            trampCharge.current = Math.max(0, trampCharge.current - 0.25);
          }
        }
      } else {
        trampCharge.current = 0;
        // Normal jump (only when on the floor under us).
        if (jumpHeld && pos.y - standingFloorY < 0.05) {
          yVel.current = JUMP_VELOCITY;
          hopSound();
        }
        yVel.current -= GRAVITY * dt;
        pos.y += yVel.current * dt;
        if (pos.y < standingFloorY) {
          pos.y = standingFloorY;
          yVel.current = 0;
        }
      }
    }

    // ---- Interactables, pass 2: doors + free-roam play (balls/bikes/cars) ----
    // All candidates (incl. pass-1 dressers/zone spots in Free Play) go through
    // ONE picker scored by distance + facing; exactly one hover/prompt results.
    const phaseNow = useGameStore.getState().phase;
    const playActive =
      modeNow === 'freeplay' ||
      (modeNow === 'aliens' &&
        (phaseNow === 'free-play' || phaseNow === 'pre-intro' || phaseNow === 'victory'));
    const play = usePlayStore.getState();
    const ridingNow = play.riding[activeId];
    const holdingBall = !!(play.heldBall && play.heldBall.by === activeId);

    const cands = earlyCands;
    if (!ridingNow && !holdingBall) {
      if (playActive) {
        for (const [bid, bp] of Object.entries(ballPositions)) {
          cands.push({ kind: 'ball', id: bid, x: bp.x, z: bp.z, radius: 1.5 });
        }
        for (const b of Object.values(play.bikes)) {
          cands.push({ kind: 'bike', id: b.id, x: b.x, z: b.z, radius: 2.0 });
        }
        for (const c of Object.values(play.cars)) {
          // Skip cars someone is already driving (a second kid could "drive" the
          // same truck from its empty driveway spot → two trucks) — those offer
          // SEATS instead (below).
          if (isCarDriven(play.riding, c.id)) continue;
          cands.push({ kind: 'car', id: c.id, x: c.x, z: c.z, radius: 3.4 }); // cars are big — generous reach
        }
        // Free seats in vehicles other family members are driving: "ride along" /
        // "hop in the back". One candidate per seat so standing by the tailgate
        // offers the bed and standing by the door offers the cab.
        for (const drvId of CHARACTER_ORDER) {
          if (drvId === activeId) continue;
          const dr = play.riding[drvId];
          if (!dr || dr.vehicle !== 'car' || dr.passengerOf) continue;
          const seats = SEATS[dr.carKind ?? 'sedan'];
          const dp = positions[drvId];
          for (let i = 0; i < seats.length; i++) {
            if (isSeatTaken(play.riding, drvId, i)) continue;
            const w = seatWorld(dp.x, 0, dp.z, dr.heading, seats[i]);
            cands.push({ kind: 'seat', id: seatCandidateId(drvId, i), x: w.x, z: w.z, radius: 2.8 });
          }
        }
      }
      for (const [id, door] of Object.entries(doors)) {
        cands.push({ kind: 'door', id, x: door.centerX, z: door.centerZ, radius: INTERACT_RADIUS });
      }
    }
    const facing = facingFromYaw(yaws[activeId]);
    const best = ridingNow || holdingBall ? null : selectInteractable(pos.x, pos.z, facing.fx, facing.fz, cands);

    // Publish exactly ONE hover so InteractPrompt shows a single label.
    setHoverDoor(best?.kind === 'door' ? best.id : null);
    useWardrobeStore.getState().setHoverDresser(best?.kind === 'dresser' ? (best.id as CharacterId) : null);
    useZoneStore.getState().setHover(best?.kind === 'zone' ? best.id : null);
    if (playActive) {
      if (ridingNow) play.setHover('getoff', ridingNow.bikeId, null);
      else if (holdingBall) play.setHover('shoot', null, play.heldBall!.ballId);
      else if (best?.kind === 'ball') play.setHover('pickup', null, best.id);
      else if (best?.kind === 'bike') play.setHover('ride', best.id, null);
      else if (best?.kind === 'car') play.setHover('drive', null, null, best.id);
      else if (best?.kind === 'seat') play.setHover('hopin', null, null);
      else play.setHover(null, null, null);
      if (best?.kind === 'seat') {
        const ps = parseSeatCandidateId(best.id);
        const dr = ps ? play.riding[ps.driver] : null;
        const seat = ps && dr ? SEATS[dr.carKind ?? 'sedan'][ps.seat] : null;
        play.setHoverSeat(ps && seat ? { driver: ps.driver, seat: ps.seat, label: seat.label } : null);
      } else if (play.hoverSeat) {
        play.setHoverSeat(null);
      }
    } else {
      // Left free-roam (combat started / mode changed): cancel local play.
      if (play.hoverPlay) play.setHover(null, null, null);
      if (play.riding[activeId]) play.dismount(activeId);
      if (play.heldBall && play.heldBall.by === activeId) play.dropBall();
    }

    if (interactPressedRef.current) {
      interactPressedRef.current = false;
      const ph = usePlayStore.getState();
      const cur = ph.riding[activeId];
      if (playActive && ph.heldBall && ph.heldBall.by === activeId) {
        ph.dropBall();
      } else if (playActive && cur) {
        // Leave a car parked exactly where it was (centered on the driver) before
        // the rider steps out, so it doesn't snap back to its driveway — and
        // tell everyone else where it is now. Passengers just hop out.
        if (cur.vehicle === 'car' && !cur.passengerOf) {
          ph.parkCar(cur.bikeId, pos.x, pos.z, cur.heading);
          void broadcastPark([{ id: cur.bikeId, x: pos.x, z: pos.z, yaw: cur.heading }]);
        }
        dismountBike(activeId, pos, staticColliders);
      } else if (best) {
        switch (best.kind) {
          case 'seat': {
            const ps = parseSeatCandidateId(best.id);
            if (playActive && ps) mountAsPassenger(activeId, ps.driver, ps.seat);
            break;
          }
          case 'dresser':
          case 'zone':
            fireHouseOrZoneInteract(best, activeId);
            break;
          case 'ball':
            if (playActive) ph.pickUpBall(best.id, activeId);
            break;
          case 'bike':
            if (playActive) mountBike(activeId, best.id, ph.bikes[best.id]?.color ?? '#3a6db0', yaws[activeId]);
            break;
          case 'car':
            if (playActive) mountCar(activeId, best.id, yaws[activeId]);
            break;
          case 'door': {
            // Doors are shared world state: everyone sees the same door.
            const willOpen = !doors[best.id]?.open;
            toggleDoor(best.id);
            void broadcastDoor({ id: best.id, open: willOpen, t: Date.now() });
            break;
          }
        }
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
// Air + tricks.
const BIKE_HOP_V = 4.6;            // bunny-hop launch (m/s)
const BIKE_AIR_GRAVITY = 20;       // gentler than on-foot so air hangs a beat
const RAMP_MIN_SPEED = 4;          // need this much speed to launch off the ramp
const RAMP_LAUNCH_BASE = 4.0;      // base upward launch
const RAMP_LAUNCH_PER_SPEED = 0.62;// + this per m/s of approach speed
const FLIP_RATE = 9.0;             // rad/s rotation while flipping
const FLIP_LAND_TOL = 0.95;        // rad of slop allowed from a full turn to stick it
const WIPEOUT_MS = 1100;           // tumble duration before you hop back up
// Cars: faster top speed, gentler accel, wider turns; ramp jumps OK, no flips.
const CAR_MAX_SPEED = 20;
const CAR_REVERSE_SPEED = 5;
const CAR_ACCEL = 11;
const CAR_BRAKE = 26;
const CAR_FRICTION = 5;
const CAR_TURN = 1.7;
const CAR_RAMP_MAX_VY = 12;        // cap the car's ramp launch so it's a big hop, not a moon-jump
const UNSTICK_TURN = 1.2;          // rad/s auto-steer when wedged head-on (bike + car) so you never get stuck

// --- Drivable region = the whole neighborhood: the bulb (cul-de-sac), the full
// stick PLUS the greenbelt behind the houses, AND Avery Ranch Blvd at the entry.
// A single radial clamp can't describe this shape, so we union three regions and
// clamp to the nearest edge when outside all of them. Houses, fences, props, and
// trees stay hard colliders — this is only the outer "don't sail into the void"
// backstop, sized so you can roam everywhere there's actually something to see.
const RIDE_BULB_R = 50;                       // bulb + ring houses + the greenbelt behind them
const RIDE_STICK_HALF_X = 48;                 // road + yards + house backs + greenbelt either side
const RIDE_BLVD_Z = STRAIGHT_END_Z - 4;       // Avery Ranch Blvd centerline (~-183.5)
const RIDE_BLVD_HALF_X = 74;                  // half the 140 m blvd + a little margin
const RIDE_BLVD_HALF_Z = 9;                   // blvd lanes + sidewalks + margin

/** If (x,z) is outside the drivable area, return the nearest valid point; else null. */
function clampToStreet(x: number, z: number): { x: number; z: number } | null {
  const inStick = Math.abs(x) <= RIDE_STICK_HALF_X && z <= STRAIGHT_START_Z && z >= STRAIGHT_END_Z;
  const inBulb = x * x + z * z <= RIDE_BULB_R * RIDE_BULB_R;
  const inBlvd = Math.abs(x) <= RIDE_BLVD_HALF_X && Math.abs(z - RIDE_BLVD_Z) <= RIDE_BLVD_HALF_Z;
  // Across-the-boulevard park zone (pond / shops / playground).
  const inZone = Math.abs(x) <= ZONE_HALF_X && z <= ZONE_MAX_Z && z >= ZONE_MIN_Z;
  if (inStick || inBulb || inBlvd || inZone) return null;
  // Outside all regions: clamp to whichever region edge is nearest.
  const sx = Math.max(-RIDE_STICK_HALF_X, Math.min(RIDE_STICK_HALF_X, x));
  const sz = Math.max(STRAIGHT_END_Z, Math.min(STRAIGHT_START_Z, z));
  const dStick = (x - sx) ** 2 + (z - sz) ** 2;
  const vx = Math.max(-RIDE_BLVD_HALF_X, Math.min(RIDE_BLVD_HALF_X, x));
  const vz = Math.max(RIDE_BLVD_Z - RIDE_BLVD_HALF_Z, Math.min(RIDE_BLVD_Z + RIDE_BLVD_HALF_Z, z));
  const dBlvd = (x - vx) ** 2 + (z - vz) ** 2;
  const dd = Math.hypot(x, z) || 1;
  const bx = (x / dd) * RIDE_BULB_R;
  const bz = (z / dd) * RIDE_BULB_R;
  const dBulb = (x - bx) ** 2 + (z - bz) ** 2;
  const zx = Math.max(-ZONE_HALF_X, Math.min(ZONE_HALF_X, x));
  const zz = Math.max(ZONE_MIN_Z, Math.min(ZONE_MAX_Z, z));
  const dZone = (x - zx) ** 2 + (z - zz) ** 2;
  const best = Math.min(dStick, dBlvd, dBulb, dZone);
  if (best === dStick) return { x: sx, z: sz };
  if (best === dBlvd) return { x: vx, z: vz };
  if (best === dZone) return { x: zx, z: zz };
  return { x: bx, z: bz };
}

type Colliders = import('../types').RectCollider[];
type Doors = Record<string, { open: boolean; centerX: number; centerZ: number; aabbWhenClosed: import('../types').RectCollider }>;

function freshRiding(bikeId: string, color: string, heading: number): import('../state/playStore').RidingState {
  return { bikeId, bikeColor: color, heading, speed: 0, y: 0, vy: 0, airborne: false, flip: null, wipeoutUntil: 0 };
}

function mountBike(id: import('../types').CharacterId, bikeId: string, color: string, currentYaw: number) {
  usePlayStore.getState().mount(id, freshRiding(bikeId, color, currentYaw));
}

function mountCar(id: import('../types').CharacterId, carId: string, currentYaw: number) {
  const car = usePlayStore.getState().cars[carId];
  if (!car) return;
  usePlayStore.getState().mount(id, {
    bikeId: carId, bikeColor: car.color, vehicle: 'car', carKind: car.kind,
    heading: currentYaw, speed: 0, y: 0, vy: 0, airborne: false, flip: null, wipeoutUntil: 0,
  });
}

function isSeatTaken(riding: Record<CharacterId, RidingState | null>, driver: CharacterId, seat: number): boolean {
  for (const r of Object.values(riding)) if (r && r.passengerOf === driver && r.seat === seat) return true;
  return false;
}

/** Hop into a free seat of a vehicle another family member is driving. */
function mountAsPassenger(id: CharacterId, driver: CharacterId, seat: number) {
  const play = usePlayStore.getState();
  const dr = play.riding[driver];
  if (!dr || dr.vehicle !== 'car' || dr.passengerOf) return;
  if (!SEATS[dr.carKind ?? 'sedan'][seat]) return;
  if (isSeatTaken(play.riding, driver, seat)) return;
  play.mount(id, {
    bikeId: dr.bikeId, bikeColor: dr.bikeColor, vehicle: 'car', carKind: dr.carKind,
    heading: dr.heading, speed: dr.speed, y: 0, vy: 0, airborne: false, flip: null, wipeoutUntil: 0,
    passengerOf: driver, seat,
  });
}

/** Passenger frame: sit where the driver's vehicle is; hop out if the ride ended. */
function passengerTick(
  riding: RidingState,
  pos: Vector3,
  yaws: Record<string, number>,
  activeId: CharacterId,
  colliders: Colliders,
) {
  const play = usePlayStore.getState();
  const driver = riding.passengerOf as CharacterId;
  const dr = play.riding[driver];
  const net = useNetStore.getState();
  // Driver still present? (a remote driver who vanished leaves a stale riding
  // entry — don't stay glued to a phantom truck).
  const driverPresent = driver === net.myCharacterId || !!net.remotePlayers[driver] || !isInRoom();
  if (!dr || dr.vehicle !== 'car' || dr.bikeId !== riding.bikeId || dr.passengerOf || !driverPresent) {
    dismountBike(activeId, pos, colliders);
    return;
  }
  const seat = SEATS[dr.carKind ?? 'sedan'][riding.seat ?? 0] ?? SEATS[dr.carKind ?? 'sedan'][0];
  const dp = useGameStore.getState().positions[driver];
  const w = seatWorld(dp.x, dr.y, dp.z, dr.heading, seat);
  pos.set(w.x, w.y, w.z);
  // Mirror the driver's motion so the chase cam + the riding pose behave.
  riding.heading = dr.heading;
  riding.speed = dr.speed;
  riding.y = dr.y;
  riding.airborne = dr.airborne;
  yaws[activeId] = dr.heading;
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
  jumpPressed: boolean,
) {
  const now = performance.now();
  const play = usePlayStore.getState();
  const wipingOut = riding.wipeoutUntil > now;
  const grounded = !riding.airborne;
  const isCar = riding.vehicle === 'car';
  // The golf cart putters: real-cart top speed, tighter turning for pond laps.
  const isGolfCart = isCar && riding.carKind === 'golfcart';
  const MAXSP = isGolfCart ? 12 : isCar ? CAR_MAX_SPEED : BIKE_MAX_SPEED;
  const REVSP = isCar ? CAR_REVERSE_SPEED : BIKE_REVERSE_SPEED;
  const ACCEL = isCar ? CAR_ACCEL : BIKE_ACCEL;
  const BRAKE = isCar ? CAR_BRAKE : BIKE_BRAKE;
  const FRICTION = isCar ? CAR_FRICTION : BIKE_FRICTION;
  const TURN = isCar ? CAR_TURN : BIKE_TURN;
  const fwd = !wipingOut && (keys['w'] || keys['arrowup']);
  const back = !wipingOut && (keys['s'] || keys['arrowdown']);

  // --- Horizontal drive (only steer/throttle on the ground; keep air momentum) ---
  let speed = riding.speed;
  if (grounded) {
    if (wipingOut) {
      const f = FRICTION * 2.4 * dt; // bleed to a stop during a tumble
      speed = speed > 0 ? Math.max(0, speed - f) : Math.min(0, speed + f);
    } else if (fwd) speed += ACCEL * dt;
    else if (back) speed -= BRAKE * dt;
    else {
      const f = FRICTION * dt;
      speed = speed > 0 ? Math.max(0, speed - f) : Math.min(0, speed + f);
    }
    speed = Math.max(-REVSP, Math.min(MAXSP, speed));
    // Steer only while moving; turn rate scales with speed; reverse flips it.
    const steer = (keys['a'] || keys['arrowleft'] ? 1 : 0) - (keys['d'] || keys['arrowright'] ? 1 : 0);
    const speedFactor = Math.min(1, Math.abs(speed) / 3);
    const dir = speed >= 0 ? 1 : -1;
    if (!wipingOut) riding.heading += steer * TURN * speedFactor * dir * dt;
  }
  riding.speed = speed;

  const fx = -Math.sin(riding.heading);
  const fz = -Math.cos(riding.heading);
  const desiredX = pos.x + fx * speed * dt;
  const desiredZ = pos.z + fz * speed * dt;

  // Ramp launch detection (bikes + cars): rolling UP the deck with enough speed
  // throws you airborne. Decided BEFORE collision so the launch arc — and any
  // airborne vehicle — flies cleanly OVER the ramp walls, while a grounded
  // approach from the back/side instead hits them as a solid wall that the
  // auto-unstick steers around (so you never pin on the ramp's back).
  const ramp = play.ramp;
  let launching = false;
  let rampVy = 0;
  if (grounded && !wipingOut && ramp) {
    const rfx = -Math.sin(ramp.heading);
    const rfz = -Math.cos(ramp.heading);
    const along = (pos.x - ramp.x) * rfx + (pos.z - ramp.z) * rfz;
    const across = (pos.x - ramp.x) * Math.cos(ramp.heading) - (pos.z - ramp.z) * Math.sin(ramp.heading);
    const movingUp = fx * rfx + fz * rfz; // heading vs ramp-up direction
    if (Math.abs(along) <= ramp.halfLen && Math.abs(across) <= ramp.halfWid && Math.abs(speed) >= RAMP_MIN_SPEED && movingUp > 0.4) {
      launching = true;
      const launch = RAMP_LAUNCH_BASE + Math.abs(speed) * RAMP_LAUNCH_PER_SPEED;
      rampVy = isCar ? Math.min(CAR_RAMP_MAX_VY, launch) : launch; // cars get a big but capped hop
    }
  }
  // Ramp walls block only a grounded, non-launching vehicle (you can't bulldoze
  // through the deck); a launch or an airborne fly-over ignores them.
  const skipRamp = launching || riding.airborne;
  const all = colliders.filter((c) => (c.tag && c.tag.startsWith('ramp') ? !skipRamp : true));
  for (const door of Object.values(doors)) { if (!door.open) all.push(door.aabbWhenClosed); }
  const resolved = resolveMotion(pos.x, pos.z, desiredX, desiredZ, all, pos.y);
  // Proportional speed loss: only a real head-on block (made <55% of the step)
  // bleeds momentum, scaled by how blocked it was. Grazes don't kill the ride.
  if (grounded && speed !== 0) {
    const want = Math.hypot(desiredX - pos.x, desiredZ - pos.z);
    const got = Math.hypot(resolved.x - pos.x, resolved.z - pos.z);
    if (want > 1e-4 && got / want < 0.55) riding.speed = speed * Math.max(0.25, got / want);
    // Kid-friendly auto-unstick: when a move is meaningfully blocked, steer the
    // heading toward the direction you can ACTUALLY slide (the resolved motion),
    // so the bike/car peels off along the wall, builds speed, and drives free —
    // instead of pinning head-on. Steering toward the real opening (not a fixed
    // bias) keeps turning until you're genuinely cruising, avoiding the wedge
    // equilibrium where a fixed nudge stalls right at the threshold. No min-speed
    // guard: it must keep working after a block has bled speed to a crawl, which
    // is exactly when you're stuck. Throttle must be engaged (speed !== 0 above).
    if (want > 1e-4 && got / want < 0.6) {
      const sx = resolved.x - pos.x;
      const sz = resolved.z - pos.z;
      let targetH: number;
      if (Math.hypot(sx, sz) > 0.02) {
        targetH = Math.atan2(-sx, -sz); // face the open slide direction
      } else {
        // Fully wedged (e.g. into a corner): bias toward the open street center.
        targetH = riding.heading + (pos.x >= 0 ? -1 : 1);
      }
      let diff = targetH - riding.heading;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      const step = UNSTICK_TURN * dt;
      riding.heading += Math.max(-step, Math.min(step, diff));
    }
  }
  pos.x = resolved.x;
  pos.z = resolved.z;

  // --- Vertical: bunny-hop / ramp launch / flip / gravity / landing.
  //     Bunny-hop + flips are bike-only; cars launch off the ramp too (just no
  //     flips — a flipping truck would look broken). ---
  if (!isCar && jumpPressed && !wipingOut) {
    if (grounded) { riding.vy = BIKE_HOP_V; riding.airborne = true; }
    else if (!riding.flip) { riding.flip = { dir: back ? -1 : 1, angle: 0 }; } // 2nd tap = flip (S = back)
  }

  // Apply the ramp launch decided before collision (cars get a capped hop; never a flip).
  if (launching) {
    riding.vy = rampVy;
    riding.airborne = true;
    riding.speed = speed * 1.04; // tiny forward boost off the lip
  }

  if (riding.airborne) {
    riding.vy -= BIKE_AIR_GRAVITY * dt;
    riding.y += riding.vy * dt;
    if (riding.flip) {
      // Snap the spin to land on a whole number of turns: predict time-to-ground
      // and steer the rate so a committed flip completes cleanly. Too little air
      // to finish even one turn → it under-rotates and you wipe out.
      const g = BIKE_AIR_GRAVITY;
      const disc = riding.vy * riding.vy + 2 * g * Math.max(0, riding.y);
      const tLand = disc > 0 ? (riding.vy + Math.sqrt(disc)) / g : 0;
      const dir = riding.flip.dir;
      const ang = riding.flip.angle;
      if (tLand > 0.06) {
        const reach = Math.abs(ang) + FLIP_RATE * tLand;
        const targetTurns = Math.max(1, Math.floor(reach / (2 * Math.PI)));
        const targetAngle = dir * targetTurns * 2 * Math.PI;
        let rate = (targetAngle - ang) / tLand;
        rate = dir > 0 ? Math.max(0, Math.min(rate, FLIP_RATE * 1.8)) : Math.min(0, Math.max(rate, -FLIP_RATE * 1.8));
        riding.flip.angle += rate * dt;
      } else {
        riding.flip.angle += FLIP_RATE * dir * dt;
      }
    }
    if (riding.y <= 0) {
      // Landed. Fire a one-shot impact (dust puff + camera shake + squash) scaled
      // by how hard the touchdown was — a real jump thumps, a tiny hop doesn't.
      const impact = -riding.vy; // downward speed at touchdown (m/s)
      if (impact > 3.5) play.triggerLandingFx(pos.x, pos.z, Math.min(1, impact / 14));
      riding.y = 0;
      riding.vy = 0;
      riding.airborne = false;
      if (riding.flip) {
        const turns = Math.round(riding.flip.angle / (2 * Math.PI));
        const err = Math.abs(riding.flip.angle - turns * 2 * Math.PI);
        const dirName = riding.flip.dir > 0 ? 'Front Flip' : 'Back Flip';
        const n = Math.abs(turns);
        riding.flip = null;
        if (n >= 1 && err <= FLIP_LAND_TOL) {
          play.setTrick(n >= 2 ? `${n}× ${dirName}!` : `${dirName}!`, true);
        } else if (n >= 1) {
          // Under/over-rotated: wipe out.
          riding.wipeoutUntil = now + WIPEOUT_MS;
          riding.speed = 0;
          play.setTrick('Wipeout! 💥', false);
        }
        // (a bare hop with no started flip just lands clean — no popup)
      }
    }
  } else {
    riding.y = 0;
  }
  pos.y = riding.y; // the rider rises with the bike (Character copies pos.y)
  yaws[activeId] = riding.heading;

  // Soft street boundary: keep vehicles on the lollipop (bulb + full stick) so
  // you can traverse the whole map but never sail off into the void.
  const clamped = clampToStreet(pos.x, pos.z);
  if (clamped) {
    pos.x = clamped.x;
    pos.z = clamped.z;
    riding.speed *= 0.6;
  }
}

// ---- Basketball shooting (you AIM it — a gentle assist, but you can miss) ----
const BALL_G = 18;
const AIM_COS = 0.84;    // hoop must be within ~±32° of facing for any assist
const AIM_RANGE = 12;    // ...and within this many metres
const AIM_BLEND = 0.6;   // how far the shot is nudged toward the rim (never 100%)
const AIM_DEFAULT_DIST = 6;

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

  // Aim-assist ONLY for a hoop you're actually facing and near. Otherwise the
  // ball just flies where you pointed (and clanks).
  let assist: import('../state/playStore').HoopReg | null = null;
  let bestScore = Infinity;
  for (const h of Object.values(play.hoops)) {
    const dx = h.x - x0;
    const dz = h.z - z0;
    const dist = Math.hypot(dx, dz) || 0.001;
    const fwdDot = (dx / dist) * fx + (dz / dist) * fz; // 1 = directly ahead
    if (fwdDot >= AIM_COS && dist <= AIM_RANGE) {
      const score = dist + (1 - fwdDot) * 4;
      if (score < bestScore) { bestScore = score; assist = h; }
    }
  }

  let aimX: number, aimZ: number, ty: number, T: number;
  if (assist) {
    const dist = Math.hypot(assist.x - x0, assist.z - z0);
    T = Math.max(0.65, Math.min(1.4, dist / 7));
    // Blend between "straight ahead at this distance" and the rim — so facing
    // squarely at it makes it, facing off-angle pulls the shot wide.
    const straightX = x0 + fx * dist;
    const straightZ = z0 + fz * dist;
    aimX = straightX + (assist.x - straightX) * AIM_BLEND;
    aimZ = straightZ + (assist.z - straightZ) * AIM_BLEND;
    ty = assist.rimY + 0.25;
  } else {
    // No lock — throw straight ahead with a believable arc.
    T = 1.0;
    aimX = x0 + fx * AIM_DEFAULT_DIST;
    aimZ = z0 + fz * AIM_DEFAULT_DIST;
    ty = 3.0;
  }

  let vx = (aimX - x0) / T;
  let vz = (aimZ - z0) / T;
  let vy = (ty - y0 + 0.5 * BALL_G * T * T) / T;
  // Real spread so makes depend on aim + distance, not a guarantee.
  vx *= 1 + (Math.random() - 0.5) * 0.08;
  vz *= 1 + (Math.random() - 0.5) * 0.08;
  vy += (Math.random() - 0.5) * 0.3;

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
  // The maze is on the ground: a kid arriving from the treehouse (y≈8) used to
  // keep "flying" over it. Stay planted.
  if (pos.y !== 0) pos.y = 0;
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
const TREEHOUSE_PLATFORM_REACH = 2.4; // past this from the trunk you've stepped off the deck
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

  // Walked off the treehouse platform edge → hop down (no more hovering at 8 m).
  if (pos.y > 0.5) {
    const oak = liveOakPosition();
    if (Math.hypot(pos.x - oak.x, pos.z - oak.z) > TREEHOUSE_PLATFORM_REACH) pos.y = 0;
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
