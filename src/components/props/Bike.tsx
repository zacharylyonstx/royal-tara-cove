import { usePlayStore } from '../../state/playStore';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface BikeProps {
  position: [number, number, number];
  rotation?: number;
  /** Frame color (tints the white GLB frame). */
  color?: string;
  /** Scale: kid-sized = 0.7, adult = 1 */
  scale?: number;
  /** Registered bike id; when set and someone is riding it, this prop hides. */
  id?: string;
}

/**
 * BMX bike (real GLB). White frame tinted by `color` for the kids' pink/green
 * bikes. The ridden copy is drawn by RiddenBike, so this parked prop hides while
 * its id is being ridden (unchanged). Forward travel is +X (see RiddenBike's
 * +PI/2 yaw offset); MODELS.bike.rotationY aligns the model to that axis.
 */
export function Bike({ position, rotation = 0, color = '#c8392a', scale = 1, id }: BikeProps) {
  // Hidden while someone rides it — or once it's been left somewhere else (then
  // <ParkedBikes/> draws it in world space where the rider hopped off).
  const away = usePlayStore((s) =>
    id != null && (!!s.bikes[id]?.parked || Object.values(s.riding).some((r) => r?.bikeId === id)),
  );
  if (away) return null;
  const cfg = MODELS.bike;
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} rotationY={cfg.rotationY} tint={color} />
    </group>
  );
}

/** Bikes resting wherever their last rider left them (world space). "I rode to
 *  the pond, hopped off to pet a duck, and my bike was gone" — not any more. */
export function ParkedBikes() {
  const bikes = usePlayStore((s) => s.bikes);
  const riding = usePlayStore((s) => s.riding);
  const ridden = new Set(Object.values(riding).map((r) => r?.bikeId).filter(Boolean));
  return (
    <>
      {Object.values(bikes).filter((b) => b.parked && !ridden.has(b.id)).map((b) => (
        // RiddenBike draws bikes at heading + π/2 (model forward is +X) — match it.
        <Bike key={b.id} position={[b.x, 0, b.z]} rotation={(b.parked?.yaw ?? 0) + Math.PI / 2} color={b.color} scale={b.scale ?? 1} />
      ))}
    </>
  );
}
