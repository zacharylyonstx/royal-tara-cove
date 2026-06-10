import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';
import { usePlayStore } from '../../state/playStore';
import { useZoneStore } from '../../state/zoneStore';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { duckQuack } from '../../audio';
import { ParkedCar } from '../HouseProps';
import {
  POND_X, POND_Z, POND_RX, POND_RZ,
  DOCK_W, DOCK_START_Z, DOCK_END_Z, DOCK_Y,
  PATH_HALF_W, PATH_START_Z, PATH_END_Z,
  PLAYGROUND_X, PLAYGROUND_Z, PICNIC_X, PICNIC_Z,
  CART_X, CART_Z, GOLFCART_X, GOLFCART_Z,
  SHOPS, SHOPS_MIN_X, SHOPS_MAX_X, SHOPS_FRONT_Z, SHOPS_BACK_Z, SHOPS_H,
  WALL_Z, POND_OAKS,
} from '../../world/acrossBlvd';

const FONT = undefined; // drei Text default — fine for signage

/**
 * "Across the Boulevard" — the duck pond, park and shops that really do sit
 * north of the Royal Tara Cove entrance in Avery Ranch. Pure additive zone:
 * mounts in the always-rendered world, far outside every game mode's action.
 */
export function AcrossTheBoulevard() {
  // Register the drivable golf cart + the ice cream interactable once.
  useEffect(() => {
    usePlayStore.getState().registerCar({
      id: 'pond-golfcart',
      x: GOLFCART_X, z: GOLFCART_Z,
      color: '#f2f0e8',
      kind: 'golfcart',
      yaw: Math.PI / 2, // parked nose-west, facing the pond
    });
    useZoneStore.getState().register({
      id: 'icecream-cart',
      kind: 'icecream',
      label: 'get ice cream 🍦',
      x: CART_X, z: CART_Z,
      radius: 2.6,
    });
    return () => useZoneStore.getState().unregister('icecream-cart');
  }, []);

  return (
    <group>
      <Crosswalk />
      <EntryWalls />
      <Paths />
      <Pond />
      <Dock />
      <Ducks />
      <Shops />

      {/* Playground corner (wood-chip pad + the play structure). */}
      <mesh position={[PLAYGROUND_X, 0.012, PLAYGROUND_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[7, 24]} />
        <meshStandardMaterial color="#8a6a4a" roughness={1} />
      </mesh>
      <GLBModel
        url={MODELS.playground.url}
        fitHeight={MODELS.playground.fitHeight}
        position={[PLAYGROUND_X, 0, PLAYGROUND_Z]}
        rotationY={Math.PI / 5}
      />

      {/* Picnic spot + benches facing the water. */}
      <GLBModel url={MODELS.picnictable.url} fitHeight={MODELS.picnictable.fitHeight} position={[PICNIC_X, 0, PICNIC_Z]} rotationY={0.4} />
      <GLBModel url={MODELS.parkbench.url} fitHeight={MODELS.parkbench.fitHeight} position={[-8, 0, -204.5]} rotationY={Math.PI + 0.25} />
      <GLBModel url={MODELS.parkbench.url} fitHeight={MODELS.parkbench.fitHeight} position={[9.5, 0, -205]} rotationY={Math.PI - 0.3} />

      {/* Ice cream cart by the path. */}
      <GLBModel url={MODELS.icecreamstand.url} fitHeight={MODELS.icecreamstand.fitHeight} position={[CART_X, 0, CART_Z]} rotationY={-Math.PI / 2.4} />

      {/* The golf cart (drivable — hides itself while someone drives it). */}
      <ParkedCar carId="pond-golfcart" />

      {/* Live oaks ringing the pond (golf-club edge woods). */}
      {POND_OAKS.map((o, i) => (
        <GLBModel key={i} url={MODELS.oak.url} fitHeight={5.5 * o.s} position={[o.x, 0, o.z]} rotationY={(i * 47) % 6} />
      ))}
    </group>
  );
}

/** Zebra crosswalk over the boulevard, continuing the street centerline. */
function Crosswalk() {
  const stripes = useMemo(() => Array.from({ length: 8 }, (_, i) => -178.4 - i * 1.5), []);
  return (
    <group>
      {stripes.map((z) => (
        <mesh key={z} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.4, 0.62]} />
          <meshStandardMaterial color="#e8e6df" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Low limestone monument walls flanking the park entrance. */
function EntryWalls() {
  return (
    <group>
      {[-8, 8].map((x) => (
        <group key={x} position={[x, 0, WALL_Z]}>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[8, 1, 0.8]} />
            <meshStandardMaterial color="#ddd3bc" roughness={0.95} />
          </mesh>
          {/* cap */}
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[8.3, 0.14, 1.0]} />
            <meshStandardMaterial color="#c9bda2" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <Text
        position={[-8, 0.58, WALL_Z + 0.42]}
        fontSize={0.42}
        color="#5a5345"
        anchorX="center"
        anchorY="middle"
        font={FONT}
        letterSpacing={0.08}
      >
        AVERY RANCH
      </Text>
      <Text
        position={[8, 0.58, WALL_Z + 0.42]}
        fontSize={0.42}
        color="#5a5345"
        anchorX="center"
        anchorY="middle"
        font={FONT}
        letterSpacing={0.08}
      >
        DUCK POND
      </Text>
    </group>
  );
}

/** Decomposed-granite park paths. */
function Paths() {
  const pathMat = <meshStandardMaterial color="#cbb693" roughness={1} />;
  return (
    <group>
      {/* Main path: crosswalk landing → dock. */}
      <mesh position={[0, 0.013, (PATH_START_Z + PATH_END_Z) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[PATH_HALF_W * 2, PATH_START_Z - PATH_END_Z]} />
        {pathMat}
      </mesh>
      {/* West spur to the playground. */}
      <mesh position={[(PLAYGROUND_X + 0) / 2, 0.013, -202]} rotation={[-Math.PI / 2, 0, 0.18]} receiveShadow>
        <planeGeometry args={[Math.abs(PLAYGROUND_X) + 6, 2.4]} />
        {pathMat}
      </mesh>
      {/* East spur to the shops walkway. */}
      <mesh position={[(SHOPS_MIN_X + 2) / 2, 0.013, -196.5]} rotation={[-Math.PI / 2, 0, -0.12]} receiveShadow>
        <planeGeometry args={[SHOPS_MIN_X + 4, 2.4]} />
        {pathMat}
      </mesh>
    </group>
  );
}

/** The pond: still water that catches the sky, sandy shore ring, lily pads. */
function Pond() {
  const waterRef = useRef<THREE.MeshStandardMaterial>(null);
  const { waterGeom, shoreGeom } = useMemo(() => {
    const mk = (rx: number, rz: number) => {
      const shape = new THREE.Shape();
      shape.ellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
      return new THREE.ShapeGeometry(shape, 36);
    };
    return { waterGeom: mk(POND_RX, POND_RZ), shoreGeom: mk(POND_RX + 1.6, POND_RZ + 1.6) };
  }, []);

  // Gentle living shimmer — breathe the envMap intensity & color, no shader.
  useFrame(({ clock }) => {
    const m = waterRef.current;
    if (!m) return;
    const t = clock.elapsedTime;
    m.envMapIntensity = 1.1 + Math.sin(t * 0.7) * 0.25;
  });

  return (
    <group position={[POND_X, 0, POND_Z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} geometry={shoreGeom} receiveShadow>
        <meshStandardMaterial color="#c8b98e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} geometry={waterGeom}>
        <meshStandardMaterial
          ref={waterRef}
          color="#2e6e8e"
          roughness={0.08}
          metalness={0.25}
          transparent
          opacity={0.94}
        />
      </mesh>
      {/* Lily pads in the north-east corner. */}
      {[[6, -6.5], [8.5, -5], [7.5, -8], [10.5, -6.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]} rotation={[-Math.PI / 2, 0, i * 1.7]}>
          <circleGeometry args={[0.55 - i * 0.07, 12]} />
          <meshStandardMaterial color="#3f7a3c" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Wooden fishing dock over the south shore. */
function Dock() {
  const midZ = (DOCK_START_Z + DOCK_END_Z) / 2;
  const len = DOCK_START_Z - DOCK_END_Z;
  const posts: [number, number][] = [
    [-DOCK_W / 2, DOCK_START_Z - 1], [DOCK_W / 2, DOCK_START_Z - 1],
    [-DOCK_W / 2, midZ], [DOCK_W / 2, midZ],
    [-DOCK_W / 2, DOCK_END_Z], [DOCK_W / 2, DOCK_END_Z],
  ];
  return (
    <group>
      {/* Deck planks (slight gaps drawn by stripes of darker seams). */}
      <mesh position={[0, DOCK_Y, midZ]} castShadow receiveShadow>
        <boxGeometry args={[DOCK_W, 0.08, len]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.9} />
      </mesh>
      {/* Entry step wedge. */}
      <mesh position={[0, DOCK_Y / 2 - 0.02, DOCK_START_Z + 0.75]} castShadow>
        <boxGeometry args={[DOCK_W, DOCK_Y - 0.04, 1.5]} />
        <meshStandardMaterial color="#7a5c3e" roughness={0.95} />
      </mesh>
      {/* Posts down into the water. */}
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, DOCK_Y / 2 - 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, DOCK_Y + 0.5, 8]} />
          <meshStandardMaterial color="#6a4e34" roughness={0.95} />
        </mesh>
      ))}
      {/* Side + end rails (match the colliders). */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (DOCK_W / 2 + 0.05), DOCK_Y + 0.5, midZ]} castShadow>
            <boxGeometry args={[0.07, 0.07, len]} />
            <meshStandardMaterial color="#7a5c3e" roughness={0.9} />
          </mesh>
          {[DOCK_START_Z - 0.5, midZ, DOCK_END_Z + 0.3].map((z, i) => (
            <mesh key={i} position={[side * (DOCK_W / 2 + 0.05), DOCK_Y + 0.25, z]} castShadow>
              <boxGeometry args={[0.06, 0.5, 0.06]} />
              <meshStandardMaterial color="#7a5c3e" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, DOCK_Y + 0.5, DOCK_END_Z - 0.05]} castShadow>
        <boxGeometry args={[DOCK_W + 0.2, 0.07, 0.07]} />
        <meshStandardMaterial color="#7a5c3e" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Four mallards on slow looping swims; quacks when the family is close. */
function Ducks() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const nextQuack = useRef(0);
  const ducks = useMemo(
    () => [
      { r: 7, speed: 0.14, phase: 0, dir: 1 },
      { r: 10, speed: 0.1, phase: 2.1, dir: -1 },
      { r: 5, speed: 0.18, phase: 4.0, dir: 1 },
      { r: 11.5, speed: 0.08, phase: 5.3, dir: -1 },
    ],
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < ducks.length; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const d = ducks[i];
      const a = d.phase + t * d.speed * d.dir;
      // Squash the loop to the pond's ellipse proportions.
      const x = POND_X + Math.cos(a) * d.r;
      const z = POND_Z + Math.sin(a) * d.r * (POND_RZ / POND_RX);
      g.position.set(x, 0.05 + Math.sin(t * 1.7 + d.phase) * 0.025, z);
      // Face travel direction (tangent of the loop).
      const tx = -Math.sin(a) * d.dir;
      const tz = Math.cos(a) * d.dir * (POND_RZ / POND_RX);
      g.rotation.y = Math.atan2(tx, tz);
    }
    // Occasional quack when the local player is near the pond.
    if (t > nextQuack.current) {
      nextQuack.current = t + 7 + Math.random() * 9;
      const game = useGameStore.getState();
      const me = useNetStore.getState().myCharacterId ?? game.activeCharacterId;
      const p = game.positions[me];
      if (p && Math.hypot(p.x - POND_X, p.z - POND_Z) < 26) duckQuack();
    }
  });

  return (
    <>
      {ducks.map((_, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }}>
          <GLBModel url={MODELS.duck.url} fitHeight={MODELS.duck.fitHeight} castShadow={false} />
        </group>
      ))}
    </>
  );
}

/** The Plaza at Avery Ranch — limestone strip with the real family spots. */
function Shops() {
  const width = SHOPS_MAX_X - SHOPS_MIN_X;
  const depth = SHOPS_FRONT_Z - SHOPS_BACK_Z; // positive (front is south of back)
  const cx = (SHOPS_MIN_X + SHOPS_MAX_X) / 2;
  const cz = (SHOPS_FRONT_Z + SHOPS_BACK_Z) / 2;
  const columns = useMemo(() => {
    const xs: number[] = [];
    for (let x = SHOPS_MIN_X + 0.6; x <= SHOPS_MAX_X - 0.5; x += 5.5) xs.push(x);
    return xs;
  }, []);

  return (
    <group>
      {/* Building body — cream limestone. */}
      <mesh position={[cx, SHOPS_H / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[width, SHOPS_H, depth]} />
        <meshStandardMaterial color="#e6deca" roughness={0.95} />
      </mesh>
      {/* Parapet cap. */}
      <mesh position={[cx, SHOPS_H + 0.18, cz]} castShadow>
        <boxGeometry args={[width + 0.4, 0.36, depth + 0.4]} />
        <meshStandardMaterial color="#cfc3a8" roughness={0.9} />
      </mesh>

      {/* Covered walkway: bronze standing-seam canopy on stone columns. */}
      <mesh position={[cx, 3.15, SHOPS_FRONT_Z + 1.35]} castShadow>
        <boxGeometry args={[width, 0.12, 2.7]} />
        <meshStandardMaterial color="#4a4238" roughness={0.6} metalness={0.3} />
      </mesh>
      {columns.map((x) => (
        <mesh key={x} position={[x, 1.55, SHOPS_FRONT_Z + 2.45]} castShadow>
          <boxGeometry args={[0.45, 3.1, 0.45]} />
          <meshStandardMaterial color="#d8d0bc" roughness={0.95} />
        </mesh>
      ))}
      {/* Walkway slab. */}
      <mesh position={[cx, 0.015, SHOPS_FRONT_Z + 1.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width + 2, 3.2]} />
        <meshStandardMaterial color="#cdc6b8" roughness={1} />
      </mesh>

      {/* Per-shop storefronts: glass, door, sign band + name. */}
      {SHOPS.map((s) => {
        const sw = s.maxX - s.minX;
        const sx = (s.minX + s.maxX) / 2;
        return (
          <group key={s.name}>
            {/* Sign band */}
            <mesh position={[sx, 3.0, SHOPS_FRONT_Z - 0.01]} castShadow>
              <boxGeometry args={[sw - 0.6, 0.9, 0.18]} />
              <meshStandardMaterial color={s.accent} roughness={0.7} />
            </mesh>
            <Text
              position={[sx, 3.14, SHOPS_FRONT_Z + 0.12]}
              fontSize={0.42}
              color="#fff8ec"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.06}
            >
              {s.name}
            </Text>
            <Text
              position={[sx, 2.72, SHOPS_FRONT_Z + 0.12]}
              fontSize={0.2}
              color="#fff8ec"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.18}
            >
              {s.sub}
            </Text>
            {/* Glass storefront */}
            <mesh position={[sx, 1.25, SHOPS_FRONT_Z + 0.02]}>
              <planeGeometry args={[sw - 1.6, 2.1]} />
              <meshStandardMaterial color="#27323c" roughness={0.15} metalness={0.4} transparent opacity={0.92} />
            </mesh>
            {/* Door frame */}
            <mesh position={[sx - sw / 2 + 1.6, 1.1, SHOPS_FRONT_Z + 0.04]}>
              <planeGeometry args={[0.95, 2.05]} />
              <meshStandardMaterial color="#4a4238" roughness={0.5} metalness={0.3} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
