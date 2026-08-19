import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { SIDEWALK_WIDTH } from '../../world/streetLayout';
import { LiveOak } from '../vegetation/LiveOak';
import {
  WEST_BLVD_X0, WEST_BLVD_X1, WEST_BLVD_Z, WEST_BLVD_W,
  WEST_BULB_X, WEST_BULB_R,
  SCHOOL_DR_X, SCHOOL_DR_Z0, SCHOOL_DR_W,
  WEST_MONUMENT_X, WEST_MONUMENT_Z,
  WEST_OAKS, WEST_BENCHES, westBenchYaw,
} from '../../world/acrossBlvd';

// Ground-plane heights are staggered so nothing z-fights the existing world:
// blvd asphalt 0.016 > drive 0.015 > walkway 0.014 > paths 0.013 > playground
// pad 0.012 > apron 0.0115. The drop-off apron sits UNDER the wood-chip pad,
// so the playground reads as a landscaped island inside the school loop.
const Y_BLVD = 0.016;
const Y_BULB = 0.0155;   // under the extension plane (same color, seamless)
const Y_SIDEWALK = 0.020;
const Y_DASH = 0.019;
const Y_DRIVE = 0.015;
const Y_APRON = 0.0115;
const Y_STRIPE = 0.0165;
const Y_XWALK = 0.0215;

/**
 * West Road: the boulevard no longer dead-ends next to the school. It keeps
 * going west (x −70..−124) to a cul-de-sac turnaround with an AVERY RANCH
 * monument, and School Dr drops off the blvd to a loop at the school's front
 * walkway. Live oaks + pond benches keep the new stretch from feeling empty.
 * All colliders live in acrossBlvd.buildWestRoadColliders().
 */
