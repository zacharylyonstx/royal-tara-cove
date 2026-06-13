import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNightStore } from '../state/nightStore';
import { useNetStore } from '../state/netStore';
import { LANTERN_GOAL } from '../world/nightLayout';
import { CHARACTERS } from '../world/characters';
import { backToGames } from './MenuButton';

const ACCENT = '#b0344f';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Siren Head Night HUD: intro framing, lantern meter + dawn timer, sprint
// stamina, the "he sees you!" danger cue, downed/regroup prompts, and the
// always-positive win card.
export function NightHud() {
  const gameMode = useGameStore((s) => s.gameMode);
  const phase = useGameStore((s) => s.phase);
  if (gameMode !== 'night') return null;
  return (
    <>
      {phase === 'night-intro' && <IntroCard />}
      {phase === 'night-hunt' && <HuntHud />}
      {phase === 'night-win' && <WinOverlay />}
    </>
  );
}

function IntroCard() {
  return (
    <div style={overlayStyle(900)}>
      <div style={{ ...cardStyle, maxWidth: 540 }}>
        <div style={{ fontSize: 64, lineHeight: 1 }}>🔦🌙</div>
        <h1 style={{ fontSize: 32, margin: '6px 0 0', color: ACCENT }}>Siren Head Night</h1>
        <p style={{ fontSize: 16, color: '#3a4030', marginTop: 8, lineHeight: 1.5 }}>
          It's dark and foggy on Royal Tara Cove… and tall <strong>Siren Head</strong> is out
          there. Sneak out <strong>together</strong>, find the <strong>{LANTERN_GOAL} glowing
          lanterns</strong>, and carry them back to the porch to <strong>light up the block!</strong>
        </p>
        <p style={{ fontSize: 14, color: '#7a5a30', marginTop: 10 }}>
          🏃 Sprint in bursts · 🦆 Crouch to hide · 🏠 Duck into a house or bush · 🤝 Help a buddy up if they get bonked
        </p>
        <p style={{ fontSize: 13, color: '#999', marginTop: 12 }}>It's all make-believe — have fun!</p>
      </div>
    </div>
  );
}

