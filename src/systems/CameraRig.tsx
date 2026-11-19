import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useNetStore } from '../state/netStore';
import { useChatStore } from '../state/chatStore';
import { usePlayStore } from '../state/playStore';
import { useNightStore } from '../state/nightStore';
import { CHARACTERS, CHARACTER_ORDER } from '../world/characters';
import { isTouchDevice, TOUCH_LOOK_SENS } from './touchInput';
import { isIndoors } from '../world/indoors';
import { useRailStore } from '../state/railStore';
import { aimAssist } from './aimAssist';
import type { RectCollider } from '../types';

// First-person camera.
// - Camera sits at the active character's eye height (1.7m).
// - Pointer Lock for mouse-look: click the canvas to capture, ESC to release.
// - Yaw/pitch driven by raw mousemove while locked.
// - Cinematic override (intro, victory) still wins and lerps the camera.
// - Camera shake still applied to position.
// - The player's own body is hidden by Character.tsx based on `isActive`.

const SENS = 0.0022;
const EYE_HEIGHT = 1.7;
const PITCH_LIMIT = Math.PI / 2 - 0.1;
const SHAKE_AMP = 0.4; // smaller than 3rd-person since the cam is "on" the player

const _euler = new Euler();

/** Is a camera-sized point inside something solid? (Walls are checked with a
 *  little padding; low things like fences only block a low camera.) */
function boomBlocked(x: number, y: number, z: number, colliders: RectCollider[]): boolean {
  const PAD = 0.22;
  for (const c of colliders) {
    if (c.passable) continue;
    if (y < (c.minY ?? 0) - 0.1 || y > (c.maxY ?? 6) + 0.25) continue;
    if (c.yaw) {
      const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
      const cn = Math.cos(-c.yaw), sn = Math.sin(-c.yaw);
      const lx = (x - cx) * cn - (z - cz) * sn;
      const lz = (x - cx) * sn + (z - cz) * cn;
      if (Math.abs(lx) < (c.maxX - c.minX) / 2 + PAD && Math.abs(lz) < (c.maxZ - c.minZ) / 2 + PAD) return true;
    } else if (x > c.minX - PAD && x < c.maxX + PAD && z > c.minZ - PAD && z < c.maxZ + PAD) return true;
  }
  return false;
}

