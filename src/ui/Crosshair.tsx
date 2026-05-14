import { useGameStore } from '../state/gameStore';

export function Crosshair() {
  const phase = useGameStore((s) => s.phase);
  if (phase !== 'combat') return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 26,
        height: 26,
        pointerEvents: 'none',
        zIndex: 90,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 11,
          top: 0,
          width: 4,
          height: 26,
          background: 'rgba(58, 255, 240, 0.8)',
          boxShadow: '0 0 6px rgba(58, 255, 240, 0.8)',
          borderRadius: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 11,
          width: 26,
          height: 4,
          background: 'rgba(58, 255, 240, 0.8)',
          boxShadow: '0 0 6px rgba(58, 255, 240, 0.8)',
          borderRadius: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 11,
          top: 11,
          width: 4,
          height: 4,
          background: 'rgba(58, 255, 240, 1)',
          borderRadius: '50%',
          boxShadow: '0 0 8px rgba(58, 255, 240, 1)',
        }}
      />
    </div>
  );
}
