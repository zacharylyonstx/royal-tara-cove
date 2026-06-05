import { useMemo } from 'react';
import type { RealLook } from '../world/realLooks';

// Procedural, tintable cosmetics that LAYER onto the photo-real avatar. Rendered
// inside the GLB's animated group (so they bounce/lean with the body) using
// model-space anchors derived from the GLB bounding box. Keeps the real face +
// figure; adds Roblox-style trendy hair / headwear / eyewear / back items in any
// colour. No skeleton needed (the avatar has no working rig).

export interface CosmeticAnchors {
  /** Head radius (model units). */
  R: number;
  /** Head centre (model units). */
  cx: number; cy: number; cz: number;
  /** Shoulder height (model units). */
  shoulderY: number;
}

// +Z is the avatar's face side in the model's LOCAL frame (verified visually in
// the wardrobe preview); −Z is the back.
const FACE = 1; // multiply by R for the face side
const BACK = -1;

function mat(color: string, opts?: { rough?: number; metal?: number; emissive?: string; emi?: number; opacity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={opts?.rough ?? 0.55}
      metalness={opts?.metal ?? 0}
      emissive={opts?.emissive ?? '#000000'}
      emissiveIntensity={opts?.emi ?? 0}
      transparent={opts?.opacity !== undefined}
      opacity={opts?.opacity ?? 1}
    />
  );
}

/** Stylized helmet hair-cap covering the crown/sides/back down to the hairline
 *  (Roblox/Lego style), centred, leaving the face open below the brow. */
function Cap({ R, color, lift = 0.08, theta = 1.7, rscale = 1.16 }: { R: number; color: string; lift?: number; theta?: number; rscale?: number }) {
  return (
    <mesh position={[0, R * lift, R * 0.02]} castShadow>
      <sphereGeometry args={[R * rscale, 22, 18, 0, Math.PI * 2, 0, theta]} />
      {mat(color, { rough: 0.5 })}
    </mesh>
  );
}

