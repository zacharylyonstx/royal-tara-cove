import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useWardrobeStore } from '../state/wardrobeStore';
import { CHARACTERS } from '../world/characters';
import { CATALOG, SLOTS, SLOT_LABEL, SLOT_EMOJI, getItem, type Slot } from '../world/wardrobe';
import { CharacterModel } from '../components/CharacterModel';
import type { CharacterId } from '../types';

const ACCENT: Record<CharacterId, string> = { dad: '#3a6db0', penny: '#e26aa1', luke: '#5cb85c' };

function PreviewModel({ id }: { id: CharacterId }) {
  const ref = useRef<Group>(null);
  const appearance = useWardrobeStore((s) => s.appearances[id]);
  const def = CHARACTERS[id];
  const norm = 1.7 / def.height; // normalize so all three frame similarly
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += Math.min(dt, 0.1) * 0.6;
  });
  return (
    <group ref={ref} scale={norm} position={[0, 0, 0]}>
      <CharacterModel def={def} appearance={appearance} />
    </group>
  );
}

export function WardrobeOverlay() {
  const open = useWardrobeStore((s) => s.open);
  const openFor = useWardrobeStore((s) => s.openFor);
  const equip = useWardrobeStore((s) => s.equip);
  const setColor = useWardrobeStore((s) => s.setColor);
  const close = useWardrobeStore((s) => s.close);
  const [tab, setTab] = useState<Slot>('top');
  // Subscribe to appearances so cards/swatches reflect current selection.
  const appearance = useWardrobeStore((s) => (openFor ? s.appearances[openFor] : null));

  if (!open || !openFor || !appearance) return null;
  const accent = ACCENT[openFor];
  const name = CHARACTERS[openFor].name;
  const items = CATALOG[tab];
  const choice = appearance[tab];
  const selItem = getItem(tab, choice.item);

  const surprise = () => {
    for (const slot of SLOTS) {
      const list = CATALOG[slot];
      const it = list[Math.floor(Math.abs(Math.sin(slot.length * 99 + Math.random() * 1000)) * list.length) % list.length];
      equip(openFor, slot, it.id);
      if (it.colors.length) setColor(openFor, slot, it.colors[Math.floor(Math.random() * it.colors.length)]);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'radial-gradient(circle at 50% 30%, rgba(40,30,60,0.78), rgba(15,12,24,0.9))',
        backdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#fff', userSelect: 'none', touchAction: 'manipulation',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px' }}>
        <div style={{ fontSize: 26, fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          👗 {name}'s Wardrobe
        </div>
        <button onClick={close} style={btn('#ffffff22', '#fff', 44)}>✕</button>
      </div>

      {/* Body: preview + controls (row on wide, column on narrow) */}
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 16, padding: '0 18px 8px', minHeight: 0 }}>
        {/* Live 3D preview */}
        <div style={{
          flex: '1 1 320px', minWidth: 260, minHeight: 240,
          borderRadius: 22, overflow: 'hidden',
          background: `linear-gradient(160deg, ${accent}33, #1a1626)`,
          border: `3px solid ${accent}aa`, position: 'relative',
        }}>
          <Canvas camera={{ position: [0, 1.05, 3.5], fov: 38 }} dpr={[1, 2]}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[3, 5, 4]} intensity={1.4} color="#fff3da" />
            <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#cfe6ff" />
            <group position={[0, -0.85, 0]}>
              <PreviewModel id={openFor} />
            </group>
          </Canvas>
          <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', fontSize: 13, opacity: 0.8 }}>
            ✨ spins automatically · your look is saved & stays on
          </div>
        </div>

        {/* Controls */}
        <div style={{ flex: '1 1 360px', minWidth: 280, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Category tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {SLOTS.map((s) => (
              <button key={s} onClick={() => setTab(s)} style={tabBtn(tab === s, accent)}>
                {SLOT_EMOJI[s]} {SLOT_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Item grid */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 10, alignContent: 'start', paddingRight: 4 }}>
            {items.map((it) => {
              const on = it.id === choice.item;
              return (
                <button key={it.id} onClick={() => equip(openFor, tab, it.id)} style={card(on, accent)}>
                  <div style={{ fontSize: 34, lineHeight: 1 }}>{it.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{it.label}</div>
                </button>
              );
            })}
          </div>

          {/* Color swatches for the selected item */}
          {selItem.colors.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '12px 2px 4px', alignItems: 'center' }}>
              <span style={{ fontSize: 14, opacity: 0.85, marginRight: 4 }}>🎨</span>
              {selItem.colors.map((c) => (
                <button key={c} onClick={() => setColor(openFor, tab, c)} style={swatch(c, choice.color === c)} aria-label={c} />
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, paddingTop: 12 }}>
            <button onClick={surprise} style={{ ...btn('#ffffff1f', '#fff', 52), flex: 1, fontSize: 17, fontWeight: 700 }}>🎲 Surprise me</button>
            <button onClick={close} style={{ ...btn(accent, '#fff', 52), flex: 1, fontSize: 18, fontWeight: 800 }}>✓ Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function btn(bg: string, color: string, size: number): React.CSSProperties {
  return {
    minWidth: size, height: size, borderRadius: 14, border: 'none', background: bg, color,
    cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
function tabBtn(on: boolean, accent: string): React.CSSProperties {
  return {
    padding: '9px 14px', borderRadius: 999, border: on ? `2px solid ${accent}` : '2px solid #ffffff22',
    background: on ? accent : '#ffffff14', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
  };
}
function card(on: boolean, accent: string): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '12px 6px', borderRadius: 16, cursor: 'pointer', color: '#fff',
    background: on ? `${accent}cc` : '#ffffff14',
    border: on ? `3px solid #fff` : '3px solid transparent',
    boxShadow: on ? `0 6px 18px ${accent}88` : '0 2px 8px rgba(0,0,0,0.3)',
    transform: on ? 'scale(1.03)' : 'scale(1)', transition: 'transform 0.08s',
  };
}
function swatch(color: string, on: boolean): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: '50%', background: color, cursor: 'pointer',
    border: on ? '3px solid #fff' : '3px solid #ffffff44',
    boxShadow: on ? '0 0 0 3px rgba(255,255,255,0.4)' : '0 2px 6px rgba(0,0,0,0.4)',
  };
}
