import type { RefObject } from 'react';
import type { Group } from 'three';
import type { CharacterDef } from '../types';
import type { Appearance } from '../world/wardrobe';
import { getItem } from '../world/wardrobe';

// Presentational, appearance-driven character mesh — shared by the in-world
// Character (which adds the animation rig + position) and the dress-up preview.
// Stylized but shaped: tapered oval body, rounded shoulders, tapered limbs,
// clothing with collars/cuffs/hems. Limbs are hip/shoulder-pivoted GROUPS exposed
// via `rig` refs so clothing swings with them. The model's FRONT is local +Z
// (Character adds π to face the game's -Z-forward yaw convention). Purely visual:
// collision is a fixed PLAYER_RADIUS elsewhere, so nothing here affects gameplay.

export interface CharRig {
  leftLeg: RefObject<Group | null>;
  rightLeg: RefObject<Group | null>;
  leftArm: RefObject<Group | null>;
  rightArm: RefObject<Group | null>;
  torso: RefObject<Group | null>;
}

export function charDims(h: number) {
  const headR = h * 0.15;
  const neckH = h * 0.045;
  const torsoH = h * 0.32;
  const legsH = h * 0.4;
  const armH = h * 0.3;
  return {
    h, headR, neckH, torsoH, legsH, armH,
    torsoRTop: h * 0.135, // chest
    torsoRBot: h * 0.115, // waist
    torsoD: 0.74,          // depth scale (oval, narrower front-to-back)
    legRTop: h * 0.062,
    legRBot: h * 0.045,
    armR: h * 0.046,
    hipX: h * 0.062,
    shoulderX: h * 0.135,
    torsoY: legsH + torsoH / 2,
    shoulderY: legsH + torsoH - h * 0.015,
    headY: legsH + torsoH + neckH + headR * 0.9,
  };
}