function Hair({ style, color, R }: { style: string; color: string; R: number }) {
  if (style === 'none' || !style) return null;
  switch (style) {
    case 'swoop':
      return (
        <group>
          <Cap R={R} color={color} />
          {/* side-swept fringe across the forehead */}
          <mesh position={[R * 0.18, R * 0.2, FACE * R * 0.92]} rotation={[0.5, 0, -0.25]} castShadow scale={[1.5, 0.45, 0.6]}>
            <sphereGeometry args={[R * 0.62, 16, 12]} />
            {mat(color, { rough: 0.5 })}
          </mesh>
        </group>
      );
    case 'spikes':
      return (
        <group>
          <Cap R={R} color={color} theta={1.3} />
          {[[0, 0.0], [0.5, 0.3], [-0.5, 0.3], [0.3, -0.4], [-0.3, -0.4], [0.0, 0.5]].map(([sx, sz], i) => (
            <mesh key={i} position={[sx * R, R * (0.95 + Math.abs(sx) * 0.1), sz * R]} rotation={[sz * 0.7, 0, -sx * 0.7]} castShadow>
              <coneGeometry args={[R * 0.18, R * 0.7, 6]} />
              {mat(color, { rough: 0.45 })}
            </mesh>
          ))}
        </group>
      );
    case 'long':
      return (
        <group>
          <Cap R={R} color={color} theta={1.7} />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * R * 0.78, -R * 0.55, R * 0.15]} rotation={[0.1, 0, s * 0.06]} castShadow scale={[0.55, 1, 0.7]}>
              <capsuleGeometry args={[R * 0.42, R * 2.0, 6, 10]} />
              {mat(color, { rough: 0.5 })}
            </mesh>
          ))}
          <mesh position={[0, -R * 0.5, BACK * R * 0.6]} rotation={[0.15, 0, 0]} castShadow scale={[1.1, 1, 0.5]}>
            <capsuleGeometry args={[R * 0.55, R * 1.9, 6, 10]} />
            {mat(color, { rough: 0.5 })}
          </mesh>
        </group>
      );
    case 'buns':
      return (
        <group>
          <Cap R={R} color={color} />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * R * 0.85, R * 1.0, R * 0.05]} castShadow>
              <sphereGeometry args={[R * 0.5, 14, 12]} />
              {mat(color, { rough: 0.5 })}
            </mesh>
          ))}
        </group>
      );
    case 'mohawk':
      return (
        <group>
          <Cap R={R} color={color} theta={1.15} rscale={1.02} />
          {[-0.55, -0.25, 0.05, 0.35, 0.65].map((z, i) => (
            <mesh key={i} position={[0, R * (1.05 + (0.18 - Math.abs(z) * 0.18)), z * R]} castShadow>
              <coneGeometry args={[R * 0.16, R * (0.7 + (0.25 - Math.abs(z) * 0.3)), 4]} />
              {mat(color, { rough: 0.45 })}
            </mesh>
          ))}
        </group>
      );
    case 'ponytail':
      return (
        <group>
          <Cap R={R} color={color} />
          <mesh position={[0, R * 0.7, BACK * R * 0.95]} rotation={[0.9, 0, 0]} castShadow scale={[0.7, 1, 0.7]}>
            <capsuleGeometry args={[R * 0.34, R * 1.7, 6, 10]} />
            {mat(color, { rough: 0.5 })}
          </mesh>
          <mesh position={[0, R * 1.02, BACK * R * 0.55]} castShadow>
            <torusGeometry args={[R * 0.3, R * 0.1, 8, 16]} />
            {mat('#1a1a1a', { rough: 0.6 })}
          </mesh>
        </group>
      );
    case 'puffs':
      return (
        <group>
          <Cap R={R} color={color} />
          {[-1, 1].map((s) => (
            <group key={s}>
              {[[0, 0], [0.35, 0.2], [-0.2, 0.3], [0.1, -0.3]].map(([ox, oz], i) => (
                <mesh key={i} position={[s * R * (1.0 + ox * 0.2), R * (0.6 + oz * 0.2), oz * R * 0.3]} castShadow>
                  <sphereGeometry args={[R * 0.42, 12, 10]} />
                  {mat(color, { rough: 0.7 })}
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    default:
      return <Cap R={R} color={color} />;
  }
}

function Headwear({ style, color, R }: { style: string; color: string; R: number }) {
  if (style === 'none' || !style) return null;
  switch (style) {
    case 'beanie':
      return (
        <group>
          <mesh position={[0, R * 0.2, 0]} castShadow>
            <sphereGeometry args={[R * 1.12, 18, 14, 0, Math.PI * 2, 0, 1.7]} />
            {mat(color, { rough: 0.8 })}
          </mesh>
          <mesh position={[0, R * 0.3, 0]} castShadow>
            <torusGeometry args={[R * 1.05, R * 0.16, 10, 24]} />
            {mat(color, { rough: 0.85 })}
          </mesh>
        </group>
      );
    case 'cap':
      return (
        <group>
          <mesh position={[0, R * 0.35, R * 0.05]} castShadow>
            <sphereGeometry args={[R * 1.08, 18, 14, 0, Math.PI * 2, 0, 1.4]} />
            {mat(color, { rough: 0.6 })}
          </mesh>
          {/* bill */}
          <mesh position={[0, R * 0.45, FACE * R * 1.05]} rotation={[-0.25, 0, 0]} castShadow scale={[1, 0.18, 1]}>
            <cylinderGeometry args={[R * 0.95, R * 0.95, R * 1.1, 16, 1, false, 0, Math.PI]} />
            {mat(color, { rough: 0.6 })}
          </mesh>
        </group>
      );
    case 'headband':
      return (
        <mesh position={[0, R * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[R * 1.02, R * 0.13, 8, 24]} />
          {mat(color, { rough: 0.5 })}
        </mesh>
      );
    case 'halo':
      return (
        <mesh position={[0, R * 1.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R * 0.8, R * 0.1, 10, 28]} />
          {mat(color, { emissive: color, emi: 1.4, rough: 0.3 })}
        </mesh>
      );
    case 'catears':
      return (
        <group>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * R * 0.6, R * 1.05, R * 0.05]} rotation={[0, 0, -s * 0.25]} castShadow>
              <coneGeometry args={[R * 0.3, R * 0.6, 4]} />
              {mat(color, { rough: 0.6 })}
            </mesh>
          ))}
        </group>
      );
    case 'crown':
      return (
        <group position={[0, R * 0.85, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[R * 0.95, R * 0.12, 8, 20]} />
            {mat(color, { metal: 0.6, rough: 0.3, emissive: color, emi: 0.2 })}
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const ang = (i / 5) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(ang) * R * 0.95, R * 0.28, Math.sin(ang) * R * 0.95]} castShadow>
                <coneGeometry args={[R * 0.14, R * 0.45, 4]} />
                {mat(color, { metal: 0.6, rough: 0.3, emissive: color, emi: 0.2 })}
              </mesh>
            );
          })}
        </group>
      );
    default:
      return null;
  }
}

