import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';

interface BinsProps {
  position: [number, number, number];
  rotation?: number;
}

export function TrashBins({ position, rotation = 0 }: BinsProps) {
  const cfg = MODELS.trashbins;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <GLBModel url={cfg.url} fitHeight={cfg.fitHeight} />
    </group>
  );
}
