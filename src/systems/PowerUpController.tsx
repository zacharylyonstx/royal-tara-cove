import { useFrame } from '@react-three/fiber';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { POWERUP_LABEL, HEAL_AMOUNT } from '../state/combatStore';
import { gunWind, petChime } from '../audio';

const PICKUP_RADIUS = 1.6;

export function PowerUpController() {
  const phase = useGameStore((s) => s.phase);

  useFrame(() => {
    if (!useNetStore.getState().isHost) return;
    if (useGameStore.getState().gameMode !== 'aliens') return;
    if (phase !== 'combat') return;
    const c = useCombatStore.getState();
    const g = useGameStore.getState();
    // Check pickup against ALL characters (any peer can grab a drop) since
    // host has all positions in gameStore.positions (network-driven).
    for (const drop of c.powerUpDrops) {
      let pickedUpBy: string | null = null;
      for (const [id, pos] of Object.entries(g.positions)) {
        const d = Math.hypot(drop.x - pos.x, drop.z - pos.z);
        if (d < PICKUP_RADIUS) {
          pickedUpBy = id;
          break;
        }
      }
      if (pickedUpBy) {
        c.pickupPowerUp(drop.id);
        if (drop.kind === 'heal') {
          g.healPlayer(HEAL_AMOUNT);
          petChime();
          c.spawnFloatingText(drop.x, 1.5, drop.z, `+${HEAL_AMOUNT} 💚`, '#8dffb0', true);
          c.pushDialogue(pickedUpBy as 'dad' | 'penny' | 'luke', 'Phew — that helps!');
        } else {
          gunWind();
          c.spawnFloatingText(drop.x, 1.5, drop.z, POWERUP_LABEL[drop.kind].toUpperCase(), '#fff7d0', true);
          c.pushDialogue(pickedUpBy as 'dad' | 'penny' | 'luke', '✨ Got one!');
        }
      }
    }
  });

  return null;
}
