import type { RefObject } from 'react';
import type { Group } from 'three';
import type { CharacterDef } from '../types';
import type { Appearance } from '../world/wardrobe';
import { getItem } from '../world/wardrobe';

// Presentational, appearance-driven character mesh — shared by the in-world
// Character (which adds the animation rig + position) and the dress-up preview.
// Limbs are hip/shoulder-pivoted GROUPS exposed via `rig` refs so clothing swings
// with them and the animation pivots naturally. Purely visual: collision is a
// fixed PLAYER_RADIUS elsewhere, so nothing here affects gameplay.

export interface CharRig {
  leftLeg: RefObject<Group | null>;
  rightLeg: RefObject<Group | null>;
  leftArm: RefObject<Group | null>;
  rightArm: RefObject<Group | null>;
  torso: RefObject<Group | null>;
}

export function charDims(h: number) {
  const headR = h * 0.135;
  const neckH = h * 0.05;
  const torsoH = h * 0.34;
  const legsH = h * 0.42;
  const armH = h * 0.32;
  return {
    h, headR, neckH, torsoH, legsH, armH,
    legW: h * 0.095,
    armW: h * 0.072,
    torsoW: h * 0.28,
    torsoD: h * 0.17,
    hipX: h * 0.075,
    shoulderX: h * 0.165,
    torsoY: legsH + torsoH / 2,
    shoulderY: legsH + torsoH - h * 0.02,
    headY: legsH + torsoH + neckH + headR * 0.92,
  };
}

const SKIN_ROUGH = 0.62;

