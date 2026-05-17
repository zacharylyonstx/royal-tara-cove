import { useFrame } from '@react-three/fiber';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { blobSquish, damageHit } from '../audio';

const GRAVITY = 22;
const BOMB_LIFE = 3.5;
const LEGO_LIFE = 1.5;
const BOMB_EXPLODE_RADIUS = 2.2;
const HIT_RADIUS_BLOB = 0.65;

export function ProjectileController() {
  const phase = useGameStore((s) => s.phase);
  const slowMo = useCombatStore((s) => s.slowMo);

  useFrame((_, dtRaw) => {
    if (useGameStore.getState().gameMode !== 'aliens') return;
    if (phase !== 'combat') return;
    const dt = Math.min(dtRaw, 0.1) * slowMo;
    const c = useCombatStore.getState();
    const projectiles = c.projectiles;
    if (projectiles.length === 0) return;
    const blobs = c.blobs.filter((b) => b.alive);
    const now = performance.now() / 1000;

    for (const p of projectiles) {
      const age = now - p.spawnedAt;
      // Gravity
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rotPhase += dt * 6;

      let exploded = false;
      let hitBlobId: number | null = null;

      // Blob hit-test
      for (const b of blobs) {
        const r = HIT_RADIUS_BLOB * b.scale;
        const d = Math.hypot(b.x - p.x, b.z - p.z);
        const dy = Math.abs(b.y + 0.4 * b.scale - p.y);
        if (d < r && dy < r) {
          hitBlobId = b.id;
          break;
        }
      }

      if (p.kind === 'bomb') {
        // Ground bounce
        if (p.y < 0.18) {
          p.y = 0.18;
          if ((p.bouncesLeft ?? 0) > 0 && Math.abs(p.vy) > 1) {
            p.bouncesLeft = (p.bouncesLeft ?? 0) - 1;
            p.vy = -p.vy * 0.55;
            p.vx *= 0.7;
            p.vz *= 0.7;
          } else if (age > 0.4) {
            // Settle then explode after fuse
            p.vy = 0;
            p.vx *= 0.8;
            p.vz *= 0.8;
          }
        }
        // Explode on blob contact OR after fuse OR after life
        if (hitBlobId !== null || age > 1.6 || age > BOMB_LIFE) {
          exploded = true;
          // Splash damage
          for (const b of blobs) {
            const d = Math.hypot(b.x - p.x, b.z - p.z);
            if (d < BOMB_EXPLODE_RADIUS) {
              c.damageBlob(b.id, p.damage);
              c.spawnHitParticle(b.x, b.y + 0.3, b.z, b.variant);
            }
          }
          // Visual: spawn a few "burst" floating texts
          c.spawnFloatingText(p.x, p.y + 0.5, p.z, '💥', '#ff66b0', true);
          c.addShake(0.35);
          c.recordShotHit();
          blobSquish();
          damageHit();
          c.removeProjectile(p.id);
        }
      } else {
        // Lego: damage on first blob hit OR removal at age
        if (hitBlobId !== null) {
          c.damageBlob(hitBlobId, p.damage);
          const blob = blobs.find((b) => b.id === hitBlobId);
          if (blob) c.spawnHitParticle(blob.x, blob.y + 0.3, blob.z, blob.variant);
          c.recordShotHit();
          blobSquish();
          c.removeProjectile(p.id);
          exploded = true;
        } else if (p.y < 0.05 || age > LEGO_LIFE) {
          c.removeProjectile(p.id);
          exploded = true;
        }
      }

      if (exploded) continue;
    }
  });

  return null;
}
