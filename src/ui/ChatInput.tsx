import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../state/chatStore';
import { useNetStore } from '../state/netStore';
import { useGameStore } from '../state/gameStore';
import { sendChat } from '../net/room';
import { CHARACTERS } from '../world/characters';

/**
 * Fixed-position chat input. Press T anywhere during gameplay to open.
 * Press Enter to send, Escape to cancel. Spectators can't open it
 * (no character to attribute the message to).
 */
export function ChatInput() {
  const inputOpen = useChatStore((s) => s.inputOpen);
  const open = useChatStore((s) => s.openInput);
  const close = useChatStore((s) => s.closeInput);
  const myCharacterId = useNetStore((s) => s.myCharacterId);

  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keydown listener — opens chat on T.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't interfere when typing in an existing input.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key !== 't' && e.key !== 'T') return;
      // Gates: must be in-game (welcome closed, room joined, character claimed).
      const game = useGameStore.getState();
      const net = useNetStore.getState();
      if (game.welcomeOpen) return;
      if (!net.mode) return;
      if (!net.myCharacterId) return;
      if (useChatStore.getState().inputOpen) return;
      e.preventDefault();
      // Release pointer lock so the user can see the textbox cursor and type.
      if (document.pointerLockElement) document.exitPointerLock();
      open();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (inputOpen && inputRef.current) {
      inputRef.current.focus();
      setText('');
    }
  }, [inputOpen]);

  if (!inputOpen || !myCharacterId) return null;
  const def = CHARACTERS[myCharacterId];

  const submit = () => {
    if (text.trim().length > 0) sendChat(text);
    close();
    setText('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20, 30, 40, 0.92)',
        border: '2px solid #5cb85c',
        borderRadius: 14,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        zIndex: 2000,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 6px 22px rgba(0,0,0,0.4)',
        minWidth: 480,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <span style={{ fontSize: 22 }}>{def.emoji}</span>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{def.name}:</span>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 120))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close();
            setText('');
          } else {
            // Don't let the game grab keypresses while chatting.
            e.stopPropagation();
          }
        }}
        placeholder="Type a message…"
        autoFocus
        spellCheck
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'white',
          fontSize: 15,
          minWidth: 320,
          fontFamily: 'inherit',
        }}
      />
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
        Enter to send · Esc to cancel
      </span>
    </div>
  );
}
