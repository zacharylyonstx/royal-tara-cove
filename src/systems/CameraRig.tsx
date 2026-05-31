import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { useNetStore } from '../state/netStore';
import { useChatStore } from '../state/chatStore';
import { usePlayStore } from '../state/playStore';
import { CHARACTER_ORDER } from '../world/characters';

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
      // Don't grab the cursor while the welcome screen is open or when
      // spectating (no input to capture).
      const _camMode = useGameStore.getState().gameMode;
      if (_camMode === 'munchies' || _camMode === 'treehouse') return;
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

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [gl]);

  useFrame((_, dtRaw) => {
    const _camMode = useGameStore.getState().gameMode;
    if (_camMode === 'munchies' || _camMode === 'treehouse') return;
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
    if (riding) {
      const fx = -Math.sin(riding.heading);
      const fz = -Math.cos(riding.heading);
      const k = Math.min(1, 6 * dt);
      camera.position.lerp(new Vector3(pos.x - fx * 4.2, pos.y + 2.4, pos.z - fz * 4.2), k);
      camera.lookAt(pos.x + fx * 3, pos.y + 0.8, pos.z + fz * 3);
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
    if (cin.active && isHost) {
      const blendK = Math.min(1, 4 * dt);
      const targetCam = new Vector3(cin.cameraX, cin.cameraY, cin.cameraZ);
      const lookTarget = new Vector3(cin.targetX, cin.targetY, cin.targetZ);
      camera.position.lerp(targetCam, blendK);
      camera.lookAt(lookTarget);
      return;
    }

    // First-person: camera position is the active character's head.
    const baseX = pos.x;
    const baseY = pos.y + EYE_HEIGHT;
    const baseZ = pos.z;

    // Sync the active character's body yaw with the camera so combat aiming
    // (which reads yaws[activeId]) fires where the player is looking.
    yaws[activeId] = yaw.current;

    // Look quaternion from yaw + pitch. Euler order 'YXZ' is the standard
    // for FPS cams (yaw around Y first, then pitch around X, no roll).
    camera.quaternion.setFromEuler(new Euler(pitch.current, yaw.current, 0, 'YXZ'));

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
