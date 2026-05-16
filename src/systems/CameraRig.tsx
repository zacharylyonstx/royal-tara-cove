import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';

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
  const activeId = useGameStore((s) => s.activeCharacterId);
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

  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => {
      if (locked.current) return;
      // Don't grab the cursor while the welcome screen is open.
      if (useGameStore.getState().welcomeOpen) return;
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
    const dt = Math.min(dtRaw, 0.1) * slowMo;
    const pos = positions[activeId];
    if (!pos) return;

    // --- Cinematic override ---
    // Preserved verbatim from the previous CameraRig. While active, the
    // cinematic owns the camera and we ignore mouse input.
    const cin = useCombatStore.getState().cinematic;
    if (cin.active) {
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

    // Reference yaws so the lint rule about unused store subscriptions
    // doesn't trip — the subscription itself is needed so a yaw change
    // wakes a re-render and keeps the camera fresh after character switch.
    void yaws;
  });

  return null;
}
