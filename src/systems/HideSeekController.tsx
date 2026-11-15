import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../state/gameStore';
import { useNetStore } from '../state/netStore';
import { useZoneStore } from '../state/zoneStore';
import { useHideSeekStore, hsRole } from '../state/hideSeekStore';
import { humanCharacters, myCharacter } from './combatRoles';
import { requestHideSeek } from '../net/room';
import {
  HS_BASE, HS_BASE_RADIUS, HS_COUNT_S, HS_NAME, HS_RESULTS_S, HS_ROUND_S, HS_SEE_CONE_COS, HS_SEE_RANGE,
  HS_TAG_SLACK, HS_TOUCH_RANGE, hsSightClear,
} from '../world/hideSeek';
import type { CharacterId, RectCollider } from '../types';
import { cheerSound, heartbeat, hsFanfare, hsReadyOrNot, hsTick } from '../audio';

const BASE_ZONE = 'hs-base';
const tagZone = (id: CharacterId) => `hs-tag-${id}`;
/** How often the "can I see anyone?" check runs (seconds). */
const LOOK_EVERY_S = 0.12;

/**
 * Hide-and-seek in Free Play.
 *
 * Two halves in one loop:
 *  • the HOST runs the game (starts it, moves it from counting → seeking →
 *    score card, confirms every "found you!"), and
 *  • EVERY client does its own looking: it knows where it's standing and
 *    which way it faces, so it decides "I can see Penny" and asks the host to
 *    make it official.
 */
