import { useEffect, useState } from 'react';
import { usePlayStore } from '../state/playStore';
import { CHARACTERS } from '../world/characters';
import { cheerSound } from '../audio';

/** Brief "X scored! 🏀" celebration whenever a basket is made (local or peer). */
export function BasketToast() {
  const lastBasket = usePlayStore((s) => s.lastBasket);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!lastBasket) return;
    const name = CHARACTERS[lastBasket.by]?.name ?? 'Someone';
    setMsg(`${name} scored! 🏀`);
    cheerSound();
    const t = setTimeout(() => setMsg(null), 1600);
    return () => clearTimeout(t);
  }, [lastBasket]);

  if (!msg) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: '32%',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 28px',
        background: 'rgba(46, 110, 64, 0.92)',
        color: 'white',
        borderRadius: 16,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 28,
        fontWeight: 800,
        zIndex: 200,
        pointerEvents: 'none',
        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
      }}
    >
      {msg}
    </div>
  );
}