export function CameraRig() {
  const { camera, gl } = useThree();
  // Camera tracks myCharacterId if I claimed one; falls back to gameStore
  // activeCharacterId for legacy single-player flows.
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  const fallbackActive = useGameStore((s) => s.activeCharacterId);
  const spectator = useNetStore((s) => s.spectator);
  const activeId = myCharacterId ?? fallbackActive;
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const shake = useCombatStore((s) => s.shake);
  const decayShake = useCombatStore((s) => s.decayShake);
  const slowMo = useCombatStore((s) => s.slowMo);

  // Mouse-look state lives in refs to avoid re-renders.
  // Initial yaw=π puts us facing +Z (south, toward the cul-de-sac / spawn direction).
  const yaw = useRef(Math.PI);
  const pitch = useRef(0);
  const locked = useRef(false);
  const boomRef = useRef(3.5); // current third-person boom length (m)
  const eyeRef = useRef(EYE_HEIGHT); // smoothly lowers when crouching in night mode

  // DEV-only: drive the first-person look direction from the console / Playwright
  // for screenshot verification (the camera is otherwise mouse-only).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __cam?: unknown }).__cam = {
      set: (y: number, p = 0) => { yaw.current = y; pitch.current = p; },
      get: () => ({ yaw: yaw.current, pitch: pitch.current }),
    };
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => {
      if (locked.current) return;
      // Pointer Lock is a mouse concept — touch devices look via drag instead.
      if (isTouchDevice()) return;
      // Don't grab the cursor while the welcome screen is open or when
      // spectating (no input to capture).
      const _camMode = useGameStore.getState().gameMode;
      if (_camMode === 'munchies') return;
      if (useGameStore.getState().welcomeOpen) return;
      if (useNetStore.getState().spectator) return;
      // Chat textbox owns focus while open.
      if (useChatStore.getState().inputOpen) return;
      // requestPointerLock returns a Promise in newer browsers; older ones return void.
      const result = canvas.requestPointerLock();
      if (result instanceof Promise) result.catch(() => {});
    };

    const onLockChange = () => {
      locked.current = document.pointerLockElement === canvas;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current) return;
      yaw.current -= e.movementX * SENS;
      pitch.current -= e.movementY * SENS;
      if (pitch.current < -PITCH_LIMIT) pitch.current = -PITCH_LIMIT;
      if (pitch.current > PITCH_LIMIT) pitch.current = PITCH_LIMIT;
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    // --- Touch drag-to-look ---
    // The FPS modes (aliens / tornado / freeplay) are mouse-pointer-lock only,
    // so on touch this is the ONLY way to turn and aim. A finger dragging on
    // empty screen (anything NOT on the joystick/buttons, which capture their
    // own touches) rotates yaw/pitch. We track one look-finger by identifier so
    // it coexists with the movement thumb. munchies uses its own
    // follow cams, so we ignore look there.
    const lookTouchId = { current: null as number | null };
    let lastX = 0;
    let lastY = 0;
    const lookActiveMode = () => {
      const m = useGameStore.getState().gameMode;
      if (m === 'munchies') return false;
      if (useGameStore.getState().welcomeOpen) return false;
      if (useNetStore.getState().spectator) return false;
      if (usePlayStore.getState().riding[useNetStore.getState().myCharacterId ?? useGameStore.getState().activeCharacterId]) return false;
      return true;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (lookTouchId.current !== null || !lookActiveMode()) return;
      const t = e.changedTouches[0];
      if (!t) return;
      lookTouchId.current = t.identifier;
      lastX = t.clientX;
      lastY = t.clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (lookTouchId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== lookTouchId.current) continue;
        yaw.current -= (t.clientX - lastX) * TOUCH_LOOK_SENS;
        pitch.current -= (t.clientY - lastY) * TOUCH_LOOK_SENS;
        if (pitch.current < -PITCH_LIMIT) pitch.current = -PITCH_LIMIT;
        if (pitch.current > PITCH_LIMIT) pitch.current = PITCH_LIMIT;
        lastX = t.clientX;
        lastY = t.clientY;
        e.preventDefault();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookTouchId.current) lookTouchId.current = null;
      }
    };

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [gl]);

  useFrame((_, dtRaw) => {
    const _camMode = useGameStore.getState().gameMode;
    if (_camMode === 'munchies') return;
    const dt = Math.min(dtRaw, 0.1) * slowMo;

    // --- Spectator mode ---
    // Slow orbital camera around the cul-de-sac, looking at the center of
    // mass of any claimed peers. Lets onlookers see the action.
    if (spectator) {
      const peers = useNetStore.getState().peers;
      const claimed: string[] = [];
      for (const p of Object.values(peers)) {
        if (p.characterId) claimed.push(p.characterId);
      }
      const focusIds = claimed.length > 0 ? claimed : CHARACTER_ORDER;
      let cx = 0;
      let cz = 10;
      let n = 0;
      for (const id of focusIds) {
        const p = positions[id as keyof typeof positions];
        if (p) {
          cx += p.x;
          cz += p.z;
          n++;
        }
      }
      if (n > 0) {
        cx /= n;
        cz /= n;
      }
      const t = performance.now() * 0.0002;
      const radius = 30;
      camera.position.set(cx + Math.cos(t) * radius, 18, cz + Math.sin(t) * radius);
      camera.lookAt(cx, 1, cz);
      return;
    }

    const pos = positions[activeId];
    if (!pos) return;

    // --- Bike chase camera ---
    // When riding, pull the camera behind+above the heading (Mario-Kart feel).
    // Keep the FPS yaw ref synced to the heading so dismount hands back cleanly.
    const riding = usePlayStore.getState().riding[activeId];

    // Speed-reactive FOV: subtly widen the lens as you pick up speed (a real
    // sense of "fast"), and ease back to normal on foot. Cheap + big game-feel.
    const cam = camera as unknown as { isPerspectiveCamera?: boolean; fov: number; updateProjectionMatrix: () => void };
    if (cam.isPerspectiveCamera) {
      const spd = riding ? Math.abs(riding.speed) : 0;
      const targetFov = 80 + Math.min(10, spd * 0.5);
      const nf = cam.fov + (targetFov - cam.fov) * Math.min(1, dt * 5);
      if (Math.abs(nf - cam.fov) > 0.01) { cam.fov = nf; cam.updateProjectionMatrix(); }
    }

    if (riding) {
      decayShake(dt); // keep draining — it used to pile up while driving and dump on dismount
      const fx = -Math.sin(riding.heading);
      const fz = -Math.cos(riding.heading);
      const k = Math.min(1, 6 * dt);
      // Cars are bigger + faster — pull the chase cam back and up a touch.
      const isCar = riding.vehicle === 'car';
      const back = isCar ? 6.4 : 4.2;
      const up = isCar ? 3.1 : 2.4;
      camera.position.lerp(new Vector3(pos.x - fx * back, pos.y + up, pos.z - fz * back), k);
      camera.lookAt(pos.x + fx * 3, pos.y + (isCar ? 1.0 : 0.8), pos.z + fz * 3);
      // Landing thump: a quick decaying jolt right after a jump touchdown.
      const lf = usePlayStore.getState().landingFx;
      if (lf) {
        const age = (performance.now() - lf.at) / 1000;
        if (age >= 0 && age < 0.28) {
          const amp = 0.4 * lf.power * (1 - age / 0.28);
          camera.position.x += Math.sin(age * 95) * amp;
          camera.position.y += Math.cos(age * 78) * amp * 0.7;
        }
      }
      yaw.current = riding.heading;
      pitch.current = 0;
      return;
    }

    // --- Cinematic override ---
    // Only the host follows cinematic camera state; non-host clients can
    // have stale cinematic state from a brief moment when they thought they
    // were the host (before presence sync). Always first-person for non-host.
    const isHost = useNetStore.getState().isHost;
    const cin = useCombatStore.getState().cinematic;
    // Night mode's only cinematic is the local swat tumble (set by THIS client's
    // own RagdollController), so it's safe to honor on guests too — otherwise a
    // caught kid (guest) wouldn't get the "tossed" view.
    // Aliens: every client plays its own intro / wave shots (started locally
    // from synced state), and they expire by the clock — so a shot can never
    // strand the camera if whoever started it stops being the host.
    if (cin.active && _camMode === 'aliens' && performance.now() / 1000 > cin.endsAt) {
      useCombatStore.getState().endCinematic();
    }
    if (useCombatStore.getState().cinematic.active && (isHost || _camMode === 'night' || _camMode === 'freeplay' || _camMode === 'aliens')) {
      decayShake(dt);
      const blendK = Math.min(1, 4 * dt);
      const targetCam = new Vector3(cin.cameraX, cin.cameraY, cin.cameraZ);
      const lookTarget = new Vector3(cin.targetX, cin.targetY, cin.targetZ);
      camera.position.lerp(targetCam, blendK);
      camera.lookAt(lookTarget);
      return;
    }

    // First-person: camera position is the active character's head. Crouching
    // in Siren Head Night drops the eye line (smoothed) so you tuck behind cover.
    const crouching = _camMode === 'night' && useNightStore.getState().crouching;
    eyeRef.current += ((crouching ? 0.95 : EYE_HEIGHT) - eyeRef.current) * Math.min(1, 10 * dt);
    const baseX = pos.x;
    const baseY = pos.y + eyeRef.current;
    const baseZ = pos.z;

    // Alien Invasion aim-assist: ease the view toward the blob the combat
    // controller picked while the trigger is held.
    if (_camMode === 'aliens' && aimAssist.active && aimAssist.rate > 0) {
      let d = aimAssist.yaw - yaw.current;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw.current += d * Math.min(1, aimAssist.rate * dt);
      // Blobs live on the ground: level a wildly tilted view back toward them.
      pitch.current += (-0.16 - pitch.current) * Math.min(1, aimAssist.rate * 0.4 * dt);
    }

    // Sync the active character's body yaw with the camera so combat aiming
    // (which reads yaws[activeId]) fires where the player is looking.
    yaws[activeId] = yaw.current;

    // Look quaternion from yaw + pitch. Euler order 'YXZ' is the standard
    // for FPS cams (yaw around Y first, then pitch around X, no roll).
    camera.quaternion.setFromEuler(_euler.set(pitch.current, yaw.current, 0, 'YXZ'));

    // --- Free Play over-the-shoulder view (V / 👁) ---
    // Same look direction, but the camera hangs back on a boom behind the
    // character so the kids can see themselves. The boom shortens when a wall,
    // fence or ceiling is in the way, and never dips under the ground.
    const combatTP = _camMode === 'aliens';
    if ((_camMode === 'freeplay' || combatTP) && usePlayStore.getState().thirdPerson && useRailStore.getState().aboard < 0) {
      const cp = Math.cos(pitch.current);
      const fx = -Math.sin(yaw.current) * cp;
      const fy = Math.sin(pitch.current);
      const fz = -Math.cos(yaw.current) * cp;
      const h = CHARACTERS[activeId]?.height ?? 1.6;
      // Combat: a true over-the-shoulder shot — the camera sits up and to the
      // right, so the hero is down-left of the crosshair and you can see what
      // you're zapping (and what's sneaking up beside you).
      const pivotY = pos.y + h * (combatTP ? 0.98 : 0.86);
      const sideX = combatTP ? Math.cos(yaw.current) * 0.62 : 0;
      const sideZ = combatTP ? -Math.sin(yaw.current) * 0.62 : 0;
      const indoors = isIndoors(pos.x, pos.z);
      const want = indoors ? 2.3 : combatTP ? 3.6 + h * 0.5 : 3.1 + h * 0.6;
      const colliders = useGameStore.getState().staticColliders;
      let free = want;
      for (let s = 0.5; s <= want + 0.01; s += 0.3) {
        const cx = pos.x + sideX - fx * s, cy = pivotY - fy * s + 0.25, cz = pos.z + sideZ - fz * s;
        if (cy < pos.y + 0.3 || boomBlocked(cx, cy, cz, colliders)) { free = Math.max(0.5, s - 0.35); break; }
      }
      // Pull in instantly, ease back out (no popping through a wall and back).
      boomRef.current = free < boomRef.current ? free : boomRef.current + (free - boomRef.current) * Math.min(1, 5 * dt);
      const d = boomRef.current;
      decayShake(dt);
      const sk3 = shake > 0 ? shake * SHAKE_AMP : 0;
      let camY = pivotY - fy * d + 0.25;
      if (indoors) camY = Math.min(camY, pos.y + 2.55);
      camera.position.set(
        pos.x + sideX - fx * d + (Math.random() - 0.5) * sk3,
        Math.max(pos.y + 0.35, camY) + (Math.random() - 0.5) * sk3,
        pos.z + sideZ - fz * d + (Math.random() - 0.5) * sk3,
      );
      return;
    }

    // Camera shake (random per-axis jitter, decays over time).
    decayShake(dt);
    const sk = shake;
    const shakeX = sk > 0 ? (Math.random() - 0.5) * sk * SHAKE_AMP : 0;
    const shakeY = sk > 0 ? (Math.random() - 0.5) * sk * SHAKE_AMP : 0;
    const shakeZ = sk > 0 ? (Math.random() - 0.5) * sk * SHAKE_AMP : 0;

    camera.position.set(baseX + shakeX, baseY + shakeY, baseZ + shakeZ);
  });

  return null;
}
