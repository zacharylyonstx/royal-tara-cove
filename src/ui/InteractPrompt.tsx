import { useGameStore } from '../state/gameStore';

export function InteractPrompt() {
  const hover = useGameStore((s) => s.hoverDoorId);
  const doors = useGameStore((s) => s.doors);
  if (!hover) return null;
  const door = doors[hover];
  const label = door?.open ? 'close door' : 'open door';

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 90,
        transform: 'translateX(-50%)',
        padding: '8px 16px',
        background: 'rgba(20, 30, 40, 0.7)',
        color: 'white',
        borderRadius: 10,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 16,
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <kbd
        style={{
          padding: '3px 10px',
          background: '#3a5a25',
          color: 'white',
          borderRadius: 6,
          fontWeight: 700,
          marginRight: 8,
        }}
      >
        E
      </kbd>
      {label}
    </div>
  );
}