export function CharacterModel({ def, appearance, rig }: { def: CharacterDef; appearance: Appearance; rig?: CharRig }) {
  const d = charDims(def.height);
  const skin = def.skinTone;
  const topKind = getItem('top', appearance.top.item).kind;
  const topColor = appearance.top.color;
  const botKind = getItem('bottom', appearance.bottom.item).kind;
  const botColor = appearance.bottom.color;
  const shoeKind = getItem('shoes', appearance.shoes.item).kind;
  const shoeColor = appearance.shoes.color;
  const hairKind = getItem('hair', appearance.hair.item).kind;
  const hairColor = appearance.hair.color;
  const hatKind = getItem('hat', appearance.hat.item).kind;
  const hatColor = appearance.hat.color;
  const accKind = getItem('accessory', appearance.accessory.item).kind;
  const accColor = appearance.accessory.color;

  const sleeve = topSleeve(topKind); // 'none' | 'short' | 'long'
  const hasSkirt = topKind === 'dress' || botKind === 'skirt';
  const skirtColor = topKind === 'dress' ? topColor : botColor;
  const isDad = def.id === 'dad';

  return (
    <group>
      {/* ---- Legs (hip-pivoted groups) ---- */}
      <group ref={rig?.leftLeg} position={[-d.hipX, d.legsH, 0]}>
        <Leg d={d} skin={skin} botKind={botKind} botColor={botColor} shoeKind={shoeKind} shoeColor={shoeColor} />
      </group>
      <group ref={rig?.rightLeg} position={[d.hipX, d.legsH, 0]}>
        <Leg d={d} skin={skin} botKind={botKind} botColor={botColor} shoeKind={shoeKind} shoeColor={shoeColor} />
      </group>

      {/* Skirt / dress flare over the hips (single cone spanning both legs) */}
      {hasSkirt && (
        <mesh position={[0, d.legsH + d.h * 0.02, 0]} castShadow>
          <coneGeometry args={[d.torsoW * 0.95, d.h * 0.22, 16, 1, true]} />
          <meshStandardMaterial color={skirtColor} roughness={0.78} side={2} />
        </mesh>
      )}

      {/* ---- Torso (bob group) ---- */}
      <group ref={rig?.torso} position={[0, d.torsoY, 0]}>
        <Torso d={d} skin={skin} topKind={topKind} topColor={topColor} />
        {/* cape / backpack ride the torso */}
        {accKind === 'cape' && (
          <mesh position={[0, d.torsoH * 0.1, -d.torsoD * 0.6]} rotation={[0.12, 0, 0]} castShadow>
            <planeGeometry args={[d.torsoW * 1.25, d.torsoH * 1.7]} />
            <meshStandardMaterial color={accColor} roughness={0.7} side={2} />
          </mesh>
        )}
        {accKind === 'wings' && <Wings d={d} color={accColor} />}
        {accKind === 'backpack' && (
          <mesh position={[0, 0, -d.torsoD * 0.62]} castShadow>
            <boxGeometry args={[d.torsoW * 0.7, d.torsoH * 0.7, d.torsoD * 0.6]} />
            <meshStandardMaterial color={accColor} roughness={0.7} />
          </mesh>
        )}
      </group>

      {/* ---- Arms (shoulder-pivoted groups) ---- */}
      <group ref={rig?.leftArm} position={[-d.shoulderX, d.shoulderY, 0]}>
        <Arm d={d} skin={skin} sleeve={sleeve} topColor={topColor} />
      </group>
      <group ref={rig?.rightArm} position={[d.shoulderX, d.shoulderY, 0]}>
        <Arm d={d} skin={skin} sleeve={sleeve} topColor={topColor} />
      </group>

      {/* ---- Neck + head + face ---- */}
      <mesh position={[0, d.legsH + d.torsoH + d.neckH * 0.4, 0]} castShadow>
        <cylinderGeometry args={[d.h * 0.045, d.h * 0.05, d.neckH, 10]} />
        <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
      </mesh>
      <group position={[0, d.headY, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[d.headR, 22, 18]} />
          <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
        </mesh>
        <Face d={d} />
        {isDad && <Beard d={d} color="#6b4226" />}
        <Hair kind={hairKind} color={hairColor} d={d} />
        {(accKind === 'glasses' || accKind === 'sunglasses') && (
          <Glasses d={d} color={accColor} shaded={accKind === 'sunglasses'} />
        )}
        {accKind === 'bandana' && (
          <mesh position={[0, d.headR * 0.55, 0]} castShadow>
            <cylinderGeometry args={[d.headR * 1.04, d.headR * 1.04, d.headR * 0.5, 18, 1, true]} />
            <meshStandardMaterial color={accColor} roughness={0.8} side={2} />
          </mesh>
        )}
        <Hat kind={hatKind} color={hatColor} d={d} />
      </group>
    </group>
  );
}

function topSleeve(kind: string): 'none' | 'short' | 'long' {
  if (kind === 'tank' || kind === 'dress') return 'none';
  if (kind === 'hoodie' || kind === 'longsleeve' || kind === 'plaid') return 'long';
  return 'short';
}

function Leg({ d, skin, botKind, botColor, shoeKind, shoeColor }: {
  d: ReturnType<typeof charDims>; skin: string; botKind: string; botColor: string; shoeKind: string; shoeColor: string;
}) {
  const legH = d.legsH;
  const full = botKind === 'jeans' || botKind === 'leggings' || botKind === 'cargo' || botKind === 'athletic';
  const bare = botKind === 'skirt';
  const coverColor = bare ? skin : botColor;
  // For shorts: upper half covered, lower half skin.
  return (
    <group>
      {full || bare ? (
        <mesh position={[0, -legH / 2, 0]} castShadow>
          <cylinderGeometry args={[d.legW * 0.5, d.legW * 0.42, legH * 0.96, 12]} />
          <meshStandardMaterial color={coverColor} roughness={bare ? SKIN_ROUGH : 0.85} />
        </mesh>
      ) : (
        <>
          <mesh position={[0, -legH * 0.28, 0]} castShadow>
            <cylinderGeometry args={[d.legW * 0.52, d.legW * 0.48, legH * 0.5, 12]} />
            <meshStandardMaterial color={botColor} roughness={0.85} />
          </mesh>
          <mesh position={[0, -legH * 0.74, 0]} castShadow>
            <cylinderGeometry args={[d.legW * 0.42, d.legW * 0.38, legH * 0.5, 12]} />
            <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
          </mesh>
        </>
      )}
      {botKind === 'cargo' && (
        <mesh position={[d.legW * 0.45, -legH * 0.5, 0]} castShadow>
          <boxGeometry args={[d.legW * 0.3, legH * 0.18, d.legW * 0.6]} />
          <meshStandardMaterial color={botColor} roughness={0.85} />
        </mesh>
      )}
      <Shoe d={d} kind={shoeKind} color={shoeColor} y={-legH} />
    </group>
  );
}

function Shoe({ d, kind, color, y }: { d: ReturnType<typeof charDims>; kind: string; color: string; y: number }) {
  const w = d.legW * 1.05;
  const fwd = d.h * 0.05;
  if (kind === 'sandals') {
    return (
      <mesh position={[0, y + 0.015, fwd * 0.6]} castShadow>
        <boxGeometry args={[w, d.h * 0.018, d.h * 0.14]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    );
  }
  const high = kind === 'hightops' || kind === 'boots';
  return (
    <group position={[0, y, 0]}>
      {/* sole */}
      <mesh position={[0, d.h * 0.012, fwd * 0.5]} castShadow>
        <boxGeometry args={[w, d.h * 0.03, d.h * 0.17]} />
        <meshStandardMaterial color={kind === 'boots' ? '#2b2b2b' : '#f3f1ea'} roughness={0.6} />
      </mesh>
      {/* upper */}
      <mesh position={[0, d.h * 0.045, fwd * 0.35]} castShadow>
        <boxGeometry args={[w * 0.95, d.h * 0.05, d.h * 0.13]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
      </mesh>
      {high && (
        <mesh position={[0, d.h * 0.085, -d.h * 0.01]} castShadow>
          <boxGeometry args={[w * 0.92, d.h * 0.06, d.h * 0.08]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
      )}
      {kind === 'cleats' && (
        <mesh position={[0, d.h * 0.0, fwd * 0.5]}>
          <boxGeometry args={[w * 0.9, d.h * 0.01, d.h * 0.15]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      )}
    </group>
  );
}

function Torso({ d, skin, topKind, topColor }: { d: ReturnType<typeof charDims>; skin: string; topKind: string; topColor: string }) {
  const covered = topKind !== 'none';
  const color = covered ? topColor : skin;
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[d.torsoW, d.torsoH, d.torsoD]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* shoulders/edges rounded a touch */}
      <mesh position={[0, d.torsoH * 0.45, 0]} castShadow>
        <boxGeometry args={[d.torsoW * 1.02, d.torsoH * 0.12, d.torsoD * 1.02]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {topKind === 'hoodie' && (
        <mesh position={[0, d.torsoH * 0.5, -d.torsoD * 0.3]} castShadow>
          <sphereGeometry args={[d.torsoW * 0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color={topColor} roughness={0.8} />
        </mesh>
      )}
      {topKind === 'jersey' && (
        <mesh position={[0, d.torsoH * 0.05, d.torsoD * 0.51]}>
          <circleGeometry args={[d.torsoW * 0.22, 16]} />
          <meshStandardMaterial color="#f6f2e8" roughness={0.8} />
        </mesh>
      )}
      {topKind === 'stripe' && [0.22, 0.0, -0.22].map((yy, i) => (
        <mesh key={i} position={[0, d.torsoH * yy, d.torsoD * 0.51]}>
          <planeGeometry args={[d.torsoW, d.torsoH * 0.12]} />
          <meshStandardMaterial color="#f6f2e8" roughness={0.85} />
        </mesh>
      ))}
      {topKind === 'plaid' && (
        <mesh position={[0, 0, d.torsoD * 0.51]}>
          <planeGeometry args={[d.torsoW * 0.16, d.torsoH]} />
          <meshStandardMaterial color="#2c2f3a" roughness={0.85} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function Arm({ d, skin, sleeve, topColor }: { d: ReturnType<typeof charDims>; skin: string; sleeve: 'none' | 'short' | 'long'; topColor: string }) {
  const armH = d.armH;
  const handY = -armH - d.h * 0.01;
  return (
    <group>
      {/* sleeve */}
      {sleeve !== 'none' && (
        <mesh position={[0, sleeve === 'long' ? -armH * 0.5 : -armH * 0.22, 0]} castShadow>
          <cylinderGeometry args={[d.armW * 0.62, d.armW * 0.55, sleeve === 'long' ? armH * 0.95 : armH * 0.42, 10]} />
          <meshStandardMaterial color={topColor} roughness={0.82} />
        </mesh>
      )}
      {/* bare arm (shown below short/none sleeve) */}
      <mesh position={[0, -armH * 0.62, 0]} castShadow>
        <cylinderGeometry args={[d.armW * 0.46, d.armW * 0.42, armH * (sleeve === 'long' ? 0.2 : 0.78), 10]} />
        <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
      </mesh>
      {/* hand */}
      <mesh position={[0, handY, 0]} castShadow>
        <sphereGeometry args={[d.armW * 0.62, 10, 10]} />
        <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
      </mesh>
    </group>
  );
}

function Face({ d }: { d: ReturnType<typeof charDims> }) {
  const r = d.headR;
  return (
    <group>
      {/* eye whites + pupils */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * r * 0.34, r * 0.08, r * 0.86]}>
          <mesh>
            <sphereGeometry args={[r * 0.17, 12, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, r * 0.1]}>
            <sphereGeometry args={[r * 0.09, 10, 10]} />
            <meshStandardMaterial color="#2a1d12" roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* smile */}
      <mesh position={[0, -r * 0.34, r * 0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r * 0.28, r * 0.045, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#c1604a" roughness={0.6} />
      </mesh>
      {/* rosy cheeks */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 0.5, -r * 0.12, r * 0.78]}>
          <sphereGeometry args={[r * 0.13, 8, 8]} />
          <meshStandardMaterial color="#f2a3a0" transparent opacity={0.5} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Beard({ d, color }: { d: ReturnType<typeof charDims>; color: string }) {
  const r = d.headR;
  return (
    <mesh position={[0, -r * 0.45, r * 0.42]} castShadow>
      <sphereGeometry args={[r * 0.82, 16, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55]} />
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  );
}

function Hair({ kind, color, d }: { kind: string; color: string; d: ReturnType<typeof charDims> }) {
  const r = d.headR;
  const mat = <meshStandardMaterial color={color} roughness={0.85} />;
  if (kind === 'buzz') {
    return (
      <mesh position={[0, r * 0.18, -r * 0.04]} castShadow>
        <sphereGeometry args={[r * 1.01, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        {mat}
      </mesh>
    );
  }
  const cap = (
    <mesh position={[0, r * 0.2, -r * 0.05]} castShadow>
      <sphereGeometry args={[r * 1.08, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
      {mat}
    </mesh>
  );
  if (kind === 'short' || kind === 'tousled') {
    return (
      <group>
        {cap}
        {kind === 'tousled' && [-0.4, 0.1, 0.5].map((x, i) => (
          <mesh key={i} position={[x * r, r * 0.95, -r * 0.1]} rotation={[0.3, 0, x]} castShadow>
            <coneGeometry args={[r * 0.18, r * 0.4, 6]} />
            {mat}
          </mesh>
        ))}
        {/* short back fringe */}
        <mesh position={[0, r * 0.45, -r * 0.6]} castShadow>
          <sphereGeometry args={[r * 0.7, 12, 10]} />
          {mat}
        </mesh>
      </group>
    );
  }
  if (kind === 'curly') {
    return (
      <group>
        {cap}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * r * 0.85, r * 0.55 + Math.sin(i) * r * 0.2, Math.sin(a) * r * 0.85 - r * 0.1]} castShadow>
              <sphereGeometry args={[r * 0.34, 8, 8]} />
              {mat}
            </mesh>
          );
        })}
      </group>
    );
  }
  if (kind === 'long') {
    return (
      <group>
        {cap}
        {/* hair falling down the back + sides */}
        <mesh position={[0, -r * 0.2, -r * 0.55]} castShadow>
          <boxGeometry args={[r * 1.7, r * 2.6, r * 0.55]} />
          {mat}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * r * 0.95, -r * 0.1, r * 0.05]} castShadow>
            <boxGeometry args={[r * 0.4, r * 2.0, r * 0.7]} />
            {mat}
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === 'ponytail') {
    return (
      <group>
        {cap}
        <mesh position={[0, r * 0.2, -r * 1.0]} rotation={[0.5, 0, 0]} castShadow>
          <cylinderGeometry args={[r * 0.28, r * 0.16, r * 1.8, 10]} />
          {mat}
        </mesh>
        <mesh position={[0, r * 0.7, -r * 0.7]} castShadow>
          <sphereGeometry args={[r * 0.22, 8, 8]} />
          <meshStandardMaterial color="#e26aa1" roughness={0.7} />
        </mesh>
      </group>
    );
  }
  if (kind === 'bun') {
    return (
      <group>
        {cap}
        <mesh position={[0, r * 1.15, -r * 0.1]} castShadow>
          <sphereGeometry args={[r * 0.5, 12, 12]} />
          {mat}
        </mesh>
      </group>
    );
  }
  return cap;
}

function Hat({ kind, color, d }: { kind: string; color: string; d: ReturnType<typeof charDims> }) {
  const r = d.headR;
  if (kind === 'none') return null;
  if (kind === 'cap') {
    return (
      <group position={[0, r * 0.7, 0]}>
        <mesh castShadow><sphereGeometry args={[r * 1.04, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
        <mesh position={[0, -r * 0.02, r * 0.95]} castShadow><boxGeometry args={[r * 1.3, r * 0.1, r * 0.9]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      </group>
    );
  }
  if (kind === 'beanie') {
    return (
      <mesh position={[0, r * 0.55, 0]} castShadow>
        <sphereGeometry args={[r * 1.1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    );
  }
  if (kind === 'cowboy') {
    return (
      <group position={[0, r * 0.75, 0]}>
        <mesh castShadow><cylinderGeometry args={[r * 1.7, r * 1.8, r * 0.08, 20]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>
        <mesh position={[0, r * 0.32, 0]} castShadow><cylinderGeometry args={[r * 0.78, r * 0.9, r * 0.66, 16]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>
      </group>
    );
  }
  if (kind === 'crown') {
    return (
      <group position={[0, r * 0.92, 0]}>
        <mesh castShadow><cylinderGeometry args={[r * 0.95, r * 0.95, r * 0.4, 12, 1, true]} /><meshStandardMaterial color={color} roughness={0.3} metalness={0.6} /></mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return <mesh key={i} position={[Math.cos(a) * r * 0.95, r * 0.3, Math.sin(a) * r * 0.95]} castShadow><coneGeometry args={[r * 0.14, r * 0.3, 6]} /><meshStandardMaterial color={color} roughness={0.3} metalness={0.6} /></mesh>;
        })}
      </group>
    );
  }
  if (kind === 'headband') {
    return <mesh position={[0, r * 0.55, 0]} castShadow><cylinderGeometry args={[r * 1.06, r * 1.06, r * 0.3, 18, 1, true]} /><meshStandardMaterial color={color} roughness={0.7} side={2} /></mesh>;
  }
  if (kind === 'party') {
    return <mesh position={[0, r * 1.3, 0]} castShadow><coneGeometry args={[r * 0.6, r * 1.3, 16]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>;
  }
  if (kind === 'bow') {
    return (
      <group position={[r * 0.7, r * 0.85, 0]}>
        {[-1, 1].map((s) => <mesh key={s} position={[s * r * 0.28, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]} castShadow><coneGeometry args={[r * 0.26, r * 0.5, 4]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>)}
        <mesh castShadow><sphereGeometry args={[r * 0.13, 8, 8]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
      </group>
    );
  }
  return null;
}

function Glasses({ d, color, shaded }: { d: ReturnType<typeof charDims>; color: string; shaded: boolean }) {
  const r = d.headR;
  return (
    <group position={[0, r * 0.08, r * 0.9]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 0.34, 0, 0]}>
          <torusGeometry args={[r * 0.2, r * 0.04, 8, 16]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {shaded && [-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 0.34, 0, -r * 0.02]}>
          <circleGeometry args={[r * 0.2, 16]} />
          <meshStandardMaterial color={color} roughness={0.2} metalness={0.4} transparent opacity={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0]}><boxGeometry args={[r * 0.28, r * 0.04, r * 0.04]} /><meshStandardMaterial color={color} roughness={0.4} metalness={0.3} /></mesh>
    </group>
  );
}

function Wings({ d, color }: { d: ReturnType<typeof charDims>; color: string }) {
  return (
    <group position={[0, d.torsoH * 0.1, -d.torsoD * 0.55]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * d.torsoW * 0.45, 0, 0]} rotation={[0, s * 0.5, 0]} castShadow>
          <sphereGeometry args={[d.torsoH * 0.5, 10, 10]} />
          <meshStandardMaterial color={color} roughness={0.5} transparent opacity={0.85} side={2} />
        </mesh>
      ))}
    </group>
  );
}
