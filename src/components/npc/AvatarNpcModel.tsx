import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Group as Stand, Box3, Color, MeshToonMaterial, DataTexture, NearestFilter, RedFormat, type Bone, type Group, type Mesh, type Object3D, type SkinnedMesh, type Material, type MeshStandardMaterial } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharRig } from '../CharacterModel';
import type { NpcLook } from '../../world/npcLook';

// Townsfolk as properly modelled anime characters. Each is one of a few template
// avatars (free VRoid sample models, slimmed and made dyeable in Blender:
// scripts/npc-avatar-build.py), dyed and sized for the person: hair, top, bottoms,
// shoes and skin take that NPC's colours, and the real skeleton does the walking.
//
// Same contract as the other character models: feet at y = 0, FRONT is local +Z.
// The NPC controller writes limb swings into `rig`; here they drive the bones.

const TEMPLATES = {
  boy: '/assets/npc/AvatarSample_C.glb',
  girl: '/assets/npc/Sendagaya_Shino.glb',
} as const;
type TemplateId = keyof typeof TEMPLATES;
export const avatarTemplateFor = (look: NpcLook): TemplateId => (look.base === 'penny' ? 'girl' : 'boy');

/** Leg length as a share of height, for sitting (see Npcs.tsx). */
export function avatarDims(h: number) {
  return { h, legsH: h * 0.5, torsoY: h * 0.62 };
}

let ramp: DataTexture | null = null;
function toonRamp() {
  if (ramp) return ramp;
  ramp = new DataTexture(new Uint8Array([170, 225, 255]), 3, 1, RedFormat);
  ramp.minFilter = NearestFilter;
  ramp.magFilter = NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

/** The colour a part is dyed, from the material's own name (VRoid names every part). */
function dyeFor(name: string, look: NpcLook): string | null {
  const a = look.appearance;
  if (/Hair/i.test(name)) return a.hair.color || '#4a3424';
  if (/FaceBrow|Eyelash|Eyeline/i.test(name)) return null;
  if (/Tops|Onepiece|AccessoryNeck/i.test(name)) return a.top.color || '#7aa6d6';
  if (/Bottoms/i.test(name)) return a.bottom.color || '#3a4d6b';
  if (/Shoes/i.test(name)) return a.shoes.color || '#333333';
  if (/SKIN/.test(name)) {
    // the templates are fair-skinned: darker skins are a multiply towards the NPC's tone
    const c = new Color(look.skin);
    const fair = new Color('#f1cdb2');
    return `#${new Color(Math.min(1, c.r / fair.r), Math.min(1, c.g / fair.g), Math.min(1, c.b / fair.b)).getHexString()}`;
  }
  return null;
}

export function AvatarNpcModel({ look, rig }: { look: NpcLook; rig: CharRig }) {
  const template = avatarTemplateFor(look);
  const gltf = useGLTF(TEMPLATES[template]);

  const built = useMemo(() => {
    const root = SkeletonUtils.clone(gltf.scene) as Group;
    const bones: Record<string, Bone> = {};
    const face: Mesh[] = [];
    root.traverse((o: Object3D) => {
      if ((o as Bone).isBone) bones[o.name] = o as Bone;
      const m = o as SkinnedMesh;
      if (!m.isMesh) return;
      m.frustumCulled = false; // skinned bounds are the rest pose; the NPC controller culls by distance
      if (m.morphTargetDictionary && 'Fcl_EYE_Close' in m.morphTargetDictionary) face.push(m);
      const convert = (src: Material) => {
        const s = src as MeshStandardMaterial;
        const dye = dyeFor(s.name, look);
        const t = new MeshToonMaterial({
          map: s.map, gradientMap: toonRamp(), color: new Color(dye ?? '#ffffff'),
          transparent: s.transparent, alphaTest: s.transparent ? 0.02 : s.alphaTest, side: s.side, depthWrite: !s.transparent,
        });
        t.name = s.name;
        return t;
      };
      m.material = Array.isArray(m.material) ? m.material.map(convert) : convert(m.material);
    });
    // size: stand the template at this person's height
    const box = new Box3().setFromObject(root);
    const native = box.max.y - box.min.y || 1.6;
    const kid = look.height < 1.5;
    const s = look.height / native;
    // (a child is not a small adult: a bigger head and shorter legs for their height)
    if (kid && bones.J_Bip_C_Head) bones.J_Bip_C_Head.scale.setScalar(1.22);
    return { root, bones, face, scale: kid ? s / 1.06 : s };
  }, [gltf, look]);

  // stand-ins the controller swings; their angles are copied onto the skeleton each frame
  const stand = useMemo(() => ({ leftLeg: new Stand(), rightLeg: new Stand(), leftArm: new Stand(), rightArm: new Stand(), torso: new Stand() }), []);
  useEffect(() => {
    rig.leftLeg.current = stand.leftLeg;
    rig.rightLeg.current = stand.rightLeg;
    rig.leftArm.current = stand.leftArm;
    rig.rightArm.current = stand.rightArm;
    rig.torso.current = stand.torso;
  }, [rig, stand]);
  const blink = useRef({ next: 1 + Math.random() * 4, until: 0 });

  useFrame(({ clock }) => {
    const b = built.bones;
    const t = clock.elapsedTime;
    const leg = (g: Group | null, upper?: Bone, lower?: Bone) => {
      if (!g || !upper) return;
      const a = g.rotation.x; // + = swung forward (the controller's convention), − deep = sitting
      upper.rotation.x = a;
      if (lower) lower.rotation.x = a < -0.9 ? -a : Math.max(0, -a) * 0.9 + Math.max(0, a) * 0.15;
    };
    leg(stand.leftLeg, b.J_Bip_L_UpperLeg, b.J_Bip_L_LowerLeg);
    leg(stand.rightLeg, b.J_Bip_R_UpperLeg, b.J_Bip_R_LowerLeg);
    const arm = (g: Group | null, sx: number, upper?: Bone, lower?: Bone) => {
      if (!g || !upper) return;
      const a = g.rotation.x;
      if (a < -1.8) {
        // a wave: the arm goes up and the forearm wags
        upper.rotation.set(0, 0, -sx * 0.9);
        if (lower) lower.rotation.set(0, 0, -sx * (0.9 + g.rotation.z));
      } else {
        upper.rotation.set(a, 0, sx * 1.32); // arms hang at the sides (the template stands arms-out)
        if (lower) lower.rotation.set(0, sx * Math.min(0.9, Math.abs(a) * 0.8 + 0.12), 0);
      }
    };
    arm(stand.leftArm, 1, b.J_Bip_L_UpperArm, b.J_Bip_L_LowerArm);
    arm(stand.rightArm, -1, b.J_Bip_R_UpperArm, b.J_Bip_R_LowerArm);
    if (b.J_Bip_C_Spine) b.J_Bip_C_Spine.rotation.x = Math.sin(t * 1.4) * 0.015;

    const k = blink.current;
    if (t > k.next) {
      k.until = t + 0.12;
      k.next = t + 2.5 + Math.random() * 3;
    }
    for (const m of built.face) {
      const i = m.morphTargetDictionary!.Fcl_EYE_Close;
      if (m.morphTargetInfluences) m.morphTargetInfluences[i] = t < k.until ? 1 : 0;
    }
  });

  return (
    <group>
      {/* the templates face −Z; the game's characters face +Z */}
      <primitive object={built.root} scale={built.scale} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

useGLTF.preload(TEMPLATES.boy);
useGLTF.preload(TEMPLATES.girl);
