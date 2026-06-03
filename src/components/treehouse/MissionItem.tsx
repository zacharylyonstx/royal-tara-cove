import { useTreehouseStore } from '../../state/treehouseStore';
import { useGameStore } from '../../state/gameStore';
import { Dog } from '../munchies/Dog';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

export function MissionItem() {
  const item = useTreehouseStore((s) => s.missionItem);
  const positions = useGameStore((s) => s.positions);
  const yaws = useGameStore((s) => s.yaws);
  if (!item) return null;

  let x = item.x;
  let z = item.z;
  let yaw = 0;
  if (item.carriedBy) {
    const p = positions[item.carriedBy];
    if (p) { x = p.x; z = p.z; yaw = yaws[item.carriedBy]; }
  }

  if (item.id === 'gnome') {
    return <GnomeMesh x={x} y={item.carriedBy ? 1.4 : 0.3} z={z} />;
  }
  if (item.id === 'sparky') {
    return <Dog positionRef={{ x, z, yaw }} bluish={false} />;
  }
  return null;
}

function GnomeMesh({ x, y, z }: { x: number; y: number; z: number }) {
  // Original gnome was centered on its group origin; ground the GLB then shift
  // down by half its height so the carry (y=1.4) / grounded (y=0.3) offsets still read.
  return (
    <group position={[x, y, z]}>
      <GLBModel url={MODELS.gnome.url} fitHeight={MODELS.gnome.fitHeight} position={[0, -0.22, 0]} />
    </group>
  );
}
