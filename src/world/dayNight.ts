/**
 * Free Play day/night math — pure functions, no React/three state.
 *
 * `dayFraction` is the game clock: 0 = midnight, 0.25 = 6 AM, 0.5 = noon,
 * 0.75 = 6 PM. One game hour is one real minute (a 24-minute game day), so a
 * one-hour call always spans at least two full nights.
 *
 * Compass convention (matches streetLayout): the stick runs NORTH into −Z, so
 * east = +X, south = +Z, up = +Y. The sun rises over the boulevard side (+X),
 * crosses the southern sky (over 10600's backyard) and sets behind the west lots.
 */

/** Real seconds per game day. 24 min → "every minute is an hour". */
export const DAY_LENGTH_REAL_SEC = 24 * 60;
/** Game time a fresh Free Play session starts at (8:00 AM). */
export const START_DAY_FRACTION = 8 / 24;

const DEG = Math.PI / 180;
const LATITUDE = 30.3 * DEG;      // Austin, TX
const SUN_DECL = 20 * DEG;        // late-May sun: long days, high noon sun
const MOON_DECL = -8 * DEG;
/** Moon trails the sun by ~150° of hour angle → waxing gibbous that rises
 *  mid-afternoon, is up all evening/night and sets around 4 AM. */
const MOON_LAG = 150 * DEG;

export interface SkyDir { x: number; y: number; z: number; elevationDeg: number }

/** Direction TOWARD a body from an hour angle (radians, 0 = local noon) and
 *  declination, in world axes (east +X, up +Y, south +Z). */
function bodyDir(hourAngle: number, decl: number): SkyDir {
  const sinEl = Math.sin(LATITUDE) * Math.sin(decl) + Math.cos(LATITUDE) * Math.cos(decl) * Math.cos(hourAngle);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const cosEl = Math.cos(el);
  let az: number;
  if (cosEl < 1e-6) az = Math.PI;
  else {
    const c = (Math.sin(decl) - Math.sin(LATITUDE) * sinEl) / (Math.cos(LATITUDE) * cosEl);
    az = Math.acos(Math.max(-1, Math.min(1, c))); // from north, toward east
    if (hourAngle > 0) az = Math.PI * 2 - az;      // afternoon → west of south
  }
  // north = (0,0,-1), east = (1,0,0)
  return {
    x: cosEl * Math.sin(az),
    y: Math.sin(el),
    z: -cosEl * Math.cos(az),
    elevationDeg: el / DEG,
  };
}

/** Sun hour angle for a day fraction. Solar noon is at 1:00 PM clock time
 *  (Austin runs on daylight-saving time in summer), so sunrise ≈ 6:10 AM and
 *  sunset ≈ 7:50 PM — the clock reads the way the kids expect. */
export function sunHourAngle(dayFraction: number): number {
  return (dayFraction * 24 - 13) * 15 * DEG;
}

export function sunDirection(dayFraction: number): SkyDir {
  return bodyDir(sunHourAngle(dayFraction), SUN_DECL);
}

export function moonDirection(dayFraction: number): SkyDir {
  let h = sunHourAngle(dayFraction) - MOON_LAG;
  if (h < -Math.PI) h += Math.PI * 2;
  return bodyDir(h, MOON_DECL);
}

export function hourOfDay(dayFraction: number): number {
  return ((dayFraction % 1) + 1) % 1 * 24;
}