export function WestRoad() {
  const mats = useMemo(() => ({
    asphalt: new THREE.MeshStandardMaterial({ color: '#3f4348', roughness: 0.95 }),
    sidewalk: new THREE.MeshStandardMaterial({ color: '#cdc6b8', roughness: 1 }),
    dash: new THREE.MeshStandardMaterial({ color: '#f0d040' }),
    schoolPaint: new THREE.MeshStandardMaterial({ color: '#e8c93f', roughness: 0.9 }),
    stall: new THREE.MeshStandardMaterial({ color: '#cfcabb', roughness: 0.9 }),
    limestone: new THREE.MeshStandardMaterial({ color: '#ddd3bc', roughness: 0.95 }),
    plinth: new THREE.MeshStandardMaterial({ color: '#cfc3a8', roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.9 }),
    iron: new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.6, metalness: 0.4 }),
    pole: new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.7 }),
    blade: new THREE.MeshStandardMaterial({ color: '#2a5d8f', roughness: 0.7 }),
  }), []);

  // Drop-off apron: rounded rect kept east of the school's front wall face
  // (x −65.85) so no asphalt pokes into the building interior.
  const apronGeom = useMemo(() => {
    const w = 11.8, d = 10, r = 2.5;
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -d / 2);
    s.lineTo(w / 2 - r, -d / 2);
    s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    s.lineTo(w / 2, d / 2 - r);
    s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    s.lineTo(-w / 2 + r, d / 2);
    s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    s.lineTo(-w / 2, -d / 2 + r);
    s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    return new THREE.ShapeGeometry(s, 8);
  }, []);

  const blvdCx = (WEST_BLVD_X0 + WEST_BLVD_X1) / 2;
  const blvdLen = WEST_BLVD_X1 - WEST_BLVD_X0;
  const bulbEastX = WEST_BULB_X + WEST_BULB_R;
  const walkCx = (bulbEastX + WEST_BLVD_X1) / 2;
  const walkLen = WEST_BLVD_X1 - bulbEastX;
  const walkOff = WEST_BLVD_W / 2 + SIDEWALK_WIDTH / 2;
  // Center dashes continue the original blvd's 8.5 m rhythm, stopping short
  // of the turnaround bulb.
  const dashXs = useMemo(() => Array.from({ length: 5 }, (_, i) => -73.5 - i * 8.5), []);
  const driveLen = 21; // z −187..−208 (the apron carries it on to −215)
  const xwalkXs = useMemo(() => Array.from({ length: 5 }, (_, i) => -62.3 + i * 1.15), []);

  return (
    <group>
      {/* ---- Boulevard extension west (x −124..−70) ---- */}
      <mesh position={[blvdCx, Y_BLVD, WEST_BLVD_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[blvdLen, WEST_BLVD_W]} />
        <primitive object={mats.asphalt} attach="material" />
      </mesh>
      {/* Sidewalks on both sides (they stop at the bulb's edge; the ring takes over). */}
      <mesh position={[walkCx, Y_SIDEWALK, WEST_BLVD_Z - walkOff]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[walkLen, SIDEWALK_WIDTH]} />
        <primitive object={mats.sidewalk} attach="material" />
      </mesh>
      <mesh position={[walkCx, Y_SIDEWALK, WEST_BLVD_Z + walkOff]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[walkLen, SIDEWALK_WIDTH]} />
        <primitive object={mats.sidewalk} attach="material" />
      </mesh>
      {/* Yellow double-line dashes continuing the original blvd's centerline. */}
      {dashXs.map((x) => (
        <group key={x}>
          <mesh position={[x, Y_DASH, WEST_BLVD_Z - 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3, 0.18]} />
            <primitive object={mats.dash} attach="material" />
          </mesh>
          <mesh position={[x, Y_DASH, WEST_BLVD_Z + 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3, 0.18]} />
            <primitive object={mats.dash} attach="material" />
          </mesh>
        </group>
      ))}

      {/* ---- West turnaround bulb + sidewalk ring ---- */}
      <mesh position={[WEST_BULB_X, Y_BULB, WEST_BLVD_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[WEST_BULB_R, 48]} />
        <primitive object={mats.asphalt} attach="material" />
      </mesh>
      <mesh position={[WEST_BULB_X, Y_SIDEWALK, WEST_BLVD_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[WEST_BULB_R, WEST_BULB_R + SIDEWALK_WIDTH, 48]} />
        <primitive object={mats.sidewalk} attach="material" />
      </mesh>

      {/* AVERY RANCH limestone monument on the bulb's west rim, facing east. */}
      <group position={[WEST_MONUMENT_X, 0, WEST_MONUMENT_Z]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.4, 0.3, 1.0]} />
          <primitive object={mats.plinth} attach="material" />
        </mesh>
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[3.4, 1.7, 0.5]} />
          <primitive object={mats.limestone} attach="material" />
        </mesh>
        <Text position={[0, 1.32, 0.27]} fontSize={0.34} color="#5a5345" anchorX="center" anchorY="middle" letterSpacing={0.06}>
          AVERY RANCH
        </Text>
        <Text position={[0, 0.9, 0.27]} fontSize={0.18} color="#75695a" anchorX="center" anchorY="middle" letterSpacing={0.1}>
          EST. 2004
        </Text>
      </group>

      {/* ---- School Dr: driveway from the blvd down to the school ---- */}
      <mesh position={[SCHOOL_DR_X, Y_DRIVE, SCHOOL_DR_Z0 - driveLen / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SCHOOL_DR_W, driveLen]} />
        <primitive object={mats.asphalt} attach="material" />
      </mesh>
      {/* Drop-off loop / parking apron at the walkway end. The playground's
          wood-chip pad renders above it as the loop's landscaped island. */}
      <mesh position={[-59.9, Y_APRON, -210]} rotation={[-Math.PI / 2, 0, 0]} geometry={apronGeom} receiveShadow>
        <primitive object={mats.asphalt} attach="material" />
      </mesh>
      {/* Three stall stripes tucked between the school wall and the loop. */}
      {[-211.2, -212.8, -214.4].map((z) => (
        <mesh key={z} position={[-64.85, Y_STRIPE, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.9, 0.12]} />
          <primitive object={mats.stall} attach="material" />
        </mesh>
      ))}
      {/* Yellow SCHOOL crosswalk band where the drive leaves the blvd. */}
      {xwalkXs.map((x) => (
        <mesh key={x} position={[x, Y_XWALK, -190.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.62, 2.2]} />
          <primitive object={mats.schoolPaint} attach="material" />
        </mesh>
      ))}
      {/* "SCHOOL" road paint for drivers turning in off the blvd. */}
      <Text
        position={[SCHOOL_DR_X, 0.017, -193.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1.3}
        color="#e8c93f"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.12}
      >
        SCHOOL
      </Text>
      {/* SCHOOL DR sign post at the junction corner (on the sidewalk). */}
      <group position={[-56.6, 0, -190.4]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.3, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 2.6, 6]} />
          <primitive object={mats.pole} attach="material" />
        </mesh>
        <mesh position={[0, 2.5, 0]} castShadow>
          <boxGeometry args={[2.0, 0.42, 0.06]} />
          <primitive object={mats.blade} attach="material" />
        </mesh>
        <Text position={[0, 2.5, 0.04]} fontSize={0.24} color="#f5ecd9" anchorX="center" anchorY="middle">
          SCHOOL DR
        </Text>
        <Text position={[0, 2.5, -0.04]} rotation={[0, Math.PI, 0]} fontSize={0.24} color="#f5ecd9" anchorX="center" anchorY="middle">
          SCHOOL DR
        </Text>
      </group>

      {/* ---- Live oaks along the extension's school side ---- */}
      {WEST_OAKS.map((o) => (
        <LiveOak key={`${o.x}:${o.z}`} position={[o.x, 0, o.z]} scale={o.s} seed={o.seed} />
      ))}

      {/* ---- Park benches looking out at the duck pond ---- */}
      {WEST_BENCHES.map((b) => (
        <group key={`${b.x}:${b.z}`} position={[b.x, 0, b.z]} rotation={[0, westBenchYaw(b), 0]}>
          <mesh position={[0, 0.48, 0.06]} castShadow>
            <boxGeometry args={[1.8, 0.1, 0.55]} />
            <primitive object={mats.wood} attach="material" />
          </mesh>
          <mesh position={[0, 0.85, -0.26]} castShadow>
            <boxGeometry args={[1.8, 0.5, 0.09]} />
            <primitive object={mats.wood} attach="material" />
          </mesh>
          <mesh position={[-0.75, 0.24, 0]} castShadow>
            <boxGeometry args={[0.12, 0.48, 0.5]} />
            <primitive object={mats.iron} attach="material" />
          </mesh>
          <mesh position={[0.75, 0.24, 0]} castShadow>
            <boxGeometry args={[0.12, 0.48, 0.5]} />
            <primitive object={mats.iron} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
