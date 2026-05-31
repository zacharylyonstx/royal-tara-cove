import * as THREE from 'three';
import {
  asphaltTexture,
  brickTexture,
  carPaintTexture,
  concreteTexture,
  grassTexture,
  lapSidingTexture,
  limestoneTexture,
  rugTexture,
  shingleTexture,
  sidewalkTexture,
  stuccoTexture,
  tileFloorTexture,
  windowGlassTexture,
  woodFloorTexture,
  woodPlankTexture,
} from './textures';

// Lazily-built shared materials. Calling `mat.X()` from React components is
// fine as long as we're inside the canvas (browser env).

let cached: {
  grass?: THREE.Material;
  asphalt?: THREE.Material;
  concrete?: THREE.Material;
  sidewalk?: THREE.Material;
  brick?: THREE.Material;
  shingleBrown?: THREE.Material;
  shingleGray?: THREE.Material;
  shingleCharcoal?: THREE.Material;
  fenceWood?: THREE.Material;
  glass?: THREE.Material;
  carWindow?: THREE.Material;
  woodFloor?: THREE.Material;
  tileFloor?: THREE.Material;
  rug?: THREE.Material;
} = {};

const stuccoCache = new Map<string, THREE.Material>();
const stoneCache = new Map<string, THREE.Material>();
const brickCache = new Map<string, THREE.Material>();
const sidingCache = new Map<string, THREE.Material>();
const carCache = new Map<string, THREE.Material>();
const glassCache = new Map<number, THREE.Material>();
const GLASS_VARIANTS = 6;

// Inject a view-space Fresnel rim into MeshStandardMaterial's emissive, so glass
// brightens at grazing angles and "catches the light" as you walk past — the cue
// a flat self-lit pane otherwise lacks. Needs no environment map. The distinct
// customProgramCacheKey stops two rim materials from sharing one shader program
// and mis-binding uniforms.
function addGlassFresnel(m: THREE.MeshStandardMaterial, rim: string, strength: number) {
  const rimColor = new THREE.Color(rim);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: rimColor };
    shader.uniforms.uRimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nfloat _fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.8);\ntotalEmissiveRadiance += uRimColor * _fres * uRimStrength;',
      );
  };
  m.customProgramCacheKey = () => `glassRim_${rim}_${strength}`;
}

