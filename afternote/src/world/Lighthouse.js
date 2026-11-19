// The landmark: an island of dark rock, a pale tower, a lantern room with eight panes of
// glass and a lens that has lost its light. Everything that can awaken is driven from
// outside by small calls (lightWindow, lightPanel, setLens, ignite).

import * as THREE from 'three-afternote';
import { COLORS, WORLD } from '../core/Constants.js';
import { G, makeStylized, softDotTexture } from './Shared.js';

// deterministic value noise for rock displacement
function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

/** A lumpy rock of radius ~1. Share and scale it. */
export function rockGeometry(seed = 1, detail = 2, rough = 0.42) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = noise3(x * 1.6 + seed * 13.1, y * 1.6 + seed * 7.7, z * 1.6 + seed * 3.3);
    const m = noise3(x * 4.1 + seed, y * 4.1, z * 4.1 - seed);
    const k = 1 + (n - 0.5) * 2 * rough + (m - 0.5) * rough * 0.5;
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Lighthouse {
  constructor(scene) {
    const L = WORLD.LIGHTHOUSE;
    this.group = new THREE.Group();
    this.group.position.set(L.x, 0, L.z);
    scene.add(this.group);
    this.center = new THREE.Vector3(L.x, 0, L.z);
    this.galleryY = L.baseY - 2 + L.towerHeight; // gallery floor
    this.lensY = this.galleryY + 2.5;
    this.lensPos = new THREE.Vector3(L.x, this.lensY, L.z);
    const rnd = seeded(77);

    // --- island -----------------------------------------------------------------
    const rockMat = makeStylized({ color: 0x4c4a5c, shade: 0x1c1b2a, grain: 0.6, grainScale: 0.35, rim: 0.55, flat: true });
    this.rockMat = rockMat;
    const main = new THREE.Mesh(rockGeometry(3, 4, 0.34), rockMat);
    main.scale.set(17.5, 10.5, 16.5);
    main.position.y = -1.6;
    this.group.add(main);
    const rocks = [rockGeometry(5, 2), rockGeometry(9, 2), rockGeometry(12, 1)];
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 14 + rnd() * 9;
      const m = new THREE.Mesh(rocks[i % 3], rockMat);
      const s = 1.6 + rnd() * 4.2;
      m.scale.set(s * (0.8 + rnd() * 0.6), s * (0.5 + rnd() * 0.9), s * (0.8 + rnd() * 0.6));
      m.position.set(Math.sin(a) * r, -0.4 + rnd() * 0.8, Math.cos(a) * r);
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      this.group.add(m);
    }

    // --- tower ------------------------------------------------------------------
    const stone = makeStylized({ color: 0x8d8799, shade: 0x39364a, grain: 0.3, grainScale: 0.8, rim: 0.7 });
    this.stoneMat = stone;
    const prof = [];
    const H = L.towerHeight;
    prof.push(new THREE.Vector2(L.radiusBase + 1.5, 0));
    prof.push(new THREE.Vector2(L.radiusBase + 1.3, 1.2));
    prof.push(new THREE.Vector2(L.radiusBase + 0.2, 1.8));
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r = L.radiusBase + (L.radiusTop - L.radiusBase) * Math.pow(t, 0.85);
      const y = 2 + (H - 3) * t;
      prof.push(new THREE.Vector2(r, y));
      if (i % 3 === 2 && i < 12) {
        // a band of darker stone every few courses
        prof.push(new THREE.Vector2(r + 0.16, y + 0.12));
        prof.push(new THREE.Vector2(r + 0.16, y + 0.5));
        prof.push(new THREE.Vector2(r - 0.02, y + 0.62));
      }
    }
    prof.push(new THREE.Vector2(L.radiusTop + 0.5, H - 0.9));
    prof.push(new THREE.Vector2(L.galleryRadius, H - 0.4));
    prof.push(new THREE.Vector2(L.galleryRadius, H));
    prof.push(new THREE.Vector2(0, H));
    const tower = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), stone);
    tower.position.y = L.baseY - 2;
    this.group.add(tower);

    // gallery rail
    const metal = makeStylized({ color: 0x5b5360, shade: 0x1d1a28, grain: 0.1, rim: 0.9 });
    const rail = new THREE.Mesh(new THREE.TorusGeometry(L.galleryRadius - 0.15, 0.07, 6, 48), metal);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = this.galleryY + 1.05;
    this.group.add(rail);
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.05, 5);
    const posts = new THREE.InstancedMesh(postGeo, metal, 24);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      mm.makeTranslation(Math.sin(a) * (L.galleryRadius - 0.15), this.galleryY + 0.52, Math.cos(a) * (L.galleryRadius - 0.15));
      posts.setMatrixAt(i, mm);
    }
    this.group.add(posts);

    // windows climbing the tower
    this.windows = [];
    for (let i = 0; i < 6; i++) {
      const t = 0.14 + i * 0.145;
      const a = 2.6 + i * 1.15;
      const r = L.radiusBase + (L.radiusTop - L.radiusBase) * Math.pow(t, 0.85) + 0.03;
      const mat = new THREE.MeshBasicMaterial({ color: 0x0c0d16 });
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.5), mat);
      w.position.set(Math.sin(a) * r, L.baseY + (H - 3) * t, Math.cos(a) * r);
      w.rotation.y = a;
      this.group.add(w);
      this.windows.push({ mat, level: 0, target: 0 });
    }

    {
      const a = Math.PI + 0.35; // facing the road
      const mat = new THREE.MeshBasicMaterial({ color: 0x0c0d16 });
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.0), mat);
      const r = L.radiusBase + 0.26;
      door.position.set(Math.sin(a) * r, L.baseY + 1.3, Math.cos(a) * r);
      door.rotation.y = a;
      this.group.add(door);
      this.windows.push({ mat, level: 0, target: 0 });
      const lintel = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.16, 5, 10, Math.PI), stone);
      lintel.position.set(Math.sin(a) * (r + 0.05), L.baseY + 2.8, Math.cos(a) * (r + 0.05));
      lintel.rotation.y = a;
      this.group.add(lintel);
    }

    // --- lantern room ----------------------------------------------------------
    const lr = 3.0;
    const paneH = 4.2;
    const baseY = this.galleryY + 0.0;
    this.panes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const mat = new THREE.MeshBasicMaterial({ color: 0x1a2030, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2 * lr * Math.tan(Math.PI / 8) - 0.14, paneH), mat);
      pane.position.set(Math.sin(a) * lr, baseY + paneH / 2 + 0.3, Math.cos(a) * lr);
      pane.rotation.y = a;
      this.group.add(pane);
      this.panes.push({ mat, level: 0, target: 0, angle: a });
      const mullion = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, paneH + 0.3, 5), metal);
      const b = a + Math.PI / 8;
      mullion.position.set(Math.sin(b) * (lr / Math.cos(Math.PI / 8)), baseY + paneH / 2 + 0.3, Math.cos(b) * (lr / Math.cos(Math.PI / 8)));
      this.group.add(mullion);
    }
    const sill = new THREE.Mesh(new THREE.CylinderGeometry(lr + 0.5, lr + 0.7, 0.35, 8), stone);
    sill.position.y = baseY + 0.17;
    sill.rotation.y = Math.PI / 8;
    this.group.add(sill);
    const roofMat = makeStylized({ color: 0x3d3a52, shade: 0x15131f, grain: 0.15, rim: 1.0 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(lr + 0.9, 3.4, 8), roofMat);
    roof.position.y = baseY + paneH + 0.3 + 1.7;
    roof.rotation.y = Math.PI / 8;
    this.group.add(roof);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), metal);
    finial.position.y = baseY + paneH + 0.3 + 3.6;
    this.group.add(finial);

    // the lens: dark glass until it is given light
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0x2a3040 });
    this.lens = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), this.lensMat);
    this.lens.position.y = this.lensY;
    this.group.add(this.lens);
    this.lensHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xffd9a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    this.lensHalo.position.y = this.lensY;
    this.lensHalo.scale.setScalar(8);
    this.group.add(this.lensHalo);
    this.lensLevel = 0;
    this.lensTarget = 0;

    // --- beam -------------------------------------------------------------------
    this.beam = new THREE.Group();
    this.beam.position.y = this.lensY;
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: G.uTime, uPower: { value: 0 }, uColor: { value: new THREE.Color(0xffe0a8) } },
      vertexShader: /* glsl */ `
        varying vec3 vPos; varying vec3 vN; varying vec3 vView;
        void main() {
          vPos = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uPower; uniform vec3 uColor;
        varying vec3 vPos; varying vec3 vN; varying vec3 vView;
        void main() {
          float along = clamp(vPos.z / 460.0, 0.0, 1.0);
          float soft = pow(abs(dot(normalize(vN), vView)), 1.6);
          float fall = pow(1.0 - along, 1.7) * smoothstep(0.0, 0.02, along);
          float dust = 0.9 + 0.1 * sin(vPos.z * 0.05 - uTime * 0.8);
          float a = soft * fall * dust * uPower;
          gl_FragColor = vec4(uColor * a * 0.6, a);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.beamMat = beamMat;
    const cone = new THREE.CylinderGeometry(30, 0.9, 460, 48, 12, true);
    cone.rotateX(Math.PI / 2); // axis along +Z, narrow end at the origin... (cylinder top radius first)
    cone.translate(0, 0, 230);
    for (const dir of [0, Math.PI]) {
      const b = new THREE.Mesh(cone, beamMat);
      b.rotation.y = dir;
      b.rotation.x = 0.03;
      b.frustumCulled = false;
      this.beam.add(b);
    }
    this.beam.visible = false;
    this.group.add(this.beam);
    this.beamPower = 0;
    this.beamTarget = 0;
    this.lit = false;

    // --- far islands that answer with small lights ------------------------------
    this.far = [];
    const farMat = makeStylized({ color: 0x3a3950, shade: 0x1a1a2a, grain: 0.3, grainScale: 0.05, rim: 0.2, flat: true });
    const farGeo = rockGeometry(21, 2, 0.5);
    const spots = [[-520, -520, 60], [-260, -760, 80], [380, -700, 70], [640, -380, 90], [-700, -140, 75], [760, -60, 60], [-380, 380, 55], [520, 420, 65], [120, -980, 110]];
    for (const [x, z, s] of spots) {
      const m = new THREE.Mesh(farGeo, farMat);
      m.scale.set(s * (1 + rnd()), s * (0.28 + rnd() * 0.3), s * (0.7 + rnd() * 0.6));
      m.position.set(x, -4, z);
      m.rotation.y = rnd() * 6;
      scene.add(m);
      const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xffd9a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false }));
      light.position.set(x + (rnd() - 0.5) * s * 0.5, s * 0.34 + 4, z);
      light.scale.setScalar(26);
      scene.add(light);
      this.far.push({ light, delay: 0.6 + rnd() * 3.4, level: 0 });
    }
    this.farOn = -1;
  }

  /** Windows glow in order up the tower (after the roots wake). */
  lightWindows(instant = false) {
    this.windows.forEach((w, i) => {
      w.target = 1;
      w.delay = instant ? 0 : i * 0.35;
      if (instant) w.level = 1;
    });
  }

  /** Wake one or more panes of the lantern room. */
  lightPanel(indices, instant = false) {
    for (const i of indices) {
      const p = this.panes[i % 8];
      p.target = 1;
      if (instant) p.level = 1;
    }
  }

  /** 0 = dark lens, 0.5 = half lit, 1 = fully charged (not yet a beam). */
  setLens(level, instant = false) {
    this.lensTarget = Math.max(this.lensTarget, level);
    if (instant) this.lensLevel = this.lensTarget;
  }

  /** The beam. */
  ignite(instant = false) {
    this.lit = true;
    this.lensTarget = 1;
    this.beamTarget = 1;
    this.beam.visible = true;
    this.lightPanel([0, 1, 2, 3, 4, 5, 6, 7], instant);
    this.farOn = instant ? -100 : G.uTime.value;
    if (instant) {
      this.beamPower = 1;
      this.lensLevel = 1;
    }
  }

  reset() {
    this.lit = false;
    this.lensTarget = 0;
    this.lensLevel = 0;
    this.beamTarget = 0;
    this.beamPower = 0;
    this.beam.visible = false;
    this.farOn = -1;
    for (const p of this.panes) p.level = p.target = 0;
    for (const w of this.windows) w.level = w.target = 0;
    for (const f of this.far) f.level = 0;
  }

  update(dt) {
    const t = G.uTime.value;
    for (const w of this.windows) {
      if (w.delay > 0) {
        w.delay -= dt;
        continue;
      }
      w.level += (w.target - w.level) * Math.min(1, dt * 1.6);
      w.mat.color.setRGB(0.05 + 2.1 * w.level, 0.05 + 1.35 * w.level, 0.09 + 0.55 * w.level);
    }
    for (const p of this.panes) {
      p.level += (p.target - p.level) * Math.min(1, dt * 2.4);
      const flick = 1 + 0.05 * Math.sin(t * 6 + p.angle * 3);
      // lit panes glow warmly; they only blaze once the beam itself is alight
      const hotPane = p.level * flick * (0.9 + 1.7 * this.beamPower);
      p.mat.color.setRGB(0.1 + hotPane, 0.125 + hotPane * 0.73, 0.19 + hotPane * 0.36);
      p.mat.opacity = 0.55 + 0.4 * p.level;
    }
    this.lensLevel += (this.lensTarget - this.lensLevel) * Math.min(1, dt * 1.5);
    this.beamPower += (this.beamTarget - this.beamPower) * Math.min(1, dt * 0.9);
    const lv = this.lensLevel;
    const hot = lv * lv * (1.5 + this.beamPower * 6);
    this.lensMat.color.setRGB(0.16 + hot * 1.0, 0.19 + hot * 0.85, 0.25 + hot * 0.5);
    this.lens.rotation.y = t * 0.3;
    this.lensHalo.material.opacity = Math.min(0.75, lv * 0.4 + this.beamPower * 0.4);
    this.lensHalo.scale.setScalar(6 + lv * 5 + this.beamPower * 34 + Math.sin(t * 2.1) * 0.8 * this.beamPower);
    this.beamMat.uniforms.uPower.value = this.beamPower;
    if (this.beam.visible) this.beam.rotation.y = t * 0.16;
    G.uBeamPos.value.copy(this.lensPos);
    G.uBeamPower.value = this.beamPower * 1.0 + lv * 0.12;
    if (this.farOn > -1 || this.farOn === -100) {
      for (const f of this.far) {
        const on = this.farOn === -100 || t - this.farOn > f.delay;
        f.level += ((on ? 1 : 0) - f.level) * Math.min(1, dt * 1.2);
        f.light.material.opacity = f.level * (0.75 + 0.2 * Math.sin(t * 1.3 + f.delay * 9));
      }
    }
  }
}
