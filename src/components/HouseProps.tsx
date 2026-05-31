import { useEffect } from 'react';
import type { HouseConfig, Lot } from '../types';
import type { HouseProps as HousePropsData } from '../world/props';
import { usePlayStore } from '../state/playStore';
import { Truck } from './props/Truck';
import { Sedan } from './props/Sedan';
import { BBQGrill } from './props/BBQGrill';
import { BasketballHoop } from './props/BasketballHoop';
import { TrashBins } from './props/TrashBins';
import { PatioSet } from './props/PatioSet';
import { GardenBed } from './props/GardenBed';
import { Hose } from './props/Hose';
import { Bike } from './props/Bike';
import { Flagpole } from './props/Flagpole';
import { Basketball } from './props/Basketball';
import { Cat } from './props/Cat';
import { Sprinkler } from './props/Sprinkler';
import { FRONT_YARD_DEPTH } from '../world/streetLayout';

const GARAGE_W = 5.6;

interface HousePropsRendererProps {
  config: HouseConfig;
  lot: Lot;
  data: HousePropsData;
}

/** Convert house-local (x, y, z) to world (x, y, z). */
function toWorld(lx: number, ly: number, lz: number, pivot: [number, number], yaw: number): [number, number, number] {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return [pivot[0] + lx * cy + lz * sy, ly, pivot[1] - lx * sy + lz * cy];
}

