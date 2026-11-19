import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import { AnimeNpcModel } from './AnimeNpcModel';
import { AvatarNpcModel, avatarDims } from './AvatarNpcModel';
import { useGameStore } from '../../state/gameStore';
import { useSkyStore } from '../../state/skyStore';
import { useZoneStore } from '../../state/zoneStore';
import { useNpcStore } from '../../state/npcStore';
import { useChatStore } from '../../state/chatStore';
import { NPCS, planNpc, type NpcDef } from '../../world/npcs';
import { realSecondsAt, sunElevation, NPC_HOME_BELOW_EL } from '../../world/npcTime';
import { CHARACTER_ORDER } from '../../world/characters';

// The townsfolk, drawn as modelled anime characters (AvatarNpcModel; the simple
// AnimeNpcModel stands in for the moment a model takes to load). The family keep
// their own likenesses.
//
// Each NPC chases a TARGET that is a pure function of the shared day clock
// (world/npcs.ts planNpc), so every player sees them in the same place with
// nothing to sync. Locally they add life: they stop and turn to you when you
// walk up, wave back when you wave, and talk when you press E.

const BUBBLE_MS = 5200;
const NOTICE_DIST = 3.2;
const WAVE_DIST = 9;
/** Don't draw (or simulate limbs for) folks this far from the player. */
const CULL_DIST = 85;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function Npcs() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'freeplay') return null;
  return (
    <>
      {NPCS.map((def, i) => <Npc key={def.id} def={def} index={i} />)}
    </>
  );
}