function HuntHud() {
  const delivered = useNightStore((s) => s.lanternsDelivered);
  const seconds = useNightStore((s) => s.roundEndsInSeconds);
  const stamina = useNightStore((s) => s.stamina);
  const sirenState = useNightStore((s) => s.sirenState);
  const regroupAt = useNightStore((s) => s.regroupAt);
  const states = useNightStore((s) => s.playerNightStates);
  const myId = useNetStore((s) => s.myCharacterId) ?? useGameStore.getState().activeCharacterId;

  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  const chasing = sirenState === 'chase';
  const alerted = sirenState === 'alerted';
  const iAmDown = states[myId] === 'down';
  const downedTeammate = (['dad', 'penny', 'luke'] as const).find((id) => id !== myId && states[id] === 'down');
  const regroupActive = regroupAt > 0 && performance.now() / 1000 - regroupAt < 3;

  return (
    <>
      {/* danger flash when he's hunting you */}
      {(chasing || alerted) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, pointerEvents: 'none',
          boxShadow: `inset 0 0 ${chasing ? 220 : 120}px ${chasing ? 90 : 50}px rgba(176,30,50,${chasing ? 0.5 : 0.28})`,
          animation: chasing ? 'pop-in 0.4s ease' : undefined }} />
      )}

      {/* top center: lantern meter + dawn timer */}
      <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, display: 'flex', gap: 10, alignItems: 'center', pointerEvents: 'none', fontFamily: FONT }}>
        <Pill>🏮 {delivered} / {LANTERN_GOAL}</Pill>
        <Pill>🌅 {m}:{sec.toString().padStart(2, '0')}</Pill>
      </div>

      {/* center banner: danger / downed / regroup */}
      {regroupActive ? (
        <Banner color="#3a7a3a">🤝 Everyone regroup at the porch!</Banner>
      ) : iAmDown ? (
        <Banner color={ACCENT}>💫 Bonked! Hold tight — a buddy can help you up</Banner>
      ) : chasing ? (
        <Banner color={ACCENT}>🏃 RUN! Siren Head sees you!</Banner>
      ) : alerted ? (
        <Banner color="#b07a34">👀 He heard something… freeze or hide!</Banner>
      ) : downedTeammate ? (
        <Banner color="#3a7a3a">🆘 {CHARACTERS[downedTeammate].name} is down — go help them up!</Banner>
      ) : null}

      {/* sprint stamina bar (above touch controls) */}
      <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom,0px) + 96px)', left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, width: 180, pointerEvents: 'none' }}>
        <div style={{ fontSize: 11, color: '#cfe', textAlign: 'center', marginBottom: 3, fontFamily: FONT, textShadow: '0 1px 3px #000' }}>
          ⚡ Sprint
        </div>
        <div style={{ height: 8, borderRadius: 6, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.25)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(stamina * 100)}%`,
            background: stamina > 0.25 ? 'linear-gradient(90deg,#6fd0ff,#cdeaff)' : '#e06a6a', transition: 'width 0.1s linear' }} />
        </div>
      </div>

      {/* control hints (desktop) */}
      <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom,0px) + 12px)', left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, fontSize: 12, color: '#bcd', fontFamily: FONT, pointerEvents: 'none', textShadow: '0 1px 3px #000', whiteSpace: 'nowrap' }}>
        <strong>WASD</strong> move · <strong>Shift</strong> sprint · <strong>C</strong> crouch · <strong>F</strong> flashlight
      </div>
    </>
  );
}

function WinOverlay() {
  useEffect(() => { /* fanfare already fired in the controller */ }, []);
  return (
    <div style={overlayStyle(999)}>
      <div style={{ ...cardStyle, maxWidth: 520, animation: 'pop-in 0.5s ease both' }}>
        <div style={{ fontSize: 70, lineHeight: 1 }}>🎉💡</div>
        <h1 style={{ fontSize: 36, margin: '6px 0 0', color: '#3a7a3a' }}>The Block is Lit!</h1>
        <p style={{ fontSize: 16, color: '#3a4030', marginTop: 8 }}>
          Every light blazed on, Siren Head lumbered back into the dark, and the whole family
          made it home. <strong>You did it together!</strong> 🌅
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
          <button onClick={replayNight} style={btn(ACCENT, true)}>Play again ↻</button>
          <button onClick={backToGames} style={btn(ACCENT, false)}>Back to menu</button>
        </div>
      </div>
    </div>
  );
}

function replayNight() {
  useNightStore.getState().reset();
  useGameStore.getState().resetFamilyPositions();
  useGameStore.getState().clearRagdoll();
  useGameStore.getState().setPhase('night-intro');
}

// --- little styled bits ---
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '7px 16px', background: 'rgba(20,16,24,0.72)', color: '#fff', borderRadius: 20,
      fontSize: 17, fontWeight: 800, border: `2px solid ${ACCENT}`, backdropFilter: 'blur(4px)', boxShadow: '0 3px 12px rgba(0,0,0,0.5)' }}>
      {children}
    </div>
  );
}

function Banner({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top,0px) + 64px)', left: '50%', transform: 'translateX(-50%)',
      zIndex: 100, padding: '9px 22px', background: 'rgba(15,12,18,0.82)', color: '#fff', borderRadius: 12,
      fontFamily: FONT, fontSize: 16, fontWeight: 800, letterSpacing: 0.3, border: `2px solid ${color}`,
      pointerEvents: 'none', backdropFilter: 'blur(4px)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
      {children}
    </div>
  );
}

function overlayStyle(z: number): React.CSSProperties {
  return { position: 'fixed', inset: 0, background: 'rgba(10,12,20,0.74)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: z, backdropFilter: 'blur(8px)', padding: 16 };
}
const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #fff7e6, #ffe3a3)', border: `4px solid ${ACCENT}`, borderRadius: 24,
  padding: '28px 36px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', fontFamily: FONT, color: '#3a4030',
};
function btn(accent: string, filled: boolean): React.CSSProperties {
  return { padding: '12px 24px', fontSize: 16, fontWeight: 700, background: filled ? accent : 'white',
    color: filled ? 'white' : accent, border: `2px solid ${accent}`, borderRadius: 10, cursor: 'pointer' };
}
