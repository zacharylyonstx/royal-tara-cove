import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useTornadoStore } from '../state/tornadoStore';
import { resetTornadoAudio } from '../audio';

// Tornado-mode HUD: warnings, countdown, victory/defeat overlays.

export function TornadoHud() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  const tornadoZ = useTornadoStore((s) => s.tornadoZ);

  if (gameMode !== 'tornado') return null;

  const tornadoMessage = (() => {
    if (phase === 'calm') {
      return '🌪️ TORNADO WARNING — get inside 10600 before it arrives!';
    }
    if (phase === 'rain') return '🌧️ Storm building — keep an eye on the sky';
    if (phase === 'hail') return '🧊 Hail! The tornado is materializing…';
    if (phase === 'tornado-approach') {
      const distMeters = Math.max(0, 15 - tornadoZ);
      // Tornado moves ~145m / 60s ≈ 2.4 m/s; ETA = distMeters / 2.4
      const eta = Math.round(distMeters / 2.4);
      const min = Math.floor(eta / 60);
      const sec = eta % 60;
      return `🌪️ TORNADO IMPACT IN ${min}:${sec.toString().padStart(2, '0')} — RUN INSIDE 10600`;
    }
    return null;
  })();

  return (
    <>
      {tornadoMessage && (
        <div
          style={{
            position: 'fixed',
            top: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            background: 'rgba(20, 20, 30, 0.78)',
            color: 'white',
            borderRadius: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 0.4,
            border: '2px solid #3a5a8a',
            zIndex: 100,
            pointerEvents: 'none',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {tornadoMessage}
        </div>
      )}
      {phase === 'victory' && <VictoryOverlay />}
      {phase === 'defeat' && <DefeatOverlay />}
    </>
  );
}

function VictoryOverlay() {
  const replay = useReplay();
  const backToMenu = useBackToMenu();
  return (
    <FullscreenOverlay accent="#5a8a3e">
      <div style={{ fontSize: 70, lineHeight: 1 }}>🌈</div>
      <h1 style={{ fontSize: 38, margin: '6px 0 0' }}>You Survived!</h1>
      <p style={{ fontSize: 16, color: '#3a4030', marginTop: 6 }}>
        The family hunkered down in 10600. The storm passed right over you.
      </p>
      <ButtonRow accent="#5a8a3e" replay={replay} backToMenu={backToMenu} />
    </FullscreenOverlay>
  );
}

function DefeatOverlay() {
  // Wait for the 4s ragdoll throw to complete before showing the overlay so
  // the player gets to watch themselves get carried away.
  const ragdoll = useGameStore((s) => s.ragdoll);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (ragdoll && ragdoll.active) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, [ragdoll]);
  if (!show) return null;
  const replay = useReplay();
  const backToMenu = useBackToMenu();
  return (
    <FullscreenOverlay accent="#8a3a3a">
      <div style={{ fontSize: 70, lineHeight: 1 }}>🌪️</div>
      <h1 style={{ fontSize: 38, margin: '6px 0 0' }}>Carried away by the storm!</h1>
      <p style={{ fontSize: 16, color: '#3a4030', marginTop: 6 }}>
        You needed to be inside 10600 when the tornado hit.
      </p>
      <ButtonRow accent="#8a3a3a" replay={replay} backToMenu={backToMenu} />
    </FullscreenOverlay>
  );
}

function FullscreenOverlay({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 30, 40, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        backdropFilter: 'blur(8px)',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7e6, #ffe3a3)',
          border: `4px solid ${accent}`,
          borderRadius: 24,
          padding: '28px 36px',
          maxWidth: 520,
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#3a4030',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ButtonRow({
  accent,
  replay,
  backToMenu,
}: {
  accent: string;
  replay: () => void;
  backToMenu: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
      <button
        onClick={replay}
        style={{
          padding: '12px 24px',
          fontSize: 16,
          fontWeight: 700,
          background: accent,
          color: 'white',
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
        }}
      >
        Try again ↻
      </button>
      <button
        onClick={backToMenu}
        style={{
          padding: '12px 24px',
          fontSize: 16,
          fontWeight: 700,
          background: 'white',
          color: accent,
          border: `2px solid ${accent}`,
          borderRadius: 10,
          cursor: 'pointer',
        }}
      >
        Back to menu
      </button>
    </div>
  );
}

function useReplay() {
  return () => {
    resetTornadoAudio();
    useTornadoStore.getState().reset();
    useGameStore.getState().resetTornadoGame();
    useGameStore.getState().setPhase('calm');
    useTornadoStore.getState().setPhaseEnteredAt(performance.now() / 1000);
  };
}

function useBackToMenu() {
  return () => {
    resetTornadoAudio();
    useTornadoStore.getState().reset();
    useGameStore.getState().resetTornadoGame();
    useGameStore.getState().setPhase('pre-intro');
    useGameStore.getState().openWelcome();
  };
}
