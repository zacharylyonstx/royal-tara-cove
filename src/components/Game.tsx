import { useEffect, useMemo } from 'react';
import { Sky, Environment } from '@react-three/drei';
import { Street } from './Street';
import { House } from './House';
import { Yard } from './Yard';
import { HousePropsRenderer } from './HouseProps';
import { Character } from './Character';
import { CameraRig } from '../systems/CameraRig';
import { PlayerController } from '../systems/PlayerController';
import { HOUSES } from '../world/houses';
import { CHARACTERS, CHARACTER_ORDER } from '../world/characters';
import { useGameStore } from '../state/gameStore';
import { buildLots } from '../world/lots';
import { buildColliders } from '../world/colliders';
import { buildPropsFor } from '../world/props';
import { mat } from '../world/materials';
import {
  HeroHouse10600,
  buildInteriorColliders,
  buildPorchColliders,
} from './hero/HeroHouse10600';
import { LiveOak } from './vegetation/LiveOak';
import { CrepeMyrtle } from './vegetation/CrepeMyrtle';
import { Hedge } from './vegetation/Hedge';

export function Game() {
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  const setStaticColliders = useGameStore((s) => s.setStaticColliders);

  // Compute lots, props, and colliders once.
  const lots = useMemo(() => buildLots(HOUSES), []);
  const lotsByAddress = useMemo(() => {
    const m = new Map<string, ReturnType<typeof buildLots>[number]>();
    for (const l of lots) m.set(l.address, l);
    return m;
  }, [lots]);
  const propsByAddress = useMemo(() => buildPropsFor(HOUSES), []);

  useEffect(() => {
    const base = buildColliders(HOUSES, lots);
    // Hero house adds interior + porch colliders
    const hero = HOUSES.find((h) => h.isHero);
    let extra: typeof base = [];
    if (hero) {
      const heroLot = lotsByAddress.get(hero.address)!;
      extra = [
        ...buildInteriorColliders(hero, heroLot),
        ...buildPorchColliders(hero, heroLot),
      ];
    }
    setStaticColliders([...base, ...extra]);
  }, [lots, lotsByAddress, setStaticColliders]);

  return (
    <>
      {/* Texas-summer sky */}
      <Sky
        sunPosition={[80, 90, 30]}
        turbidity={4}
        rayleigh={1.6}
        mieCoefficient={0.005}
        mieDirectionalG={0.7}
      />
      {/* Cheap reflections via env preset */}
      <Environment preset="park" background={false} environmentIntensity={0.45} />

      <hemisphereLight color="#fff5d8" groundColor="#5a8a3e" intensity={0.55} />
      <directionalLight
        position={[60, 80, 35]}
        intensity={1.5}
        color="#fff0d0"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0008}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
      />
      <ambientLight intensity={0.18} color="#9ad0e0" />

      {/* Ground plane (textured grass) */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <primitive object={mat.grass()} attach="material" />
      </mesh>

      <Street />

      {/* Houses: hero special-cased */}
      {HOUSES.map((h) => {
        const lot = lotsByAddress.get(h.address)!;
        return (
          <group key={h.address}>
            <Yard config={h} lot={lot} />
            {h.isHero ? (
              <HeroHouse10600 config={h} lot={lot} />
            ) : (
              <House config={h} lot={lot} />
            )}
            <HousePropsRenderer config={h} lot={lot} data={propsByAddress.get(h.address)!} />
            {/* Per-lot vegetation: 1 live oak in back, 1 crepe myrtle in front */}
            <LotVegetation address={h.address} lot={lot} />
          </group>
        );
      })}

      {/* Common-area trees lining the street entry */}
      {[
        { x: -16, z: -110 }, { x: 16, z: -110 },
        { x: -22, z: -90 }, { x: 22, z: -90 },
        { x: -22, z: -65 }, { x: 22, z: -65 },
        { x: -22, z: -40 }, { x: 22, z: -40 },
      ].map((p, i) => (
        <LiveOak key={`bgtree-${i}`} position={[p.x, 0, p.z]} scale={1.05} seed={i + 99} />
      ))}

      {/* Characters */}
      {CHARACTER_ORDER.map((id) => (
        <Character
          key={id}
          def={CHARACTERS[id]}
          positionRef={positions[id]}
          yawRef={{
            get current() { return yaws[id]; },
            set current(v: number) { yaws[id] = v; },
          }}
          isActive={id === activeId}
        />
      ))}

      <PlayerController />
      <CameraRig />
    </>
  );
}

function LotVegetation({ address, lot }: { address: string; lot: ReturnType<typeof buildLots>[number] }) {
  // Place 1-2 live oaks in the backyard region (centroid + offset toward back)
  // and a crepe myrtle near the front sidewalk.
  const seed = address.charCodeAt(0) * 131 + address.charCodeAt(2) * 7;
  const cx = lot.housePivot[0];
  const cz = lot.housePivot[1];
  const yawCos = Math.cos(lot.houseYaw);
  const yawSin = Math.sin(lot.houseYaw);

  // backyard offset: house-local (0, +6) maps to world via the house yaw
  const backLocalX = (((seed % 7) - 3) * 0.7);
  const backLocalZ = 6 + (seed % 3);
  const backWX = cx + backLocalX * yawCos + backLocalZ * yawSin;
  const backWZ = cz - backLocalX * yawSin + backLocalZ * yawCos;

  // crepe near the curb on the door side
  const sideLocalX = (seed % 11) > 5 ? -3 : 3;
  const sideLocalZ = -7;
  const sideWX = cx + sideLocalX * yawCos + sideLocalZ * yawSin;
  const sideWZ = cz - sideLocalX * yawSin + sideLocalZ * yawCos;

  // Hedge against the front foundation (some lots only)
  const showHedge = (seed % 3) === 0;
  const hedgeLocalZ = -(7); // along front of house
  const hedgeWX = cx + 0 * yawCos + hedgeLocalZ * yawSin;
  const hedgeWZ = cz - 0 * yawSin + hedgeLocalZ * yawCos;

  return (
    <>
      <LiveOak position={[backWX, 0, backWZ]} scale={1.15 + (seed % 5) * 0.05} seed={seed} />
      <CrepeMyrtle
        position={[sideWX, 0, sideWZ]}
        scale={0.9 + (seed % 3) * 0.07}
        bloomColor={(seed % 2) === 0 ? '#d985b3' : '#c66ea4'}
        seed={seed}
      />
      {showHedge && (
        <Hedge position={[hedgeWX, 0, hedgeWZ]} rotation={lot.houseYaw} length={3.5} />
      )}
    </>
  );
}
