import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNightStore } from '../../state/nightStore';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { getGlowTex } from '../sky/StreetLamps';
import {
  TORSO_H, boneLine, fingerGeometry, hornGeometry, knob, limbRadius, rustTextures, skinTextures, spineCurl, sweep,
  teethGeometry, torsoGeometry,
} from './sirenGeometry';

// SIREN HEAD — a twelve-metre starved thing with two loudspeakers where a head
// should be. Still built in code (a text-to-3D model can't make "no head, just
// sirens" — it gives a skull with megaphones every time), but no longer out of
// boxes: the body is swept, lofted and lathe-turned geometry with painted skin
// (components/horror/sirenGeometry.ts), hung on a real skeleton — hips, knees,
// ankles, a spine that leans, shoulders, elbows, wrists and ten long fingers —
// so it can WALK (knees lifting, arms swinging against the stride, the stride
// matched to how fast it is actually going) rather than slide.
//
// Pure render consumer of nightStore (the host/snapshot writes where it is and
// what it is doing). Front of the body = local +Z.

const SCALE = 1.5; // ≈12 m — towers over the rooftops

const THIGH = 2.05, SHIN = 1.95, FOOT_H = 0.1;
const HIP_Y = THIGH + SHIN + FOOT_H;
const UPPER = 1.78, FORE = 1.74;
const NECK = 1.02;
/** Ground covered per step at full extension (unscaled metres) — sets how fast
 *  the legs cycle for a given speed, so the feet don't skate. */
const STRIDE = 2.5;

const SWING_DUR = 0.55; // hand-swat: raise then chop
const TWO_PI = Math.PI * 2;
function shortestAngle(from: number, to: number): number {
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}
function hash1(n: number): number {
  const s = Math.sin(n * 91.345) * 47453.5453;
  return s - Math.floor(s);
}

interface ArmRig { shoulder: THREE.Group | null; elbow: THREE.Group | null; wrist: THREE.Group | null; fingers: (THREE.Group | null)[] }
interface LegRig { hip: THREE.Group | null; knee: THREE.Group | null; ankle: THREE.Group | null }