export const mat = {
  grass(): THREE.Material {
    if (cached.grass) return cached.grass;
    cached.grass = new THREE.MeshStandardMaterial({
      map: grassTexture(),
      roughness: 0.95,
      metalness: 0,
    });
    return cached.grass;
  },
  asphalt(): THREE.Material {
    if (cached.asphalt) return cached.asphalt;
    cached.asphalt = new THREE.MeshStandardMaterial({
      map: asphaltTexture(),
      roughness: 0.92,
      metalness: 0.02,
    });
    return cached.asphalt;
  },
  concrete(): THREE.Material {
    if (cached.concrete) return cached.concrete;
    cached.concrete = new THREE.MeshStandardMaterial({
      map: concreteTexture(),
      roughness: 0.88,
    });
    return cached.concrete;
  },
  sidewalk(): THREE.Material {
    if (cached.sidewalk) return cached.sidewalk;
    cached.sidewalk = new THREE.MeshStandardMaterial({
      map: sidewalkTexture(),
      roughness: 0.85,
    });
    return cached.sidewalk;
  },
  brick(color: string): THREE.Material {
    const c = brickCache.get(color);
    if (c) return c;
    const m = new THREE.MeshStandardMaterial({
      map: brickTexture(color),
      roughness: 0.9,
      metalness: 0,
    });
    brickCache.set(color, m);
    return m;
  },
  lapSiding(color: string): THREE.Material {
    const c = sidingCache.get(color);
    if (c) return c;
    const m = new THREE.MeshStandardMaterial({
      map: lapSidingTexture(color),
      roughness: 0.9,
      metalness: 0,
    });
    sidingCache.set(color, m);
    return m;
  },
  stucco(color: string): THREE.Material {
    const k = color;
    const c = stuccoCache.get(k);
    if (c) return c;
    const m = new THREE.MeshStandardMaterial({
      map: stuccoTexture(color),
      roughness: 0.88,
    });
    stuccoCache.set(k, m);
    return m;
  },
  stone(color: string): THREE.Material {
    const k = color;
    const c = stoneCache.get(k);
    if (c) return c;
    const m = new THREE.MeshStandardMaterial({
      map: limestoneTexture(color),
      roughness: 0.82,
      metalness: 0,
    });
    stoneCache.set(k, m);
    return m;
  },
  shingles(color: string): THREE.Material {
    // Pick a cached one if it matches a common roof color; otherwise build.
    const k = color;
    const all: Record<string, THREE.Material | undefined> = {
      brown: cached.shingleBrown,
      gray: cached.shingleGray,
      charcoal: cached.shingleCharcoal,
    };
    const exists = all[k];
    if (exists) return exists;
    const m = new THREE.MeshStandardMaterial({
      map: shingleTexture(color),
      roughness: 0.92,
      metalness: 0,
      color,
    });
    return m;
  },
  fenceWood(): THREE.Material {
    if (cached.fenceWood) return cached.fenceWood;
    cached.fenceWood = new THREE.MeshStandardMaterial({
      map: woodPlankTexture('#a08560'),
      roughness: 0.92,
    });
    return cached.fenceWood;
  },
  /**
   * Window glass that reads as reflected sky (or a warm lit room), not a dark
   * brick recess. Self-lit via emissiveMap with metalness 0 so it never goes
   * black without an environment map (the same trap that blacked out the cars).
   * `seed` picks one of a few cached variants so adjacent panes differ.
   */
  glassFor(seed: number): THREE.Material {
    const bucket = ((Math.round(seed) % GLASS_VARIANTS) + GLASS_VARIANTS) % GLASS_VARIANTS;
    const hit = glassCache.get(bucket);
    if (hit) return hit;
    const tex = windowGlassTexture(bucket);
    const warm = bucket === 4;
    const dusk = bucket === 5;
    const m = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: '#ffffff',
      emissiveMap: tex, // same gradient self-lights the pane
      emissiveIntensity: warm ? 0.6 : dusk ? 0.4 : 0.46,
      roughness: 0.12,
      metalness: 0, // CRITICAL: 0 or it renders black with no env map
    });
    addGlassFresnel(m, warm ? '#ffe3b0' : '#d6ecff', warm ? 0.5 : 0.6);
    glassCache.set(bucket, m);
    return m;
  },
  /** Back-compat default (BayWindow + any seedless caller) = a cool sky pane. */
  glass(): THREE.Material {
    return this.glassFor(0);
  },
  carPaint(color: string): THREE.Material {
    const c = carCache.get(color);
    if (c) return c;
    // Low metalness: with no environment map, high metalness made every car
    // read as black. The paint texture ALREADY encodes the colour, so we leave
    // the material colour white — multiplying map×colour would square the value
    // and crush every mid-tone car to near-black (the old bug).
    const m = new THREE.MeshStandardMaterial({
      map: carPaintTexture(color),
      roughness: 0.45,
      metalness: 0.15,
    });
    carCache.set(color, m);
    return m;
  },
  carWindow(): THREE.Material {
    if (cached.carWindow) return cached.carWindow;
    cached.carWindow = new THREE.MeshStandardMaterial({
      color: '#0a0e14',
      roughness: 0.2,
      metalness: 0.5,
    });
    return cached.carWindow;
  },
  woodFloor(): THREE.Material {
    if (cached.woodFloor) return cached.woodFloor;
    cached.woodFloor = new THREE.MeshStandardMaterial({
      map: woodFloorTexture(),
      roughness: 0.6,
    });
    return cached.woodFloor;
  },
  tileFloor(): THREE.Material {
    if (cached.tileFloor) return cached.tileFloor;
    cached.tileFloor = new THREE.MeshStandardMaterial({
      map: tileFloorTexture(),
      roughness: 0.4,
      metalness: 0.05,
    });
    return cached.tileFloor;
  },
  rug(): THREE.Material {
    if (cached.rug) return cached.rug;
    cached.rug = new THREE.MeshStandardMaterial({
      map: rugTexture(),
      roughness: 0.95,
    });
    return cached.rug;
  },
};
