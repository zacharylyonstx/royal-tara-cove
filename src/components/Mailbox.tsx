import { Text } from '@react-three/drei';

interface MailboxProps {
  position: [number, number, number];
  rotation?: number;
  /** Family name shown in white vinyl letters on the side. */
  name?: string;
}

export function Mailbox({ position, rotation = 0, name }: MailboxProps) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 1.1, 6]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <boxGeometry args={[0.5, 0.3, 0.36]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.22, 1.18, 0]} castShadow>
        <boxGeometry args={[0.06, 0.1, 0.1]} />
        <meshStandardMaterial color="#c8392a" />
      </mesh>
      {name && (
        <Text
          position={[0, 1.18, 0.19]}
          fontSize={0.09}
          color="#f0f0f0"
          anchorX="center"
          anchorY="middle"
        >
          {name}
        </Text>
      )}
    </group>
  );
}
