import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CanvasTexture, Color, DataTexture, MeshToonMaterial, NearestFilter, RedFormat, SRGBColorSpace,
  type Texture,
} from 'three';
import type { CharRig } from '../CharacterModel';
import type { NpcLook } from '../../world/npcLook';

// The townsfolk, drawn as cute anime-style (chibi) characters: a big round head,
// big bright eyes, chunky hair, a small soft body. Built from a few simple shapes
// and one painted face per character, so a whole town of them is cheap to draw.
//
// Same contract as CharacterModel: feet at y = 0, FRONT is local +Z, and the limbs
// are exposed through `rig` so the NPC controller can swing them.

/** Sizes of a chibi of total height h. Kids get a bigger head for their height. */
export function animeDims(h: number) {
  const kid = h < 1.5;
  const headR = h * (kid ? 0.2 : 0.175);
  const legsH = h * (kid ? 0.27 : 0.31);
  const torsoH = h * (kid ? 0.25 : 0.27);
  const headY = legsH + torsoH + headR * 0.82;
  return {
    h, kid, headR, legsH, torsoH, headY,
    torsoY: legsH + torsoH / 2,
    shoulderY: legsH + torsoH - h * 0.03,
    shoulderX: h * (kid ? 0.105 : 0.115),
    hipX: h * 0.05,
    armH: h * (kid ? 0.24 : 0.27),
    armR: h * 0.034,
    legR: h * 0.043,
    torsoRTop: h * 0.085,
    torsoRBot: h * 0.105,
  };
}

// ---------------------------------------------------------------- materials --
let ramp: DataTexture | null = null;
function toonRamp() {
  if (ramp) return ramp;
  // three soft steps: shade, mid, light (cel shading without harsh black)
  ramp = new DataTexture(new Uint8Array([150, 215, 255]), 3, 1, RedFormat);
  ramp.minFilter = NearestFilter;
  ramp.magFilter = NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}
const mats = new Map<string, MeshToonMaterial>();
function toon(color: string) {
  let m = mats.get(color);
  if (!m) {
    m = new MeshToonMaterial({ color: new Color(color), gradientMap: toonRamp() });
    mats.set(color, m);
  }
  return m;
}
const shade = (hex: string, k: number) => `#${new Color(hex).multiplyScalar(k).getHexString()}`;

