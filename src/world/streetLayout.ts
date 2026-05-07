// Geometry of the Royal Tara Cove cul-de-sac.
//
// World convention: y is up, +x east, +z south. The cove center is the world origin.
// The road enters from the south (–z axis side) — we leave a 60° angular gap there.
// Houses ring the bulb, facing inward (toward the origin).
//
// Polar angles below are math-convention degrees: 0° = +x (east), 90° = +z (south),
// 180° = -x (west), 270° = -z (north).
export const STREET_RADIUS = 22;          // pavement edge — radius of the cul-de-sac bulb
export const SIDEWALK_WIDTH = 1.4;
export const LOT_FRONT_RADIUS = STREET_RADIUS + SIDEWALK_WIDTH; // where the lot begins
export const FRONT_YARD_DEPTH = 7;        // depth of front yard from sidewalk to house
export const HOUSE_FRONT_RADIUS = LOT_FRONT_RADIUS + FRONT_YARD_DEPTH;
export const BACKYARD_DEPTH = 12;         // depth of backyard behind the house
export const ENTRY_GAP_DEG = 60;          // angular gap on the entry side (south)
export const ENTRY_CENTER_DEG = 90;       // direction the road comes in from (south = +z = 90°)

export function radialToXZ(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [Math.cos(rad) * radius, Math.sin(rad) * radius];
}

// Yaw rotation around Y so that an object's local –Z axis (its "front") points
// toward the cove center. Default house orientation has front = –Z.
export function houseYawForAngle(angleDeg: number): number {
  // From derivation: a house at polar angle θ should rotate by (θ + 90°) so its
  // local –Z faces the origin. We use radians.
  return ((angleDeg + 90) * Math.PI) / 180;
}
