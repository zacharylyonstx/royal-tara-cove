import * as THREE from 'three';

// Real-world debris shapes pulled into the funnel: planks, shingles,
// sheet metal, tree branches, 2×4 lumber. Each archetype gets its own
// geometry + material so an InstancedMesh per archetype renders cleanly.

export interface DebrisArchetype {
  name: string;
  geom: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

export function buildDebrisArchetypes(): DebrisArchetype[] {
  return [
    {
      name: 'plank',
      geom: new THREE.BoxGeometry(0.04, 0.04, 0.6),
      material: new THREE.MeshStandardMaterial({ color: '#7a5a32', roughness: 0.9, transparent: true, opacity: 0 }),
    },
    {
      name: 'shingle',
      geom: new THREE.BoxGeometry(0.2, 0.02, 0.15),
      material: new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.95, transparent: true, opacity: 0 }),
    },
    {
      name: 'sheet-metal',
      geom: new THREE.BoxGeometry(0.25, 0.01, 0.3),
      material: new THREE.MeshStandardMaterial({ color: '#8a8a92', metalness: 0.55, roughness: 0.4, transparent: true, opacity: 0 }),
    },
    {
      name: 'branch',
      geom: new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6),
      material: new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.95, transparent: true, opacity: 0 }),
    },
    {
      name: 'lumber-2x4',
      geom: new THREE.BoxGeometry(0.05, 0.1, 1.0),
      material: new THREE.MeshStandardMaterial({ color: '#a07050', roughness: 0.85, transparent: true, opacity: 0 }),
    },
  ];
}
