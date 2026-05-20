import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import { CHARACTERS } from '../../world/characters';
import { useMunchiesStore, type SleepwalkerId } from '../../state/munchiesStore';
import { Dog } from './Dog';
import { SchmorgesGhost } from './SchmorgesGhost';

export function SleepwalkersLive() {
  const sleepwalkers = useMunchiesStore((s) => s.sleepwalkers);
  return (
    <>
      {(Object.keys(sleepwalkers) as SleepwalkerId[]).map((id) => (
        <SleepwalkerRender key={id} id={id} />
      ))}
    </>
  );
}

function SleepwalkerRender({ id }: { id: SleepwalkerId }) {
  const sw = useMunchiesStore((s) => s.sleepwalkers[id]);
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(sw.x, 0, sw.z);
    groupRef.current.rotation.y = sw.yaw;
    groupRef.current.visible = sw.mode !== 'tucked';
  });

  const bluish = sw.mode === 'powered';

  if (id === 'dog') {
    return (
      <group ref={groupRef}>
        <Dog positionRef={sw} bluish={bluish} />
        <ZzzOverlay bigger={bluish} yOffset={1.15} />
        <NameLabel name={SLEEPWALKER_LABEL.dog} yOffset={1.7} />
      </group>
    );
  }

  if (id === 'schmorgesblob') {
    return (
      <group ref={groupRef}>
        <SchmorgesGhost positionRef={sw} bluish={bluish} />
        <ZzzOverlay bigger={bluish} yOffset={1.15} />
        <NameLabel name={SLEEPWALKER_LABEL.schmorgesblob} yOffset={1.7} />
      </group>
    );
  }

  // any future non-humanoid IDs not yet handled
  if (!(id in CHARACTERS)) {
    return (
      <group ref={groupRef}>
        <mesh castShadow>
          <sphereGeometry args={[0.45, 10, 8]} />
          <meshStandardMaterial color={bluish ? '#7a8aa8' : '#7a5c8a'} />
        </mesh>
        <ZzzOverlay bigger={bluish} />
      </group>
    );
  }

  const def = CHARACTERS[id as keyof typeof CHARACTERS];
  const h = def.height;
  const torsoColor = bluish ? '#7a8aa8' : def.bodyColor;
  return (
    <group ref={groupRef}>
      {/* legs */}
      <mesh position={[-h * 0.06, h * 0.21, 0]} castShadow>
        <boxGeometry args={[h * 0.1, h * 0.42, h * 0.12]} />
        <meshStandardMaterial color={def.pantsColor} />
      </mesh>
      <mesh position={[h * 0.06, h * 0.21, 0]} castShadow>
        <boxGeometry args={[h * 0.1, h * 0.42, h * 0.12]} />
        <meshStandardMaterial color={def.pantsColor} />
      </mesh>
      {/* torso */}
      <mesh position={[0, h * 0.6, 0]} castShadow>
        <boxGeometry args={[h * 0.28, h * 0.36, h * 0.18]} />
        <meshStandardMaterial color={torsoColor} />
      </mesh>
      {/* arms outstretched zombie-style */}
      <mesh position={[-h * 0.22, h * 0.65, -h * 0.15]} castShadow>
        <boxGeometry args={[h * 0.08, h * 0.08, h * 0.36]} />
        <meshStandardMaterial color={torsoColor} />
      </mesh>
      <mesh position={[h * 0.22, h * 0.65, -h * 0.15]} castShadow>
        <boxGeometry args={[h * 0.08, h * 0.08, h * 0.36]} />
        <meshStandardMaterial color={torsoColor} />
      </mesh>
      {/* head */}
      <mesh position={[0, h * 0.91, 0]} castShadow>
        <sphereGeometry args={[h * 0.13, 12, 10]} />
        <meshStandardMaterial color={def.skinTone} />
      </mesh>
      <ZzzOverlay bigger={bluish} yOffset={h * 1.15} />
      <NameLabel name={SLEEPWALKER_LABEL[id]} yOffset={h * 1.55} />
    </group>
  );
}

function NameLabel({ name, yOffset }: { name: string; yOffset: number }) {
  return (
    <Html
      position={[0, yOffset, 0]}
      center
      distanceFactor={10}
      style={{
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 12,
        fontWeight: 700,
        color: '#fff7e6',
        background: 'rgba(20,16,30,0.78)',
        padding: '2px 7px',
        borderRadius: 8,
        whiteSpace: 'nowrap',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        transform: 'translateY(-100%)',
        border: '1px solid rgba(255,255,255,0.18)',
      }}
    >
      {name}
    </Html>
  );
}

const SLEEPWALKER_LABEL: Record<string, string> = {
  dad: '👨 Dad',
  penny: '👧 Penny',
  dog: '🐕 Doggie',
  schmorgesblob: '👽 Blob',
};

function ZzzOverlay({ bigger, yOffset = 1.6 }: { bigger?: boolean; yOffset?: number }) {
  return (
    <Html
      position={[0, yOffset, 0]}
      center
      distanceFactor={8}
      style={{
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: bigger ? 26 : 18,
        fontWeight: 800,
        color: bigger ? '#8acfff' : '#ffffff',
        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        letterSpacing: 1,
      }}
    >
      Zzz
    </Html>
  );
}
