import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useTreehouseStore } from '../state/treehouseStore';

export function TreehouseMissionCompleteToast() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const souvenirs = useTreehouseStore((s) => s.souvenirs);
  const [latest, setLatest] = useState<{ emoji: string; label: string } | null>(null);

  useEffect(() => {
    if (phase !== 'treehouse-complete') return;
    const list = Object.values(souvenirs).sort((a, b) => b.earnedAt - a.earnedAt);
    if (list.length > 0) setLatest({ emoji: list[0].emoji, label: list[0].label });
  }, [phase, souvenirs]);

  if (gameMode !== 'treehouse') return null;
  if (phase !== 'treehouse-complete') return null;
  if (!latest) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 130, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #2c5e3a, #5fa86a)',
        border: '3px solid #ffd86a', borderRadius: 22, padding: '20px 34px',
        color: '#fff7e6', textAlign: 'center',
        boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
        animation: 'treehouse-toast-in 0.5s ease-out',
      }}>
        <div style={{ fontSize: 56 }}>{latest.emoji}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>New sticker earned!</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{latest.label}</div>
        <style>{`@keyframes treehouse-toast-in { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    </div>
  );
}
