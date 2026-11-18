import { useEffect, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useRailStore } from '../state/railStore';
import {
  rail, departures, sightAt, stationNear, STATIONS, STATION_ORDER, DOOR_CLOSE_LEAD, STN_AVERY_Z, ROUTE_LEN, LAKELINE_Z, HOWARD_Z, CITY_STOPS,
  type StationId,
} from '../world/redLine';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const RED = '#c8102e';

function fmt(s: number): string {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

interface View {
  /** 'ride' = I'm on a train; 'wait' = I'm at a station. */
  kind: 'ride' | 'wait';
  title: string;
  line: string;
  /** 0..1 along the line (Avery Ranch → Bastrop), for the strip map. */
  at?: number;
  hot?: boolean;
  key: string;
}

/** The line as a strip: the four stops, the places in between as small dots,
 *  and a little train sliding along it. */
const STRIP_STOPS: [number, string, boolean][] = [
  ...STATION_ORDER.map((id) => [(STATIONS[id].z - STN_AVERY_Z) / ROUTE_LEN, STATIONS[id].short, true] as [number, string, boolean]),
  ...[LAKELINE_Z, HOWARD_Z, ...CITY_STOPS.map((c) => c.z)].map((z) => [(z - STN_AVERY_Z) / ROUTE_LEN, '', false] as [number, string, boolean]),
];
function StripMap({ at }: { at: number }) {
  const stops = STRIP_STOPS;
  return (
    <div style={{ position: 'relative', height: 30, margin: '8px 6px 0' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 6, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.28)' }} />
      <div style={{ position: 'absolute', left: 0, width: `${at * 100}%`, top: 6, height: 4, borderRadius: 2, background: '#ffb21e' }} />
      {stops.map(([p, name, served]) => (
        <div key={p} style={{ position: 'absolute', left: `${p * 100}%`, top: 0, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ width: served ? 12 : 5, height: served ? 12 : 5, margin: served ? '2px auto 0' : '5.5px auto 0', borderRadius: '50%', background: served ? '#fff' : 'rgba(255,255,255,0.7)', border: served ? `2px solid ${RED}` : 'none', boxSizing: 'border-box' }} />
          <div style={{ fontSize: 10, fontWeight: served ? 800 : 600, opacity: served ? 1 : 0.75, marginTop: 2 }}>{name}</div>
        </div>
      ))}
      <div style={{ position: 'absolute', left: `${at * 100}%`, top: -7, transform: 'translateX(-50%)', fontSize: 15 }}>🚆</div>
    </div>
  );
}

/** Everything the Red Line puts on the glass: the next-train chip while you
 *  wait at a station, and the journey card while you ride. */
export function RailHud() {
  const gameMode = useGameStore((s) => s.gameMode);
  const welcomeOpen = useGameStore((s) => s.welcomeOpen);
  const aboard = useRailStore((s) => s.aboard);
  const active = gameMode === 'freeplay' && !welcomeOpen;
  const [view, setView] = useState<View | null>(null);
  /** "📍 The Domain" splash when the doors open at a stop you rode to. */
  const [arrived, setArrived] = useState<{ name: string; hint: string; until: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    let rodeFrom: StationId | null = null;
    let lastAt: StationId | null = null;
    const tick = () => {
      if (!rail.live) { setView(null); return; }
      const g = useGameStore.getState();
      const me = useNetStore.getState().myCharacterId ?? g.activeCharacterId;
      const p = g.positions[me];
      const ab = useRailStore.getState().aboard;
      let v: View | null = null;
      if (ab >= 0) {
        const tr = rail.trains[ab];
        const at = (tr.z - STN_AVERY_Z) / ROUTE_LEN;
        if (tr.at) {
          // Standing at a platform with me inside.
          if (lastAt !== tr.at && rodeFrom && rodeFrom !== tr.at) {
            const end = tr.at === 'avery' || tr.at === 'bastrop';
            setArrived({ name: STATIONS[tr.at].name, hint: end ? 'End of the line — hop off, or stay on to ride back' : `Doors open — hop off, or stay on for ${STATIONS[tr.next].short}`, until: performance.now() + 3600 });
          }
          lastAt = tr.at;
          rodeFrom = tr.at;
          const closeIn = tr.departsIn - DOOR_CLOSE_LEAD;
          const line = tr.door > 0.5 && closeIn > 0
            ? `Doors open · leaving for ${STATIONS[tr.next].short} in ${fmt(tr.departsIn)}`
            : tr.departsIn < DOOR_CLOSE_LEAD + 0.5 ? `Doors closing · next stop ${STATIONS[tr.next].short}` : `Arriving at ${STATIONS[tr.at].name}`;
          v = { kind: 'ride', title: `${STATIONS[tr.at].name} Station`, line, at, key: `at${tr.at}${line}` };
        } else {
          lastAt = null;
          const sg = sightAt(tr.z);
          const line = tr.arrivesIn < 12 ? `Arriving in ${fmt(tr.arrivesIn)}` : sg ? `Now passing: ${sg.label}` : `Arriving in ${fmt(tr.arrivesIn)}`;
          v = { kind: 'ride', title: `Next stop: ${STATIONS[tr.next].short}`, line, at, key: `run${tr.next}${line}` };
        }
      } else {
        lastAt = null;
        const stn = stationNear(p.x, p.z, 26);
        if (stn) {
          rodeFrom = stn;
          const deps = departures(stn, rail.T);
          const nd = deps.find((d) => d.boarding);
          if (nd) {
            const to = STATIONS[nd.dest].short;
            v = { kind: 'wait', title: `🚆 To ${to} — boarding now!`, line: `Step aboard · doors close in ${fmt(nd.doorsFor)}`, hot: true, key: `b${stn}${nd.dest}${fmt(nd.doorsFor)}` };
          } else if (deps.length === 1) {
            v = { kind: 'wait', title: `🚆 To ${STATIONS[deps[0].dest].short}`, line: `Next train in ${fmt(deps[0].inS)} · wait on the platform`, key: `w${stn}${fmt(deps[0].inS)}` };
          } else {
            // Two directions: say which is which.
            const line = deps.map((d) => `${STATIONS[d.dest].short} ${fmt(d.inS)}`).join('  ·  ');
            v = { kind: 'wait', title: `🚆 ${STATIONS[stn].short} Station`, line, key: `w${stn}${line}` };
          }
        }
      }
      setView((cur) => (cur?.key === v?.key ? cur : v));
      setArrived((a) => (a && performance.now() > a.until ? null : a));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [active]);

  if (!active || (!view && !arrived)) return null;
  return (
    <>
      {view && (
        <div style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 30, pointerEvents: 'none',
          top: 'calc(env(safe-area-inset-top, 0px) + 58px)',
          width: view.kind === 'ride' ? 'min(470px, calc(100vw - 300px))' : 'auto', minWidth: 250, maxWidth: 'calc(100vw - 24px)',
          padding: view.kind === 'ride' ? '10px 16px 12px' : '8px 16px', borderRadius: 16, color: '#fff', fontFamily: FONT,
          background: view.hot ? 'rgba(200,16,46,0.92)' : 'rgba(18,28,44,0.84)', boxShadow: '0 6px 22px rgba(0,0,0,0.28)',
          border: `2px solid ${view.hot ? '#ffd98a' : 'rgba(255,255,255,0.16)'}`, textAlign: 'center',
        }}>
          {view.kind === 'ride' && aboard >= 0 && (
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, opacity: 0.8 }}>
              <span style={{ background: RED, borderRadius: 4, padding: '1px 6px', marginRight: 6 }}>RED LINE</span>METRORAIL
            </div>
          )}
          <div style={{ fontSize: view.kind === 'ride' ? 20 : 17, fontWeight: 800, marginTop: view.kind === 'ride' ? 3 : 0 }}>{view.title}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.92, marginTop: 1 }}>{view.line}</div>
          {view.kind === 'ride' && view.at !== undefined && <StripMap at={Math.max(0, Math.min(1, view.at))} />}
        </div>
      )}
      {arrived && (
        <div style={{
          position: 'fixed', left: '50%', top: '34%', transform: 'translate(-50%, -50%)', zIndex: 31, pointerEvents: 'none',
          padding: '14px 30px', borderRadius: 22, background: 'rgba(255,255,255,0.95)', color: '#16335c', fontFamily: FONT,
          boxShadow: '0 10px 34px rgba(0,0,0,0.3)', textAlign: 'center', border: `3px solid ${RED}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: RED }}>THIS STOP</div>
          <div style={{ fontSize: 32, fontWeight: 900 }}>📍 {arrived.name}</div>
          <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.8 }}>{arrived.hint}</div>
        </div>
      )}
    </>
  );
}
