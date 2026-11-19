// Kite: a small hooded traveler built from code so every motion can follow the music.
// The same model, drawn in light, is an Echo.
//
// Personality rules (bible §9.6): readable, brief reactions — lean toward a forming stone,
// a little effort on a high leap, delight on a glide, a wobble (never a crash) on a miss.

import * as THREE from 'three-afternote';
import { COLORS, KITE } from '../core/Constants.js';
import { G, GLSL_COMMON, softDotTexture } from './Shared.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _side = new THREE.Vector3();

// ---------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------

function clothMaterial({ ghost = false, color = COLORS.CLOAK, light = COLORS.CLOAK_LIGHT, trim = COLORS.CLOAK_TRIM, echoColor = 0xa9d8ff, cloak = false }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...G,
      uColor: { value: new THREE.Color(color) },
      uLight: { value: new THREE.Color(light) },
      uTrim: { value: new THREE.Color(trim) },
      uEcho: { value: new THREE.Color(echoColor) },
      uBillow: { value: 0 },
      uLift: { value: 0 },
      uFlare: { value: 0 },
      uOpacity: { value: 1 },
      uPulse: { value: 0 },
    },
    defines: { ...(ghost ? { GHOST: '' } : {}), ...(cloak ? { CLOAK: '' } : {}) },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uBillow; uniform float uLift; uniform float uFlare;
      attribute float aW;
      varying vec3 vWorldPos; varying vec3 vNormalW; varying float vW; varying float vAng;
      void main() {
        vec3 p = position;
        float w = 0.0; float ang = 0.0;
        #ifdef CLOAK
          ang = atan(p.x, p.z);
          float back = clamp((1.0 - cos(ang)) * 0.5, 0.0, 1.0);
          w = aW * aW;
          p.xz *= 1.0 + w * uFlare * 0.3;
          p.z -= w * back * uBillow * (0.46 + 0.1 * sin(uTime * 7.0 + ang * 3.0));
          p.y += w * (uLift * 0.24 + back * uBillow * 0.2);
          p.x += w * sin(uTime * 8.0 + p.y * 10.0 + ang * 2.0) * 0.022 * (0.4 + uBillow);
          p.z += w * cos(uTime * 6.3 + ang * 4.0) * 0.012 * (0.4 + uBillow);
        #endif
        vW = aW; vAng = ang;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uColor; uniform vec3 uLight; uniform vec3 uTrim; uniform vec3 uEcho;
      uniform float uOpacity; uniform float uPulse;
      varying vec3 vWorldPos; varying vec3 vNormalW; varying float vW; varying float vAng;
      void main() {
        vec3 N = normalize(vNormalW);
        if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(cameraPosition - vWorldPos);
        #ifdef GHOST
          // an Echo is drawn in light: bright at the edges, nearly clear in the middle
          float fres = pow(1.0 - abs(dot(N, V)), 1.6);
          float band = 0.5 + 0.5 * sin(vWorldPos.y * 22.0 - uTime * 3.0);
          vec3 col = uEcho * (0.5 + 2.0 * fres + 0.12 * band + uPulse * 1.6);
          float a = (0.3 + 0.7 * fres + uPulse * 0.4) * uOpacity;
          gl_FragColor = vec4(col * a, a);
        #else
          vec3 albedo = mix(uColor, uLight, smoothstep(0.1, 1.0, vW) * 0.55);
          vec3 emissive = vec3(0.0);
          #ifdef CLOAK
            // gold hem and a finer line above it, with a little stitched pattern between
            float hem = smoothstep(0.86, 0.9, vW);
            float line = smoothstep(0.7, 0.72, vW) * (1.0 - smoothstep(0.74, 0.76, vW));
            float stitch = smoothstep(0.76, 0.78, vW) * (1.0 - smoothstep(0.84, 0.86, vW)) * step(0.72, sin(vAng * 13.0) * 0.5 + 0.5);
            float gold = clamp(hem + line + stitch, 0.0, 1.0);
            albedo = mix(albedo, uTrim, gold);
            emissive = uTrim * gold * 0.22;
          #endif
          vec3 shade = albedo * 0.38 + vec3(0.01, 0.015, 0.05);
          vec3 col = stylizedLight(albedo, shade, N, V, vWorldPos, 1.15) + emissive;
          col = applyFog(col, vWorldPos, cameraPosition);
          gl_FragColor = vec4(col, 1.0);
        #endif
      }
    `,
    side: THREE.DoubleSide,
    transparent: ghost,
    depthWrite: !ghost,
    blending: ghost ? THREE.CustomBlending : THREE.NormalBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

// ---------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------

function cloakGeometry() {
  // profile from hem (bottom) to neck (top)
  const profile = [
    [0.4, 0.17], [0.395, 0.22], [0.37, 0.3], [0.33, 0.4], [0.28, 0.5], [0.23, 0.6], [0.185, 0.68], [0.15, 0.74], [0.12, 0.78],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile, 36);
  const pos = geo.attributes.position;
  const w = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = 1 - Math.min(1, Math.max(0, (y - 0.17) / 0.61));
    w[i] = t;
    // a ragged, travelled hem; a little longer behind than in front
    const ang = Math.atan2(x, z);
    const rag = 1 + t * t * (0.07 * Math.sin(ang * 7.0) + 0.04 * Math.sin(ang * 13.0 + 1.3));
    const longer = t * t * 0.07 * (1 - Math.cos(ang)) * 0.5;
    pos.setXYZ(i, x * rag, y - longer, z * rag);
  }
  geo.setAttribute('aW', new THREE.BufferAttribute(w, 1));
  geo.computeVertexNormals();
  return geo;
}

function withWeight(geo, value = 0) {
  geo.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(value), 1));
  return geo;
}

// ---------------------------------------------------------------------------------
// A ribbon that trails a moving point (Kite's scarf tail, an Echo's light trail)
// ---------------------------------------------------------------------------------
export class Streamer {
  constructor(scene, { nodes = 12, segment = 0.14, width = 0.12, color = COLORS.CLOAK_TRIM, additive = false, droop = 0.9, opacity = 1 }) {
    this.n = nodes;
    this.segment = segment;
    this.width = width;
    this.droop = droop;
    this.points = Array.from({ length: nodes }, () => new THREE.Vector3());
    const pos = new Float32Array(nodes * 2 * 3);
    const uv = new Float32Array(nodes * 2 * 2);
    const idx = [];
    for (let i = 0; i < nodes; i++) {
      uv.set([i / (nodes - 1), 0, i / (nodes - 1), 1], i * 4);
      if (i < nodes - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: G.uTime },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: additive
        ? /* glsl */ `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
            void main(){ float a = (1.0 - vUv.x); a *= a; float e = 1.0 - abs(vUv.y - 0.5) * 2.0; a *= smoothstep(0.0, 0.8, e) * uOpacity; gl_FragColor = vec4(uColor * a * 1.6, a); }`
        : /* glsl */ `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
            void main(){ vec3 c = mix(uColor, uColor * vec3(1.0, 0.72, 0.45), vUv.x); float bow = step(0.86, fract(vUv.x * 3.0 + 0.1)); c = mix(c, vec3(1.0, 0.9, 0.7), bow * 0.5); gl_FragColor = vec4(c * (0.75 + 0.5 * vUv.x), uOpacity); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.ready = false;
  }

  reset(anchor) {
    for (const p of this.points) p.copy(anchor);
    this.ready = true;
  }

  update(anchor, dt, cameraPos) {
    if (!this.ready) this.reset(anchor);
    const pts = this.points;
    pts[0].copy(anchor);
    const t = G.uTime.value;
    for (let i = 1; i < this.n; i++) {
      const p = pts[i];
      p.y -= this.droop * dt * (0.4 + i * 0.05);
      p.x += Math.sin(t * 3.1 + i * 0.9) * dt * 0.12;
      p.z += Math.cos(t * 2.3 + i * 1.3) * dt * 0.08;
      _v.subVectors(p, pts[i - 1]);
      const len = _v.length() || 1e-4;
      p.copy(pts[i - 1]).addScaledVector(_v, this.segment / len);
    }
    const pos = this.geo.attributes.position;
    for (let i = 0; i < this.n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(this.n - 1, i + 1)];
      _v.subVectors(b, a).normalize();
      _w.subVectors(cameraPos, pts[i]).normalize();
      _side.crossVectors(_v, _w).normalize();
      const taper = 1 - (i / (this.n - 1)) * 0.75;
      const hw = this.width * 0.5 * taper;
      pos.setXYZ(i * 2, pts[i].x - _side.x * hw, pts[i].y - _side.y * hw, pts[i].z - _side.z * hw);
      pos.setXYZ(i * 2 + 1, pts[i].x + _side.x * hw, pts[i].y + _side.y * hw, pts[i].z + _side.z * hw);
    }
    pos.needsUpdate = true;
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ---------------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------------
let GEO = null;
function geometries() {
  if (GEO) return GEO;
  GEO = {
    cloak: cloakGeometry(),
    hood: withWeight(new THREE.SphereGeometry(0.285, 28, 20), 0.15),
    face: withWeight(new THREE.SphereGeometry(0.215, 20, 14), 0),
    ear: withWeight(new THREE.ConeGeometry(0.085, 0.22, 10), 0.3),
    tip: withWeight(new THREE.ConeGeometry(0.13, 0.3, 12), 0.3),
    rim: withWeight(new THREE.TorusGeometry(0.2, 0.022, 8, 28), 1),
    leg: withWeight(new THREE.CapsuleGeometry(0.058, 0.16, 4, 10), 0),
    boot: withWeight(new THREE.SphereGeometry(0.085, 12, 10), 0),
    arm: withWeight(new THREE.CapsuleGeometry(0.05, 0.14, 4, 8), 0.2),
    hand: withWeight(new THREE.SphereGeometry(0.052, 10, 8), 0),
    eye: new THREE.SphereGeometry(0.026, 10, 8),
    ember: new THREE.OctahedronGeometry(0.07, 0),
  };
  return GEO;
}

export class KiteModel {
  /**
   * @param {THREE.Scene} scene
   * @param {{ghost?:boolean, echoColor?:number}} opts
   */
  constructor(scene, { ghost = false, echoColor = 0xa9d8ff } = {}) {
    const g = geometries();
    this.scene = scene;
    this.ghost = ghost;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const mk = (o = {}) => clothMaterial({ ghost, echoColor, ...o });
    this.mats = [];
    const track = (m) => {
      this.mats.push(m);
      return m;
    };
    this.cloakMat = track(mk({ cloak: true }));
    const hoodMat = track(mk({ color: COLORS.CLOAK, light: COLORS.CLOAK_LIGHT }));
    const darkMat = track(mk({ color: 0x0d0f1c, light: 0x0d0f1c }));
    const trimMat = track(mk({ color: COLORS.CLOAK_TRIM, light: 0xfff0c0 }));
    this.hoodMat = hoodMat;
    this.trimMat = trimMat;
    const bootMat = track(mk({ color: 0x4a3526, light: 0x6b4d36 }));
    const legMat = track(mk({ color: 0x1c2040, light: 0x2c3260 }));

    // legs
    this.legs = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(0.085 * s, 0.3, 0.0);
      const leg = new THREE.Mesh(g.leg, legMat);
      leg.position.y = -0.13;
      const boot = new THREE.Mesh(g.boot, bootMat);
      boot.position.set(0, -0.255, 0.03);
      boot.scale.set(1, 0.72, 1.35);
      hip.add(leg, boot);
      this.body.add(hip);
      return hip;
    });

    // cloak
    this.cloak = new THREE.Mesh(g.cloak, this.cloakMat);
    this.body.add(this.cloak);

    // arms (mostly hidden under the cloak until they are needed)
    this.arms = [-1, 1].map((s) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.17 * s, 0.66, 0.02);
      const arm = new THREE.Mesh(g.arm, hoodMat);
      arm.position.y = -0.11;
      const hand = new THREE.Mesh(g.hand, darkMat);
      hand.position.y = -0.22;
      shoulder.add(arm, hand);
      shoulder.userData.side = s;
      this.body.add(shoulder);
      return shoulder;
    });

    // head: hood, shadowed face, two small warm eyes, pointed ears
    this.head = new THREE.Group();
    this.head.position.set(0, 0.93, 0.02);
    const hood = new THREE.Mesh(g.hood, hoodMat);
    hood.scale.set(1, 0.96, 1.04);
    const face = new THREE.Mesh(g.face, darkMat);
    face.position.set(0, -0.015, 0.105);
    face.scale.set(0.95, 0.9, 0.8);
    const rim = new THREE.Mesh(g.rim, trimMat);
    rim.position.set(0, -0.015, 0.2);
    rim.scale.set(1, 0.93, 0.6);
    this.head.add(hood, face, rim);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(g.ear, hoodMat);
      ear.position.set(0.15 * s, 0.26, -0.02);
      ear.rotation.z = -0.3 * s;
      ear.rotation.x = -0.15;
      this.head.add(ear);
    }
    const tip = new THREE.Mesh(g.tip, hoodMat);
    tip.position.set(0, 0.12, -0.26);
    tip.rotation.x = -1.95;
    this.head.add(tip);
    this.eyes = [];
    if (!ghost) {
      const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(2.2) });
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(g.eye, eyeMat);
        eye.position.set(0.075 * s, -0.01, 0.262);
        eye.scale.set(1, 1.25, 0.6);
        this.head.add(eye);
        this.eyes.push(eye);
      }
    }
    this.body.add(this.head);

    // the Pulse: an ember floating near the chest
    this.ember = new THREE.Group();
    const emberColor = ghost ? new THREE.Color(echoColor) : new THREE.Color(COLORS.EMBER);
    this.emberCore = new THREE.Mesh(g.ember, new THREE.MeshBasicMaterial({ color: emberColor.clone().multiplyScalar(ghost ? 1.6 : 3.2), transparent: ghost, opacity: ghost ? 0.8 : 1 }));
    this.emberGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: emberColor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.emberGlow.scale.setScalar(1.25);
    this.ember.add(this.emberCore, this.emberGlow);
    this.root.add(this.ember);
    this.emberColor = emberColor;
    this.emberFlash = 0;

    // contact shadow
    this.shadow = null;
    if (!ghost) {
      this.shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: softDotTexture(), color: 0x05060c, transparent: true, opacity: 0.5, depthWrite: false }),
      );
      this.shadow.renderOrder = 3;
      scene.add(this.shadow);
    }

    // scarf tail for Kite; a longer trail of light for an Echo
    this.tail = ghost
      ? new Streamer(scene, { nodes: 22, segment: 0.2, width: 0.34, color: echoColor, additive: true, droop: 0.05, opacity: 0.8 })
      : new Streamer(scene, { nodes: 12, segment: 0.105, width: 0.085, color: 0xc8963c, droop: 1.3 });

    scene.add(this.root);

    // animation state
    this.phase = 0;
    this.squash = 0;
    this.squashVel = 0;
    this.wasAir = false;
    this.yaw = 0;
    this.yawOffset = 0;
    this.roll = 0;
    this.pitch = 0;
    this.poseTime = 0;
    this.lastPose = 'idle';
    this.prev = new THREE.Vector3();
    this.hasPrev = false;
    this.joint = { legL: 0, legR: 0, armLx: 0, armRx: 0, armLz: 0, armRz: 0, headYaw: 0, headPitch: 0, lean: 0, bob: 0 };
    this.opacity = 1;
    this.lookBack = 0; // 0..1: turn to face back down the path
    this.visible = true;
  }

  setOpacity(o) {
    this.opacity = o;
    for (const m of this.mats) m.uniforms.uOpacity.value = o;
    this.tail.mat.uniforms.uOpacity.value = o * (this.ghost ? 0.8 : 1);
    this.emberGlow.material.opacity = o;
    if (this.ghost) this.emberCore.material.opacity = 0.8 * o;
  }

  setVisible(v) {
    this.visible = v;
    this.root.visible = v;
    this.tail.mesh.visible = v;
    if (this.shadow) this.shadow.visible = v;
  }

  /** A note was just played: the ember answers in that pitch's colour. */
  /**
   * Wear another cloak: the cloth, its lit side, its trim, the ember and the scarf.
   * (An Echo is made of light and keeps its own colour.)
   * @param {{cloak:number, light:number, trim:number, ember:number, tail:number}} look
   */
  setLook(look) {
    if (this.ghost || !look) return;
    for (const m of [this.cloakMat, this.hoodMat]) {
      m.uniforms.uColor.value.set(look.cloak);
      m.uniforms.uLight.value.set(look.light);
    }
    this.cloakMat.uniforms.uTrim.value.set(look.trim);
    this.trimMat.uniforms.uColor.value.set(look.trim);
    this.emberColor.set(look.ember);
    this.emberCore.material.color.copy(this.emberColor).multiplyScalar(3.2);
    this.emberGlow.material.color.copy(this.emberColor);
    this.tail.mat.uniforms.uColor.value.set(look.tail);
  }

  flash(color, strength = 1) {
    this.emberFlash = Math.max(this.emberFlash, strength);
    if (color !== undefined) this.flashColor = new THREE.Color(color);
    for (const m of this.mats) m.uniforms.uPulse.value = strength;
  }

  /**
   * @param {THREE.Vector3} position  feet position in world space
   * @param {number} yaw              heading (radians, 0 faces -Z)
   * @param {{pose:string, air:boolean, u:number}} state
   * @param {number} dt
   * @param {THREE.Vector3} cameraPos
   */
  update(position, yaw, state, dt, cameraPos) {
    if (!this.visible) return;
    const j = this.joint;
    const t = G.uTime.value;
    const pose = state.pose;
    if (pose !== this.lastPose) {
      this.poseTime = 0;
      this.lastPose = pose;
    }
    this.poseTime += dt;

    // velocity from the last frame (world space)
    if (!this.hasPrev) {
      this.prev.copy(position);
      this.hasPrev = true;
    }
    _v.subVectors(position, this.prev);
    const inv = dt > 1e-5 ? 1 / dt : 0;
    const speed = Math.hypot(_v.x, _v.z) * inv;
    const vy = _v.y * inv;
    // lateral speed relative to heading
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const lateral = (_v.x * -fz + _v.z * fx) * inv;
    this.prev.copy(position);

    this.phase += speed * dt * 2.7;
    const k = Math.min(1, dt * 14);
    const amp = Math.min(1, speed / 3.5);

    let legL = 0, legR = 0, armLx = 0, armRx = 0, armLz = 0.12, armRz = 0.12, lean = 0, headPitch = 0, headYaw = 0, bob = 0;
    let billow = Math.min(1, speed / 7) * 0.75;
    let flare = 0;
    let roll = -lateral * 0.035;

    if (pose === 'leap') {
      const u = state.u;
      const s = Math.sin(Math.PI * u);
      legL = 0.95 - 0.4 * u;
      legR = -0.85 + 1.25 * u;
      armLx = armRx = -0.5;
      armLz = armRz = 1.0 + 0.4 * s;
      lean = 0.28 - 0.5 * u;
      headPitch = -0.2 + 0.35 * u;
      billow = 0.9;
      flare = 0.55 * s;
      this.body.scale.y += (1 + 0.1 * s - this.body.scale.y) * k;
    } else if (pose === 'glide') {
      legL = -0.75 + 0.1 * Math.sin(t * 3.0);
      legR = -0.55 + 0.1 * Math.sin(t * 3.0 + 1.2);
      armLx = armRx = -1.25;
      armLz = armRz = 0.75 + 0.1 * Math.sin(t * 2.2);
      lean = 0.42;
      headPitch = -0.22;
      billow = 1.0;
      flare = 0.2;
      roll += Math.sin(t * 1.8) * 0.07;
      bob = Math.sin(t * 2.4) * 0.03 + 0.05;
    } else if (pose === 'stumble') {
      const d = Math.exp(-this.poseTime * 5);
      legL = Math.sin(this.phase) * 0.9 * amp;
      legR = -legL;
      armLx = armRx = -0.8 * d;
      armLz = armRz = 0.2 + 1.2 * d;
      lean = 0.16 + 0.5 * d;
      headPitch = 0.3 * d;
    } else if (pose === 'wobble') {
      const d = Math.exp(-this.poseTime * 2.4);
      legL = Math.sin(this.phase) * 0.7 * amp;
      legR = -legL;
      armLz = 0.3 + 1.3 * d;
      armRz = 0.3 + 1.3 * d;
      roll += Math.sin(this.poseTime * 13) * 0.32 * d;
      lean = 0.1;
    } else if (pose === 'idle') {
      const breathe = Math.sin(t * 1.7);
      bob = breathe * 0.008;
      headPitch = -0.08 + 0.04 * Math.sin(t * 0.9);
      headYaw = 0.12 * Math.sin(t * 0.6);
      armLz = armRz = 0.1;
      billow = 0.08;
      this.body.scale.y += (1 + breathe * 0.012 - this.body.scale.y) * k;
    } else {
      // run
      const sw = Math.sin(this.phase);
      legL = sw * 0.95 * amp;
      legR = -sw * 0.95 * amp;
      armLx = -sw * 0.5 * amp;
      armRx = sw * 0.5 * amp;
      lean = 0.1 + 0.1 * amp;
      bob = Math.abs(Math.cos(this.phase)) * 0.04 * amp;
      headPitch = -0.05;
      this.body.scale.y += (1 - this.body.scale.y) * k;
    }

    // landing squash: a quick spring when feet touch down
    if (this.wasAir && !state.air) this.squashVel = -3.2;
    this.wasAir = state.air;
    this.squashVel += (-this.squash * 160 - this.squashVel * 13) * dt;
    this.squash += this.squashVel * dt;
    const sq = Math.max(-0.28, Math.min(0.2, this.squash));

    j.legL += (legL - j.legL) * k;
    j.legR += (legR - j.legR) * k;
    j.armLx += (armLx - j.armLx) * k;
    j.armRx += (armRx - j.armRx) * k;
    j.armLz += (armLz - j.armLz) * k;
    j.armRz += (armRz - j.armRz) * k;
    j.lean += (lean - j.lean) * k * 0.6;
    j.bob += (bob - j.bob) * k;
    j.headPitch += (headPitch - j.headPitch) * k * 0.6;
    j.headYaw += (headYaw - j.headYaw) * k * 0.4;
    this.roll += (roll - this.roll) * k * 0.6;

    this.legs[0].rotation.x = -j.legL;
    this.legs[1].rotation.x = -j.legR;
    this.arms[0].rotation.set(j.armLx, 0, -j.armLz);
    this.arms[1].rotation.set(j.armRx, 0, j.armRz);
    this.head.rotation.set(j.headPitch, j.headYaw, 0);
    this.body.rotation.set(j.lean, 0, this.roll);
    this.body.position.y = j.bob;
    this.body.scale.x = this.body.scale.z = 1 - sq * 0.5;
    this.body.scale.y *= 1 + sq * 0.08;
    if (pose !== 'leap' && pose !== 'idle') this.body.scale.y += (1 + sq - this.body.scale.y) * k;

    // heading: face along the route, lean into sideways leaps, turn back when asked
    const want = yaw + Math.atan2(lateral, Math.max(speed, 2.5)) * -0.55 + this.lookBack * Math.PI;
    let dy = want - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 9);
    this.root.position.copy(position);
    this.root.scale.setScalar(KITE.SCALE);
    this.root.rotation.y = this.yaw + Math.PI; // model is built facing +Z

    // cloth
    const cu = this.cloakMat.uniforms;
    cu.uBillow.value += (billow - cu.uBillow.value) * Math.min(1, dt * 6);
    cu.uLift.value += (Math.max(-0.6, Math.min(1.2, -vy * 0.22)) - cu.uLift.value) * Math.min(1, dt * 8);
    cu.uFlare.value += (flare - cu.uFlare.value) * Math.min(1, dt * 9);
    for (const m of this.mats) m.uniforms.uPulse.value = Math.max(0, m.uniforms.uPulse.value - dt * 2.5);

    // ember: floats ahead-right of the chest, bobbing; brightens on notes
    this.emberFlash = Math.max(0, this.emberFlash - dt * 2.2);
    const ex = 0.3, ey = 0.72 + Math.sin(t * 2.1) * 0.035 + j.bob, ez = 0.26;
    const cy = Math.cos(this.root.rotation.y), sy = Math.sin(this.root.rotation.y);
    this.ember.position.set(ex * cy + ez * sy, ey, -ex * sy + ez * cy);
    // (the ember is a child of the scaled root, so its offsets scale with Kite)
    this.emberCore.rotation.y = t * 1.6;
    this.emberCore.rotation.x = t * 1.1;
    const glow = 1.0 + 0.1 * Math.sin(t * 5.3) + this.emberFlash * 0.9;
    this.emberGlow.scale.setScalar(glow * (this.ghost ? 0.8 : 0.95));
    this.emberCore.scale.setScalar(1 + this.emberFlash * 0.7);
    if (this.flashColor && !this.ghost) {
      this.emberGlow.material.color.copy(this.emberColor).lerp(this.flashColor, Math.min(1, this.emberFlash));
    }

    // shadow hugs the surface under Kite
    if (this.shadow) {
      const h = Math.max(0, state.airHeight ?? 0);
      this.shadow.position.set(position.x, position.y - h + 0.02, position.z);
      const s = (0.95 + h * 0.5) * KITE.SCALE;
      this.shadow.scale.set(s, 1, s);
      this.shadow.material.opacity = 0.5 * this.opacity / (1 + h * 1.6);
    }

    // tail
    _w.set(0, 0.76 + j.bob, -0.14).multiplyScalar(KITE.SCALE).applyAxisAngle(UP, this.root.rotation.y).add(position);
    this.tail.update(_w, dt, cameraPos);
  }

  /** World position of the ember (for the shared light uniform). */
  emberWorld(target) {
    return target.copy(this.ember.position).multiplyScalar(KITE.SCALE).add(this.root.position);
  }

  resetMotion(position) {
    this.hasPrev = false;
    this.tail.ready = false;
    this.squash = 0;
    this.squashVel = 0;
    if (position) this.root.position.copy(position);
  }

  dispose() {
    this.scene.remove(this.root);
    if (this.shadow) this.scene.remove(this.shadow);
    this.tail.dispose();
    for (const m of this.mats) m.dispose();
  }
}

export const KITE_HEIGHT = KITE.HEIGHT;
