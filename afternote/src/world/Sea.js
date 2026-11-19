// The sea: dark and nearly colourless at first, reflecting the dusk; it answers the
// player's notes in luminous teal rings and wakes into slow glowing swirls.

import * as THREE from 'three-afternote';
import { COLORS } from '../core/Constants.js';
import { G, GLSL_COMMON } from './Shared.js';
import { SKY_GLSL } from './Sky.js';

const MAX_RIPPLES = 16;

export class Sea {
  constructor(scene, skyUniforms) {
    this.ripples = [];
    for (let i = 0; i < MAX_RIPPLES; i++) this.ripples.push(new THREE.Vector4(0, 0, -100, 0));
    this.next = 0;
    this.uniforms = {
      ...G,
      uSkyTop: skyUniforms.uSkyTop,
      uSkyMid: skyUniforms.uSkyMid,
      uSkyHorizon: skyUniforms.uSkyHorizon,
      uGlowDir: skyUniforms.uGlowDir,
      uDeep: { value: new THREE.Color(COLORS.SEA_DEEP) },
      uTeal: { value: new THREE.Color(COLORS.TEAL) },
      uTealDeep: { value: new THREE.Color(COLORS.TEAL_DEEP) },
      uRipples: { value: this.ripples },
      uRippleColors: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Color(COLORS.TEAL)) },
      uIsland: { value: new THREE.Vector3(0, 0, -1000) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        ${GLSL_COMMON}
        ${SKY_GLSL}
        #define MAX_RIPPLES ${MAX_RIPPLES}
        uniform vec3 uDeep;
        uniform vec3 uTeal;
        uniform vec3 uTealDeep;
        uniform vec4 uRipples[MAX_RIPPLES];
        uniform vec3 uRippleColors[MAX_RIPPLES];
        uniform vec3 uIsland;
        varying vec3 vWorldPos;

        vec2 waveSlope(vec2 p, float t) {
          vec2 s = vec2(0.0);
          s += vec2(cos(p.x * 0.11 + t * 0.6), 0.0) * 0.5;
          s += vec2(0.7, 0.7) * cos(dot(p, vec2(0.08, 0.13)) + t * 0.45) * 0.6;
          s += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.21, 0.17)) + t * 0.9) * 0.3;
          float n1 = vnoise(p * 0.35 + vec2(t * 0.25, 0.0));
          float n2 = vnoise(p * 0.35 + vec2(0.3, 0.0) + vec2(t * 0.25, 0.0));
          float n3 = vnoise(p * 0.35 + vec2(0.0, 0.3) + vec2(t * 0.25, 0.0));
          s += vec2(n2 - n1, n3 - n1) * 2.6;
          float m1 = vnoise(p * 1.3 - vec2(0.0, t * 0.5));
          float m2 = vnoise(p * 1.3 + vec2(0.2, 0.0) - vec2(0.0, t * 0.5));
          float m3 = vnoise(p * 1.3 + vec2(0.0, 0.2) - vec2(0.0, t * 0.5));
          s += vec2(m2 - m1, m3 - m1) * 1.1;
          return s;
        }

        void main() {
          vec3 toCam = cameraPosition - vWorldPos;
          float dist = length(toCam);
          vec3 V = toCam / dist;
          vec2 p = vWorldPos.xz;

          float calm = smoothstep(500.0, 60.0, dist);
          vec2 slope = waveSlope(p, uTime) * (0.05 + 0.11 * calm);
          vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));

          float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
          fres = 0.06 + 0.94 * fres;
          vec3 R = reflect(-V, N);
          R.y = abs(R.y);
          vec3 refl = skyGradient(R);

          // body colour: nearly monochrome ink until the world wakes into teal depth
          vec3 body = mix(uDeep, uTealDeep * 0.75, 0.18 + 0.5 * uAwake);
          // dusk water keeps most of its darkness; only a grazing view picks up the sky
          vec3 col = mix(body, refl * 0.72, fres * 0.62);

          // a long sheen under the horizon glow
          float toward = max(dot(normalize(vec3(R.x, 0.0, R.z)), uGlowDir), 0.0);
          col += uSkyHorizon * pow(toward, 24.0) * pow(1.0 - R.y, 6.0) * 0.22;

          // luminous swirls: thin warped contour lines that drift
          vec2 w = p * 0.045 + vec2(fbm(p * 0.02 + uTime * 0.01), fbm(p * 0.02 - uTime * 0.012 + 9.0)) * 1.7;
          float f = fbm(w * 2.2 + uTime * 0.02);
          float lines = smoothstep(0.05, 0.0, abs(fract(f * 3.6) - 0.5) - 0.022);
          float patches = smoothstep(0.42, 0.7, fbm(p * 0.012 + 3.0));
          float nearIsland = exp(-length(p - uIsland.xz) * 0.012);
          float swirl = lines * (0.2 + 0.8 * patches) * calm / (1.0 + dist * 0.022);
          col += uTeal * swirl * (0.07 + 0.42 * uAwake + 0.5 * uAwake * nearIsland);
          // a soft teal depth under the lines, so the glow reads as water rather than wire
          col += uTealDeep * patches * calm * (0.05 + 0.3 * uAwake) / (1.0 + dist * 0.01);

          // rings where notes landed
          for (int i = 0; i < MAX_RIPPLES; i++) {
            vec4 r = uRipples[i];
            float age = uTime - r.z;
            if (age < 0.0 || age > 5.0 || r.w <= 0.0) continue;
            float d = length(p - r.xy);
            float radius = 0.8 + age * 5.5;
            float ring = exp(-pow((d - radius) * 0.9, 2.0)) + 0.5 * exp(-pow((d - radius * 0.55) * 1.4, 2.0));
            float fade = exp(-age * 1.0) * smoothstep(0.0, 0.12, age);
            float pool = exp(-d * d * 0.03) * exp(-age * 0.9) * 0.16;
            col += uRippleColors[i] * (ring + pool) * fade * r.w;
          }

          // the ember's warm reflection directly below Kite
          float ed = length(p - uEmberPos.xz);
          col += uEmberColor * exp(-ed * ed * 0.035) * uEmberPower * 0.22 / (1.0 + max(uEmberPos.y, 0.0) * 0.25);
          // the lit lens pours gold onto the water around the island
          float bd = length(p - uBeamPos.xz);
          col += vec3(1.0, 0.78, 0.45) * uBeamPower * exp(-bd * 0.02) * 0.35 * (0.6 + 0.4 * f);

          // glints
          float glint = smoothstep(0.985, 1.0, vnoise(p * 2.2 + uTime * 0.7)) * fres * calm;
          col += refl * glint * 1.5;

          col *= 1.0 - uContrast * 0.4;
          col = applyFog(col, vWorldPos, cameraPosition);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1).rotateX(-Math.PI / 2), mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** A ring of light on the water at world x,z. */
  ripple(x, z, strength = 1, color = COLORS.TEAL) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_RIPPLES;
    this.ripples[i].set(x, z, G.uTime.value, strength);
    this.uniforms.uRippleColors.value[i].set(color);
  }
}
