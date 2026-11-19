// Possible landings. A seed is a translucent outline with its pitch letter standing above
// it and a ring that closes onto the outline exactly on the beat.
//
//   guided     one bright seed
//   choice     two bright seeds
//   open       a faint fan of seeds within reach
//   hold       a seed plus a long outlined ribbon with a marked end
//   resonance  the answering pitch wears a double ring
//   breath     a pale ring over the path: rest here

import * as THREE from 'three-afternote';
import { COLORS, SEEDS, STONE, RULES, LANES } from '../core/Constants.js';
import { PITCH_NAMES } from '../music/Theory.js';
import { makeGlow, letterTexture, keycapTexture, ringTexture, softDotTexture, ribbonGeometry, G } from './Shared.js';

let TEX = null;
function textures() {
  if (TEX) return TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  // rounded outline plate with a faint fill
  const r = 44;
  const path = () => {
    g.beginPath();
    g.moveTo(20 + r, 20);
    g.lineTo(236 - r, 20); g.quadraticCurveTo(236, 20, 236, 20 + r);
    g.lineTo(236, 236 - r); g.quadraticCurveTo(236, 236, 236 - r, 236);
    g.lineTo(20 + r, 236); g.quadraticCurveTo(20, 236, 20, 236 - r);
    g.lineTo(20, 20 + r); g.quadraticCurveTo(20, 20, 20 + r, 20);
    g.closePath();
  };
  path();
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(255,255,255,1)';
  path();
  g.stroke();
  const plate = new THREE.CanvasTexture(c);
  plate.colorSpace = THREE.NoColorSpace;

  const c2 = document.createElement('canvas');
  c2.width = c2.height = 256;
  const g2 = c2.getContext('2d');
  g2.setLineDash([26, 18]);
  g2.lineWidth = 8;
  g2.strokeStyle = '#fff';
  g2.beginPath();
  g2.arc(128, 128, 104, 0, Math.PI * 2);
  g2.stroke();
  const breath = new THREE.CanvasTexture(c2);
  breath.colorSpace = THREE.NoColorSpace;

  TEX = { plate, ring: ringTexture(false), ring2: ringTexture(true), breath };
  return TEX;
}

const FLAT = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function mapMaterial(map, color, intensity = 1) {
  return makeGlow({ map, color, intensity });
}

