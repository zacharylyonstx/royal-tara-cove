import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface BBQProps {
  position: [number, number, number];
  rotation?: number;
}

export function BBQGrill({ position, rotation = 0 }: BBQProps) {
  const cfg = MODELS.grill;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} />
    </group>
  );
}
