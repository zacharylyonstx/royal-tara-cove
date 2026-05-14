import type { HouseConfig, Lot } from '../types';
import type { HouseProps as HousePropsData } from '../world/props';
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
import { FRONT_YARD_DEPTH } from '../world/streetLayout';

const GARAGE_W = 5.6;

interface HousePropsRendererProps {
  config: HouseConfig;
  lot: Lot;
  data: HousePropsData;
}

/**
 * Renders all yard props for a single house in HOUSE-LOCAL space, then is
 * placed into the world by the lot's housePivot+yaw.
 */
export function HousePropsRenderer({ config, lot, data }: HousePropsRendererProps) {
  const halfW = config.width / 2;
  const halfD = config.depth / 2;
  const sidewalkZ = -halfD - FRONT_YARD_DEPTH;

  const garageCenterX = config.garageOnLeft
    ? -halfW + 0.6 + GARAGE_W / 2
    : halfW - 0.6 - GARAGE_W / 2;
  const driveZCenter = (sidewalkZ + -halfD) / 2 + 0.6; // slightly forward, parked nose-in
  const backyardZ = halfD + 6; // mid backyard

  return (
    <group position={[lot.housePivot[0], 0, lot.housePivot[1]]} rotation={[0, lot.houseYaw, 0]}>
      {/* Vehicle in driveway (truck or sedan, never both) */}
      {data.tags.has('truck') && (
        <Truck position={[garageCenterX, 0, driveZCenter]} rotation={Math.PI} color={data.vehicleColor} />
      )}
      {!data.tags.has('truck') && data.tags.has('sedan') && (
        <Sedan position={[garageCenterX, 0, driveZCenter]} rotation={Math.PI} color={data.vehicleColor} />
      )}

      {/* Basketball hoop at end of driveway, on the side toward the curb */}
      {data.tags.has('hoop') && (
        <BasketballHoop
          position={[
            garageCenterX + (config.garageOnLeft ? 1 : -1) * (GARAGE_W / 2 + 0.6),
            0,
            sidewalkZ - 0.4,
          ]}
          rotation={Math.PI}
        />
      )}

      {/* Trash bins curbside, opposite side of driveway */}
      {data.tags.has('bins') && (
        <TrashBins
          position={[
            (config.garageOnLeft ? halfW - 1.8 : -halfW + 1.8) * 0.7,
            0,
            sidewalkZ - 0.5,
          ]}
        />
      )}

      {/* Garden bed against the front of the house, on the door side */}
      {data.tags.has('gardenBed') && (
        <GardenBed
          position={[
            config.garageOnLeft ? halfW - 2.5 : -halfW + 2.5,
            0,
            -halfD - 0.6,
          ]}
        />
      )}

      {/* Hose reel — far side wall */}
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

      {/* Bike on driveway */}
      {data.tags.has('bike') && (
        <Bike
          position={[
            garageCenterX - (config.garageOnLeft ? 1.6 : -1.6),
            0,
            -halfD - 1.6,
          ]}
          rotation={-Math.PI / 2}
          color="#3a6db0"
        />
      )}

      {/* Hero house: kid bikes (Penny pink, Luke green) */}
      {data.tags.has('kidsBikes') && (
        <>
          <Bike
            position={[garageCenterX - 1.5, 0, -halfD - 1.4]}
            rotation={-Math.PI / 2.5}
            color="#e26aa1"
            scale={0.78}
          />
          <Bike
            position={[garageCenterX - 0.4, 0, -halfD - 1.6]}
            rotation={-Math.PI / 2 + 0.4}
            color="#5cb85c"
            scale={0.7}
          />
        </>
      )}

      {/* Backyard patio set + grill */}
      {data.tags.has('patio') && (
        <>
          <PatioSet position={[1.5, 0, backyardZ]} />
          <BBQGrill position={[-2.0, 0, backyardZ + 1.5]} rotation={-Math.PI / 4} />
        </>
      )}

      {/* Hero house: flagpole in front yard */}
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
  );
}
