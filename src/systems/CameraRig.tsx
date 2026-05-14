import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useGameStore } from '../state/gameStore';
import { useCombatStore } from '../state/combatStore';
import { unclipCamera } from './collision';

// Spherical 3rd-person follow cam.
// - Target is the active character's chest (~1.5m off ground).
// - Camera position = target + spherical(yaw, pitch, distance).
// - Right-mouse drag adjusts targetYaw / targetPitch.
// - Wheel adjusts targetDistance (3..18m).
// - When idle (no drag) and player is moving, targetYaw relaxes toward the
//   player's facing yaw + π (i.e. behind the character).
// - Camera collision: raycast (sample-step) from chest toward desired pos and
//   clip if a collider is in the way.

const MIN_DIST = 3.5;
const MAX_DIST = 18;
const MIN_PITCH = 0.18;          // can't look straight up
const MAX_PITCH = Math.PI / 2 - 0.12;
const DRAG_SENSITIVITY = 0.0028; // halved for finer turning
const WHEEL_SENSITIVITY = 0.005;
const RELAX_SPEED = 1.0;         // slower auto-relax-behind
const LERP_SPEED = 8;            // higher = snappier follow

export function CameraRig() {
  const { camera, gl } = useThree();
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const staticColliders = useGameStore((s) => s.staticColliders);
  const doors = useGameStore((s) => s.doors);
  const shake = useCombatStore((s) => s.shake);
  const decayShake = useCombatStore((s) => s.decayShake);
  const slowMo = useCombatStore((s) => s.slowMo);

  // Persistent rig state lives in refs to avoid re-renders.
  // Initial cam yaw=π puts the camera at -Z (north of player). Player spawns
  // facing +Z (south, toward the cul-de-sac, yaw=π), so this puts the camera
  // behind them looking south.
  const yaw = useRef(Math.PI);
  const pitch = useRef(0.55);
  const distance = useRef(8);
  const targetYaw = useRef(yaw.current);
  const targetPitch = useRef(pitch.current);
  const targetDistance = useRef(distance.current);
  const dragging = useRef(false);
  const dragStartedAt = useRef(0);
  const lastDragInputAt = useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;

    const onContextMenu = (e: Event) => e.preventDefault();
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2 || e.button === 0) {
        dragging.current = true;
        dragStartedAt.current = performance.now();
        canvas.style.cursor = 'grabbing';
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2 || e.button === 0) {
        dragging.current = false;
        canvas.style.cursor = '';
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      lastDragInputAt.current = performance.now();
      targetYaw.current -= e.movementX * DRAG_SENSITIVITY;
      targetPitch.current -= e.movementY * DRAG_SENSITIVITY;
      if (targetPitch.current < MIN_PITCH) targetPitch.current = MIN_PITCH;
      if (targetPitch.current > MAX_PITCH) targetPitch.current = MAX_PITCH;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetDistance.current += e.deltaY * WHEEL_SENSITIVITY;
      if (targetDistance.current < MIN_DIST) targetDistance.current = MIN_DIST;
      if (targetDistance.current > MAX_DIST) targetDistance.current = MAX_DIST;
    };

    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1) * slowMo;
    const pos = positions[activeId];
    const playerYaw = yaws[activeId];

    // Behind-character relax: only if user hasn't dragged in the last 1.5s.
    const sinceDrag = (performance.now() - lastDragInputAt.current) / 1000;
    if (!dragging.current && sinceDrag > 1.5) {
      // Player yaw=0 → faces -Z. We want the camera BEHIND the player (on +Z),
      // so cam yaw=0 makes offset = (sin(0), 0, cos(0))*dist = (0, 0, dist) which
      // sits on +Z. Therefore camera yaw target equals player yaw.
      const desired = playerYaw;
      let diff = desired - targetYaw.current;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      const step = RELAX_SPEED * dt;
      if (Math.abs(diff) < step) targetYaw.current = desired;
      else targetYaw.current += Math.sign(diff) * step;
    }

    // Lerp current toward target.
    const k = Math.min(1, LERP_SPEED * dt);
    let dY = targetYaw.current - yaw.current;
    while (dY > Math.PI) dY -= 2 * Math.PI;
    while (dY < -Math.PI) dY += 2 * Math.PI;
    yaw.current += dY * k;
    pitch.current += (targetPitch.current - pitch.current) * k;
    distance.current += (targetDistance.current - distance.current) * k;

    // Compute camera position.
    const cx = Math.sin(yaw.current) * Math.cos(pitch.current) * distance.current;
    const cy = Math.sin(pitch.current) * distance.current;
    const cz = Math.cos(yaw.current) * Math.cos(pitch.current) * distance.current;
    const tgt = new Vector3(pos.x, pos.y + 1.5, pos.z);
    const desiredCam = new Vector3(tgt.x + cx, tgt.y + cy, tgt.z + cz);

    // Camera unclip — pull in if blocked by world geometry. Closed doors count.
    const allColliders = [...staticColliders];
    for (const door of Object.values(doors)) {
      if (!door.open) allColliders.push(door.aabbWhenClosed);
    }
    const safe = unclipCamera(
      tgt.x, tgt.y, tgt.z,
      desiredCam.x, desiredCam.y, desiredCam.z,
      allColliders,
    );

    // Camera shake offset
    decayShake(dt);
    const sk = shake;
    const shakeX = sk > 0 ? (Math.random() - 0.5) * sk * 0.6 : 0;
    const shakeY = sk > 0 ? (Math.random() - 0.5) * sk * 0.6 : 0;
    const shakeZ = sk > 0 ? (Math.random() - 0.5) * sk * 0.6 : 0;

    camera.position.set(safe.x + shakeX, safe.y + shakeY, safe.z + shakeZ);
    camera.lookAt(tgt);
  });

  return null;
}
