import { Text } from '@react-three/drei';

// Kid-sized backyard playhouse modeled on the real "68" clubhouse: light grey-white
// board walls, two big front windows with a white "68" placard between them, a play
// serving-counter ledge, and a door on the +X side you can walk through (its wall
// colliders are emitted by HeroHouse10600.buildPlayhouseColliders).
export const PLAYHOUSE_W = 3.6;
export const PLAYHOUSE_H = 2.25;
export const PLAYHOUSE_D = 3.0;
const WALL = '#e2e6e9';
const TRIM = '#ffffff';
const ROOFC = '#c9ced2';

function Panel({ x, y, z, w, h, d = 0.1, color = WALL }: { x: number; y: number; z: number; w: number; h: number; d?: number; color?: string }) {
  return (
    <mesh position={[x, y, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function PlayWindow({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh><boxGeometry args={[0.92, 1.0, 0.05]} /><meshStandardMaterial color="#bfe0ef" emissive="#dff0f8" emissiveIntensity={0.35} metalness={0.1} roughness={0.1} /></mesh>
      {/* white frame */}
      <mesh position={[0, 0.52, 0.02]}><boxGeometry args={[1.02, 0.08, 0.06]} /><meshStandardMaterial color={TRIM} /></mesh>
      <mesh position={[0, -0.52, 0.02]}><boxGeometry args={[1.02, 0.08, 0.06]} /><meshStandardMaterial color={TRIM} /></mesh>
      {[-0.51, 0.51].map((dx, i) => <mesh key={i} position={[dx, 0, 0.02]}><boxGeometry args={[0.08, 1.08, 0.06]} /><meshStandardMaterial color={TRIM} /></mesh>)}
      <mesh position={[0, 0, 0.02]}><boxGeometry args={[0.06, 1.0, 0.05]} /><meshStandardMaterial color={TRIM} /></mesh>
    </group>
  );
}

export function Playhouse({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const hw = PLAYHOUSE_W / 2;   // 1.8
  const hd = PLAYHOUSE_D / 2;   // 1.5
  const H = PLAYHOUSE_H;
  const zf = -hd;               // front (faces the deck / -Z)
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Floor pad */}
      <mesh position={[0, 0.06, 0]} receiveShadow><boxGeometry args={[PLAYHOUSE_W + 0.1, 0.12, PLAYHOUSE_D + 0.1]} /><meshStandardMaterial color="#b08458" roughness={0.95} /></mesh>

      {/* ---- FRONT wall (-Z): two windows + "68" placard between ---- */}
      <Panel x={0} y={0.4} z={zf} w={PLAYHOUSE_W} h={0.8} />                 {/* base / counter band */}
      <Panel x={0} y={2.0} z={zf} w={PLAYHOUSE_W} h={0.5} />                 {/* header */}
      <Panel x={-1.575} y={1.3} z={zf} w={0.45} h={0.9} />                  {/* left edge */}
      <Panel x={1.575} y={1.3} z={zf} w={0.45} h={0.9} />                   {/* right edge */}
      <Panel x={0} y={1.3} z={zf} w={0.9} h={0.9} />                        {/* center (placard) */}
      <PlayWindow x={-0.9} y={1.3} z={zf - 0.02} />
      <PlayWindow x={0.9} y={1.3} z={zf - 0.02} />
      {/* "68" white circle placard between the windows (disc faces -Z) */}
      <mesh position={[0, 1.45, zf - 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.33, 0.33, 0.05, 28]} />
        <meshStandardMaterial color="#fbfbf8" roughness={0.7} />
      </mesh>
      <Text position={[0, 1.45, zf - 0.1]} rotation={[0, Math.PI, 0]} fontSize={0.34} color="#3a4654" anchorX="center" anchorY="middle">68</Text>
      {/* Serving counter ledge under the right window */}
      <mesh position={[0.9, 0.82, zf - 0.32]} castShadow receiveShadow><boxGeometry args={[1.15, 0.06, 0.55]} /><meshStandardMaterial color="#d8cbb0" roughness={0.85} /></mesh>

      {/* ---- BACK wall (+Z) ---- */}
      <Panel x={0} y={H / 2} z={hd} w={PLAYHOUSE_W} h={H} />

      {/* ---- LEFT wall (-X): solid ---- */}
      <Panel x={-hw} y={H / 2} z={0} w={PLAYHOUSE_D} h={H} d={0.1} color={WALL} />

      {/* ---- RIGHT wall (+X): door gap at z=-0.45..0.6 ---- */}
      <group rotation={[0, Math.PI / 2, 0]} position={[hw, 0, 0]}>
        {/* now local x runs along the wall (house +Z..-Z); render panels around the door */}
        <Panel x={-1.05} y={H / 2} z={0} w={0.9} h={H} />                   {/* z=1.5..0.6 side */}
        <Panel x={0.95} y={H / 2} z={0} w={1.1} h={H} />                    {/* z=-0.45..-1.5 side */}
        <Panel x={0.05} y={2.05} z={0} w={1.05} h={0.4} />                  {/* header over door */}
      </group>
      {/* the actual door leaf in the +X gap */}
      <mesh position={[hw - 0.02, 0.95, 0.075]} castShadow><boxGeometry args={[0.08, 1.9, 0.95]} /><meshStandardMaterial color="#8a6a4a" roughness={0.7} /></mesh>
      <mesh position={[hw - 0.06, 0.95, -0.25]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#caa14a" metalness={0.7} roughness={0.3} /></mesh>

      {/* ---- Slanted roof ---- */}
      <mesh position={[0, H + 0.12, 0.1]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[PLAYHOUSE_W + 0.35, 0.12, PLAYHOUSE_D + 0.45]} />
        <meshStandardMaterial color={ROOFC} roughness={0.8} />
      </mesh>
      {/* warm interior light so the inside reads when you walk in */}
      <pointLight position={[0, 1.4, 0]} intensity={2.4} distance={5} decay={2} color="#fff2dc" />
    </group>
  );
}
