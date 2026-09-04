import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSkyStore } from '../../state/skyStore';
import { cloudCover, moonDirection, skyPalette, sunDirection } from '../../world/dayNight';
import { isTouchDevice } from '../../systems/touchInput';

/**
 * Free Play sky: ONE shader on a camera-centred dome.
 *  • Day: Rayleigh + Mie single-scattering (the three.js Sky formulation) with
 *    a real sun disc, plus an explicit twilight band so dusk lingers after the
 *    scattering model goes dark.
 *  • Night: deep-blue gradient + light pollution on the horizon, procedural
 *    stars (two scales, twinkle) and a faint Milky Way band.
 *  • Moon: a disc shaded by the ACTUAL sun direction (so its phase is real),
 *    with maria noise and a soft halo.
 *  • Clouds: FBM on a high shell, projected with perspective, lit by the sun
 *    (silver-lining offset sample), sunset undersides, moonlit at night.
 *  • The horizon blends into the scene fog colour so the treeline sits in it.
 * Output is raw (toneMapped false) to match how the drei <Sky> looked before.
 */

const TOUCH = isTouchDevice();
const OCTAVES = TOUCH ? 3 : 5;
const RADIUS = 480;

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uFogColor;
uniform vec3 uZenith;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uCloudCover;
uniform vec2 uCloudOffset;
uniform float uNight;      // 0 day → 1 deep night (lighting-weighted)
uniform float uSunEl;      // sun elevation, degrees
uniform float uMoonUp;     // 0..1
uniform float uMilky;      // 1 = draw Milky Way + twinkle (desktop)

const float PI = 3.141592653589793;
const vec3 UP = vec3(0.0, 1.0, 0.0);

// ---------- noise ----------
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < ${OCTAVES}; i++) {
    v += a * vnoise(p);
    p = ROT * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}

// ---------- day scattering (three.js Sky model) ----------
const vec3 TOTAL_RAYLEIGH = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
const vec3 MIE_CONST = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
const float RAYLEIGH_ZENITH = 8.4E3;
const float MIE_ZENITH = 1.25E3;
const float CUTOFF_ANGLE = 1.6110731556870734; // pi / 1.95
const float STEEPNESS = 1.5;
const float SUN_COS = 0.99996; // ~0.5 deg disc

vec3 daySky(vec3 d, float cosTheta, out vec3 fexOut, out float sunE) {
  float rayleigh = 3.0;
  float turbidity = 2.2;
  float mieCoeff = 0.0042;
  float mieG = 0.8;
  float sunfade = 1.0 - clamp(1.0 - exp(uSunDir.y * 1000.0 / 450000.0), 0.0, 1.0);
  vec3 betaR = TOTAL_RAYLEIGH * (rayleigh - 1.0 + sunfade);
  float c = (0.2 * turbidity) * 10E-18;
  vec3 betaM = 0.434 * c * MIE_CONST * mieCoeff;
  sunE = 1000.0 * max(0.0, 1.0 - exp(-((CUTOFF_ANGLE - acos(clamp(uSunDir.y, -1.0, 1.0))) / STEEPNESS)));
  float zenithAngle = acos(max(0.0, dot(UP, d)));
  float inverse = 1.0 / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / PI), -1.253));
  float sR = RAYLEIGH_ZENITH * inverse;
  float sM = MIE_ZENITH * inverse;
  vec3 Fex = exp(-(betaR * sR + betaM * sM));
  fexOut = Fex;
  float rPhase = (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
  float g2 = mieG * mieG;
  float mPhase = (1.0 / (4.0 * PI)) * ((1.0 - g2) / pow(1.0 - 2.0 * mieG * cosTheta + g2, 1.5));
  vec3 betaRTheta = betaR * rPhase;
  vec3 betaMTheta = betaM * mPhase;
  vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex), vec3(1.5));
  Lin *= mix(vec3(1.0), pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fex, vec3(0.5)), clamp(pow(1.0 - dot(UP, uSunDir), 5.0), 0.0, 1.0));
  vec3 L0 = vec3(0.1) * Fex;
  vec3 col = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
  return pow(col, vec3(1.0 / (1.2 + 1.2 * sunfade)));
}

