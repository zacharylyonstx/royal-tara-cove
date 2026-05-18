import { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useChatStore } from '../state/chatStore';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { CHARACTERS, CHARACTER_ORDER } from '../world/characters';

/**
 * 3D billboard speech bubbles that follow each character with a recent
 * chat message. Rendered inside the R3F Canvas. Each bubble lives for
 * ~6s after the message arrived (handled by chatStore.recentBubbleFor).
 *
 * Bubbles for characters that aren't claimed by any peer are skipped —
 * an unclaimed NPC shouldn't have a speech bubble even if there's an
 * old message in the log.
 */
export function SpeechBubbles() {
  // Force a re-render each frame so new messages appear and old ones expire
  // visually. The cost is tiny (3 chars × ~30-msg scan).
  const [, setTick] = useState(0);
  useFrame(() => setTick((n) => (n + 1) & 1023));

  const peers = useNetStore((s) => s.peers);
  const positions = useGameStore((s) => s.positions);

  const claimedSet = new Set<string>();
  for (const p of Object.values(peers)) {
    if (p.characterId) claimedSet.add(p.characterId);
  }

  return (
    <>
      {CHARACTER_ORDER.map((id) => {
        if (!claimedSet.has(id)) return null;
        const msg = useChatStore.getState().recentBubbleFor(id, Date.now());
        if (!msg) return null;
        const def = CHARACTERS[id];
        const pos = positions[id];
        if (!pos) return null;
        return (
          <Html
            key={`${id}-${msg.id}`}
            position={[pos.x, pos.y + def.height + 0.6, pos.z]}
            center
            distanceFactor={9}
            zIndexRange={[100, 0]}
            occlude={false}
          >
            <div
              style={{
                background: 'white',
                color: '#1a1a1c',
                padding: '6px 10px',
                borderRadius: 10,
                fontSize: 18,
                fontWeight: 600,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
                maxWidth: 180,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                textAlign: 'center',
                position: 'relative',
                border: `2px solid ${def.bodyColor}`,
                pointerEvents: 'none',
              }}
            >
              <span style={{ marginRight: 4 }}>{def.emoji}</span>
              {msg.text}
              <span
                style={{
                  position: 'absolute',
                  bottom: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderTop: `8px solid ${def.bodyColor}`,
                }}
              />
            </div>
          </Html>
        );
      })}
    </>
  );
}