export function HideSeekController() {
  const prev = useRef({ phase: 'idle', round: -1, foundAt: 0, sec: -1, lookAt: 0, heartAt: 0, baseLabel: '' });
  const tagSentAt = useRef<Partial<Record<CharacterId, number>>>({});
  const tagZones = useRef<Set<CharacterId>>(new Set());

  useEffect(() => {
    const zones = tagZones.current;
    return () => {
      // Leaving Free Play: put the tree prompt away and forget the game.
      const zs = useZoneStore.getState();
      zs.unregister(BASE_ZONE);
      for (const id of zones) zs.unregister(tagZone(id));
      zones.clear();
      useHideSeekStore.getState().reset();
    };
  }, []);

  useFrame(() => {
    const now = performance.now() / 1000;
    const game = useGameStore.getState();
    const net = useNetStore.getState();
    const store = useHideSeekStore.getState();
    const humans = humanCharacters();
    const me = myCharacter();

    // ------------------------------------------------------------- HOST --
    if (net.isHost) {
      for (const r of store.takePending()) {
        const s = useHideSeekStore.getState();
        if (r.type === 'start') {
          if ((s.phase === 'idle' || s.phase === 'results') && humans.length >= 2 && humans.includes(r.by)) {
            useHideSeekStore.setState({
              phase: 'counting', round: s.round + 1, seeker: r.by, players: [...humans],
              found: {}, foundBy: {}, seekSecs: 0, endsAt: now + HS_COUNT_S, seekStartedAt: 0, newBest: {},
            });
          }
        } else if (r.type === 'stop') {
          if (s.phase === 'counting' || s.phase === 'seeking') useHideSeekStore.setState({ phase: 'idle', endsAt: 0 });
        } else if (s.phase === 'seeking' && s.players.includes(r.who) && r.who !== s.seeker && s.found[r.who] === undefined) {
          // "Found you!" — only the seeking side may call it, and only from
          // roughly where they say they are (positions lag a little online).
          const byRole = r.by === s.seeker || s.found[r.by] !== undefined;
          const a = game.positions[r.by], b = game.positions[r.who];
          if (byRole && a && b && Math.hypot(a.x - b.x, a.z - b.z) <= HS_SEE_RANGE + HS_TAG_SLACK) {
            useHideSeekStore.setState({
              found: { ...s.found, [r.who]: Math.max(1, Math.round(now - s.seekStartedAt)) },
              foundBy: { ...s.foundBy, [r.who]: r.by },
            });
            s.markFound(r.who, r.by);
          }
        }
      }
      const s = useHideSeekStore.getState();
      if (s.phase === 'counting' || s.phase === 'seeking') {
        // Someone closed their laptop: carry on without them if we can.
        const still = s.players.filter((id) => humans.includes(id));
        if (!s.seeker || !still.includes(s.seeker) || still.length < 2) {
          useHideSeekStore.setState({ phase: 'idle', endsAt: 0 });
        } else {
          if (still.length !== s.players.length) useHideSeekStore.setState({ players: still });
          if (s.phase === 'counting' && now >= s.endsAt) {
            useHideSeekStore.setState({ phase: 'seeking', endsAt: now + HS_ROUND_S, seekStartedAt: now });
          } else if (s.phase === 'seeking') {
            const hiders = still.filter((id) => id !== s.seeker);
            const everyone = hiders.every((id) => s.found[id] !== undefined);
            if (everyone || now >= s.endsAt) {
              // Stars: one per find for the seeker, one for each hider who was never found.
              const stars = { ...s.stars };
              const finds = hiders.filter((id) => s.found[id] !== undefined).length;
              if (finds > 0) stars[s.seeker] = (stars[s.seeker] ?? 0) + finds;
              for (const id of hiders) if (s.found[id] === undefined) stars[id] = (stars[id] ?? 0) + 1;
              useHideSeekStore.setState({
                phase: 'results', stars,
                seekSecs: Math.min(HS_ROUND_S, Math.max(1, Math.round(now - s.seekStartedAt))),
                endsAt: now + HS_RESULTS_S,
              });
            }
          }
        }
      } else if (s.phase === 'results' && now >= s.endsAt) {
        useHideSeekStore.setState({ phase: 'idle', endsAt: 0 });
      }
    }

    // ------------------------------------------------------- EVERY CLIENT --
    // Failsafe for guests: if the host has gone quiet well past the end of a
    // phase (it left without anyone taking over), don't sit in a dead game.
    if (!net.isHost) {
      const g0 = useHideSeekStore.getState();
      if (g0.phase !== 'idle' && now > g0.endsAt + 8) useHideSeekStore.setState({ phase: 'idle', endsAt: 0 });
    }
    const s = useHideSeekStore.getState();
    const p = prev.current;
    const role = hsRole(me);
    const playing = role !== 'none';

    // Phase changes → the sounds that go with them.
    if (s.phase !== p.phase || s.round !== p.round) {
      const was = p.phase;
      p.phase = s.phase; p.round = s.round; p.sec = -1;
      if (s.phase === 'seeking' && playing) hsReadyOrNot();
      if (s.phase === 'results' && was !== 'results') {
        hsFanfare();
        // A hider's time this round — did it beat their best?
        if (s.players.includes(me) && me !== s.seeker) s.recordBest(me, s.found[me] ?? s.seekSecs);
      }
      if (s.phase === 'idle' && (was === 'counting' || was === 'seeking')) s.say('Hide-and-seek stopped');
    }
    if (s.lastFound && s.lastFound.at !== p.foundAt) {
      p.foundAt = s.lastFound.at;
      cheerSound();
    }
    // The count: a tick a second (loud ones for the last five).
    if (s.phase === 'counting' && playing) {
      const left = Math.ceil(s.endsAt - now);
      if (left !== p.sec && left >= 0) {
        p.sec = left;
        if (left > 0) hsTick(left <= 5, role === 'seeker' ? 1 : 0.45);
      }
    }

    // The Home Base prompt at the tree (only between games).
    const inRoom = !!net.myCharacterId && !net.spectator;
    const baseLabel = !inRoom || s.phase === 'counting' || s.phase === 'seeking'
      ? ''
      : humans.length >= 2 ? 'play hide-and-seek — I\'ll count! 🙈' : 'hide-and-seek 🙈 (needs 2 players)';
    if (baseLabel !== p.baseLabel) {
      p.baseLabel = baseLabel;
      const zs = useZoneStore.getState();
      if (baseLabel) zs.register({ id: BASE_ZONE, kind: 'hsbase', label: baseLabel, x: HS_BASE.x, z: HS_BASE.z, radius: HS_BASE_RADIUS });
      else zs.unregister(BASE_ZONE);
    }

    // Looking for people (the seeker + everyone already found).
    const seeking = s.phase === 'seeking' && (role === 'seeker' || role === 'found');
    if (!seeking) {
      if (tagZones.current.size) {
        for (const id of tagZones.current) useZoneStore.getState().unregister(tagZone(id));
        tagZones.current.clear();
      }
    } else if (now - p.lookAt >= LOOK_EVERY_S) {
      p.lookAt = now;
      const mp = game.positions[me];
      const yaw = game.yaws[me];
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      let blockers: RectCollider[] | null = null;
      const zs = useZoneStore.getState();
      for (const id of s.players) {
        if (id === s.seeker || s.found[id] !== undefined) {
          if (tagZones.current.delete(id)) zs.unregister(tagZone(id));
          continue;
        }
        const hp = game.positions[id];
        const dx = hp.x - mp.x, dz = hp.z - mp.z;
        const d = Math.hypot(dx, dz);
        let spotted = false;
        if (d <= HS_SEE_RANGE) {
          if (!blockers) {
            // Walls and anything else solid — plus every door that's shut.
            blockers = [...game.staticColliders];
            for (const door of Object.values(game.doors)) if (!door.open) blockers.push(door.aabbWhenClosed);
          }
          if (hsSightClear(mp.x, mp.y, mp.z, hp.x, hp.y, hp.z, blockers)) {
            if (d <= HS_TOUCH_RANGE) {
              // Walked right into them.
              if (now - (tagSentAt.current[id] ?? -9) > 0.6) {
                tagSentAt.current[id] = now;
                requestHideSeek({ type: 'tag', who: id, by: me });
              }
            } else if (d < 0.01 || (dx / d) * fx + (dz / d) * fz >= HS_SEE_CONE_COS) {
              spotted = true;
            }
          }
        }
        if (spotted) {
          if (!tagZones.current.has(id)) {
            tagZones.current.add(id);
            zs.register({ id: tagZone(id), kind: 'hstag', label: `FOUND YOU, ${HS_NAME[id].toUpperCase()}! 🎉`, x: hp.x, z: hp.z, radius: HS_SEE_RANGE + 1 });
          } else zs.updatePos(tagZone(id), hp.x, hp.z);
        } else if (tagZones.current.delete(id)) zs.unregister(tagZone(id));
      }
    }

    // A hider's heart pounds as the seekers close in.
    if (s.phase === 'seeking' && role === 'hider') {
      const mp = game.positions[me];
      let near = Infinity;
      for (const id of s.players) {
        if (id === me || (id !== s.seeker && s.found[id] === undefined)) continue;
        const q = game.positions[id];
        near = Math.min(near, Math.hypot(q.x - mp.x, q.z - mp.z));
      }
      if (near < 16) {
        const prox = 1 - near / 16;
        if (now - p.heartAt > 1.15 - 0.65 * prox) { p.heartAt = now; heartbeat(prox); }
      }
    }
  });

  return null;
}