// --------------------------------------------------------------------- face --
const EYES = ['#3f7fd9', '#3aa76d', '#8a5a2b', '#7a4fd0', '#2f9aa8', '#b3692c', '#5a6ad8', '#3d8f52'];
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const faces = new Map<string, Texture>();
/** One painted face: big anime eyes, tiny nose, a little smile, pink cheeks. */
function faceTexture(o: { eye: string; lashes: boolean; glasses: string | null; brow: string; blink: boolean; grown: boolean; mouth: number }) {
  const key = JSON.stringify(o);
  const hit = faces.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const eyeY = 118, dx = 56;
  const ew = o.grown ? 30 : 34, eh = o.grown ? 39 : 46;
  for (const sx of [-1, 1]) {
    const x = S / 2 + sx * dx;
    if (o.blink) {
      // closed: one happy curve
      g.strokeStyle = '#2a1c1c';
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(x, eyeY - 4, ew * 0.8, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      continue;
    }
    // white of the eye
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(x, eyeY, ew, eh, 0, 0, Math.PI * 2);
    g.fill();
    // iris: darker at the top, brighter at the bottom
    const grad = g.createLinearGradient(0, eyeY - eh, 0, eyeY + eh);
    grad.addColorStop(0, shade(o.eye, 0.42));
    grad.addColorStop(0.55, o.eye);
    grad.addColorStop(1, shade(o.eye, 1.5));
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, eyeY + 2, ew * 0.8, eh * 0.86, 0, 0, Math.PI * 2);
    g.fill();
    // pupil
    g.fillStyle = '#1a1220';
    g.beginPath();
    g.ellipse(x, eyeY + 2, ew * 0.36, eh * 0.44, 0, 0, Math.PI * 2);
    g.fill();
    // two highlights: the sparkle that makes the eye read as anime
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(x - ew * 0.3, eyeY - eh * 0.36, ew * 0.3, eh * 0.24, -0.4, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(x + ew * 0.34, eyeY + eh * 0.42, ew * 0.15, eh * 0.11, 0, 0, Math.PI * 2);
    g.fill();
    // upper lid line
    g.strokeStyle = '#2a1c1c';
    g.lineWidth = o.lashes ? 7 : 5.5;
    g.lineCap = 'round';
    g.beginPath();
    g.ellipse(x, eyeY, ew + 1, eh + 1, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
    if (o.lashes) {
      g.lineWidth = 4.5;
      g.beginPath();
      g.moveTo(x + sx * (ew + 1), eyeY - 8);
      g.lineTo(x + sx * (ew + 11), eyeY - 17);
      g.stroke();
    }
  }
  // brows
  g.strokeStyle = o.brow;
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(S / 2 + sx * (dx - 20), eyeY - eh - 11);
    g.quadraticCurveTo(S / 2 + sx * dx, eyeY - eh - 19, S / 2 + sx * (dx + 24), eyeY - eh - 9);
    g.stroke();
  }
  // cheeks
  for (const sx of [-1, 1]) {
    const x = S / 2 + sx * (dx + 30), y = eyeY + eh + 6;
    const blush = g.createRadialGradient(x, y, 0, x, y, 21);
    blush.addColorStop(0, 'rgba(255,120,130,0.5)');
    blush.addColorStop(1, 'rgba(255,120,130,0)');
    g.fillStyle = blush;
    g.fillRect(x - 22, y - 22, 44, 44);
  }
  // nose: a hint
  g.fillStyle = 'rgba(120,60,50,0.4)';
  g.beginPath();
  g.ellipse(S / 2, eyeY + eh - 2, 3, 2.2, 0, 0, Math.PI * 2);
  g.fill();
  // mouth: a smile, a little open one, or a cat mouth
  const my = eyeY + eh + 20;
  g.strokeStyle = '#7a2f33';
  g.lineWidth = 4.5;
  g.beginPath();
  if (o.mouth === 1) {
    g.fillStyle = '#b9434c';
    g.ellipse(S / 2, my + 3, 10, 8, 0, 0, Math.PI);
    g.fill();
    g.moveTo(S / 2 - 10, my + 3);
    g.lineTo(S / 2 + 10, my + 3);
  } else if (o.mouth === 2) {
    g.arc(S / 2 - 6, my, 6, 0.1 * Math.PI, 0.95 * Math.PI);
    g.moveTo(S / 2 + 12, my + 1.5);
    g.arc(S / 2 + 6, my, 6, 0.05 * Math.PI, 0.9 * Math.PI);
  } else {
    g.arc(S / 2, my - 7, 14, 0.2 * Math.PI, 0.8 * Math.PI);
  }
  g.stroke();
  if (o.glasses) {
    g.strokeStyle = o.glasses;
    g.lineWidth = 5;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.ellipse(S / 2 + sx * dx, eyeY + 2, ew + 12, eh + 9, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(S / 2 - dx + ew + 12, eyeY);
    g.lineTo(S / 2 + dx - ew - 12, eyeY);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  faces.set(key, t);
  return t;
}

// --------------------------------------------------------------------- hair --
function Hair({ item, color, r, hat }: { item: string; color: string; r: number; hat: string }) {
  const m = toon(color);
  const dark = toon(shade(color, 0.8));
  const under = hat === 'cap' || hat === 'beanie' || hat === 'cowboy';
  if (item === 'none') return null;
  if (item === 'buzz') {
    return (
      <mesh material={dark} position={[0, r * 0.06, -r * 0.03]} scale={[1.03, 1.0, 1.04]}>
        <sphereGeometry args={[r, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
      </mesh>
    );
  }
  const long = item === 'long' || item === 'ponytail' || item === 'bun' || item === 'curly';
  // bangs: a row of soft locks across the forehead, longest at the sides
  const locks = [-0.82, -0.5, -0.17, 0.17, 0.5, 0.82];
  return (
    <group>
      {/* the cap of hair over the skull */}
      {!under && (
        <mesh material={m} position={[0, r * 0.12, -r * 0.1]} rotation={[-0.42, 0, 0]} scale={[1.09, 1.06, 1.1]}>
          <sphereGeometry args={[r, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        </mesh>
      )}
      {/* back of the head, down to the neck (longer styles reach the shoulders) */}
      <mesh material={m} position={[0, -r * (long ? 0.2 : 0.0), -r * 0.3]} scale={[1.06, long ? 1.3 : 1.0, 0.9]}>
        <sphereGeometry args={[r, 20, 14]} />
      </mesh>
      {locks.map((a, i) => {
        const side = Math.abs(a);
        const len = r * (0.3 + side * side * 0.5) * (item === 'tousled' ? 1.15 : 1);
        const tilt = item === 'tousled' ? (i % 2 ? 0.28 : -0.22) : a * 0.24;
        return (
          <mesh
            key={i}
            material={i % 2 ? dark : m}
            position={[Math.sin(a) * r * 0.95, r * (0.74 - side * 0.14) - len * 0.5, Math.cos(a) * r * 0.86]}
            rotation={[0.18, a, tilt]}
            scale={[1, 1, 0.55]}
          >
            <coneGeometry args={[r * 0.3, len, 6]} />
          </mesh>
        );
      })}
      {/* the fringe the locks hang from */}
      <mesh material={m} position={[0, r * 0.62, r * 0.42]} rotation={[0.5, 0, 0]} scale={[1.02, 0.5, 0.75]}>
        <sphereGeometry args={[r * 0.92, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      </mesh>
      {/* side locks in front of the ears */}
      {long && [-1, 1].map((sx) => (
        <mesh key={sx} material={m} position={[sx * r * 0.93, -r * 0.42, r * 0.22]} rotation={[0, 0, sx * 0.08]} scale={[0.6, 1, 0.7]}>
          <coneGeometry args={[r * 0.3, r * 1.15, 6]} />
        </mesh>
      ))}
      {item === 'ponytail' && (
        <group position={[0, r * 0.42, -r * 0.98]} rotation={[-0.65, 0, 0]}>
          <mesh material={toon('#ff6f91')} scale={[1, 0.5, 1]}><sphereGeometry args={[r * 0.19, 10, 8]} /></mesh>
          <mesh material={m} position={[0, -r * 0.62, 0]} rotation={[Math.PI, 0, 0]} scale={[1, 1, 0.75]}>
            <coneGeometry args={[r * 0.33, r * 1.3, 8]} />
          </mesh>
        </group>
      )}
      {item === 'bun' && (
        <mesh material={m} position={[0, r * 1.0, -r * 0.5]}><sphereGeometry args={[r * 0.4, 12, 10]} /></mesh>
      )}
      {item === 'curly' && [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <mesh key={i} material={i % 2 ? dark : m} position={[Math.sin(a) * r * 0.92, r * (0.42 + (i % 3) * 0.14), Math.cos(a) * r * 0.86 - r * 0.1]}>
            <sphereGeometry args={[r * 0.36, 9, 8]} />
          </mesh>
        );
      })}
      {(item === 'short' || item === 'tousled') && !under && (
        // one cheeky tuft on top
        <mesh material={m} position={[r * 0.08, r * 1.13, -r * 0.04]} rotation={[0.2, 0, -0.5]}>
          <coneGeometry args={[r * 0.14, r * 0.42, 5]} />
        </mesh>
      )}
    </group>
  );
}

function Hat({ item, color, r }: { item: string; color: string; r: number }) {
  if (item === 'none' || !item) return null;
  const m = toon(color || '#444');
  if (item === 'cap') {
    return (
      <group position={[0, r * 0.4, -r * 0.04]}>
        <mesh material={m} scale={[1.1, 1.0, 1.12]}><sphereGeometry args={[r, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.43]} /></mesh>
        <mesh material={toon(shade(color || '#444', 0.78))} position={[0, r * 0.2, r * 1.08]} rotation={[0.16, 0, 0]} scale={[1, 0.14, 0.92]}>
          <cylinderGeometry args={[r * 0.64, r * 0.64, r, 14, 1, false, -Math.PI / 2, Math.PI]} />
        </mesh>
      </group>
    );
  }
  if (item === 'beanie') {
    return (
      <group position={[0, r * 0.4, -r * 0.06]} rotation={[-0.1, 0, 0]}>
        <mesh material={m} scale={[1.11, 1.12, 1.13]}><sphereGeometry args={[r, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.46]} /></mesh>
        <mesh material={toon(shade(color || '#444', 1.25))} position={[0, r * 0.13, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.12, 1.14, 1]}>
          <torusGeometry args={[r * 0.98, r * 0.11, 6, 22]} />
        </mesh>
        <mesh material={toon(shade(color || '#444', 1.25))} position={[0, r * 1.17, 0]}><sphereGeometry args={[r * 0.2, 8, 8]} /></mesh>
      </group>
    );
  }
  if (item === 'cowboy') {
    return (
      <group position={[0, r * 0.66, -r * 0.08]} rotation={[-0.16, 0, 0]}>
        <mesh material={m} scale={[1, 0.07, 1]}><cylinderGeometry args={[r * 1.7, r * 1.7, r, 20]} /></mesh>
        <mesh material={m} position={[0, r * 0.38, 0]}><cylinderGeometry args={[r * 0.78, r * 0.98, r * 0.74, 14]} /></mesh>
        <mesh material={toon(shade(color || '#444', 0.62))} position={[0, r * 0.11, 0]}><cylinderGeometry args={[r * 1.0, r * 1.0, r * 0.13, 14]} /></mesh>
      </group>
    );
  }
  if (item === 'headband' || item === 'bandana') {
    return (
      <mesh material={m} position={[0, r * 0.5, -r * 0.05]} rotation={[Math.PI / 2 - 0.18, 0, 0]} scale={[1.12, 1.14, item === 'bandana' ? 2 : 1]}>
        <torusGeometry args={[r * 0.88, r * 0.085, 6, 24]} />
      </mesh>
    );
  }
  if (item === 'bow') {
    return (
      <group position={[r * 0.5, r * 1.02, r * 0.14]} rotation={[0, 0, -0.35]}>
        {[-1, 1].map((sx) => (
          <mesh key={sx} material={m} position={[sx * r * 0.24, 0, 0]} rotation={[0, 0, sx * Math.PI / 2]} scale={[1, 1, 0.5]}>
            <coneGeometry args={[r * 0.24, r * 0.42, 6]} />
          </mesh>
        ))}
        <mesh material={toon(shade(color || '#444', 0.8))}><sphereGeometry args={[r * 0.1, 8, 6]} /></mesh>
      </group>
    );
  }
  return null;
}

// --------------------------------------------------------------------- body --
const SHORT_SLEEVE = new Set(['tee', 'jersey', 'stripe', 'athletic', 'dress']);
const BARE_LEG = new Set(['shorts', 'skirt', 'athletic', 'cargo']);

export function AnimeNpcModel({ id, look, rig }: { id: string; look: NpcLook; rig?: CharRig }) {
  const d = useMemo(() => animeDims(look.height), [look.height]);
  const a = look.appearance;
  const seed = useMemo(() => hash(id), [id]);
  const skin = toon(look.skin);
  const topColor = a.top.color || '#7aa6d6';
  const top = toon(topColor);
  const botColor = a.bottom.color || '#3a4d6b';
  const bottom = toon(botColor);
  const shoes = toon(a.shoes.color || '#333');
  const dress = a.top.item === 'dress';
  const skirt = dress || a.bottom.item === 'skirt';
  const bareLeg = skirt || BARE_LEG.has(a.bottom.item);
  const tank = a.top.item === 'tank';
  const shortSleeve = SHORT_SLEEVE.has(a.top.item);
  const grown = !d.kid;

  const face = useMemo(() => {
    const base = {
      eye: EYES[seed % EYES.length],
      lashes: look.base === 'penny',
      glasses: a.accessory.item === 'glasses' ? (a.accessory.color || '#2a2a2a') : null,
      brow: shade(a.hair.color || '#3a2a20', 0.7),
      grown,
      mouth: (seed >> 4) % 3,
    };
    return { open: faceTexture({ ...base, blink: false }), shut: faceTexture({ ...base, blink: true }) };
  }, [seed, look.base, a.accessory.item, a.accessory.color, a.hair.color, grown]);
  const faceMat = useMemo(() => new MeshToonMaterial({ map: face.open, transparent: true, gradientMap: toonRamp(), depthWrite: false }), [face]);
  useEffect(() => () => faceMat.dispose(), [faceMat]);

  // blink now and then, each on their own clock
  const blink = useRef({ next: 1 + (seed % 40) / 10, until: 0 });
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const b = blink.current;
    if (t > b.next) {
      b.until = t + 0.13;
      b.next = t + 2.2 + ((seed >> 3) % 30) / 10 + Math.random() * 1.5;
    }
    const want = t < b.until ? face.shut : face.open;
    if (faceMat.map !== want) {
      faceMat.map = want;
      faceMat.needsUpdate = true;
    }
  });

  const r = d.headR;
  const sleeveLen = tank ? 0 : shortSleeve ? d.armH * 0.42 : d.armH * 0.86;
  const legTop = bareLeg ? d.legsH * (skirt ? 0.0 : 0.42) : d.legsH * 0.88;

  const leg = (sx: number, legRef?: CharRig['leftLeg']) => (
    <group ref={legRef} position={[sx * d.hipX, d.legsH, 0]}>
      {/* skin underneath, trouser or short over it */}
      <mesh material={skin} position={[0, -d.legsH * 0.47, 0]}>
        <cylinderGeometry args={[d.legR * 0.92, d.legR * 0.74, d.legsH * 0.9, 10]} />
      </mesh>
      {legTop > 0 && (
        <mesh material={bottom} position={[0, -legTop / 2, 0]}>
          <cylinderGeometry args={[d.legR * 1.16, d.legR * (bareLeg ? 1.12 : 0.96), legTop, 10]} />
        </mesh>
      )}
      {/* a round, slightly oversized shoe */}
      <mesh material={shoes} position={[0, -d.legsH + d.legR * 0.62, d.legR * 0.5]} scale={[1.18, 0.78, 1.75]}>
        <sphereGeometry args={[d.legR * 1.02, 10, 8]} />
      </mesh>
    </group>
  );

  const arm = (sx: number, armRef?: CharRig['leftArm']) => (
    <group ref={armRef} position={[sx * d.shoulderX, d.shoulderY, 0]}>
      <group rotation={[0, 0, sx * 0.13]}>
        <mesh material={skin} position={[0, -d.armH * 0.47, 0]}>
          <cylinderGeometry args={[d.armR * 0.9, d.armR * 0.76, d.armH * 0.9, 9]} />
        </mesh>
        {sleeveLen > 0 && (
          <mesh material={top} position={[0, -sleeveLen / 2, 0]}>
            <cylinderGeometry args={[d.armR * 1.25, d.armR * (shortSleeve ? 1.28 : 1.0), sleeveLen, 9]} />
          </mesh>
        )}
        <mesh material={tank ? skin : top}><sphereGeometry args={[d.armR * 1.26, 9, 8]} /></mesh>
        <mesh material={skin} position={[0, -d.armH * 0.95, 0]}><sphereGeometry args={[d.armR * 1.12, 9, 8]} /></mesh>
      </group>
    </group>
  );

  return (
    <group>
      {leg(-1, rig?.leftLeg)}
      {leg(1, rig?.rightLeg)}

      <group ref={rig?.torso} position={[0, d.torsoY, 0]}>
        {/* a small soft body, a little wider at the hips */}
        <mesh material={top} scale={[1, 1, 0.8]}>
          <cylinderGeometry args={[d.torsoRTop, d.torsoRBot, d.torsoH, 14]} />
        </mesh>
        <mesh material={top} position={[0, d.torsoH / 2, 0]} scale={[1, 0.45, 0.8]}><sphereGeometry args={[d.torsoRTop, 14, 8]} /></mesh>
        {!skirt && (
          <mesh material={bottom} position={[0, -d.torsoH * 0.42, 0]} scale={[1.02, 1, 0.82]}>
            <cylinderGeometry args={[d.torsoRBot * 0.98, d.torsoRBot * 0.92, d.torsoH * 0.26, 14]} />
          </mesh>
        )}
        {skirt && (
          <mesh material={dress ? top : bottom} position={[0, -d.torsoH * 0.52, 0]} scale={[1, 1, 0.86]}>
            <cylinderGeometry args={[d.torsoRBot * 0.94, d.torsoRBot * 1.75, d.torsoH * 0.62, 16, 1, true]} />
          </mesh>
        )}
        {a.top.item === 'hoodie' && (
          <mesh material={toon(shade(topColor, 0.84))} position={[0, d.torsoH * 0.47, -d.torsoRTop * 0.5]} scale={[1.25, 0.6, 0.95]}>
            <sphereGeometry args={[d.torsoRTop, 12, 8]} />
          </mesh>
        )}
        {(a.top.item === 'stripe' || a.top.item === 'jersey' || a.top.item === 'plaid') && (
          <mesh material={toon(a.top.item === 'plaid' ? shade(topColor, 0.7) : '#f6f2e8')} position={[0, d.torsoH * 0.06, 0]} scale={[1.02, 1, 0.82]}>
            <cylinderGeometry args={[d.torsoRTop * 1.06, d.torsoRBot * 0.99, d.torsoH * 0.2, 14, 1, true]} />
          </mesh>
        )}
        {a.top.item === 'suit' && (
          <mesh material={toon('#f6f2e8')} position={[0, d.torsoH * 0.2, d.torsoRTop * 0.62]} rotation={[0.1, 0, 0]} scale={[0.5, 1, 0.3]}>
            <coneGeometry args={[d.torsoRTop * 0.6, d.torsoH * 0.5, 4]} />
          </mesh>
        )}
        {a.accessory.item === 'backpack' && (
          <mesh material={toon(a.accessory.color || '#d94f4f')} position={[0, d.torsoH * 0.04, -d.torsoRBot * 0.98]} scale={[1, 1, 0.6]}>
            <capsuleGeometry args={[d.torsoRTop * 0.82, d.torsoH * 0.42, 4, 10]} />
          </mesh>
        )}
      </group>

      {arm(-1, rig?.leftArm)}
      {arm(1, rig?.rightArm)}

      {/* the head: most of the character */}
      <group position={[0, d.headY, 0]}>
        <mesh material={skin} scale={[1, 0.94, 0.95]}><sphereGeometry args={[r, 26, 20]} /></mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} material={skin} position={[sx * r * 0.97, -r * 0.1, 0]} scale={[0.5, 1, 0.8]}><sphereGeometry args={[r * 0.2, 8, 8]} /></mesh>
        ))}
        {/* the painted face, a patch just proud of the skin */}
        <mesh material={faceMat} scale={[1, 0.94, 0.95]} renderOrder={2}>
          <sphereGeometry args={[r * 1.012, 24, 16, Math.PI / 2 - 1.12, 2.24, Math.PI / 2 - 0.8, 1.9]} />
        </mesh>
        <Hair item={a.hair.item} color={a.hair.color || '#3a2a20'} r={r} hat={a.hat.item} />
        <Hat item={a.hat.item} color={a.hat.color} r={r} />
      </group>
    </group>
  );
}
