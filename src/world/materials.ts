import * as THREE from 'three';
import {
  asphaltTexture,
  brickTexture,
  carPaintTexture,
  concreteTexture,
  grassTexture,
  limestoneTexture,
  rugTexture,
  shingleTexture,
  sidewalkTexture,
  stuccoTexture,
  tileFloorTexture,
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
const carCache = new Map<string, THREE.Material>();

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
  brick(): THREE.Material {
    if (cached.brick) return cached.brick;
    cached.brick = new THREE.MeshStandardMaterial({
      map: brickTexture(),
      roughness: 0.86,
      color: '#cc8a78',
    });
    return cached.brick;
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
  glass(): THREE.Material {
    if (cached.glass) return cached.glass;
    cached.glass = new THREE.MeshStandardMaterial({
      color: '#3e5a78',
      metalness: 0.6,
      roughness: 0.18,
      emissive: '#0d1620',
      emissiveIntensity: 0.4,
    });
    return cached.glass;
  },
  carPaint(color: string): THREE.Material {
    const c = carCache.get(color);
    if (c) return c;
    const m = new THREE.MeshStandardMaterial({
      map: carPaintTexture(color),
      roughness: 0.42,
      metalness: 0.6,
      color,
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