const SKIN_ROUGH = 0.62;
const CLOTH_ROUGH = 0.82;

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

  const sleeve = topSleeve(topKind);
  const isDress = topKind === 'dress';
  const hasSkirt = isDress || botKind === 'skirt';
  const skirtColor = isDress ? topColor : botColor;

  return (
    <group>
      {/* ---- Legs (hip-pivoted groups) ---- */}
      <group ref={rig?.leftLeg} position={[-d.hipX, d.legsH, 0]}>
        <Leg d={d} skin={skin} botKind={botKind} botColor={botColor} shoeKind={shoeKind} shoeColor={shoeColor} />
      </group>
      <group ref={rig?.rightLeg} position={[d.hipX, d.legsH, 0]}>
        <Leg d={d} skin={skin} botKind={botKind} botColor={botColor} shoeKind={shoeKind} shoeColor={shoeColor} />
      </group>

      {/* Skirt / dress flare over the hips */}
      {hasSkirt && (
        <group position={[0, d.legsH + d.h * 0.01, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[d.torsoRBot * 1.05, d.torsoRTop * 1.7, d.h * 0.2, 20, 1, true]} />
            <meshStandardMaterial color={skirtColor} roughness={0.78} side={2} />
          </mesh>
          {/* hem trim */}
          <mesh position={[0, -d.h * 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[d.torsoRTop * 1.62, d.h * 0.012, 8, 24]} />
            <meshStandardMaterial color={skirtColor} roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* ---- Torso (bob group) ---- */}
      <group ref={rig?.torso} position={[0, d.torsoY, 0]}>
        <group scale={[1, 1, d.torsoD]}>
          <Torso d={d} skin={skin} topKind={topKind} topColor={topColor} isDress={isDress} />
        </group>
        {accKind === 'cape' && (
          <mesh position={[0, d.torsoH * 0.12, -d.torsoRTop * 0.85]} rotation={[0.12, 0, 0]} castShadow>
            <planeGeometry args={[d.torsoRTop * 2.4, d.torsoH * 1.8]} />
            <meshStandardMaterial color={accColor} roughness={0.7} side={2} />
          </mesh>
        )}
        {accKind === 'wings' && <Wings d={d} color={accColor} />}
        {accKind === 'backpack' && (
          <group position={[0, 0, -d.torsoRTop * 0.95]}>
            <mesh castShadow>
              <boxGeometry args={[d.torsoRTop * 1.5, d.torsoH * 0.75, d.torsoRTop * 0.7]} />
              <meshStandardMaterial color={accColor} roughness={0.7} />
            </mesh>
            <mesh position={[0, d.torsoH * 0.1, d.torsoRTop * 0.36]}>
              <boxGeometry args={[d.torsoRTop * 1.1, d.torsoH * 0.32, d.torsoRTop * 0.1]} />
              <meshStandardMaterial color="#ffffff" roughness={0.7} transparent opacity={0.5} />
            </mesh>
          </group>
        )}
      </group>

      {/* ---- Arms (shoulder-pivoted groups) ---- */}
      <group ref={rig?.leftArm} position={[-d.shoulderX, d.shoulderY, 0]}>
        <Arm d={d} skin={skin} sleeve={sleeve} topColor={topColor} />
      </group>
      <group ref={rig?.rightArm} position={[d.shoulderX, d.shoulderY, 0]}>
        <Arm d={d} skin={skin} sleeve={sleeve} topColor={topColor} />
      </group>

      {/* ---- Neck + head ---- */}
      <mesh position={[0, d.legsH + d.torsoH + d.neckH * 0.4, 0]} castShadow>
        <cylinderGeometry args={[d.headR * 0.32, d.headR * 0.36, d.neckH, 12]} />
        <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
      </mesh>
      <group position={[0, d.headY, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[d.headR, 24, 20]} />
          <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
        </mesh>
        {/* ears */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * d.headR * 0.96, -d.headR * 0.05, 0]} castShadow>
            <sphereGeometry args={[d.headR * 0.2, 10, 10]} />
            <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
          </mesh>
        ))}
        <Face d={d} />
        {def.id === 'dad' && <Beard d={d} color="#6b4a2c" />}
        <Hair kind={hairKind} color={hairColor} d={d} />
        {(accKind === 'glasses' || accKind === 'sunglasses') && (
          <Glasses d={d} color={accColor} shaded={accKind === 'sunglasses'} />
        )}
        {accKind === 'bandana' && (
          <mesh position={[0, d.headR * 0.6, 0]} castShadow>
            <cylinderGeometry args={[d.headR * 1.04, d.headR * 1.04, d.headR * 0.42, 20, 1, true]} />
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
  const tube = (yc: number, h: number, rt: number, rb: number, color: string, rough: number) => (
    <mesh position={[0, yc, 0]} castShadow>
      <cylinderGeometry args={[rt, rb, h, 14]} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
  return (
    <group>
      {full || bare
        ? tube(-legH / 2, legH * 0.98, d.legRTop, d.legRBot, bare ? skin : botColor, bare ? SKIN_ROUGH : CLOTH_ROUGH)
        : (
          <>
            {tube(-legH * 0.27, legH * 0.52, d.legRTop, d.legRTop * 0.92, botColor, CLOTH_ROUGH)}
            {tube(-legH * 0.72, legH * 0.5, d.legRBot * 1.05, d.legRBot, skin, SKIN_ROUGH)}
          </>
        )}
      {botKind === 'athletic' && (
        <mesh position={[d.legRTop * 0.85, -legH * 0.5, 0]}>
          <boxGeometry args={[d.h * 0.012, legH * 0.9, d.legRTop * 1.2]} />
          <meshStandardMaterial color="#f6f2e8" roughness={0.8} />
        </mesh>
      )}
      {botKind === 'cargo' && (
        <mesh position={[d.legRTop * 0.9, -legH * 0.46, 0]} castShadow>
          <boxGeometry args={[d.legRTop * 0.5, legH * 0.2, d.legRTop * 1.3]} />
          <meshStandardMaterial color={botColor} roughness={CLOTH_ROUGH} />
        </mesh>
      )}
      <Shoe d={d} kind={shoeKind} color={shoeColor} y={-legH} />
    </group>
  );
}

function Shoe({ d, kind, color, y }: { d: ReturnType<typeof charDims>; kind: string; color: string; y: number }) {
  const w = d.legRTop * 2.1;
  const fwd = d.h * 0.045;
  if (kind === 'sandals') {
    return (
      <group position={[0, y + 0.01, fwd * 0.6]}>
        <mesh castShadow><boxGeometry args={[w, d.h * 0.016, d.h * 0.15]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
        <mesh position={[0, d.h * 0.02, -d.h * 0.01]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[d.h * 0.006, d.h * 0.006, w * 0.8, 6]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      </group>
    );
  }
  const high = kind === 'hightops' || kind === 'boots';
  const sole = kind === 'boots' ? '#2b2b2b' : '#f4f2ec';
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, d.h * 0.014, fwd * 0.55]} castShadow>
        <boxGeometry args={[w, d.h * 0.028, d.h * 0.18]} />
        <meshStandardMaterial color={sole} roughness={0.6} />
      </mesh>
      <mesh position={[0, d.h * 0.05, fwd * 0.42]} castShadow>
        <boxGeometry args={[w * 0.92, d.h * 0.055, d.h * 0.14]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
      </mesh>
      {/* toe cap */}
      <mesh position={[0, d.h * 0.035, fwd * 1.15]} castShadow>
        <sphereGeometry args={[d.h * 0.035, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {high && (
        <mesh position={[0, d.h * 0.095, -d.h * 0.01]} castShadow>
          <cylinderGeometry args={[w * 0.46, w * 0.46, d.h * 0.07, 12]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      )}
      {kind === 'cleats' && (
        <mesh position={[0, -d.h * 0.002, fwd * 0.55]}>
          <boxGeometry args={[w * 0.9, d.h * 0.012, d.h * 0.16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      )}
    </group>
  );
}

function Torso({ d, skin, topKind, topColor, isDress }: {
  d: ReturnType<typeof charDims>; skin: string; topKind: string; topColor: string; isDress: boolean;
}) {
  const covered = topKind !== 'none';
  const color = covered ? topColor : skin;
  const th = d.torsoH;
  const collarColor = topKind === 'plaid' ? '#f6f2e8' : color;
  return (
    <group>
      {/* shaped body (chest → waist taper) */}
      <mesh castShadow>
        <cylinderGeometry args={[d.torsoRTop, d.torsoRBot, th, 18]} />
        <meshStandardMaterial color={color} roughness={covered ? CLOTH_ROUGH : SKIN_ROUGH} />
      </mesh>
      {/* rounded shoulders */}
      <mesh position={[0, th * 0.46, 0]} castShadow>
        <sphereGeometry args={[d.torsoRTop * 1.02, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={color} roughness={covered ? CLOTH_ROUGH : SKIN_ROUGH} />
      </mesh>
      {/* collar / neckline */}
      {covered && !isDress && (
        <mesh position={[0, th * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[d.torsoRTop * 0.4, d.torsoRTop * 0.12, 8, 18]} />
          <meshStandardMaterial color={collarColor} roughness={CLOTH_ROUGH} />
        </mesh>
      )}
      {/* hem */}
      {covered && !isDress && (
        <mesh position={[0, -th * 0.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[d.torsoRBot * 1.02, d.torsoRBot * 0.1, 8, 20]} />
          <meshStandardMaterial color={color} roughness={CLOTH_ROUGH} />
        </mesh>
      )}
      {/* dress bodice + waist sash */}
      {isDress && (
        <mesh position={[0, -th * 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[d.torsoRBot * 1.05, d.torsoRBot * 0.16, 8, 20]} />
          <meshStandardMaterial color="#ffffff" roughness={0.7} transparent opacity={0.6} />
        </mesh>
      )}
      {/* hoodie hood + pocket + strings */}
      {topKind === 'hoodie' && (
        <>
          <mesh position={[0, th * 0.5, -d.torsoRTop * 0.45]} castShadow>
            <sphereGeometry args={[d.torsoRTop * 0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshStandardMaterial color={topColor} roughness={CLOTH_ROUGH} />
          </mesh>
          <mesh position={[0, -th * 0.12, d.torsoRTop * 0.92]}>
            <boxGeometry args={[d.torsoRTop * 1.1, th * 0.28, d.torsoRTop * 0.12]} />
            <meshStandardMaterial color={topColor} roughness={CLOTH_ROUGH} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * d.torsoRTop * 0.2, th * 0.32, d.torsoRTop * 0.95]}>
              <cylinderGeometry args={[d.h * 0.006, d.h * 0.006, th * 0.3, 6]} />
              <meshStandardMaterial color="#f6f2e8" roughness={0.8} />
            </mesh>
          ))}
        </>
      )}
      {/* jersey number */}
      {topKind === 'jersey' && (
        <mesh position={[0, th * 0.05, d.torsoRTop * 1.0]}>
          <circleGeometry args={[d.torsoRTop * 0.42, 20]} />
          <meshStandardMaterial color="#f6f2e8" roughness={CLOTH_ROUGH} />
        </mesh>
      )}
      {/* tank straps (cut-in shoulders shown as thin straps over bare upper chest) */}
      {topKind === 'tank' && [-1, 1].map((s) => (
        <mesh key={s} position={[s * d.torsoRTop * 0.5, th * 0.3, 0]}>
          <boxGeometry args={[d.torsoRTop * 0.16, th * 0.5, d.torsoRTop * 0.4]} />
          <meshStandardMaterial color={topColor} roughness={CLOTH_ROUGH} />
        </mesh>
      ))}
      {/* stripes (wrap front band) */}
      {topKind === 'stripe' && [0.22, -0.02, -0.26].map((yy, i) => (
        <mesh key={i} position={[0, th * yy, 0]}>
          <cylinderGeometry args={[d.torsoRTop * 1.01, d.torsoRBot * 1.01, th * 0.1, 18, 1, true]} />
          <meshStandardMaterial color="#f6f2e8" roughness={CLOTH_ROUGH} side={2} />
        </mesh>
      ))}
      {/* plaid: button placket + collar flaps */}
      {topKind === 'plaid' && (
        <>
          <mesh position={[0, 0, d.torsoRTop * 1.0]}>
            <boxGeometry args={[d.torsoRTop * 0.14, th * 0.92, d.torsoRTop * 0.06]} />
            <meshStandardMaterial color="#2c2f3a" roughness={CLOTH_ROUGH} transparent opacity={0.55} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * d.torsoRTop * 0.28, th * 0.42, d.torsoRTop * 0.75]} rotation={[0, s * -0.5, 0]}>
              <boxGeometry args={[d.torsoRTop * 0.4, th * 0.16, d.torsoRTop * 0.05]} />
              <meshStandardMaterial color="#f6f2e8" roughness={CLOTH_ROUGH} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function Arm({ d, skin, sleeve, topColor }: { d: ReturnType<typeof charDims>; skin: string; sleeve: 'none' | 'short' | 'long'; topColor: string }) {
  const armH = d.armH;
  const handY = -armH - d.armR * 0.4;
  const sleeveLen = sleeve === 'long' ? armH * 0.9 : armH * 0.4;
  return (
    <group>
      {/* shoulder cap */}
      <mesh castShadow>
        <sphereGeometry args={[d.armR * 1.15, 12, 10]} />
        <meshStandardMaterial color={sleeve !== 'none' ? topColor : skin} roughness={sleeve !== 'none' ? CLOTH_ROUGH : SKIN_ROUGH} />
      </mesh>
      {/* sleeve */}
      {sleeve !== 'none' && (
        <mesh position={[0, -sleeveLen / 2, 0]} castShadow>
          <cylinderGeometry args={[d.armR * 1.18, d.armR * 1.05, sleeveLen, 12]} />
          <meshStandardMaterial color={topColor} roughness={CLOTH_ROUGH} />
        </mesh>
      )}
      {/* cuff */}
      {sleeve === 'long' && (
        <mesh position={[0, -sleeveLen, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[d.armR * 1.0, d.armR * 0.28, 8, 14]} />
          <meshStandardMaterial color={topColor} roughness={CLOTH_ROUGH} />
        </mesh>
      )}
      {/* bare forearm */}
      <mesh position={[0, -armH * 0.62, 0]} castShadow>
        <cylinderGeometry args={[d.armR * 0.92, d.armR * 0.85, armH * (sleeve === 'long' ? 0.22 : 0.82), 12]} />
        <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
      </mesh>
      {/* hand */}
      <mesh position={[0, handY, 0]} castShadow>
        <sphereGeometry args={[d.armR * 1.05, 12, 12]} />
        <meshStandardMaterial color={skin} roughness={SKIN_ROUGH} />
      </mesh>
    </group>
  );
}

function Face({ d }: { d: ReturnType<typeof charDims> }) {
  const r = d.headR;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * r * 0.33, r * 0.06, r * 0.85]}>
          <mesh><sphereGeometry args={[r * 0.16, 14, 14]} /><meshStandardMaterial color="#ffffff" roughness={0.35} /></mesh>
          <mesh position={[0, 0, r * 0.1]}><sphereGeometry args={[r * 0.085, 12, 12]} /><meshStandardMaterial color="#2a1d12" roughness={0.25} /></mesh>
          {/* eyebrow */}
          <mesh position={[0, r * 0.22, r * 0.02]} rotation={[0, 0, s * -0.15]}><boxGeometry args={[r * 0.26, r * 0.05, r * 0.05]} /><meshStandardMaterial color="#3a2a1a" roughness={0.8} /></mesh>
        </group>
      ))}
      {/* nose */}
      <mesh position={[0, -r * 0.05, r * 0.97]} castShadow><sphereGeometry args={[r * 0.1, 10, 10]} /><meshStandardMaterial color="#e8b48f" roughness={0.6} /></mesh>
      {/* smile */}
      <mesh position={[0, -r * 0.36, r * 0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r * 0.26, r * 0.04, 8, 18, Math.PI]} />
        <meshStandardMaterial color="#bb5742" roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 0.52, -r * 0.16, r * 0.74]}>
          <sphereGeometry args={[r * 0.12, 8, 8]} />
          <meshStandardMaterial color="#f2a3a0" transparent opacity={0.45} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// A neat short beard: a lower-front band of a head-sized sphere, nudged forward
// so the back of the band sinks into the head and only the jaw/chin shows.
function Beard({ d, color }: { d: ReturnType<typeof charDims>; color: string }) {
  const r = d.headR;
  return (
    <group>
      <mesh position={[0, 0, r * 0.14]} castShadow>
        <sphereGeometry args={[r * 1.0, 22, 18, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.42]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      {/* mustache */}
      <mesh position={[0, -r * 0.18, r * 0.9]}>
        <boxGeometry args={[r * 0.4, r * 0.1, r * 0.12]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
    </group>
  );
}

function Hair({ kind, color, d }: { kind: string; color: string; d: ReturnType<typeof charDims> }) {
  const r = d.headR;
  const mat = <meshStandardMaterial color={color} roughness={0.78} />;
  if (kind === 'buzz') {
    return <mesh position={[0, r * 0.16, -r * 0.04]} castShadow><sphereGeometry args={[r * 1.01, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.48]} />{mat}</mesh>;
  }
  // Smooth scalp cap shared by most styles.
  const cap = (
    <mesh position={[0, r * 0.16, -r * 0.06]} castShadow>
      <sphereGeometry args={[r * 1.07, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.66]} />
      {mat}
    </mesh>
  );
  if (kind === 'short' || kind === 'tousled') {
    return (
      <group>
        {cap}
        {/* fringe */}
        <mesh position={[0, r * 0.62, r * 0.62]} rotation={[0.5, 0, 0]} castShadow><sphereGeometry args={[r * 0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />{mat}</mesh>
        {kind === 'tousled' && [-0.45, 0.05, 0.5].map((x, i) => (
          <mesh key={i} position={[x * r, r * 1.05, -r * 0.05]} rotation={[0.25, 0, x * 1.1]} castShadow><coneGeometry args={[r * 0.16, r * 0.42, 7]} />{mat}</mesh>
        ))}
        <mesh position={[0, r * 0.35, -r * 0.7]} castShadow><sphereGeometry args={[r * 0.66, 14, 12]} />{mat}</mesh>
      </group>
    );
  }
  if (kind === 'curly') {
    return (
      <group>
        {cap}
        {Array.from({ length: 14 }).map((_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const ring = i % 2 === 0 ? 0.92 : 0.6;
          return <mesh key={i} position={[Math.cos(a) * r * ring, r * (0.5 + (i % 3) * 0.18), Math.sin(a) * r * ring - r * 0.08]} castShadow><sphereGeometry args={[r * 0.3, 8, 8]} />{mat}</mesh>;
        })}
      </group>
    );
  }
  if (kind === 'long') {
    return (
      <group>
        {cap}
        {/* back curtain — smooth tapered sheet hugging the head */}
        <mesh position={[0, -r * 0.35, -r * 0.5]} castShadow>
          <cylinderGeometry args={[r * 1.0, r * 0.82, r * 2.7, 18, 1, true, Math.PI * 0.15, Math.PI * 1.7]} />
          {mat}
        </mesh>
        <mesh position={[0, -r * 1.55, -r * 0.5]} castShadow><sphereGeometry args={[r * 0.85, 14, 10]} />{mat}</mesh>
        {/* side locks */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * r * 0.92, -r * 0.45, r * 0.12]} rotation={[0, 0, s * 0.08]} castShadow>
            <cylinderGeometry args={[r * 0.28, r * 0.18, r * 1.9, 10]} />
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
        <mesh position={[0, r * 0.3, -r * 1.05]} rotation={[0.55, 0, 0]} castShadow><cylinderGeometry args={[r * 0.26, r * 0.12, r * 1.9, 12]} />{mat}</mesh>
        <mesh position={[0, r * 0.78, -r * 0.7]} castShadow><sphereGeometry args={[r * 0.2, 10, 10]} /><meshStandardMaterial color="#e26aa1" roughness={0.7} /></mesh>
      </group>
    );
  }
  if (kind === 'bun') {
    return (
      <group>
        {cap}
        <mesh position={[0, r * 1.18, -r * 0.08]} castShadow><sphereGeometry args={[r * 0.5, 14, 14]} />{mat}</mesh>
        <mesh position={[0, r * 0.95, -r * 0.45]}><torusGeometry args={[r * 0.5, r * 0.06, 8, 16]} /><meshStandardMaterial color="#e26aa1" roughness={0.7} /></mesh>
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
      <group position={[0, r * 0.66, 0]}>
        <mesh castShadow><sphereGeometry args={[r * 1.06, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
        <mesh position={[0, -r * 0.02, r * 1.0]} rotation={[-0.15, 0, 0]} castShadow><boxGeometry args={[r * 1.25, r * 0.08, r * 0.85]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
        <mesh position={[0, r * 0.5, 0]}><sphereGeometry args={[r * 0.1, 8, 8]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      </group>
    );
  }
  if (kind === 'beanie') {
    return (
      <group position={[0, r * 0.5, 0]}>
        <mesh castShadow><sphereGeometry args={[r * 1.1, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r * 1.08, r * 0.16, 8, 20]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
        <mesh position={[0, r * 0.62, 0]}><sphereGeometry args={[r * 0.16, 10, 10]} /><meshStandardMaterial color="#f6f2e8" roughness={0.9} /></mesh>
      </group>
    );
  }
  if (kind === 'cowboy') {
    return (
      <group position={[0, r * 0.72, 0]}>
        <mesh castShadow><cylinderGeometry args={[r * 1.75, r * 1.85, r * 0.08, 24]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>
        <mesh position={[0, r * 0.34, 0]} castShadow><cylinderGeometry args={[r * 0.82, r * 0.95, r * 0.7, 18]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>
        <mesh position={[0, r * 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r * 0.92, r * 0.05, 8, 20]} /><meshStandardMaterial color="#3a2a1a" roughness={0.7} /></mesh>
      </group>
    );
  }
  if (kind === 'crown') {
    return (
      <group position={[0, r * 0.9, 0]}>
        <mesh castShadow><cylinderGeometry args={[r * 0.96, r * 0.96, r * 0.4, 16, 1, true]} /><meshStandardMaterial color={color} roughness={0.3} metalness={0.6} /></mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return <mesh key={i} position={[Math.cos(a) * r * 0.96, r * 0.32, Math.sin(a) * r * 0.96]} castShadow><coneGeometry args={[r * 0.14, r * 0.32, 6]} /><meshStandardMaterial color={color} roughness={0.3} metalness={0.6} /></mesh>;
        })}
      </group>
    );
  }
  if (kind === 'headband') {
    return <mesh position={[0, r * 0.52, 0]} castShadow><cylinderGeometry args={[r * 1.07, r * 1.07, r * 0.28, 20, 1, true]} /><meshStandardMaterial color={color} roughness={0.7} side={2} /></mesh>;
  }
  if (kind === 'party') {
    return (
      <group position={[0, r * 1.0, 0]} rotation={[0.12, 0, 0]}>
        <mesh castShadow><coneGeometry args={[r * 0.55, r * 1.25, 18]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
        <mesh position={[0, r * 0.7, 0]}><sphereGeometry args={[r * 0.16, 10, 10]} /><meshStandardMaterial color="#f6f2e8" roughness={0.7} /></mesh>
      </group>
    );
  }
  if (kind === 'bow') {
    return (
      <group position={[r * 0.66, r * 0.82, 0]}>
        {[-1, 1].map((s) => <mesh key={s} position={[s * r * 0.26, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]} castShadow><coneGeometry args={[r * 0.24, r * 0.48, 5]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>)}
        <mesh castShadow><sphereGeometry args={[r * 0.13, 10, 10]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
      </group>
    );
  }
  return null;
}

function Glasses({ d, color, shaded }: { d: ReturnType<typeof charDims>; color: string; shaded: boolean }) {
  const r = d.headR;
  return (
    <group position={[0, r * 0.06, r * 0.9]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * r * 0.33, 0, 0]}>
          <mesh><torusGeometry args={[r * 0.2, r * 0.035, 8, 18]} /><meshStandardMaterial color={color} roughness={0.4} metalness={0.3} /></mesh>
          {shaded && <mesh position={[0, 0, -r * 0.02]}><circleGeometry args={[r * 0.2, 18]} /><meshStandardMaterial color={color} roughness={0.2} metalness={0.4} transparent opacity={0.82} /></mesh>}
        </group>
      ))}
      <mesh><boxGeometry args={[r * 0.26, r * 0.035, r * 0.04]} /><meshStandardMaterial color={color} roughness={0.4} metalness={0.3} /></mesh>
    </group>
  );
}

function Wings({ d, color }: { d: ReturnType<typeof charDims>; color: string }) {
  return (
    <group position={[0, d.torsoH * 0.1, -d.torsoRTop * 0.8]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * d.torsoRTop * 0.7, 0, 0]} rotation={[0, s * 0.5, 0]} castShadow>
          <sphereGeometry args={[d.torsoH * 0.5, 12, 10]} />
          <meshStandardMaterial color={color} roughness={0.5} transparent opacity={0.85} side={2} />
        </mesh>
      ))}
    </group>
  );
}
