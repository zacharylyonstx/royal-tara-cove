import { Text } from '@react-three/drei';
import { GARDEN_HOMES, HOME_W, HOME_D, HOME_H } from '../../world/acrossBlvd';

/**
 * The Casitas garden homes — the dense rows of small homes lining Casitas Dr
 * straight across from Royal Tara Cove (real geography). Deliberately simpler
 * than the main-street houses: facade-only charm, one collider box each
 * (registered in buildAcrossBlvdColliders). One of them really is the
 * neighborhood's Little Twist home bakery.
 */
export function CasitasHomes() {
  return (
    <>
      {GARDEN_HOMES.map((h, i) => (
        <GardenHome key={i} x={h.x} z={h.z} faceYaw={h.faceYaw} body={h.body} roof={h.roof} bakery={h.bakery} />
      ))}
    </>
  );
}

function GardenHome({ x, z, faceYaw, body, roof, bakery }: {
  x: number; z: number; faceYaw: number; body: string; roof: string; bakery?: boolean;
}) {
  return (
    // Group yaw turns the facade (door/windows at local +Z) toward the street.
    <group position={[x, 0, z]} rotation={[0, faceYaw, 0]}>
      {/* Body */}
      <mesh position={[0, HOME_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[HOME_W, HOME_H, HOME_D]} />
        <meshStandardMaterial color={body} roughness={0.95} />
      </mesh>
      {/* Hipped-ish roof: a low 4-sided pyramid. */}
      <mesh position={[0, HOME_H + 0.75, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.hypot(HOME_W, HOME_D) / 2 + 0.3, 1.5, 4]} />
        <meshStandardMaterial color={roof} roughness={0.9} flatShading />
      </mesh>
      {/* Door (facade = local +Z) */}
      <mesh position={[-1.1, 1.0, HOME_D / 2 + 0.02]}>
        <planeGeometry args={[0.95, 2.0]} />
        <meshStandardMaterial color="#5a4632" roughness={0.8} />
      </mesh>
      {/* Windows */}
      {[0.7, 2.1].map((wx) => (
        <mesh key={wx} position={[wx, 1.5, HOME_D / 2 + 0.02]}>
          <planeGeometry args={[1.0, 1.0]} />
          <meshStandardMaterial color="#bfd8e8" roughness={0.25} metalness={0.2} />
        </mesh>
      ))}
      {/* Stoop */}
      <mesh position={[-1.1, 0.08, HOME_D / 2 + 0.55]} receiveShadow>
        <boxGeometry args={[1.4, 0.16, 1.1]} />
        <meshStandardMaterial color="#c9bda2" roughness={1} />
      </mesh>
      {bakery && (
        <>
          {/* The real-life Little Twist neighborhood home bakery. */}
          <mesh position={[0, 2.62, HOME_D / 2 + 0.04]}>
            <boxGeometry args={[3.6, 0.62, 0.08]} />
            <meshStandardMaterial color="#b86a8e" roughness={0.7} />
          </mesh>
          <Text position={[0, 2.72, HOME_D / 2 + 0.1]} fontSize={0.26} color="#fff6ea" anchorX="center" anchorY="middle" letterSpacing={0.05}>
            LITTLE TWIST BAKERY
          </Text>
          <Text position={[0, 2.46, HOME_D / 2 + 0.1]} fontSize={0.13} color="#ffe8f2" anchorX="center" anchorY="middle" letterSpacing={0.12}>
            NEIGHBORHOOD HOME BAKERY
          </Text>
        </>
      )}
    </group>
  );
}