// ACES filmic (Narkowicz fit) — the day scattering model is unbounded and
// clips to white without it (the three.js Sky demo tone-maps at exposure 0.5).
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// ---------- stars ----------
float starLayer(vec3 d, float scale, float density, float sizeMul, float tw) {
  vec3 p = d * scale;
  vec3 cell = floor(p);
  vec3 h = hash33(cell);
  float exists = step(1.0 - density, h.x);
  vec3 center = cell + 0.15 + 0.7 * hash33(cell + 7.1);
  float dist = length(p - center);
  float size = (0.06 + 0.10 * h.y) * sizeMul;
  float star = exists * smoothstep(size, size * 0.25, dist);
  float twinkle = 1.0 - tw * 0.45 * (0.5 + 0.5 * sin(uTime * (2.0 + 5.0 * h.z) + h.z * 40.0));
  return star * (0.35 + 0.65 * h.y) * twinkle;
}

// ---------- moon ----------
vec3 moon(vec3 d, out float disc) {
  disc = 0.0;
  float cosM = dot(d, uMoonDir);
  float ang = acos(clamp(cosM, -1.0, 1.0));
  const float R = 0.026; // ~1.5 deg — larger than life so the kids can spot the phase
  vec3 col = vec3(0.0);
  if (ang < R) {
    vec3 t = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 b = cross(uMoonDir, t);
    vec2 q = vec2(dot(d, t), dot(d, b)) / R;
    float rr = dot(q, q);
    float nz = sqrt(max(0.0, 1.0 - rr));
    vec3 n = normalize(t * q.x + b * q.y - uMoonDir * nz);
    float lambert = clamp(dot(n, uSunDir), 0.0, 1.0);
    // Maria: darker basalt patches.
    float maria = vnoise3(vec3(q * 3.2, 1.7)) * 0.6 + vnoise3(vec3(q * 7.0, 4.2)) * 0.4;
    float albedo = mix(0.62, 1.0, smoothstep(0.35, 0.7, maria));
    float edge = smoothstep(R, R * 0.93, ang);
    disc = edge;
    col = vec3(0.90, 0.88, 0.80) * albedo * (lambert * 0.9 + 0.01) * edge;
  }
  // Halo — brighter when the moon is high and the air is clear.
  float halo = exp(-ang * 22.0) * 0.22 + exp(-ang * 5.0) * 0.05;
  col += vec3(0.30, 0.36, 0.60) * halo * uMoonUp;
  return col;
}