class Seed {
  constructor(parent) {
    const t = textures();
    this.group = new THREE.Group();
    this.plateMat = mapMaterial(t.plate, COLORS.GOLD, 1);
    this.plate = new THREE.Mesh(FLAT, this.plateMat);
    this.ringMat = mapMaterial(t.ring, COLORS.GOLD, 1.2);
    this.ring = new THREE.Mesh(FLAT, this.ringMat);
    this.ring.position.y = 0.03;
    this.letter = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('C'), transparent: true, depthWrite: false, depthTest: false }));
    this.letter.renderOrder = 20;
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    // the key to press, as a keycap, right where the player is already looking
    this.cap = new THREE.Sprite(new THREE.SpriteMaterial({ map: keycapTexture('1'), transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    this.cap.renderOrder = 21;
    this.capLabel = '1';
    this.capAlpha = 0;
    this.group.add(this.plate, this.ring, this.glow, this.letter, this.cap);
    this.hold = null;
    this.alpha = 0;
    this.target = 0;
    this.key = null;
    this.pitch = -1;
    parent.add(this.group);
    this.group.visible = false;
  }

  setPitch(p, double) {
    const t = textures();
    if (this.pitch !== p) {
      this.pitch = p;
      this.letter.material.map = letterTexture(PITCH_NAMES[p]);
      this.letter.material.needsUpdate = true;
      const col = new THREE.Color(COLORS.PITCH[p]).lerp(new THREE.Color(COLORS.GOLD), 0.25);
      this.plateMat.uniforms.uColor.value.copy(col);
      this.ringMat.uniforms.uColor.value.copy(col);
      this.glow.material.color.copy(col);
      this.letter.material.color.copy(col).lerp(new THREE.Color(0xffffff), 0.55);
    }
    const ringTex = double ? t.ring2 : t.ring;
    if (this.ringMat.uniforms.uMap.value !== ringTex) this.ringMat.uniforms.uMap.value = ringTex;
  }

  setCap(label) {
    if (label === this.capLabel) return;
    this.capLabel = label;
    this.cap.material.map = keycapTexture(label);
    this.cap.material.needsUpdate = true;
  }

  clearHold() {
    if (this.hold) {
      this.group.parent.remove(this.hold);
      this.hold.geometry.dispose();
      this.hold.material.dispose();
      this.hold = null;
    }
  }
}

export class SeedView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'seeds';
    scene.add(this.group);
    this.pool = [];
    this.live = new Map(); // key -> Seed
    this.breaths = [];
    this.showNames = true; // italic note letters above seeds
    this.showCaps = true; // keycaps beside the next seed (keyboard players)
    this.keyLabels = ['1', '2', '3', '4', '5'];
    this.contrast = 1;
    const t = textures();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.breath, color: COLORS.BREATH, transparent: true, depthWrite: false, opacity: 0 }));
      m.scale.setScalar(1.5);
      m.visible = false;
      this.group.add(m);
      this.breaths.push(m);
    }
    this.thread = null; // light from an Echo's stone to the resonant seed
  }

  _acquire() {
    return this.pool.pop() ?? new Seed(this.group);
  }

  _release(seed) {
    seed.clearHold();
    seed.group.visible = false;
    seed.key = null;
    seed.alpha = 0;
    seed.capAlpha = 0;
    seed.cap.material.opacity = 0;
    this.pool.push(seed);
  }

  clear() {
    for (const s of this.live.values()) this._release(s);
    this.live.clear();
    for (const b of this.breaths) b.visible = false;
  }

  /**
   * @param {object} runner   MovementRunner (or null to hide everything)
   * @param {import('./Routes.js').Route} route
   * @param {number} beat
   * @param {number} dt
   * @param {{gate:boolean}} flags
   */
  update(runner, route, beat, dt, flags = {}) {
    const seen = new Set();
    if (runner && !runner.done && runner.free) this._updateFree(runner, route, beat, dt, flags, seen);
    if (runner && !runner.done) {
      const list = runner.free ? [] : runner.upcoming(beat, SEEDS.HORIZON_BEATS);
      let order = 0;
      for (const up of list) {
        const { slot, offers, ring, isNext, window: win } = up;
        const leap = runner.leapFor(slot);
        const head = Math.min(slot.d, 0.9);
        const at = slot.b + leap - RULES.LAND_LEAD_BEATS + head * 0.5;
        const inWindow = isNext && beat >= win.open;
        for (const p of offers) {
          const key = `${slot.i}:${p}`;
          seen.add(key);
          let seed = this.live.get(key);
          if (!seed) {
            seed = this._acquire();
            seed.key = key;
            seed.alpha = 0;
            this.live.set(key, seed);
            seed.group.visible = true;
          }
          const resonant = ring !== null && ring === p;
          seed.setPitch(p, resonant);
          route.pointAt(at, LANES.X[p], LANES.Y[p] + 0.02, seed.group.position);
          seed.group.rotation.y = route.yawAt(at);

          // length of the plate follows the head of the note
          route.pointAt(slot.b + leap - RULES.LAND_LEAD_BEATS, 0, 0, _v);
          route.pointAt(slot.b + leap - RULES.LAND_LEAD_BEATS + head, 0, 0, _w);
          const len = Math.max(1.1, _v.distanceTo(_w) * 0.96);
          seed.plate.scale.set(STONE.WIDTH * 1.04, 1, len);

          // brightness: next > later; open fans are fainter than guided ones
          const far = Math.max(0, order - 0);
          let target = isNext ? 1 : Math.max(0.16, 0.5 - far * 0.13);
          if (slot.src === 'open') target *= isNext ? 0.8 : 0.6;
          if (flags.gate && isNext) target = 1;
          seed.target = target;
          seed.alpha += (seed.target - seed.alpha) * Math.min(1, dt * 7);

          // the ring closes onto the plate on the beat
          const lead = flags.gate && isNext ? 0.5 + 0.5 * Math.sin(G.uTime.value * 2.6) : Math.max(0, Math.min(1, (slot.b - beat) / SEEDS.RING_LEAD_BEATS));
          const ringScale = (1.0 + lead * 1.35) * Math.max(STONE.WIDTH, len) * 1.1;
          seed.ring.scale.set(ringScale, 1, ringScale);
          const ringOn = isNext || lead < 1;
          seed.ringMat.uniforms.uOpacity.value = ringOn ? seed.alpha * (0.35 + 0.65 * (1 - lead)) : 0;
          const pulse = inWindow ? 1.25 + 0.35 * Math.sin(G.uTime.value * 16) : 1;
          seed.plateMat.uniforms.uOpacity.value = seed.alpha;
          seed.plateMat.uniforms.uIntensity.value = (isNext ? 1.5 : 0.9) * pulse * this.contrast;
          seed.ringMat.uniforms.uIntensity.value = 1.6 * pulse * this.contrast;
          seed.glow.material.opacity = seed.alpha * (isNext ? 0.2 : 0.06) * pulse;
          seed.glow.scale.setScalar(isNext ? 3.2 : 2.2);
          seed.glow.position.y = 0.25;

          // Two different kinds of sign, never mixed up:
          //   the KEY to press is a keycap, shown on the seeds of the very next beat;
          //   the NOTE it will sound is an italic letter floating above.
          const capOn = this.showCaps && isNext;
          seed.capAlpha += ((capOn ? 1 : 0) - seed.capAlpha) * Math.min(1, dt * 9);
          const capShown = seed.capAlpha > 0.02;
          seed.cap.visible = capShown;
          if (capShown) {
            seed.setCap(this.keyLabels[p]);
            const bob = 0.05 * Math.sin(G.uTime.value * 3.2);
            const big = this.showNames ? 1 : 1.2;
            seed.cap.position.y = (this.showNames ? 1.08 : 1.2) + bob;
            seed.cap.scale.setScalar((0.86 + (inWindow ? 0.12 + 0.05 * Math.sin(G.uTime.value * 16) : 0)) * big * (0.7 + 0.3 * seed.capAlpha));
            seed.cap.material.opacity = Math.min(1, seed.alpha * 1.3) * seed.capAlpha;
          }
          // a fan of free choices further ahead would repeat every letter; its plates are enough
          seed.letter.visible = this.showNames && (isNext || slot.src !== 'open');
          const lift = seed.capAlpha * (this.showCaps ? 1.02 : 0);
          seed.letter.position.y = 0.95 + lift + (isNext ? 0.06 * Math.sin(G.uTime.value * 3.2) : 0);
          seed.letter.scale.setScalar(isNext ? 1.15 - 0.2 * seed.capAlpha : 0.85);
          seed.letter.material.opacity = Math.min(1, seed.alpha * (isNext ? 1.25 : 1.0));

          // a hold shows its whole length and where to let go
          if (slot.k === 'hold' && !seed.hold) this._buildHold(seed, route, slot, leap, p);
          if (seed.hold) seed.hold.material.uniforms.uOpacity.value = seed.alpha * 0.9;
        }
        order++;
      }

      // breaths: pale rings over the path
      const brs = runner.upcomingBreaths(beat, SEEDS.HORIZON_BEATS).filter((b) => b.style !== 'ruin');
      for (let i = 0; i < this.breaths.length; i++) {
        const m = this.breaths[i];
        const br = brs[i];
        if (!br) {
          m.material.opacity = Math.max(0, m.material.opacity - dt * 3);
          m.visible = m.material.opacity > 0.01;
          continue;
        }
        const lane = br.lane !== null ? br.lane : runner.lane;
        route.pointAt(br.b + Math.min(0.6, br.d * 0.5), LANES.X[lane], LANES.Y[lane] + 1.25, m.position);
        m.visible = true;
        m.material.opacity += (0.75 - m.material.opacity) * Math.min(1, dt * 4);
        m.material.rotation = G.uTime.value * 0.25;
        const s = 1.35 + 0.12 * Math.sin(G.uTime.value * 1.6);
        m.scale.setScalar(s);
      }
    } else {
      for (const m of this.breaths) {
        m.material.opacity = Math.max(0, m.material.opacity - dt * 3);
        m.visible = m.material.opacity > 0.01;
      }
    }

    for (const [key, seed] of this.live) {
      if (!seen.has(key)) {
        this.live.delete(key);
        this._release(seed);
      }
    }
  }

  /**
   * A sea crossing: nothing is asked for, so there is no ring to close. Five faint landings
   * glide just ahead of Kite, exactly where a stone would grow if that key were played now.
   */
  _updateFree(runner, route, beat, dt, flags, seen) {
    const slot = runner.nextSlot();
    if (!slot) return;
    const at = beat + runner.leapFor(slot) - RULES.LAND_LEAD_BEATS + 0.34;
    const frac = ((beat % 1) + 1) % 1;
    const onBeat = Math.max(0, 1 - frac * 2.4); // a soft swell on every beat: something to play along with
    for (let p = 0; p < 5; p++) {
      const key = `free:${p}`;
      seen.add(key);
      let seed = this.live.get(key);
      if (!seed) {
        seed = this._acquire();
        seed.key = key;
        seed.alpha = 0;
        this.live.set(key, seed);
        seed.group.visible = true;
      }
      seed.setPitch(p, false);
      route.pointAt(at, LANES.X[p], LANES.Y[p] + 0.02, seed.group.position);
      seed.group.rotation.y = route.yawAt(at);
      seed.plate.scale.set(STONE.WIDTH * 1.04, 1, 1.5);
      seed.target = flags.gate ? 1 : 0.58;
      seed.alpha += (seed.target - seed.alpha) * Math.min(1, dt * 5);
      const wait = flags.gate ? 0.5 + 0.5 * Math.sin(G.uTime.value * 2.6 + p * 0.5) : 0;
      const ringScale = (1.0 + wait * 0.9) * 1.7;
      seed.ring.scale.set(ringScale, 1, ringScale);
      seed.ringMat.uniforms.uOpacity.value = flags.gate ? seed.alpha * 0.6 : 0;
      seed.ringMat.uniforms.uIntensity.value = 1.4 * this.contrast;
      seed.plateMat.uniforms.uOpacity.value = seed.alpha;
      seed.plateMat.uniforms.uIntensity.value = (0.9 + 0.55 * onBeat + (flags.gate ? 0.3 : 0)) * this.contrast;
      seed.glow.material.opacity = seed.alpha * (0.07 + 0.08 * onBeat);
      seed.glow.scale.setScalar(2.4);
      seed.glow.position.y = 0.25;
      seed.capAlpha += ((this.showCaps ? 1 : 0) - seed.capAlpha) * Math.min(1, dt * 9);
      const capShown = seed.capAlpha > 0.02;
      seed.cap.visible = capShown;
      if (capShown) {
        seed.setCap(this.keyLabels[p]);
        seed.cap.position.y = this.showNames ? 1.02 : 1.14;
        seed.cap.scale.setScalar((this.showNames ? 0.78 : 0.94) * (0.7 + 0.3 * seed.capAlpha));
        seed.cap.material.opacity = Math.min(1, seed.alpha * 1.4) * seed.capAlpha;
      }
      seed.letter.visible = this.showNames;
      seed.letter.position.y = 0.9 + seed.capAlpha * (this.showCaps ? 0.92 : 0);
      seed.letter.scale.setScalar(0.9);
      seed.letter.material.opacity = Math.min(1, seed.alpha * 1.3);
      if (seed.hold) seed.clearHold();
    }
  }

  _buildHold(seed, route, slot, leap, p) {
    const pts = [];
    const b0 = slot.b + leap - RULES.LAND_LEAD_BEATS;
    const b1 = slot.b + slot.d;
    const n = Math.max(2, Math.ceil((b1 - b0) / 0.125));
    for (let i = 0; i <= n; i++) {
      pts.push(route.pointAt(b0 + ((b1 - b0) * i) / n, LANES.X[p], LANES.Y[p] + 0.02, new THREE.Vector3()));
    }
    const col = new THREE.Color(COLORS.PITCH[p]).lerp(new THREE.Color(COLORS.GOLD), 0.25);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: col }, uOpacity: { value: 0 }, uTime: G.uTime },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
        void main(){
          float edge = smoothstep(0.78, 0.92, abs(vUv.y - 0.5) * 2.0);      // two outlined rails
          float dash = 0.55 + 0.45 * step(0.5, fract(vUv.x * 14.0 - uTime * 0.6));
          float fill = 0.1;
          float endBar = smoothstep(0.965, 0.985, vUv.x);                    // the marked end
          float a = max(edge * dash, fill) + endBar * 1.4;
          gl_FragColor = vec4(uColor * (0.9 + endBar * 1.6) * a * uOpacity, a * uOpacity);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(ribbonGeometry(pts, STONE.WIDTH * 0.92), mat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    seed.hold = mesh;
  }
}
