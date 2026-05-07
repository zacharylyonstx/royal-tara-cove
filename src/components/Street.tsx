import { STREET_RADIUS, SIDEWALK_WIDTH } from '../world/streetLayout';

// The cul-de-sac itself: pavement disc + sidewalk ring + a short stub of the
// entry road heading south (the way the road connects back to the main street).
export function Street() {
  return (
    <group>
      {/* Cul-de-sac bulb pavement */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[STREET_RADIUS, 64]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>

      {/* Sidewalk ring around the bulb */}
      <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[STREET_RADIUS, STREET_RADIUS + SIDEWALK_WIDTH, 64]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>

      {/* Short entry road extending south (toward the main road, off-screen) */}
      <mesh position={[0, 0.01, 30]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 30]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>
      <mesh position={[-8, 0.013, 30]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2, 30]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>
      <mesh position={[8, 0.013, 30]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2, 30]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>
      {/* Yellow center line on the entry road */}
      <mesh position={[0, 0.012, 30]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.18, 28]} />
        <meshStandardMaterial color="#f0d040" />
      </mesh>

      {/* "Royal Tara Cv" street sign at the entry */}
      <group position={[5, 0, 44]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 2.8, 6]} />
          <meshStandardMaterial color="#2c2c2c" />
        </mesh>
        <mesh position={[0, 2.7, 0]} castShadow>
          <boxGeometry args={[2.6, 0.5, 0.06]} />
          <meshStandardMaterial color="#2a5d8f" />
        </mesh>
      </group>
    </group>
  );
}
