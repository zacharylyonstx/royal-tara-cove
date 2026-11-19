// The dusk sky: a painted gradient with slow cloud bands, a low glow behind the lighthouse,
// and stars that come out as the world wakes.

import * as THREE from 'three-afternote';
import { COLORS } from '../core/Constants.js';
import { G, GLSL_COMMON } from './Shared.js';

export const SKY_GLSL = /* glsl */ `
uniform vec3 uSkyTop;
uniform vec3 uSkyMid;
uniform vec3 uSkyHorizon;
uniform vec3 uGlowDir;

// Shared by the sky dome and the sea's reflection so they always agree.
vec3 skyGradient(vec3 dir) {
  float h = clamp(dir.y, -0.05, 1.0);
  vec3 col = mix(uSkyMid, uSkyTop, smoothstep(0.08, 0.7, h));
  float hor = exp(-max(h, 0.0) * 7.0);
  // the horizon burns warmest behind the lighthouse and cools around the compass
  float toward = max(dot(normalize(vec3(dir.x, 0.0, dir.z)), uGlowDir), 0.0);
  vec3 horizon = mix(uSkyMid * 1.15, uSkyHorizon, 0.25 + 0.75 * pow(toward, 2.5));
  col = mix(col, horizon, hor * (0.55 + 0.45 * toward));
  col += uSkyHorizon * pow(toward, 14.0) * exp(-max(h, 0.0) * 16.0) * (0.35 + 0.5 * uAwake);
  return col;
}
`;

export class Sky {
  constructor(scene) {
    this.uniforms = {
      ...G,
      uSkyTop: { value: new THREE.Color(COLORS.SKY_TOP) },
      uSkyMid: { value: new THREE.Color(COLORS.SKY_MID) },
      uSkyHorizon: { value: new THREE.Color(COLORS.SKY_HORIZON) },
      uGlowDir: { value: new THREE.Vector3(0.12, 0, -1).normalize() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        ${GLSL_COMMON}
        ${SKY_GLSL}
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          vec3 col = skyGradient(dir);

          // faint rays fanning up from where the light is waiting below the horizon
          {
            vec3 hd = normalize(vec3(dir.x, 0.0, dir.z));
            float tw = max(dot(hd, uGlowDir), 0.0);
            float ang = atan(hd.x, -hd.z) - atan(uGlowDir.x, -uGlowDir.z);
            float hh = max(dir.y, 0.0);
            float fan = pow(tw, 5.0) * smoothstep(0.0, 0.1, hh) * (1.0 - smoothstep(0.18, 0.62, hh));
            float streak = 0.5 + 0.5 * sin(ang * 38.0 + sin(ang * 13.0) * 2.2);
            streak *= 0.55 + 0.45 * vnoise(vec2(ang * 24.0, uTime * 0.015));
            col += uSkyHorizon * fan * streak * (0.1 + 0.2 * uAwake);
          }

          // cloud bands: two drifting layers, underlit toward the glow
          float h = max(dir.y, 0.0);
          vec2 cuv = dir.xz / (h + 0.22);
          float c1 = fbm(cuv * 1.1 + vec2(uTime * 0.006, 0.0));
          float c2 = fbm(cuv * 2.6 - vec2(uTime * 0.011, 3.0));
          float cloud = smoothstep(0.46, 0.78, c1 * 0.7 + c2 * 0.42);
          cloud *= smoothstep(0.0, 0.1, h) * (1.0 - smoothstep(0.55, 0.95, h));
          float toward = max(dot(normalize(vec3(dir.x, 0.0, dir.z)), uGlowDir), 0.0);
          vec3 cloudDark = uSkyTop * 1.25 + vec3(0.02, 0.02, 0.05);
          vec3 cloudLit = mix(uSkyMid * 1.5, uSkyHorizon * 1.15, pow(toward, 1.6));
          float under = smoothstep(0.75, 0.45, c1) * exp(-h * 4.0);
          col = mix(col, mix(cloudDark, cloudLit, under), cloud * 0.82);

          // stars: a few before, many after
          vec2 sp = dir.xz / (dir.y + 0.35) * 46.0;
          vec2 cell = floor(sp);
          float rnd = hash21(cell);
          vec2 off = vec2(hash21(cell + 7.1), hash21(cell + 3.7)) - 0.5;
          float d = length(fract(sp) - 0.5 - off * 0.7);
          float star = smoothstep(0.07, 0.0, d) * step(0.86 - uAwake * 0.22, rnd);
          star *= 0.6 + 0.4 * sin(uTime * (1.0 + rnd * 3.0) + rnd * 40.0);
          col += vec3(0.9, 0.92, 1.0) * star * smoothstep(0.12, 0.5, dir.y) * (1.0 - cloud) * (0.35 + 0.9 * uAwake);

          col *= 1.0 - uContrast * 0.35;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
  }
}
