// Small lights in the air: sparks when a stone forms, drips of light beneath it, drifting
// motes, and the gold leaves that grow where the player has built.
// Everything here is one draw call per system, animated in the vertex shader.

import * as THREE from 'three-afternote';
import { COLORS } from '../core/Constants.js';
import { G, softDotTexture } from './Shared.js';

const MAX_SPARKS = 1400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.reduced = false;
    this._initSparks();
    this._initLeaves();
    this._initMotes();
  }

  // -------------------------------------------------------------------------------
  // Sparks: short-lived additive points with velocity and gravity
  // -------------------------------------------------------------------------------
  _initSparks() {
    const geo = new THREE.BufferGeometry();
    this.sPos = new Float32Array(MAX_SPARKS * 3);
    this.sVel = new Float32Array(MAX_SPARKS * 3);
    this.sData = new Float32Array(MAX_SPARKS * 4); // birth, life, size, gravity
    this.sCol = new Float32Array(MAX_SPARKS * 3);
    for (let i = 0; i < MAX_SPARKS; i++) this.sData[i * 4] = -100;
    geo.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(this.sVel, 3));
    geo.setAttribute('aData', new THREE.BufferAttribute(this.sData, 4));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.sCol, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: G.uTime, uMap: { value: softDotTexture() }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uScale;
        attribute vec3 aVel; attribute vec4 aData; attribute vec3 aColor;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float age = uTime - aData.x;
          float life = aData.y;
          float u = clamp(age / life, 0.0, 1.0);
          vec3 p = position + aVel * age * (1.0 - 0.35 * u) + vec3(0.0, -aData.w * age * age, 0.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float alive = step(0.0, age) * step(age, life);
          vAlpha = alive * (1.0 - u) * (1.0 - u) * smoothstep(0.0, 0.06, u + 0.02);
          vColor = aColor;
          gl_PointSize = aData.z * uScale * (1.0 - 0.5 * u) * alive / max(0.1, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec3 vColor; varying float vAlpha;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
          gl_FragColor = vec4(vColor * a * 2.2, a);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.sparks = new THREE.Points(geo, mat);
    this.sparks.frustumCulled = false;
    this.sparkMat = mat;
    this.sNext = 0;
    this.scene.add(this.sparks);
  }

  setViewport(height, pixelRatio) {
    this.sparkMat.uniforms.uScale.value = height * pixelRatio * 0.5;
    this.moteMat.uniforms.uScale.value = height * pixelRatio * 0.5;
  }

  _spark(x, y, z, vx, vy, vz, life, size, gravity, color) {
    const i = this.sNext;
    this.sNext = (this.sNext + 1) % MAX_SPARKS;
    this.sPos.set([x, y, z], i * 3);
    this.sVel.set([vx, vy, vz], i * 3);
    this.sData.set([G.uTime.value, life, size, gravity], i * 4);
    this.sCol.set([color.r, color.g, color.b], i * 3);
    this._dirty = true;
  }

  /** A puff of sparks at a point. */
  burst(pos, color, count = 22, speed = 2.2, { up = 1.2, life = 0.9, size = 0.5, gravity = 1.6 } = {}) {
    if (this.reduced) count = Math.ceil(count * 0.3);
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random();
      const s = speed * (0.35 + 0.65 * Math.random());
      this._spark(
        pos.x + Math.cos(a) * r * 0.5, pos.y + Math.random() * 0.2, pos.z + Math.sin(a) * r * 0.5,
        Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s,
        life * (0.6 + 0.6 * Math.random()), size * (0.6 + 0.8 * Math.random()), gravity, c,
      );
    }
  }

  /** Light draining from the underside of a newly formed stone. */
  drips(pos, color, count = 9, width = 1.2) {
    if (this.reduced) return;
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      this._spark(
        pos.x + (Math.random() - 0.5) * width, pos.y - 0.35 - Math.random() * 0.2, pos.z + (Math.random() - 0.5) * width,
        0, -0.5 - Math.random() * 1.4, 0, 0.9 + Math.random() * 0.9, 0.36 + Math.random() * 0.3, 0.5, c,
      );
    }
  }

  /** Slow rising motes, e.g. when a mechanism wakes. */
  rise(pos, color, count = 30, radius = 3, height = 5) {
    if (this.reduced) count = Math.ceil(count * 0.3);
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      this._spark(
        pos.x + Math.cos(a) * r, pos.y + Math.random() * 1.0, pos.z + Math.sin(a) * r,
        (Math.random() - 0.5) * 0.4, (0.5 + Math.random()) * height * 0.3, (Math.random() - 0.5) * 0.4,
        2.0 + Math.random() * 2.0, 0.45 + Math.random() * 0.5, -0.05, c,
      );
    }
  }

  // -------------------------------------------------------------------------------
  // Gold leaves: instanced quads that unfurl and sway where notes were played
  // -------------------------------------------------------------------------------
  _initLeaves() {
    const MAX = 1600;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.5, 0.35, 0, 1);
    shape.quadraticCurveTo(-0.5, 0.35, 0, 0);
    const base = new THREE.ShapeGeometry(shape, 5);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    this.lOff = new Float32Array(MAX * 3);
    this.lData = new Float32Array(MAX * 4); // birth, size, yaw, tilt
    this.lTint = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) this.lData[i * 4] = 1e9;
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(this.lOff, 3));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(this.lData, 4));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(this.lTint, 1));
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: G.uTime, uFogColor: G.uFogColor, uFogDensity: G.uFogDensity,
        uA: { value: new THREE.Color(0xffd27a) }, uB: { value: new THREE.Color(0xe98b3a) }, uC: { value: new THREE.Color(0x9ad8a0) },
        uEmberPos: G.uEmberPos,
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute vec3 aOffset; attribute vec4 aData; attribute float aTint;
        varying float vTint; varying float vV; varying vec3 vWorld;
        void main() {
          float age = uTime - aData.x;
          float grow = clamp(age / 0.9, 0.0, 1.0);
          grow = 1.0 - pow(1.0 - grow, 3.0);
          float size = aData.y * grow;
          vec3 p = position * size;
          // sway from the stem
          float sway = sin(uTime * 1.7 + aOffset.x * 1.3 + aOffset.z * 0.7) * 0.25 * position.y;
          p.x += sway * size;
          float ct = cos(aData.w), st = sin(aData.w);
          p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
          float cy = cos(aData.z), sy = sin(aData.z);
          p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
          vec4 wp = modelMatrix * vec4(p + aOffset, 1.0);
          vWorld = wp.xyz; vTint = aTint; vV = position.y;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uEmberPos;
        varying float vTint; varying float vV; varying vec3 vWorld;
        void main() {
          vec3 col = mix(uB, uA, vV);
          col = mix(col, uC, smoothstep(0.75, 1.0, vTint) * 0.8);
          col *= 0.55 + 0.75 * vV;
          float d2 = dot(uEmberPos - vWorld, uEmberPos - vWorld);
          col += uA * 0.5 / (1.0 + d2 * 0.25);
          float dist = length(vWorld - cameraPosition);
          if (dist < 2.6) discard; // never a leaf across the lens
          float f = 1.0 - exp(-pow(dist * uFogDensity, 1.6));
          col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.DoubleSide,
    });
    this.leaves = new THREE.Mesh(geo, mat);
    this.leaves.frustumCulled = false;
    this.leafGeo = geo;
    this.leafMax = MAX;
    this.leafCount = 0;
    this.scene.add(this.leaves);
  }

  /** Sprout a few leaves around a point (e.g. along the rim of a stone). */
  sprout(pos, count = 7, radius = 0.8, { instant = false, drop = 0.1 } = {}) {
    const now = G.uTime.value;
    for (let k = 0; k < count; k++) {
      const i = this.leafCount % this.leafMax;
      this.leafCount++;
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.75 + Math.random() * 0.45);
      this.lOff.set([pos.x + Math.cos(a) * r, pos.y - drop - Math.random() * 0.25, pos.z + Math.sin(a) * r], i * 3);
      this.lData.set([instant ? -10 : now + Math.random() * 0.8, 0.16 + Math.random() * 0.2, a + Math.PI / 2 + (Math.random() - 0.5), 0.5 + Math.random() * 0.9], i * 4);
      this.lTint[i] = Math.random();
    }
    this.leafGeo.instanceCount = Math.min(this.leafCount, this.leafMax);
    this.leafGeo.attributes.aOffset.needsUpdate = true;
    this.leafGeo.attributes.aData.needsUpdate = true;
    this.leafGeo.attributes.aTint.needsUpdate = true;
  }

  clearLeaves() {
    this.leafCount = 0;
    this.leafGeo.instanceCount = 0;
  }

  // -------------------------------------------------------------------------------
  // Motes: a slow field of fireflies that follows the camera and grows with the world
  // -------------------------------------------------------------------------------
  _initMotes() {
    const N = 260;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos.set([(Math.random() - 0.5) * 90, Math.random() * 16, (Math.random() - 0.5) * 90], i * 3);
      seed[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.moteMat = new THREE.ShaderMaterial({
      uniforms: { uTime: G.uTime, uAwake: G.uAwake, uMap: { value: softDotTexture() }, uCenter: { value: new THREE.Vector3() }, uScale: { value: 1 }, uColor: { value: new THREE.Color(COLORS.GOLD) } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform vec3 uCenter; uniform float uScale; uniform float uAwake;
        attribute float aSeed; varying float vA;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.21 + aSeed * 40.0) * 2.5;
          p.y += sin(uTime * 0.33 + aSeed * 17.0) * 1.2;
          p.z += cos(uTime * 0.19 + aSeed * 29.0) * 2.5;
          // wrap around the camera so the field is endless
          p.xz = mod(p.xz - uCenter.xz + 45.0, 90.0) - 45.0 + uCenter.xz;
          p.y += uCenter.y * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.5 + 0.5 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 60.0);
          vA = tw * (0.12 + 0.88 * uAwake) * step(aSeed, 0.25 + 0.75 * uAwake);
          gl_PointSize = (0.18 + 0.3 * aSeed) * uScale / max(0.1, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
        void main() { float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(uColor * a * 1.8, a); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.motes = new THREE.Points(geo, this.moteMat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  update(dt, cameraPos) {
    if (this._dirty) {
      const g = this.sparks.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.aVel.needsUpdate = true;
      g.attributes.aData.needsUpdate = true;
      g.attributes.aColor.needsUpdate = true;
      this._dirty = false;
    }
    this.moteMat.uniforms.uCenter.value.copy(cameraPos);
  }
}
