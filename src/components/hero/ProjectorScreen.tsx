import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getProjectorTexture } from '../../world/projectorMedia';

// House-local coordinates. The screen is mounted FLUSH on the +X great-room side
// wall (cream lining at x = 11.84). Its normal points -X (into the room) so the
// couch — which sits in the great room facing +X — looks straight at it. The
// projector is ceiling-mounted to the west and throws +X onto the screen.

const SCREEN_W = 2.5;
const SCREEN_H = 1.4;
const SCREEN_X = 11.6;    // flush on the +X side wall (lining at 11.84)
const SCREEN_Y = 1.9;     // eye level
const SCREEN_Z = -4;      // great-room seating row

const PROJECTOR_X = 8.6;  // ceiling-mounted west of the screen, throws +X
const PROJECTOR_Y = 2.78; // just below the great-room loft underside
const PROJECTOR_Z = -4;
const PROJECTOR_BODY_W = 0.35; // along X
const PROJECTOR_BODY_H = 0.18; // along Y
const PROJECTOR_BODY_D = 0.5;  // along Z
const LENS_LEN = 0.08;
const LENS_RAD = 0.07;
const LENS_TIP_X = PROJECTOR_X + PROJECTOR_BODY_W / 2 + LENS_LEN; // -3.245

export function ProjectorScreen() {
  const projectorMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const coneMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const ledMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Build the screen video texture (singleton, shared with the audio controller).
  const videoTex = useMemo(() => getProjectorTexture(), []);

  // Build the light cone: 4 triangles fanning from the lens tip to the
  // four screen corners. Additive-blended, opacity ~7% for a dusty beam.
  const coneGeom = useMemo(() => buildConeGeometry(), []);

  // Subtle filmic flicker — bumps emissive on body + opacity on cone at 24Hz.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flicker = 1 + 0.04 * Math.sin(t * 24 * 2 * Math.PI);
    if (projectorMatRef.current) projectorMatRef.current.emissiveIntensity = 0.25 * flicker;
    if (coneMatRef.current) coneMatRef.current.opacity = 0.07 * flicker;
    if (ledMatRef.current) ledMatRef.current.emissiveIntensity = 1.0 * flicker;
  });

  return (
    <group>
      {/* Black matte border behind the screen (slightly larger so it peeks around) */}
      <mesh position={[SCREEN_X + 0.002, SCREEN_Y, SCREEN_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SCREEN_W + 0.12, SCREEN_H + 0.12]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.85} side={THREE.FrontSide} />
      </mesh>

      {/* The video screen itself — normal points -X (faces couch) */}
      <mesh position={[SCREEN_X, SCREEN_Y, SCREEN_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial map={videoTex} toneMapped={false} side={THREE.FrontSide} />
      </mesh>

      {/* Light cone — additive-blended dusty beam from lens to screen */}
      <mesh geometry={coneGeom}>
        <meshBasicMaterial
          ref={coneMatRef}
          color="#fff0c8"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Projector body */}
      <mesh position={[PROJECTOR_X, PROJECTOR_Y, PROJECTOR_Z]} castShadow>
        <boxGeometry args={[PROJECTOR_BODY_W, PROJECTOR_BODY_H, PROJECTOR_BODY_D]} />
        <meshStandardMaterial
          ref={projectorMatRef}
          color="#1a1a1c"
          roughness={0.7}
          emissive="#3a3a3c"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Lens cylinder — long axis along X, pointing east toward the screen */}
      <mesh
        position={[PROJECTOR_X + PROJECTOR_BODY_W / 2 + LENS_LEN / 2, PROJECTOR_Y, PROJECTOR_Z]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[LENS_RAD, LENS_RAD, LENS_LEN, 16]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Lens glass — tiny disc on the +X face of the cylinder */}
      <mesh
        position={[LENS_TIP_X + 0.001, PROJECTOR_Y, PROJECTOR_Z]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <circleGeometry args={[LENS_RAD * 0.85, 16]} />
        <meshStandardMaterial color="#fff0c8" emissive="#fff0c8" emissiveIntensity={1.4} />
      </mesh>

      {/* Power LED on top of the projector */}
      <mesh position={[PROJECTOR_X + 0.1, PROJECTOR_Y + PROJECTOR_BODY_H / 2 + 0.01, PROJECTOR_Z + 0.15]}>
        <boxGeometry args={[0.03, 0.01, 0.03]} />
        <meshStandardMaterial
          ref={ledMatRef}
          color="#e63a3a"
          emissive="#e63a3a"
          emissiveIntensity={1.0}
        />
      </mesh>
    </group>
  );
}

function buildConeGeometry(): THREE.BufferGeometry {
  // 5 vertices: lens tip + 4 screen corners. 4 triangles fanning from tip
  // to adjacent corner pairs forming the lateral surface (open at the
  // screen end; no cap — the screen mesh covers it).
  const tip: [number, number, number] = [LENS_TIP_X, PROJECTOR_Y, PROJECTOR_Z];
  const halfW = SCREEN_W / 2;
  const halfH = SCREEN_H / 2;
  // Screen corners ordered: top-back (+Z), top-front (-Z), bottom-front (-Z), bottom-back (+Z)
  // (Z is the variable axis since the screen normal is -X.)
  const corners: Array<[number, number, number]> = [
    [SCREEN_X, SCREEN_Y + halfH, SCREEN_Z + halfW],
    [SCREEN_X, SCREEN_Y + halfH, SCREEN_Z - halfW],
    [SCREEN_X, SCREEN_Y - halfH, SCREEN_Z - halfW],
    [SCREEN_X, SCREEN_Y - halfH, SCREEN_Z + halfW],
  ];
  // 4 triangles: (tip, c0, c1), (tip, c1, c2), (tip, c2, c3), (tip, c3, c0)
  const pos: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    pos.push(...tip, ...a, ...b);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.computeVertexNormals();
  return geom;
}
