import { useEffect, useState } from 'react';
import { useChatStore } from '../state/chatStore';
import { CHARACTERS } from '../world/characters';

const VISIBLE_DURATION_MS = 12000;
const FADE_DURATION_MS = 1000;
const MAX_VISIBLE = 5;

/**
 * Bottom-left chat history. Shows the most-recent few messages, each
 * fading after 12s.
 */
export function ChatLog() {
  const messages = useChatStore((s) => s.messages);
  const [now, setNow] = useState(() => Date.now());

  // Tick every 300ms so messages fade in real time without re-rendering each frame.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 300);
    return () => window.clearInterval(id);
  }, []);

  const visible = messages
    .slice(-MAX_VISIBLE)
    .map((m) => {
      const age = now - m.sentAt;
      if (age > VISIBLE_DURATION_MS + FADE_DURATION_MS) return null;
      const opacity = age < VISIBLE_DURATION_MS
        ? 1
        : Math.max(0, 1 - (age - VISIBLE_DURATION_MS) / FADE_DURATION_MS);
      return { msg: m, opacity };
    })
    .filter((x): x is { msg: typeof messages[number]; opacity: number } => x !== null);

  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 40,
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxWidth: 360,
      }}
    >
      {visible.map(({ msg, opacity }) => {
        const def = CHARACTERS[msg.characterId];
        return (
          <div
            key={msg.id}
            style={{
              opacity,
              transition: 'opacity 300ms ease',
              background: 'rgba(20, 30, 40, 0.78)',
              color: 'white',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 13,
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              wordBreak: 'break-word',
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{def.emoji}</span>
            <span style={{ color: def.bodyColor, fontWeight: 700 }}>{def.name}:</span>
            <span>{msg.text}</span>
          </div>
        );
      })}
    </div>
  );
}