export function SirenHead() {
  const group = useRef<THREE.Group>(null);
  const pelvis = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const horns = useRef<THREE.Group>(null);
  const wires = useRef<THREE.Group>(null);
  const legs = useRef<[LegRig, LegRig]>([{ hip: null, knee: null, ankle: null }, { hip: null, knee: null, ankle: null }]);
  const arms = useRef<[ArmRig, ArmRig]>([{ shoulder: null, elbow: null, wrist: null, fingers: [] }, { shoulder: null, elbow: null, wrist: null, fingers: [] }]);
  const hornLight = useRef<THREE.PointLight>(null);

  // ---- materials + geometry (built once) ----
  const M = useMemo(() => {
    const skinTex = skinTextures();
    const rustTex = rustTextures();
    // He is only ever out in the dark, so the hide carries a faint glow of its
    // own (its own colours, shaded by the same baked creases) — just enough for
    // ribs, knuckles and tendons to read against a night sky without a light on him.
    const skin = new THREE.MeshStandardMaterial({
      map: skinTex.map, bumpMap: skinTex.bump, bumpScale: 2.2, roughness: 0.93, metalness: 0.02, vertexColors: true,
      emissive: '#7d8894', emissiveMap: skinTex.map, emissiveIntensity: 0.2,
    });
    skin.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor.rgb * vColor.rgb;\n#endif',
      );
    };
    return {
      skin,
      rust: new THREE.MeshStandardMaterial({ map: rustTex.map, bumpMap: rustTex.bump, bumpScale: 1.6, roughness: 0.74, metalness: 0.42, side: THREE.DoubleSide, emissive: '#6f7680', emissiveMap: rustTex.map, emissiveIntensity: 0.16 }),
      // The lining of the bells: raw, wet, and lit from somewhere down the throat.
      flesh: new THREE.MeshStandardMaterial({ color: '#3a0c0a', emissive: '#c81808', emissiveIntensity: 0.4, roughness: 0.38, side: THREE.DoubleSide }),
      throat: new THREE.MeshBasicMaterial({ color: '#ff4a22', toneMapped: false }),
      teeth: new THREE.MeshStandardMaterial({ color: '#c9bb98', roughness: 0.5, emissive: '#6b5a44', emissiveIntensity: 0.35 }),
      dark: new THREE.MeshStandardMaterial({ color: '#14110e', roughness: 0.85, metalness: 0.2 }),
      beacon: new THREE.SpriteMaterial({ map: getGlowTex(), color: '#ff2a10', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4, toneMapped: false }),
    };
  }, []);

  const G = useMemo(() => {
    const down = (t: number) => t * 0.22;
    const fingers = (seed: number) => [
      fingerGeometry(0.6, 0.036, 0.3, seed + 1), fingerGeometry(0.72, 0.038, 0.26, seed + 2),
      fingerGeometry(0.68, 0.036, 0.3, seed + 3), fingerGeometry(0.54, 0.032, 0.36, seed + 4),
      fingerGeometry(0.46, 0.04, 0.42, seed + 5), // thumb
    ];
    // Neck: a rope of tendon climbing up and a little forward to the mount.
    const neckPath: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; neckPath.push(new THREE.Vector3(Math.sin(t * 2.4) * 0.03, NECK * t, 0.1 * t * t)); }
    // A cable coiled round the neck.
    const coil: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * Math.PI * 7; coil.push(new THREE.Vector3(Math.cos(a) * 0.17, 0.08 + NECK * 0.92 * t, Math.sin(a) * 0.17 + 0.1 * t * t)); }
    const hang = (dx: number, dz: number, len: number, kink: number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(dx, 0.05, dz), new THREE.Vector3(dx * 1.5, -len * 0.3, dz * 1.6 + kink), new THREE.Vector3(dx * 1.2 - kink, -len * 0.7, dz * 1.2),
      new THREE.Vector3(dx * 1.6, -len, dz * 1.5 + kink * 0.5),
    ]), 20, 0.022, 5);
    // Foot: a long flat blade of bone with three toes.
    const foot: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; foot.push(new THREE.Vector3(0, -0.03 - t * 0.03, -0.2 + t * 0.78)); }
    return {
      torso: torsoGeometry(),
      thigh: [sweep(boneLine(THIGH, 14, -0.05), limbRadius(0.125, 0.095, 0.55, 0.6), { ridges: 3, ridgeAmp: 0.13, seed: 3, shade: down }),
        sweep(boneLine(THIGH, 14, -0.05), limbRadius(0.12, 0.092, 0.55, 0.6), { ridges: 3, ridgeAmp: 0.13, seed: 8, shade: down })],
      shin: [sweep(boneLine(SHIN, 14, 0.05), limbRadius(0.09, 0.065, 0.2, 0.55), { ridges: 2, ridgeAmp: 0.14, seed: 5, shade: (t) => 0.2 + t * 0.3 }),
        sweep(boneLine(SHIN, 14, 0.05), limbRadius(0.088, 0.064, 0.2, 0.55), { ridges: 2, ridgeAmp: 0.14, seed: 11, shade: (t) => 0.2 + t * 0.3 })],
      foot: sweep(foot, (t) => 0.1 * (1 - t * 0.35) * (1 + Math.exp(-((t / 0.15) ** 2)) * 0.3), { ridges: 4, ridgeAmp: 0.12, sx: 1.45, sz: 0.62, seed: 21, shade: (t) => 0.45 + t * 0.25 }),
      toe: [fingerGeometry(0.34, 0.036, -0.22, 31), fingerGeometry(0.4, 0.04, -0.2, 32), fingerGeometry(0.32, 0.034, -0.24, 33)],
      upper: [sweep(boneLine(UPPER, 14, -0.03), limbRadius(0.085, 0.066, 0.75, 0.6), { ridges: 3, ridgeAmp: 0.14, seed: 41, shade: down }),
        sweep(boneLine(UPPER, 14, -0.03), limbRadius(0.09, 0.07, 0.75, 0.6), { ridges: 3, ridgeAmp: 0.14, seed: 47, shade: down })],
      fore: [sweep(boneLine(FORE, 14, 0.04), limbRadius(0.064, 0.05, 0.25, 0.75), { ridges: 2, ridgeAmp: 0.16, seed: 53, shade: (t) => 0.18 + t * 0.4 }),
        sweep(boneLine(FORE, 14, 0.04), limbRadius(0.068, 0.054, 0.25, 0.75), { ridges: 2, ridgeAmp: 0.16, seed: 59, shade: (t) => 0.18 + t * 0.4 })],
      palm: knob(0.145, 1.2, 1.5, 0.34, 61, 0.5),
      fingers: [fingers(70), fingers(90)],
      neck: sweep(neckPath, (t) => 0.15 - t * 0.045 + Math.exp(-((t / 0.12) ** 2)) * 0.1, { ridges: 5, ridgeAmp: 0.2, lump: 0.12, seed: 101, vPer: 0.8, shade: (t) => 0.1 + t * 0.15 }),
      coil: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 120, 0.02, 5),
      hang: [hang(0.12, 0.14, 1.5, 0.12), hang(-0.16, -0.1, 2.2, -0.15), hang(0.05, -0.18, 0.95, 0.08), hang(-0.1, 0.16, 1.25, -0.1)],
      hipBone: knob(0.15, 1.15, 0.8, 0.85, 111),
      blade: knob(0.2, 0.75, 1.25, 0.32, 121, 0.2),
      shoulder: knob(0.13, 1.1, 0.95, 1, 131),
      hub: knob(0.2, 1.35, 0.9, 1, 141, 0.3),
      collar: [0, 1].map((k) => sweep(
        [new THREE.Vector3(0, 0, 0), new THREE.Vector3((k ? -1 : 1) * 0.2, 0.03, 0.03), new THREE.Vector3((k ? -1 : 1) * 0.42, 0.05, -0.02), new THREE.Vector3((k ? -1 : 1) * 0.6, 0.0, -0.1)],
        () => 0.042, { radial: 7, ridges: 2, ridgeAmp: 0.08, seed: 150 + k })),
      horn: hornGeometry(false),
      lining: hornGeometry(true),
      teeth: [teethGeometry(7), teethGeometry(19)],
    };
  }, []);

  const rx = useRef(useNightStore.getState().sirenX);
  const rz = useRef(useNightStore.getState().sirenZ);
  const ryaw = useRef(useNightStore.getState().sirenYaw);
  const A = useRef({
    walkPhase: 0, moving: 0, chase: 0, alert: 0, glow: 0.7,
    headYaw: 0, headGoal: 0, nextLook: 0, swingStart: -10, lastSwing: 0, wireLag: 0,
  });

  useFrame((state, dtRaw) => {
    const g = group.current;
    if (!g) return;
    const mode = useGameStore.getState().gameMode;
    const ns = useNightStore.getState();
    // Siren Head Night always; Free Play only while he's out after dark.
    // (DEV: `window.__sirenShow = true` shows him at any hour, for inspection.)
    const shown = mode === 'night' || (mode === 'freeplay' && ns.stalkerActive)
      || (import.meta.env.DEV && !!(window as unknown as { __sirenShow?: boolean }).__sirenShow);
    if (g.visible !== shown) g.visible = shown;
    if (!shown) return;
    const dt = Math.min(dtRaw, 0.1);
    const a = A.current;
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);

    const prevX = rx.current, prevZ = rz.current;
    const k = ease(12);
    rx.current += (ns.sirenX - rx.current) * k;
    rz.current += (ns.sirenZ - rz.current) * k;
    const dyaw = shortestAngle(ryaw.current, ns.sirenYaw) * k;
    ryaw.current += dyaw;
    const moveSpeed = Math.hypot(rx.current - prevX, rz.current - prevZ) / dt;

    g.position.x = rx.current;
    g.position.z = rz.current;
    g.rotation.y = ryaw.current;

    const chasing = ns.sirenState === 'chase';
    const alerted = ns.sirenState === 'alerted';
    a.chase += ((chasing ? 1 : 0) - a.chase) * ease(4);
    a.alert += ((alerted ? 1 : 0) - a.alert) * ease(6);
    a.moving += ((moveSpeed > 0.35 ? 1 : 0) - a.moving) * ease(5);
    const t = state.clock.elapsedTime;
    const m = a.moving, ch = a.chase, al = a.alert;

    // ---- the walk: phase advances with DISTANCE, so stride matches speed ----
    a.walkPhase += dt * Math.PI * Math.min(moveSpeed, 14) / (STRIDE * SCALE * (1 + ch * 0.35));
    const wp = a.walkPhase;
    const amp = (0.4 + ch * 0.24) * m;
    const sw = Math.sin(wp);

    // A shudder now and then: one frame-ish of wrongness through the frame.
    const tw = Math.floor(t / 0.16);
    const twitch = hash1(tw) < 0.03 ? (hash1(tw + 7) - 0.5) * 2 : 0;
    const breath = Math.sin(t * 1.15);

    const lean = 0.1 + ch * 0.34 - al * 0.14 + breath * 0.012;
    if (pelvis.current) {
      // Lowest when the legs are widest apart; hips rock over the planted foot.
      pelvis.current.position.set(sw * 0.07 * m, HIP_Y - (0.1 + ch * 0.1) * m * Math.abs(sw) - ch * 0.12, 0);
      pelvis.current.rotation.set(0, sw * 0.09 * m, sw * 0.04 * m);
    }
    for (let i = 0; i < 2; i++) {
      const L = legs.current[i];
      const ph = wp + (i ? Math.PI : 0);
      const thigh = -amp * Math.sin(ph) - lean * 0.25 - ch * 0.12;
      // The knee folds while the leg is travelling forward, and stays a touch
      // bent the rest of the time (it never quite straightens — spider-ish).
      const knee = 0.1 + ch * 0.22 + m * (0.75 + ch * 0.4) * Math.pow(Math.max(0, Math.cos(ph)), 1.25);
      if (L.hip) L.hip.rotation.x = thigh;
      if (L.knee) L.knee.rotation.x = knee;
      if (L.ankle) L.ankle.rotation.x = -(thigh + knee) * 0.9;
    }
    if (spine.current) {
      spine.current.rotation.set(lean, -sw * 0.12 * m + twitch * 0.03, -sw * 0.045 * m + Math.sin(t * 0.47) * 0.018);
      const s = 1 + breath * 0.012;
      spine.current.scale.set(s, 1, 1 + breath * 0.02);
    }

    // ---- HAND-SWAT: latch on the swing counter, override the right arm ----
    if (ns.sirenSwingCount !== a.lastSwing) { a.lastSwing = ns.sirenSwingCount; a.swingStart = t; }
    const swingP = (t - a.swingStart) / SWING_DUR;
    const swatting = swingP >= 0 && swingP < 1;

    for (let i = 0; i < 2; i++) {
      const R = arms.current[i];
      const side = i ? -1 : 1;                       // arm 1 is the right (−X) arm, the swatter
      const ph = wp + (i ? 0 : Math.PI);             // opposite to the leg on the same side
      const dangle = Math.sin(t * 0.8 + i * 2.1) * 0.03;
      let sh = Math.sin(ph) * amp * 0.55 - lean * 0.7 + dangle - ch * 0.62 - al * 0.12;
      let el = -(0.16 + m * 0.12 + ch * 0.55 + al * 0.2 + Math.max(0, Math.sin(ph)) * amp * 0.35);
      let wr = -0.08 - ch * 0.35;
      let curl = 0.12 + Math.sin(t * 1.7 + i) * 0.05 - ch * 0.3 - al * 0.22;
      if (i === 1 && swatting) {
        // Raise overhead (0–0.4), then CHOP down and through (0.4–1).
        sh = swingP < 0.4 ? -2.6 * (swingP / 0.4) : -2.6 + 3.8 * ((swingP - 0.4) / 0.6);
        el = swingP < 0.4 ? -0.9 * (swingP / 0.4) : -0.9 * (1 - (swingP - 0.4) / 0.6) - 0.05;
        wr = -0.25; curl = -0.3;
      }
      if (R.shoulder) R.shoulder.rotation.set(sh, 0, side * (0.07 + ch * 0.1 + al * 0.08) + (i === 0 ? twitch * 0.05 : 0));
      if (R.elbow) R.elbow.rotation.x = el;
      if (R.wrist) R.wrist.rotation.x = wr;
      R.fingers.forEach((f, fi) => {
        if (!f) return;
        // Fingers work on their own a little — never all together.
        f.rotation.x = curl + Math.sin(t * (1.3 + fi * 0.37) + fi * 1.9 + i * 3) * 0.06 + (hash1(tw + fi * 3 + i) < 0.02 ? 0.35 : 0);
      });
    }

    // ---- the head: it LOOKS at you. Long still stares, then a snap. ----
    if (neck.current) neck.current.rotation.set(-lean * 0.55 - al * 0.1 + ch * 0.12, 0, Math.sin(t * 0.6) * 0.03 + twitch * 0.06);
    if (horns.current) {
      if (chasing || alerted) a.headGoal = 0;         // dead ahead: straight at whoever it has found
      else if (t > a.nextLook) {
        a.nextLook = t + 1.1 + hash1(tw) * 2.4;
        const game = useGameStore.getState();
        const localId = useNetStore.getState().myCharacterId ?? game.activeCharacterId;
        const p = game.positions[localId];
        // Mostly it fixes on you; sometimes it listens somewhere else entirely.
        if (p && hash1(tw + 3) > 0.28) a.headGoal = shortestAngle(0, Math.atan2(-(p.x - rx.current), -(p.z - rz.current)) - ryaw.current);
        else a.headGoal = (hash1(tw + 5) - 0.5) * 2.6;
      }
      a.headYaw += shortestAngle(a.headYaw, a.headGoal) * ease(chasing ? 14 : 20);
      horns.current.rotation.set(Math.sin(t * 0.9) * 0.025 + ch * 0.1, a.headYaw, Math.sin(t * 0.53) * 0.05 + twitch * 0.09);
    }
    // Loose cables trail behind the motion and swing back.
    if (wires.current) {
      a.wireLag += ((Math.min(moveSpeed, 9) * 0.035 + Math.abs(dyaw) * 3) - a.wireLag) * ease(3);
      wires.current.rotation.set(-a.wireLag + Math.sin(t * 1.3) * 0.04, 0, Math.sin(t * 0.9) * 0.06);
    }

    g.rotation.z = Math.sin(t * 0.37) * 0.012;
    g.rotation.x = 0;

    // ---- the glow down its throats: dim and slow, rising to a blaze ----
    const targetGlow = chasing ? 3.4 : alerted ? 2.1 : 1.05;
    a.glow += (targetGlow - a.glow) * ease(6);
    const pulse = 0.68 + 0.32 * Math.sin(t * (chasing ? 7 : 2.5));
    const flick = Math.random() < 0.04 ? 0.4 : 1;
    const em = a.glow * pulse * flick;
    M.flesh.emissiveIntensity = em * 0.34;
    M.throat.color.setRGB(Math.min(1, 0.25 + em * 0.3), 0.05 + em * 0.05, 0.03 + em * 0.02);
    if (hornLight.current) hornLight.current.intensity = 1.6 + em * 1.9;
    // The red beacons are for spotting him from the far end of the street; up
    // close they fade so you can see down the throats — teeth and all.
    const cam = state.camera.position;
    const camD = Math.hypot(cam.x - rx.current, cam.z - rz.current);
    M.beacon.opacity = Math.min(1, 0.22 + em * 0.2) * Math.max(0.1, Math.min(1, (camD - 14) / 26));
  });

  const cz = (t: number) => spineCurl(t);
  return (
    <group ref={group}>
      <group scale={SCALE}>
        <group ref={pelvis} position={[0, HIP_Y, 0]}>
          {/* ---- legs: hip → knee → ankle (left is +X, a shade longer in the shin) ---- */}
          {[1, -1].map((side, i) => (
            <group key={side} ref={(el) => { legs.current[i].hip = el; }} position={[side * 0.24, 0.02, 0.02]}>
              <mesh geometry={G.thigh[i]} material={M.skin} castShadow />
              <group ref={(el) => { legs.current[i].knee = el; }} position={[0, -THIGH, 0]}>
                <mesh geometry={G.shin[i]} material={M.skin} castShadow />
                <group ref={(el) => { legs.current[i].ankle = el; }} position={[0, -SHIN, 0]}>
                  <mesh geometry={G.foot} material={M.skin} castShadow />
                  {[-0.09, 0, 0.09].map((dx, k) => (
                    <mesh key={k} geometry={G.toe[k]} material={M.skin} position={[dx, -0.06, 0.52]} rotation={[-Math.PI / 2, 0, -dx * 2.2]} />
                  ))}
                </group>
              </group>
            </group>
          ))}

          {/* ---- everything above the hips leans and breathes together ---- */}
          <group ref={spine}>
            <mesh geometry={G.torso} material={M.skin} castShadow />
            {[1, -1].map((s) => (
              <group key={s}>
                {/* hip bones standing out under the skin; shoulder blades; shoulder knobs */}
                <mesh geometry={G.hipBone} material={M.skin} position={[s * 0.27, 0.2, 0.11]} />
                <mesh geometry={G.blade} material={M.skin} position={[s * 0.24, TORSO_H * 0.78, cz(0.78) - 0.25]} rotation={[0.15, s * 0.35, s * -0.12]} />
                <mesh geometry={G.shoulder} material={M.skin} position={[s * 0.6, TORSO_H - 0.1, cz(0.95) - 0.02]} castShadow />
              </group>
            ))}
            {/* collar bones */}
            {G.collar.map((geo, k) => <mesh key={k} geometry={geo} material={M.skin} position={[0, TORSO_H - 0.07, cz(0.97) + 0.1]} />)}

            {/* ---- arms: shoulder → elbow → wrist → five fingers. The right (−X) one swats. ---- */}
            {[1, -1].map((side, i) => (
              <group key={side} ref={(el) => { arms.current[i].shoulder = el; }} position={[side * 0.6, TORSO_H - 0.1, cz(0.95) - 0.02]}>
                <mesh geometry={G.upper[i]} material={M.skin} castShadow />
                <group ref={(el) => { arms.current[i].elbow = el; }} position={[0, -UPPER, 0]}>
                  <mesh geometry={G.fore[i]} material={M.skin} castShadow />
                  <group ref={(el) => { arms.current[i].wrist = el; }} position={[0, -FORE, 0]} scale={i === 1 ? 1.22 : 1.05}>
                    <mesh geometry={G.palm} material={M.skin} position={[0, -0.2, 0]} castShadow />
                    {[-0.125, -0.042, 0.042, 0.125].map((dx, f) => (
                      <group key={f} ref={(el) => { arms.current[i].fingers[f] = el; }} position={[dx * side, -0.4, 0.01]} rotation={[0, 0, dx * side * 1.1]}>
                        <mesh geometry={G.fingers[i][f]} material={M.skin} castShadow />
                      </group>
                    ))}
                    <group ref={(el) => { arms.current[i].fingers[4] = el; }} position={[side * -0.15, -0.14, 0.03]} rotation={[0, 0, side * -0.75]}>
                      <mesh geometry={G.fingers[i][4]} material={M.skin} />
                    </group>
                  </group>
                </group>
              </group>
            ))}

            {/* ---- neck, and the thing where a head should be ---- */}
            <group ref={neck} position={[0, TORSO_H - 0.04, cz(1)]}>
              <mesh geometry={G.neck} material={M.skin} castShadow />
              <mesh geometry={G.coil} material={M.dark} />
              <group ref={horns} position={[0, NECK + 0.08, 0.1]}>
                {/* a knot of flesh grown round the mount, clamped in iron */}
                <mesh geometry={G.hub} material={M.skin} castShadow />
                <mesh material={M.rust} rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.2, 0.2, 0.62, 16]} />
                </mesh>
                {[-0.2, 0.2].map((x) => (
                  <mesh key={x} material={M.dark} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                    <torusGeometry args={[0.215, 0.022, 6, 20]} />
                  </mesh>
                ))}
                {/* the two sirens: mouths OUT, one bigger and cocked upward */}
                {[1, -1].map((s, h) => (
                  <group key={s} position={[s * 0.28, h ? -0.01 : 0.05, 0]} rotation={[h ? -0.06 : 0.07, 0, -s * Math.PI / 2 + (h ? 0.05 : -0.09) * s]} scale={h ? 0.93 : 1.09}>
                    <mesh geometry={G.horn} material={M.rust} castShadow />
                    <mesh material={M.rust} position={[0, 1.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
                      <torusGeometry args={[0.8, 0.03, 6, 32]} />
                    </mesh>
                    <mesh geometry={G.lining} material={M.flesh} />
                    <mesh geometry={G.teeth[h]} material={M.teeth} />
                    <mesh material={M.throat} position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                      <circleGeometry args={[0.07, 12]} />
                    </mesh>
                    <sprite position={[0, 1.4, 0]} scale={[1.5, 1.5, 1]} renderOrder={5} material={M.beacon} />
                  </group>
                ))}
                {/* loose cables hanging off the mount */}
                <group ref={wires}>
                  {G.hang.map((geo, k) => <mesh key={k} geometry={geo} material={M.dark} />)}
                </group>
                <pointLight ref={hornLight} color="#ff3a1a" intensity={1.6} distance={24} decay={1.6} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