function Face({ style, color, R }: { style: string; color: string; R: number }) {
  if (style === 'none' || !style) return null;
  const eyeY = -R * 0.28; // eyes sit below head centre
  const z = FACE * R * 0.96;
  if (style === 'visor') {
    return (
      <mesh position={[0, eyeY, z]} rotation={[0, 0, 0]} castShadow scale={[1.15, 0.5, 0.5]}>
        <sphereGeometry args={[R * 0.9, 16, 12, -1.2, 2.4, 0.6, 1.0]} />
        {mat(color, { rough: 0.15, metal: 0.4, emissive: color, emi: 0.25, opacity: 0.92 })}
      </mesh>
    );
  }
  const dark = style === 'shades';
  return (
    <group position={[0, eyeY, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * R * 0.32, 0, z]} castShadow scale={[1, 0.85, 0.35]}>
          <sphereGeometry args={[R * 0.3, 14, 12]} />
          {mat(color, { rough: dark ? 0.15 : 0.3, metal: dark ? 0.5 : 0.1, opacity: dark ? 1 : 0.55, emissive: color, emi: dark ? 0.15 : 0 })}
        </mesh>
      ))}
      {/* bridge */}
      <mesh position={[0, R * 0.05, z]} castShadow>
        <boxGeometry args={[R * 0.28, R * 0.07, R * 0.07]} />
        {mat(color, { rough: 0.3 })}
      </mesh>
      {/* short temple stubs hugging the sides of the face */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * R * 0.6, R * 0.05, FACE * R * 0.55]} rotation={[0, FACE * s * 0.5, 0]} castShadow>
          <boxGeometry args={[R * 0.07, R * 0.07, R * 0.5]} />
          {mat(color, { rough: 0.3 })}
        </mesh>
      ))}
    </group>
  );
}

function Back({ style, color, R, shoulderY, cy }: { style: string; color: string; R: number; shoulderY: number; cy: number }) {
  if (style === 'none' || !style) return null;
  const backZ = BACK * R * 1.1;
  const midY = (shoulderY + (cy - R)) / 2; // upper-back height
  if (style === 'wings') {
    return (
      <group position={[0, midY + R * 0.6, backZ]}>
        {[-1, 1].map((s) => (
          <group key={s} rotation={[0, s * -0.5, s * 0.3]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[s * R * (0.6 + i * 0.5), R * (0.4 - i * 0.25), 0]} rotation={[0, 0, s * (0.6 - i * 0.15)]} castShadow scale={[1, 1, 0.18]}>
                <coneGeometry args={[R * (0.5 - i * 0.08), R * (1.6 - i * 0.25), 5]} />
                {mat(color, { rough: 0.5, emissive: color, emi: 0.1 })}
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }
  if (style === 'cape') {
    return (
      <mesh position={[0, midY - R * 0.4, backZ * 0.7]} rotation={[0.1, 0, 0]} castShadow scale={[1, 1, 1]}>
        <boxGeometry args={[R * 2.0, R * 4.0, R * 0.12]} />
        {mat(color, { rough: 0.7 })}
      </mesh>
    );
  }
  if (style === 'backpack') {
    return (
      <group position={[0, midY, backZ * 0.7]}>
        <mesh castShadow>
          <boxGeometry args={[R * 1.5, R * 2.0, R * 0.7]} />
          {mat(color, { rough: 0.6 })}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * R * 0.5, R * 0.4, FACE * R * 0.9]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[R * 0.22, R * 1.8, R * 0.18]} />
            {mat(color, { rough: 0.6 })}
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}

export function AvatarCosmetics({ look, a }: { look: RealLook; a: CosmeticAnchors }) {
  const empty = useMemo(
    () => look.hair.item === 'none' && look.headwear.item === 'none' && look.face.item === 'none' && look.back.item === 'none',
    [look],
  );
  if (empty) return null;
  return (
    <group position={[a.cx, a.cy, a.cz]}>
      <Hair style={look.hair.item} color={look.hair.color || '#5a3216'} R={a.R} />
      <Headwear style={look.headwear.item} color={look.headwear.color || '#1a1a1a'} R={a.R} />
      <Face style={look.face.item} color={look.face.color || '#1a1a1a'} R={a.R} />
      <Back style={look.back.item} color={look.back.color || '#ffffff'} R={a.R} shoulderY={a.shoulderY - a.cy} cy={0} />
    </group>
  );
}
