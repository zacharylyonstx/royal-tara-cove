import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import { EMOTES } from '../state/chatStore';
import { sendEmote } from '../net/room';
import { isTouchDevice } from '../systems/touchInput';

/**
 * Four big one-tap emote buttons (bottom-center). They ride the chat channel,
 * so the emoji pops as a speech bubble over your head on EVERY screen — a
 * voice for the 6-year-old who can't type, and the only chat on iPad.
 * Desktop can also fire them with keys 1-4 (wired in PlayerController).
 */
export function EmoteBar() {
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const wardrobeOpen = useWardrobeStore((s) => s.open);
  const myCharacterId = useNetStore((s) => s.myCharacterId);
  if (welcomeOpen || wardrobeOpen || !myCharacterId) return null;

  const touch = isTouchDevice();
  const size = touch ? 52 : 42;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: touch ? 12 : 8,
        zIndex: 110,
      }}
    >
      {EMOTES.map((e, i) => (
        <EmoteButton key={e} emoji={e} hint={touch ? undefined : String(i + 1)} size={size} onPress={() => sendEmote(i)} />
      ))}
    </div>
  );
}

function EmoteButton({ emoji, hint, size, onPress }: { emoji: string; hint?: string; size: number; onPress: () => void }) {
  const [down, setDown] = useState(false);
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); setDown(true); onPress(); }}
      onPointerUp={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      aria-label={`Emote ${emoji}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.45)',
        background: down ? 'rgba(90,138,62,0.9)' : 'rgba(20,30,40,0.55)',
        fontSize: Math.round(size * 0.52),
        lineHeight: 1,
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        boxShadow: down ? 'inset 0 2px 8px rgba(0,0,0,0.4)' : '0 3px 10px rgba(0,0,0,0.35)',
        transform: down ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.06s, background 0.06s',
        position: 'relative',
        touchAction: 'none',
        padding: 0,
      }}
    >
      {emoji}
      {hint && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -2,
            fontSize: 10,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.85)',
            background: 'rgba(20,30,40,0.8)',
            borderRadius: 6,
            padding: '1px 4px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {hint}
        </span>
      )}
    </button>
  );
}