/** "7:42 PM" */
export function clockLabel(dayFraction: number): string {
  const h = hourOfDay(dayFraction);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${mm.toString().padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

/** Emoji for the HUD clock pill. */
export function clockIcon(sunEl: number, hour: number): string {
  if (sunEl > 10) return hour < 12 ? '🌤️' : '☀️';
  if (sunEl > -4) return hour < 12 ? '🌅' : '🌇';
  if (sunEl > -12) return '🌆';
  return '🌙';
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

export type RGB = [number, number, number];
/** sRGB hex → LINEAR rgb (three's lights/fog/colors live in linear space, so
 *  a hex authored by eye must be decoded or it renders ~2× too bright). */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}
function mixRGB(a: RGB, b: RGB, t: number, out: RGB): RGB {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
/** Piecewise-linear colour ramp keyed on sun elevation (degrees). */
function ramp(stops: [number, RGB][], el: number, out: RGB): RGB {
  if (el <= stops[0][0]) return mixRGB(stops[0][1], stops[0][1], 0, out);
  for (let i = 1; i < stops.length; i++) {
    if (el <= stops[i][0]) {
      const [e0, c0] = stops[i - 1];
      const [e1, c1] = stops[i];
      return mixRGB(c0, c1, (el - e0) / (e1 - e0), out);
    }
  }
  const last = stops[stops.length - 1][1];
  return mixRGB(last, last, 0, out);
}

// Colour ramps (sun elevation → colour). Night values are lifted a touch above
// physical so the kids can still see the yards; the street lamps do the rest.
const SUN_COLOR: [number, RGB][] = [
  [-6, hex('#ff6a3a')], [0, hex('#ff9650')], [3, hex('#ffb877')], [8, hex('#ffd9b0')], [15, hex('#fff0dc')], [30, hex('#fff8ee')], [60, hex('#fffaf0')],
];
const MOON_COLOR: RGB = hex('#8fa6ff');
const ZENITH: [number, RGB][] = [
  [-14, hex('#05091a')], [-8, hex('#0b1330')], [-3, hex('#1c2b5e')], [0, hex('#345a9a')], [6, hex('#4a83c9')], [20, hex('#4c8ad6')], [60, hex('#3f7fd0')],
];
const HORIZON: [number, RGB][] = [
  [-14, hex('#0d1424')], [-8, hex('#1b2036')], [-4, hex('#5e4a5c')], [-1, hex('#c47a5a')], [2, hex('#e8a874')], [8, hex('#dcc3a6')], [20, hex('#bdd4ea')], [60, hex('#b7d1ea')],
];
const AMBIENT: [number, RGB][] = [
  [-12, hex('#3c4a78')], [-4, hex('#5a5878')], [0, hex('#9a7a78')], [8, hex('#a5a8b8')], [30, hex('#bfe0ec')],
];
const HEMI_GROUND: RGB = hex('#6a9a4e');

export interface SkyPalette {
  sunEl: number;
  moonEl: number;
  /** 0 night → 1 full day (lighting-weighted). */
  day: number;
  /** 0 day → 1 deep night. */
  night: number;
  /** 1 while the sun is near the horizon (golden/blue hour). */
  dusk: number;
  /** Street lamps / porch lights / windows: 0 off (day) → 1 on (night). */
  lamps: number;
  sunColor: RGB;
  sunIntensity: number;
  moonIntensity: number;
  zenith: RGB;
  horizon: RGB;
  ambient: RGB;
  hemiSky: RGB;
  hemiGround: RGB;
  hemiIntensity: number;
  ambientIntensity: number;
  fogNear: number;
  fogFar: number;
  envIntensity: number;
}

const _p: SkyPalette = {
  sunEl: 0, moonEl: 0, day: 1, night: 0, dusk: 0, lamps: 0,
  sunColor: [1, 1, 1], sunIntensity: 1, moonIntensity: 0,
  zenith: [0, 0, 0], horizon: [0, 0, 0], ambient: [0, 0, 0], hemiSky: [0, 0, 0], hemiGround: HEMI_GROUND,
  hemiIntensity: 1, ambientIntensity: 0.45, fogNear: 70, fogFar: 330, envIntensity: 0.62,
};

/** Fill (and return) the shared palette for a sun/moon elevation. Reuses one
 *  object — read it immediately, don't hold onto it. */
export function skyPalette(sunEl: number, moonEl: number): SkyPalette {
  const p = _p;
  p.sunEl = sunEl;
  p.moonEl = moonEl;
  p.day = smoothstep(-8, 6, sunEl);
  p.night = 1 - smoothstep(-13, -2, sunEl);
  p.dusk = Math.exp(-(sunEl * sunEl) / 90);
  p.lamps = 1 - smoothstep(-0.5, 3.5, sunEl);
  ramp(SUN_COLOR, sunEl, p.sunColor);
  // Sun: 1.6 at high noon, tapering through golden hour, gone by civil dusk.
  p.sunIntensity = 1.6 * smoothstep(-1.5, 9, sunEl) * (0.5 + 0.5 * smoothstep(0, 35, sunEl));
  // Moon: only once the sun is properly down and the moon is up.
  const moonUp = smoothstep(-2, 8, moonEl);
  p.moonIntensity = 0.3 * (1 - smoothstep(-10, -3, sunEl)) * moonUp;
  ramp(ZENITH, sunEl, p.zenith);
  ramp(HORIZON, sunEl, p.horizon);
  ramp(AMBIENT, sunEl, p.ambient);
  // Hemisphere sky colour tracks the zenith but lifted so it reads as fill.
  p.hemiSky[0] = Math.min(1, p.zenith[0] * 0.55 + p.horizon[0] * 0.55);
  p.hemiSky[1] = Math.min(1, p.zenith[1] * 0.55 + p.horizon[1] * 0.55);
  p.hemiSky[2] = Math.min(1, p.zenith[2] * 0.55 + p.horizon[2] * 0.55);
  p.hemiIntensity = lerp(0.14 + 0.06 * moonUp, 0.95, p.day);
  p.ambientIntensity = lerp(0.12 + 0.04 * moonUp, 0.45, p.day);
  p.fogNear = lerp(40, 70, p.day);
  p.fogFar = lerp(210, 330, p.day);
  p.envIntensity = lerp(0.06, 0.62, p.day);
  return p;
}

export function moonColor(): RGB { return MOON_COLOR; }

/** Legacy combatStore.timeOfDay (0 = bright midday → 1 = night) from the sun
 *  elevation, so existing consumers (Fireflies, SunMotes, IBL fade) keep
 *  working unchanged in Free Play. */
export function legacyTimeOfDay(sunEl: number): number {
  if (sunEl >= 60) return 0;
  if (sunEl >= 0) return 0.5 * (1 - sunEl / 60);
  return 0.5 + 0.5 * Math.min(1, -sunEl / 18);
}

/**
 * Window "lights on" amount (0..1) for a glass-material bucket. Lights come on
 * at dusk and go off at staggered bedtimes; bucket 4 (the warm hall light)
 * stays on all night; buckets 1 and 3 are dark rooms that never light.
 */
export function windowLightAmount(bucket: number, hour: number, lamps: number): number {
  if (bucket === 1 || bucket === 3) return 0;
  if (bucket === 4) return lamps;
  const bedtime = bucket === 0 ? 22.5 : bucket === 2 ? 23.75 : 21.5; // bucket 5
  // Off from bedtime until the sun comes back up (lamps → 0 handles dawn).
  const evening = hour >= 12 ? 1 - smoothstep(bedtime - 0.3, bedtime + 0.3, hour) : 0;
  return lamps * evening;
}

/** Slow cloud-cover drift (0.12 clear … 0.58 broken clouds) over a couple of
 *  real hours so some game days are clearer than others. */
export function cloudCover(realSeconds: number): number {
  const a = 0.5 + 0.5 * Math.sin(realSeconds * 0.00085 + 1.3);
  const b = 0.5 + 0.5 * Math.sin(realSeconds * 0.00031 + 4.1);
  return 0.12 + 0.46 * (a * 0.65 + b * 0.35);
}