void main() {
  vec3 d = normalize(vDir);
  float cosTheta = dot(d, uSunDir);
  float dy = d.y;

  // ----- day -----
  vec3 Fex; float sunE;
  vec3 col = daySky(d, cosTheta, Fex, sunE);
  // Tone-map the day model (it clips to white raw) and keep its 0.1·Fex floor
  // from lingering into the night (it reads as grey fog).
  col = aces(col * 0.62);
  col = pow(col, vec3(1.15));
  // With the sun well up, the scattering model reads grey and flat; cross-fade
  // to a designed gradient (palette zenith → horizon) with a warm sun halo so
  // a clear noon is the saturated blue a Texas sky actually is. The model
  // still owns sunrise/sunset, where its warm horizon is the star.
  {
    float gradW = smoothstep(3.0, 16.0, uSunEl);
    float t = pow(clamp(dy, 0.0, 1.0), 0.42);
    vec3 grad = mix(uFogColor * 1.12, uZenith, t);
    float ang = acos(clamp(cosTheta, -1.0, 1.0));
    grad += uSunColor * (exp(-ang * 3.5) * 0.30 + exp(-ang * 16.0) * 0.9);
    col = mix(col, grad, gradW);
  }
  float dayW = smoothstep(-7.0, -2.0, uSunEl);
  col *= dayW;
  float dayAmt = 1.0 - uNight;

  // ----- twilight band (after the scattering model goes dark) -----
  float twi = smoothstep(-17.0, -6.0, uSunEl) * (1.0 - smoothstep(-2.5, 2.0, uSunEl));
  vec3 sunFlat = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-4);
  vec3 dFlat = normalize(vec3(d.x, 0.0, d.z) + 1e-4);
  float toward = max(0.0, dot(sunFlat, dFlat));
  float band = exp(-max(dy, 0.0) * 7.0);
  col += (vec3(0.80, 0.22, 0.05) * pow(toward, 4.0) * 0.45 + vec3(0.08, 0.03, 0.12) * 0.25) * band * twi;
  col += vec3(0.025, 0.035, 0.11) * exp(-max(dy, 0.0) * 2.2) * twi * 0.4;

  // ----- night base -----
  // (linear-space values: the renderer encodes to sRGB on output)
  vec3 nightZenith = vec3(0.0022, 0.0040, 0.0125);
  vec3 nightHorizon = vec3(0.0085, 0.0115, 0.0235);
  vec3 nightSky = mix(nightHorizon, nightZenith, pow(clamp(dy, 0.0, 1.0), 0.55));
  nightSky *= 0.75 + 0.6 * uMoonUp;
  // Light pollution: a warm glow hugging the horizon (the city is out there).
  nightSky += vec3(0.020, 0.013, 0.007) * pow(1.0 - clamp(dy, 0.0, 1.0), 7.0);
  col += nightSky * uNight;

  // ----- clouds -----
  float cloudA = 0.0;
  vec3 cloudCol = vec3(0.0);
  if (dy > 0.015) {
    vec2 uv = d.xz / (dy + 0.10) * 1.9 + uCloudOffset * 3.0;
    float n = fbm(uv);
    // Erode the edges with finer detail so clouds get ragged cumulus rims.
    n += (fbm(uv * 2.7 + 13.1) - 0.5) * 0.22;
    float thr = 1.0 - uCloudCover * 0.85;
    float dens = smoothstep(thr, thr + 0.16, n);
    if (dens > 0.001) {
      // Sample toward the sun (or moon at night): thinner toward the light → lit rim.
      vec3 light = mix(uSunDir, uMoonDir, uNight);
      vec2 luv = uv + light.xz * 0.09;
      float n2 = fbm(luv);
      float lit = 1.0 - clamp((n2 - n) * 7.0, 0.0, 1.0);
      lit = lit * 0.75 + 0.25;
      // Lit/shadow colours by time of day.
      vec3 litDay = mix(vec3(1.0), uSunColor, 0.7) * 1.05;
      vec3 shadeDay = mix(vec3(0.30, 0.36, 0.52), vec3(0.14, 0.07, 0.13), smoothstep(12.0, -2.0, uSunEl));
      vec3 litNight = vec3(0.020, 0.026, 0.045) * (0.4 + 0.9 * uMoonUp);
      vec3 shadeNight = vec3(0.0035, 0.0045, 0.0085);
      vec3 litC = mix(litDay, litNight, uNight);
      vec3 shadeC = mix(shadeDay, shadeNight, uNight);
      // Thick cloud = less light gets through → grey underside even on the
      // lit side (keeps overcast from washing to flat white).
      float thick = smoothstep(0.0, 1.0, (n - thr) / 0.45);
      cloudCol = mix(shadeC, litC, lit * (1.0 - 0.55 * thick));
      cloudCol *= mix(1.0, 0.6, thick);
      // Distant clouds sink into the haze.
      float hazeAmt = 1.0 - smoothstep(0.02, 0.14, dy);
      cloudCol = mix(cloudCol, uFogColor, hazeAmt * 0.7);
      cloudA = dens * smoothstep(0.015, 0.12, dy);
    }
  }

  // ----- sun disc (behind clouds it dims but still glows) -----
  float sundisk = smoothstep(SUN_COS, SUN_COS + 0.00004, cosTheta);
  // Hue-preserving clamp so the disc goes orange at the horizon (extinction
  // reddens Fex) instead of clipping to white.
  vec3 sd = sunE * 19000.0 * Fex * sundisk * 0.04;
  float sdm = max(sd.r, max(sd.g, sd.b));
  vec3 sunDisc = (sdm > 1e-4 ? sd / sdm : vec3(0.0)) * min(sdm, 1.6) * dayAmt;
  col += sunDisc * (1.0 - cloudA * 0.9);

  // ----- stars + Milky Way -----
  float starAmt = (1.0 - smoothstep(-16.0, -4.0, uSunEl)) * smoothstep(-0.02, 0.12, dy) * (1.0 - cloudA);
  if (starAmt > 0.001) {
    float s = starLayer(d, 95.0, 0.14, 1.0, uMilky) * 0.9 + starLayer(d, 42.0, 0.10, 1.25, uMilky) * 1.4;
    // Slight colour variety: warm/cool by hash.
    float h = hash31(floor(d * 95.0));
    vec3 starCol = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.6), h);
    col += starCol * s * starAmt * 0.8;
    if (uMilky > 0.5) {
      vec3 mwAxis = normalize(vec3(0.55, 0.42, -0.72));
      float bandMW = exp(-pow(dot(d, mwAxis) / 0.20, 2.0));
      float mwN = vnoise3(d * 5.0) * 0.55 + vnoise3(d * 11.0) * 0.30 + vnoise3(d * 23.0) * 0.15;
      col += vec3(0.25, 0.30, 0.55) * bandMW * smoothstep(0.35, 0.8, mwN) * 0.13 * starAmt * (1.0 - 0.6 * uMoonUp);
    }
  }

  // ----- moon -----
  float moonDisc;
  vec3 moonCol = moon(d, moonDisc);
  float moonVis = (1.0 - cloudA) * smoothstep(-0.03, 0.06, dy);
  // Daytime moon: faint, tinted by the sky.
  col = mix(col, moonCol + col * (1.0 - moonDisc), moonDisc * moonVis * mix(0.35, 1.0, uNight));
  col += (moonCol - moonCol * moonDisc) * moonVis * uNight; // halo only

  // ----- clouds composite -----
  col = mix(col, cloudCol, cloudA);

  // ----- horizon → fog -----
  float horizonMix = 1.0 - smoothstep(-0.02, 0.07, dy);
  col = mix(col, uFogColor, horizonMix);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function SkyDome() {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uFogColor: { value: new THREE.Color('#c4dbef') },
      uZenith: { value: new THREE.Color('#3f7fd0') },
      uSunColor: { value: new THREE.Color('#fff3e0') },
      uTime: { value: 0 },
      uCloudCover: { value: 0.35 },
      uCloudOffset: { value: new THREE.Vector2(0, 0) },
      uNight: { value: 0 },
      uSunEl: { value: 45 },
      uMoonUp: { value: 0 },
      uMilky: { value: TOUCH ? 0 : 1 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
  }), []);

  useFrame(({ camera, clock }) => {
    const m = meshRef.current;
    if (!m) return;
    m.position.copy(camera.position);
    const sky = useSkyStore.getState();
    const sun = sunDirection(sky.dayFraction);
    const moon = moonDirection(sky.dayFraction);
    const p = skyPalette(sun.elevationDeg, moon.elevationDeg);
    const u = material.uniforms;
    (u.uSunDir.value as THREE.Vector3).set(sun.x, sun.y, sun.z);
    (u.uMoonDir.value as THREE.Vector3).set(moon.x, moon.y, moon.z);
    (u.uFogColor.value as THREE.Color).setRGB(p.horizon[0], p.horizon[1], p.horizon[2]);
    (u.uZenith.value as THREE.Color).setRGB(p.zenith[0], p.zenith[1], p.zenith[2]);
    (u.uSunColor.value as THREE.Color).setRGB(p.sunColor[0], p.sunColor[1], p.sunColor[2]);
    u.uTime.value = clock.elapsedTime;
    u.uCloudCover.value = sky.cloudOverride ?? cloudCover(performance.now() / 1000);
    (u.uCloudOffset.value as THREE.Vector2).set(sky.cloudOffsetX, sky.cloudOffsetY);
    u.uNight.value = p.night;
    u.uSunEl.value = sun.elevationDeg;
    u.uMoonUp.value = Math.max(0, Math.min(1, (moon.elevationDeg + 2) / 10));
  });

  return (
    <mesh ref={meshRef} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[RADIUS, 48, 32]} />
    </mesh>
  );
}
