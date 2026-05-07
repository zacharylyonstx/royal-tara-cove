import { Sky } from '@react-three/drei';
import { Street } from './Street';
import { House } from './House';
import { Yard } from './Yard';
import { Character } from './Character';
import { CameraRig } from '../systems/CameraRig';
import { PlayerController } from '../systems/PlayerController';
import { HOUSES } from '../world/houses';
import { CHARACTERS, CHARACTER_ORDER } from '../world/characters';
import { useGameStore } from '../state/gameStore';

export function Game() {
  const activeId = useGameStore((s) => s.activeCharacterId);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);

  return (
    <>
      {/* Sky + sun */}
      <Sky
        sunPosition={[100, 80, 50]}
        turbidity={6}
        rayleigh={1.4}
        mieCoefficient={0.005}
        mieDirectionalG={0.7}
      />

      <hemisphereLight color="#fff5d8" groundColor="#5a8a3e" intensity={0.55} />
      <directionalLight
        position={[40, 60, 25]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={250}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />

      {/* Ground (large grass plane) */}
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#4a7e35" />
      </mesh>

      <Street />

      {/* Each house lot — yard underneath, structure on top */}
      {HOUSES.map((h) => (
        <group key={h.address}>
          <Yard config={h} />
          <House config={h} />
        </group>
      ))}

      {/* All three characters always present in the world */}
      {CHARACTER_ORDER.map((id) => (
        <Character
          key={id}
          def={CHARACTERS[id]}
          positionRef={positions[id]}
          yawRef={{
            // Wrap the live number in a ref-shaped object that reads/writes the store
            // each frame. Updating yaws[id] in PlayerController mutates the same record.
            get current() {
              return yaws[id];
            },
            set current(v: number) {
              yaws[id] = v;
            },
          }}
          isActive={id === activeId}
        />
      ))}

      <PlayerController />
      <CameraRig />
    </>
  );
}
