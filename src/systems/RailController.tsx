import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useRailStore } from '../state/railStore';
import { isInRoom } from '../net/room';
import {
  rail, railSync, trainAboardPrev, PERIOD_S, TRAIN_HALF_W, TRAIN_LEN, TRAIN_FLOOR_Y, INNER_HALF_W,
  LINE_SPEED, STATIONS, PLATFORM_HALF_LEN,
} from '../world/redLine';
import { RAIL_MID_X } from '../world/westAvery';
import { doorChime, railClack, setTrainRumble, trainHiss, trainHorn } from '../audio';

/** DEV: window.__rail = the live rail state (clock, trains). */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __rail: unknown }).__rail = rail;
}

/**
 * Runs the Red Line. Every frame, BEFORE the player controller (priority −10):
 *   1. advance the rail clock (host/solo: real time; guests chase the host's),
 *   2. slide the trains — and their colliders and floors — to where the
 *      timetable says they are,
 *   3. carry my character along if I'm standing in a car,
 *   4. play the sounds of whichever train I'm on or near.
 * Free Play only; in every other mode the trains are parked off the map.
 */
export function RailController() {
  const st = useRef({ clackDist: 0, door: [0, 0], at: [true, true] as boolean[], hornFor: [-1, -1] });

  useEffect(() => () => { railSync(false); setTrainRumble(0, 0); useRailStore.getState().setAboard(-1); }, []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const game = useGameStore.getState();
    const live = game.gameMode === 'freeplay';
    if (!live) {
      if (rail.live) { railSync(false); setTrainRumble(0, 0); useRailStore.getState().setAboard(-1); }
      return;
    }
    const net = useNetStore.getState();

    // ---- 1. the clock ----
    const guest = isInRoom() && !net.isHost;
    if (guest && rail.netT !== null) {
      // The host's phase arrived a moment ago; chase it gently so the train
      // never lurches, and only jump if we are hopelessly out (just joined).
      let err = rail.netT - (((rail.T % PERIOD_S) + PERIOD_S) % PERIOD_S);
      if (err > PERIOD_S / 2) err -= PERIOD_S;
      if (err < -PERIOD_S / 2) err += PERIOD_S;
      if (Math.abs(err) > 2.5) rail.T += err;
      else rail.T += dt * (1 + Math.max(-0.3, Math.min(0.3, err * 0.5)));
      rail.netT = (rail.netT + dt) % PERIOD_S; // it keeps ticking between snapshots
    } else {
      rail.T += dt;
    }

    // ---- 2. trains ----
    railSync(true);

    // ---- 3. carry me ----
    const me = net.myCharacterId ?? game.activeCharacterId;
    const p = game.positions[me];
    const s = st.current;
    const ab = net.spectator ? -1 : trainAboardPrev(p.x, p.y, p.z);
    if (ab >= 0) {
      const tr = rail.trains[ab];
      p.z += tr.dz;
      // Doors shut (or shutting) with me in the doorway: step inside.
      if (tr.door < 0.5) {
        const lim = INNER_HALF_W - 0.33;
        if (p.x > tr.x + lim) p.x = tr.x + lim;
        if (p.x < tr.x - lim) p.x = tr.x - lim;
      }
    } else if (!net.spectator && p.y < TRAIN_FLOOR_Y - 0.3) {
      // Standing on the tracks as a train comes through? It nudges you clear
      // (nobody gets hurt) — always AWAY from an island platform.
      for (let i = 0; i < 2; i++) {
        const tr = rail.trains[i];
        if (Math.abs(p.x - tr.x) < TRAIN_HALF_W + 0.4 && Math.abs(p.z - tr.z) < TRAIN_LEN / 2 + 0.6) {
          const outward = tr.x < RAIL_MID_X ? -1 : 1;
          const atStation = Object.values(STATIONS).some((sn) => Math.abs(p.z - sn.z) < PLATFORM_HALF_LEN + 1);
          const side = atStation ? outward : (p.x >= tr.x ? 1 : -1);
          p.x = tr.x + side * (TRAIN_HALF_W + 0.75);
        }
      }
    }
    useRailStore.getState().setAboard(ab);

    // ---- 4. sounds ----
    if (game.welcomeOpen) { setTrainRumble(0, 0); return; }
    let rumbleV = 0, rumbleS = 0;
    for (let i = 0; i < 2; i++) {
      const tr = rail.trains[i];
      const d = Math.hypot(p.x - tr.x, Math.max(0, Math.abs(p.z - tr.z) - TRAIN_LEN / 2));
      const near = ab === i ? 1 : Math.max(0, 1 - d / 60);
      const sp = Math.abs(tr.v) / LINE_SPEED;
      if (near > rumbleV) { rumbleV = near; rumbleS = sp; }
      // Door chimes + the hiss of the brakes, for a train I can hear.
      const opening = tr.door > 0.02 && s.door[i] <= 0.02;
      const closing = tr.door < 0.98 && s.door[i] >= 0.98;
      if (near > 0.45) {
        if (opening) doorChime(false, near);
        if (closing) doorChime(true, near);
        if (tr.at !== null && !s.at[i]) trainHiss(near);
      }
      // A toot as it pulls out.
      if (tr.at === null && s.at[i]) {
        const run = Math.floor((rail.T + i * (PERIOD_S / 2)) / (PERIOD_S / 2));
        if (s.hornFor[i] !== run && near > 0.1) { s.hornFor[i] = run; trainHorn(Math.max(0.25, near) * (ab === i ? 0.55 : 1)); }
      }
      s.door[i] = tr.door;
      s.at[i] = tr.at !== null;
    }
    setTrainRumble(rumbleS, ab >= 0 ? 0.85 : rumbleV * 0.7);
    // Clickety-clack: a rail joint every 12 m, heard from inside.
    if (ab >= 0) {
      s.clackDist += Math.abs(rail.trains[ab].dz);
      if (s.clackDist > 12) { s.clackDist = 0; railClack(0.35 + 0.65 * Math.abs(rail.trains[ab].v) / LINE_SPEED); }
    }
  }, -10);

  return null;
}