function Npc({ def, index }: { def: NpcDef; index: number }) {
  const root = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const rig = useMemo(() => ({ leftLeg, rightLeg, leftArm, rightArm, torso }), []);
  const d = useMemo(() => avatarDims(def.look.height), [def.look.height]);

  const st = useRef({
    init: false, x: 0, z: 0, y: 0, yaw: 0, phase: Math.random() * 6, speed: 0,
    shown: true, near: false, waveUntil: 0, lastChatId: '', accum: 0, sit: 0,
    /** How far along def.route I am: 0 = indoors side … route.length = outdoors. */
    routeIdx: 0,
  });
  // React state only for things that change rarely (mount/unmount of DOM bits).
  const [shown, setShown] = useState(true);
  const [near, setNear] = useState(false);
  const bubble = useNpcStore((s) => s.bubbles[def.id]);
  const carryingTo = useNpcStore((s) => s.carrying?.toId === def.id ? s.carrying.item : null);
  const [, force] = useState(0);
  const zoneId = `npc-${def.id}`;

  // Talkable while visible.
  useEffect(() => {
    if (!shown) return;
    const s = st.current;
    useZoneStore.getState().register({ id: zoneId, kind: 'talk', label: `talk to ${def.name} 💬`, x: s.x, z: s.z, radius: 2.6 });
    return () => useZoneStore.getState().unregister(zoneId);
  }, [shown, zoneId, def.name]);

  // Expire the speech bubble.
  useEffect(() => {
    if (!bubble) return;
    const left = BUBBLE_MS - (performance.now() - bubble.at);
    if (left <= 0) return;
    const t = setTimeout(() => force((n) => n + 1), left + 30);
    return () => clearTimeout(t);
  }, [bubble]);

  useFrame(({ clock, camera }, dtRaw) => {
    const s = st.current;
    const g = root.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.1);
    const t = clock.elapsedTime;
    const f = useSkyStore.getState().dayFraction;
    const T = realSecondsAt(f);
    const night = sunElevation(f) < NPC_HOME_BELOW_EL;
    const plan = planNpc(def, index, T, night);
    const route = def.route;
    if (!s.init) { s.init = true; s.x = plan.x; s.z = plan.z; s.y = plan.y; s.yaw = plan.yaw ?? 0; s.routeIdx = route && plan.outside ? route.length : 0; }
    // Going in or out? Head for the next doorway on the way, not straight through the wall.
    let tx = plan.x, tz = plan.z, viaDoor = false;
    if (route) {
      if (plan.outside && s.routeIdx < route.length) { [tx, tz] = route[s.routeIdx]; viaDoor = true; }
      else if (!plan.outside && s.routeIdx > 0) { [tx, tz] = route[s.routeIdx - 1]; viaDoor = true; }
      if (viaDoor && Math.hypot(tx - s.x, tz - s.z) < 0.45) s.routeIdx += plan.outside ? 1 : -1;
    }

    // Far away? Skip everything but keeping the position current.
    const cdx = camera.position.x - s.x, cdz = camera.position.z - s.z;
    const far = cdx * cdx + cdz * cdz > CULL_DIST * CULL_DIST;

    // Who's closest?
    const game = useGameStore.getState();
    let nd = Infinity, nx = 0, nz = 0;
    for (const id of CHARACTER_ORDER) {
      const p = game.positions[id];
      if (Math.abs(p.y - s.y) > 2.2) continue;
      const dd = Math.hypot(p.x - s.x, p.z - s.z);
      if (dd < nd) { nd = dd; nx = p.x; nz = p.z; }
    }
    const talking = !!bubble && performance.now() - bubble.at < BUBBLE_MS;
    const noticed = nd < NOTICE_DIST || (talking && nd < 6);

    // Chase the plan (unless someone has stopped for a chat).
    const dx = tx - s.x, dz = tz - s.z;
    const dist = Math.hypot(dx, dz);
    let moving = false;
    if (Math.hypot(plan.x - s.x, plan.z - s.z) > 90) {        // schedule jumped (clock set): just be there
      s.x = plan.x; s.z = plan.z; s.routeIdx = route && plan.outside ? route.length : 0;
    }
    else if (dist > 0.12 && !(noticed && !plan.hide)) {
      moving = true;
      const v = Math.min(dist / dt, dist > 5 && !viaDoor ? Math.max(plan.speed * 2, 3.4) : plan.speed);
      s.x += (dx / dist) * v * dt;
      s.z += (dz / dist) * v * dt;
      s.speed = v;
    }
    if (!moving) s.speed = 0;
    s.y += (plan.y - s.y) * Math.min(1, 6 * dt);

    // Facing: the way I'm walking → the kid in front of me → my post's facing.
    let wantYaw = s.yaw;
    if (moving) wantYaw = Math.atan2(-dx, -dz);
    else if (noticed) wantYaw = Math.atan2(-(nx - s.x), -(nz - s.z));
    else if (plan.yaw != null) wantYaw = plan.yaw;
    let dy = wantYaw - s.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    s.yaw += dy * Math.min(1, 7 * dt);

    // Gone indoors for the night?
    const visible = !(plan.hide && dist < 0.6);
    if (visible !== s.shown) { s.shown = visible; setShown(visible); }
    const isNear = visible && nd < 14;
    if (isNear !== s.near) { s.near = isNear; setNear(isNear); }

    // Wave back when a player waves nearby.
    if (visible && nd < WAVE_DIST) {
      for (const id of CHARACTER_ORDER) {
        const m = useChatStore.getState().recentBubbleFor(id, Date.now());
        if (m && m.text === '👋' && m.id !== s.lastChatId) {
          const p = game.positions[id];
          if (Math.hypot(p.x - s.x, p.z - s.z) < WAVE_DIST) { s.lastChatId = m.id; s.waveUntil = t + 1.8; }
        }
      }
    }

    g.visible = visible && !far;
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = s.yaw + Math.PI; // model front is +Z; yaw convention faces −Z

    s.accum += dt;
    if (s.accum > 0.2) { s.accum = 0; useZoneStore.getState().updatePos(zoneId, s.x, s.z); }
    if (!g.visible) return;

    // --- limbs ---
    const sitting = plan.sit && !moving && !viaDoor && dist < 0.3;
    s.sit += ((sitting ? 1 : 0) - s.sit) * Math.min(1, 8 * dt);
    if (moving) s.phase += dt * Math.min(13, 4.5 + s.speed * 1.6);
    else s.phase += dt * 1.5 * -Math.sin(s.phase);
    const swing = Math.sin(s.phase) * Math.min(0.62, s.speed * 0.22);
    const waving = t < s.waveUntil;
    const sitLeg = -1.45 * s.sit;
    if (leftLeg.current) leftLeg.current.rotation.x = swing + sitLeg;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing + sitLeg;
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.9 - 0.25 * s.sit;
    if (rightArm.current) {
      if (waving) {
        rightArm.current.rotation.x = -2.7;
        rightArm.current.rotation.z = Math.sin(t * 11) * 0.45;
      } else {
        rightArm.current.rotation.x = talking ? -0.5 + Math.sin(t * 5) * 0.25 : swing * 0.9 - 0.25 * s.sit;
        rightArm.current.rotation.z = 0;
      }
    }
    if (torso.current) torso.current.position.y = d.torsoY + Math.sin(t * 1.5 + index) * 0.012 + (talking ? Math.abs(Math.sin(t * 7)) * 0.012 : 0);
    // Sitting: drop the hips to chair height.
    g.position.y = s.y - s.sit * Math.max(0, d.legsH - 0.44);
  });

  const now = performance.now();
  const showBubble = !!bubble && now - bubble.at < BUBBLE_MS && shown;
  return (
    <group ref={root}>
      <Suspense fallback={<AnimeNpcModel id={def.id} look={def.look} />}>
        <AvatarNpcModel look={def.look} rig={rig} />
      </Suspense>
      {shown && near && !showBubble && (
        <Html position={[0, def.look.height + 0.32, 0]} center distanceFactor={9} zIndexRange={[70, 0]} occlude={false}>
          <div style={{ background: 'rgba(20,28,38,0.74)', color: '#fff', padding: '2px 9px', borderRadius: 999, fontSize: 13, fontWeight: 800, fontFamily: FONT, whiteSpace: 'nowrap', pointerEvents: 'none', border: '2px solid #f6c945', textAlign: 'center' }}>
            {carryingTo ? `${carryingTo} ` : '💬 '}{def.name}
            <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>{def.role}</div>
          </div>
        </Html>
      )}
      {shown && carryingTo && !near && (
        // "Bring it here!" beacon, visible from far away.
        <Html position={[0, def.look.height + 1.1, 0]} center zIndexRange={[70, 0]} occlude={false}>
          <div style={{ fontSize: 30, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', pointerEvents: 'none', animation: 'pop-in 0.4s both' }}>{carryingTo}⬇️</div>
        </Html>
      )}
      {showBubble && bubble && (
        <Html position={[0, def.look.height + 0.45, 0]} center distanceFactor={8} zIndexRange={[95, 0]} occlude={false}>
          <div style={{ transform: 'translateY(-50%)', background: '#fffdf6', color: '#2a2433', padding: '8px 13px', borderRadius: 16, fontSize: 15, fontWeight: 600, lineHeight: 1.3, fontFamily: FONT, width: 'max-content', maxWidth: 250, boxShadow: '0 4px 14px rgba(0,0,0,0.35)', border: '2px solid #2a2433', pointerEvents: 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#a0651a', marginBottom: 2 }}>{def.name}</div>
            {bubble.text}
          </div>
        </Html>
      )}
    </group>
  );
}
