import { useEffect, useMemo, useRef } from 'react';
import { Sky, Environment } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { DirectionalLight, HemisphereLight, AmbientLight } from 'three';
import { Street } from './Street';
import { House } from './House';
import { Yard } from './Yard';
import { HousePropsRenderer } from './HouseProps';
import { Character } from './Character';
import { CameraRig } from '../systems/CameraRig';
import { PlayerController } from '../systems/PlayerController';
import { NPCController } from '../systems/NPCController';
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
import { UFOCrash } from './aliens/UFOCrash';
import { Schmorgesblob, GooSplat as GooSplatMesh } from './aliens/Schmorgesblob';
import { BossBlob } from './aliens/BossBlob';
import { HitParticles } from './aliens/HitParticles';
import { Stars } from './aliens/Stars';
import { RayGun } from './weapons/RayGun';
import { KidBlaster } from './weapons/KidBlaster';
import { PennyBomber } from './weapons/PennyBomber';
import { LukeLegoLauncher } from './weapons/LukeLegoLauncher';
import { Beams } from './weapons/Beams';
import { BlobController } from '../systems/BlobController';
import { CombatController } from '../systems/CombatController';
import { WaveController } from '../systems/WaveController';
import { SidekickController } from '../systems/SidekickController';
import { SkyController } from '../systems/SkyController';
import { PowerUpController } from '../systems/PowerUpController';
import { ProjectileController } from '../systems/ProjectileController';
import { MusicController } from '../systems/MusicController';
import { PickupRenderer } from './pickups/Pickup';
import { Projectiles } from './projectiles/Projectiles';
import { Fireworks } from './celebration/Fireworks';
import { Confetti } from './celebration/Confetti';
import { DiscoLights } from './celebration/DiscoLights';
import { DancingBlobs } from './celebration/DancingBlobs';
import { Fireflies } from './celebration/Fireflies';
import { BackyardPortal } from './celebration/BackyardPortal';
import { useCombatStore } from '../state/combatStore';
import { CameraExposer } from '../ui/Dialogue';

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
      <DynamicSky />
      <Stars />
      {/* Cheap reflections via env preset */}
      <Environment preset="park" background={false} environmentIntensity={0.35} />

      <DynamicLights />

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

      {/* Aliens + combat */}
      <UFOCrash />
      <BlobRenderer />
      <SplatRenderer />
      <HitParticles />
      <Beams />
      <RayGun />
      <PennyBomber />
      <LukeLegoLauncher />
      <KidBlaster who="penny" color="#e26aa1" />
      <KidBlaster who="luke" color="#5cb85c" />

      {/* Pickups + projectiles */}
      <PickupsLive />
      <Projectiles />

      {/* Spawn portal (visible whenever blobs are queued) */}
      <BackyardPortal />

      {/* Celebration / ambience */}
      <Fireworks />
      <Confetti />
      <DiscoLights />
      <DancingBlobs />
      <Fireflies />

      <PlayerController />
      <NPCController />
      <BlobController />
      <CombatController />
      <ProjectileController />
      <PowerUpController />
      <SidekickController />
      <WaveController />
      <SkyController />
      <MusicController />
      <CameraRig />
      <CameraExposer />
    </>
  );
}

function DynamicSky() {
  const timeOfDay = useCombatStore((s) => s.timeOfDay);
  // 0..1 → angle around horizon. We compute a sun position via timeOfDay.
  // tod 0..0.5 = day, 0.5..1 = night (sun below).
  const elev = Math.max(0.05, Math.cos(timeOfDay * Math.PI)); // 1 at noon, -1 at midnight
  const azimuth = (timeOfDay - 0.25) * Math.PI; // sweeps E->W
  const sunY = 100 * elev;
  const sunX = 100 * Math.sin(azimuth);
  const sunZ = 100 * Math.cos(azimuth);
  const turbidity = 4 + timeOfDay * 7;
  const rayleigh = 1.5 + timeOfDay * 1.8;
  return (
    <Sky
      sunPosition={[sunX, sunY, sunZ]}
      turbidity={turbidity}
      rayleigh={rayleigh}
      mieCoefficient={0.005}
      mieDirectionalG={0.7}
    />
  );
}

function DynamicLights() {
  const dirRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const ambRef = useRef<AmbientLight>(null);
  useFrame(() => {
    const t = useCombatStore.getState().timeOfDay;
    const sunIntensity = Math.max(0.05, 1.5 * (1 - t * 1.6));
    if (dirRef.current) {
      dirRef.current.intensity = sunIntensity;
      // Color shifts cooler as night approaches
      const r = 1.0 - t * 0.4;
      const g = 0.95 - t * 0.55;
      const b = 0.82 - t * 0.4;
      dirRef.current.color.setRGB(Math.max(0.2, r), Math.max(0.2, g), Math.max(0.4, b));
      // Sun position
      const elev = Math.max(0.05, Math.cos(t * Math.PI));
      const azimuth = (t - 0.25) * Math.PI;
      dirRef.current.position.set(60 * Math.sin(azimuth), 80 * elev, 35 * Math.cos(azimuth));
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = 0.55 * (1 - t * 0.6);
    }
    if (ambRef.current) {
      ambRef.current.intensity = 0.18 + t * 0.18;
      const r = 0.6 + t * 0.2;
      const g = 0.7 + t * 0.15;
      const b = 0.9;
      ambRef.current.color.setRGB(r, g, b);
    }
  });
  return (
    <>
      <hemisphereLight ref={hemiRef} color="#fff5d8" groundColor="#5a8a3e" intensity={0.55} />
      <directionalLight
        ref={dirRef}
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
      <ambientLight ref={ambRef} intensity={0.18} color="#9ad0e0" />
    </>
  );
}

function PickupsLive() {
  const drops = useCombatStore((s) => s.powerUpDrops);
  return <PickupRenderer drops={drops} />;
}

function BlobRenderer() {
  const blobs = useCombatStore((s) => s.blobs);
  return (
    <>
      {blobs.map((b) => {
        if (b.kind === 'boss') return <BossBlob key={b.id} blob={b} />;
        return <Schmorgesblob key={b.id} blob={b} />;
      })}
    </>
  );
}

function SplatRenderer() {
  const splats = useCombatStore((s) => s.splats);
  return (
    <>
      {splats.map((s) => <GooSplatMesh key={s.id} x={s.x} z={s.z} variant={s.variant} spawnedAt={s.spawnedAt} scale={s.scale} />)}
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
