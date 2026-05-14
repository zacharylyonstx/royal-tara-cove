import { useFrame } from '@react-three/fiber';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { POWERUP_LABEL } from '../state/combatStore';
import { gunWind } from '../audio';

const PICKUP_RADIUS = 1.6;

export function PowerUpController() {
  const phase = useGameStore((s) => s.phase);

  useFrame(() => {
    if (phase !== 'combat') return;
    const c = useCombatStore.getState();
    const g = useGameStore.getState();
    const player = g.positions[g.activeCharacterId];
    for (const drop of c.powerUpDrops) {
      const d = Math.hypot(drop.x - player.x, drop.z - player.z);
      if (d < PICKUP_RADIUS) {
        c.pickupPowerUp(drop.id);
        gunWind();
        c.spawnFloatingText(drop.x, 1.5, drop.z, POWERUP_LABEL[drop.kind].toUpperCase(), '#fff7d0', true);
        c.pushDialogue(g.activeCharacterId, '✨ Got one!');
      }
    }
  });

  return null;
}