export function HousePropsRenderer({ config, lot, data }: HousePropsRendererProps) {
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  const sidewalkZ = -halfD - FRONT_YARD_DEPTH;

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const driveZCenter = (sidewalkZ + -halfD) / 2 + 0.6;
  const backyardZ = halfD + 6;

  // Compute world positions for physics-driven props (cat, ball, sprinkler).
  const ballSide = config.garageOnLeft ? 1 : -1;
  const ballLocal: [number, number, number] = [
    garageCenterX + ballSide * (GARAGE_W / 2 + 1.2),
    0,
    sidewalkZ + 0.5,
  ];
  const catLocal: [number, number, number] = [
    config.garageOnLeft ? halfW - 3 : -halfW + 3,
    0,
    -halfD - 5.5,
  ];
  const sprinklerLocal: [number, number, number] = [0, 0, halfD + 9];

  // Register hoop rim + bike spots (world coords) for the free-roam play layer.
  useEffect(() => {
    const pivot = lot.housePivot;
    const yaw = lot.houseYaw;
    if (data.tags.has('hoop')) {
      const hoopX = garageCenterX + ballSide * (GARAGE_W / 2 + 0.6);
      const hoopZ = sidewalkZ - 0.4;
      // Hoop is drawn with rotation=Math.PI, so its local rim (0,2.85,0.65)
      // sits at house-local (hoopX, 2.85, hoopZ-0.65).
      const rim = toWorld(hoopX, 2.85, hoopZ - 0.65, pivot, yaw);
      // Forgiving scoring radius so the kids reliably make baskets.
      usePlayStore.getState().registerHoop(config.address, { x: rim[0], z: rim[2], rimY: rim[1], rimR: 0.5 });
    }
    if (data.tags.has('bike')) {
      const bx = garageCenterX - (config.garageOnLeft ? 1.6 : -1.6);
      const w = toWorld(bx, 0, -halfD - 1.6, pivot, yaw);
      usePlayStore.getState().registerBike({ id: `${config.address}-bike`, x: w[0], z: w[2], color: '#3a6db0' });
    }
    if (data.tags.has('kidsBikes')) {
      const a = toWorld(garageCenterX - 1.5, 0, -halfD - 1.4, pivot, yaw);
      const b = toWorld(garageCenterX - 0.4, 0, -halfD - 1.6, pivot, yaw);
      usePlayStore.getState().registerBike({ id: `${config.address}-kbike-0`, x: a[0], z: a[2], color: '#e26aa1' });
      usePlayStore.getState().registerBike({ id: `${config.address}-kbike-1`, x: b[0], z: b[2], color: '#5cb85c' });
    }
  }, [config.address, config.garageOnLeft, garageCenterX, ballSide, sidewalkZ, halfD, lot, data]);

  return (
    <>
      {/* House-local group: all decoration that should rotate with the house. */}
      <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
        {data.tags.has('truck') && (
          <Truck position={[garageCenterX, 0, driveZCenter]} rotation={Math.PI} color={data.vehicleColor} />
        )}
        {!data.tags.has('truck') && data.tags.has('sedan') && (
          <Sedan position={[garageCenterX, 0, driveZCenter]} rotation={Math.PI} color={data.vehicleColor} />
        )}

        {data.tags.has('hoop') && (
          <BasketballHoop
            position={[
              garageCenterX + ballSide * (GARAGE_W / 2 + 0.6),
              0,
              sidewalkZ - 0.4,
            ]}
            rotation={Math.PI}
          />
        )}

        {data.tags.has('bins') && (
          <TrashBins
            position={[
              (config.garageOnLeft ? halfW - 1.8 : -halfW + 1.8) * 0.7,
              0,
              sidewalkZ - 0.5,
            ]}
          />
        )}

        {data.tags.has('gardenBed') && (
          <GardenBed
            position={[
              config.garageOnLeft ? halfW - 2.5 : -halfW + 2.5,
              0,
              -halfD - 0.6,
            ]}
          />
        )}

        {data.tags.has('hose') && (
          <Hose
            position={[
              config.garageOnLeft ? -halfW + 0.3 : halfW - 0.3,
              0,
              0,
            ]}
            rotation={config.garageOnLeft ? Math.PI / 2 : -Math.PI / 2}
          />
        )}

        {data.tags.has('bike') && (
          <Bike
            id={`${config.address}-bike`}
            position={[
              garageCenterX - (config.garageOnLeft ? 1.6 : -1.6),
              0,
              -halfD - 1.6,
            ]}
            rotation={-Math.PI / 2}
            color="#3a6db0"
          />
        )}

        {data.tags.has('kidsBikes') && (
          <>
            <Bike
              id={`${config.address}-kbike-0`}
              position={[garageCenterX - 1.5, 0, -halfD - 1.4]}
              rotation={-Math.PI / 2.5}
              color="#e26aa1"
              scale={0.78}
            />
            <Bike
              id={`${config.address}-kbike-1`}
              position={[garageCenterX - 0.4, 0, -halfD - 1.6]}
              rotation={-Math.PI / 2 + 0.4}
              color="#5cb85c"
              scale={0.7}
            />
          </>
        )}

        {data.tags.has('patio') && (
          <>
            <PatioSet position={[1.5, 0, backyardZ]} />
            <BBQGrill position={[-2.0, 0, backyardZ + 1.5]} rotation={-Math.PI / 4} />
          </>
        )}

        {data.tags.has('flagpole') && (
          <Flagpole
            position={[
              config.garageOnLeft ? -halfW - 1.0 : halfW + 1.0,
              0,
              -halfD - 4.0,
            ]}
            flag="tx"
          />
        )}
      </group>

      {/* World-space sibling group for physics-driven / player-aware props. */}
      {/* A few basketballs in the driveway so the whole family can play together. */}
      {data.tags.has('hoop') && [
        [ballLocal[0], 0, ballLocal[2]],
        [ballLocal[0] + 1.3, 0, ballLocal[2] + 0.5],
        [ballLocal[0] - 0.7, 0, ballLocal[2] + 1.0],
      ].map((bl, i) => (
        <Basketball
          key={i}
          id={`${config.address}-ball-${i}`}
          position={toWorld(bl[0], bl[1], bl[2], lot.housePivot, lot.houseYaw)}
        />
      ))}
      {config.isHero && (
        <Cat
          position={toWorld(catLocal[0], catLocal[1], catLocal[2], lot.housePivot, lot.houseYaw)}
          rotation={lot.houseYaw + Math.PI / 4}
        />
      )}
      {data.tags.has('hose') && (
        <Sprinkler position={toWorld(sprinklerLocal[0], sprinklerLocal[1], sprinklerLocal[2], lot.housePivot, lot.houseYaw)} />
      )}
    </>
  );
}
