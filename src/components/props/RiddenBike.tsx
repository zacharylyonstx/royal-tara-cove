import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Bike } from './Bike';
import { Truck } from './Truck';
import { Sedan } from './Sedan';
import { usePlayStore } from '../../state/playStore';
import { useGameStore } from '../../state/gameStore';
import { CHARACTER_ORDER } from '../../world/characters';
import type { CharacterId } from '../../types';

/** A vehicle (bike or car) rendered under every character currently riding. */
export function RiddenBikes() {
  return (
    <>
      {CHARACTER_ORDER.map((id) => (
        <OneRiddenBike key={id} id={id} />
      ))}
    </>
  );
}

function OneRiddenBike({ id }: { id: CharacterId }) {
  const ref = useRef<Group>(null);
  const flipRef = useRef<Group>(null);
  const riding = usePlayStore((s) => s.riding[id]);
  const isCar = riding?.vehicle === 'car';

  useFrame(() => {
    const g = ref.current;
    const fg = flipRef.current;
    if (!g || !fg) return;
    const r = usePlayStore.getState().riding[id];
    if (!r) { g.visible = false; return; }
    g.visible = true;
    const p = useGameStore.getState().positions[id];
    g.position.set(p.x, r.y, p.z);
    if (r.vehicle === 'car') {
      // Car nose (headlights/grille) is modelled at local -Z; heading with no
      // offset points the nose along the travel direction. Cars never flip/tip.
      g.rotation.y = r.heading;
      fg.rotation.z = 0;
      fg.rotation.x = 0;
    } else {
      // Bike rolls along its local +X; +90deg aligns it with the heading forward.
      g.rotation.y = r.heading + Math.PI / 2;
      // Flip = rotation about the inner local Z (the left-right axis after the yaw).
      fg.rotation.z = r.flip ? r.flip.angle : 0;
      // Wipeout = tip over sideways (roll about the forward/local-X axis).
      const wipeActive = r.wipeoutUntil > performance.now();
      fg.rotation.x += ((wipeActive ? 1.15 : 0) - fg.rotation.x) * 0.18;
    }
  });

  if (!riding) return null;
  return (
    <group ref={ref}>
      <group ref={flipRef}>
        {isCar ? (
          riding.carKind === 'truck' ? (
            <Truck position={[0, 0, 0]} rotation={0} color={riding.bikeColor} />
          ) : (
            <Sedan position={[0, 0, 0]} rotation={0} color={riding.bikeColor} />
          )
        ) : (
          <Bike position={[0, 0, 0]} rotation={0} color={riding.bikeColor} scale={0.85} />
        )}
      </group>
    </group>
  );
}
