import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { CHARACTERS } from '../world/characters';
import type { CharacterId } from '../types';

/**
 * Floating name tags over family members controlled by OTHER peers — the
 * instant "I see you, Daddy!" moment when the kids connect. The local player
 * never sees their own tag (it would hang in the first-person camera), and
 * unclaimed NPCs stay tag-less.
 *
 * Each tag is a group moved in useFrame (positions are mutated in place by
 * NetSyncController, so following via refs avoids per-frame React renders).
 */
export function NameTags() {
  const peers = useNetStore((s) => s.peers);
  const myCharacterId = useNetStore((s) => s.myCharacterId);

  const remoteClaimed = new Set<CharacterId>();
  for (const p of Object.values(peers)) {
    if (p.characterId && p.characterId !== myCharacterId) remoteClaimed.add(p.characterId);
  }

  return (
    <>
      {[...remoteClaimed].map((id) => (
        <NameTag key={id} id={id} />
      ))}
    </>
  );
}

function NameTag({ id }: { id: CharacterId }) {
  const groupRef = useRef<THREE.Group>(null);
  const def = CHARACTERS[id];

  useFrame(() => {
    const pos = useGameStore.getState().positions[id];
    if (groupRef.current && pos) {
      // Below the speech bubble slot (height + 0.6) so both can show at once.
      groupRef.current.position.set(pos.x, pos.y + def.height + 0.3, pos.z);
    }
  });

  return (
    <group ref={groupRef}>
      <Html center distanceFactor={11} zIndexRange={[90, 0]} occlude={false}>
        <div
          style={{
            background: 'rgba(20,28,38,0.72)',
            color: 'white',
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 800,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            border: `2px solid ${def.bodyColor}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
            letterSpacing: 0.3,
            pointerEvents: 'none',
          }}
        >
          {def.emoji} {def.name}
        </div>
      </Html>
    </group>
  );
}
