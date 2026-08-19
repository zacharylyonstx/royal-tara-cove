import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useChatStore } from '../state/chatStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import { usePlayStore } from '../state/playStore';
import { isTouchDevice } from '../systems/touchInput';

/**
 * "I can't look up and down!" — on desktop the camera only turns while the
 * mouse is pointer-locked, and kids lose the lock constantly (Esc, alt-tab to
 * Zoom, clicking the picker). This little pill shows whenever the game is
 * running but the cursor isn't captured, so the fix is always on screen:
 * click the game. Hidden on touch (drag-to-look needs no lock).
 */
export function LookHint() {
  const [locked, setLocked] = useState(() => typeof document !== 'undefined' && !!document.pointerLockElement);
  useEffect(() => {
    const f = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', f);
    document.addEventListener('pointerlockerror', f);
    return () => {
      document.removeEventListener('pointerlockchange', f);
      document.removeEventListener('pointerlockerror', f);
    };
  }, []);
  const gameMode = useGameStore((s) => s.gameMode);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const me = useNetStore((s) => s.myCharacterId);
  const spectator = useNetStore((s) => s.spectator);
  const chatOpen = useChatStore((s) => s.inputOpen);
  const wardrobeOpen = useWardrobeStore((s) => s.open);
  const riding = usePlayStore((s) => (me ? !!s.riding[me] : false));

  if (isTouchDevice()) return null;
  if (locked || welcomeOpen || !me || spectator || chatOpen || wardrobeOpen || riding) return null;
  if (gameMode === 'munchies' || gameMode === 'treehouse') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '7px 14px',
        background: 'rgba(20, 30, 40, 0.72)',
        color: 'white',
        borderRadius: 999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 14,
        fontWeight: 700,
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        whiteSpace: 'nowrap',
        animation: 'pop-in 0.35s ease-out',
      }}
    >
      🖱️ Click the game to look around
    </div>
  );
}
