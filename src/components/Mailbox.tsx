interface MailboxProps {
  position: [number, number, number];
  rotation?: number;
  numberLabel?: string;
}

export function Mailbox({ position, rotation = 0 }: MailboxProps) {
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
    </group>
  );
}
