// People of the Red Line and the Domain (Free Play). All fictional. Same pure
// data as the rest of the townsfolk (world/npcs.ts plans where they stand).
import type { NpcDef } from './npcs';
import { npcAppearance as A, npcLook } from './npcLook';
import { RAIL_MID_X } from './westAvery';
import { PLATFORM_Y, STATIONS } from './redLine';
import { FOUNTAIN, STAGE, STAGE_Y, STREET, TACO_TRUCK, WALK_Z } from './domain';
import { SCHOOL, SNOW_CONE } from './colony';

const S = Math.PI; // facing south (+Z)

export const RAIL_NPCS: NpcDef[] = [
  {
    id: 'ray', name: 'Conductor Ray', role: 'MetroRail', where: 'on the platform at Avery Ranch station',
    look: npcLook('dad', 1.8, '#8a5a3c', A(['buzz', '#2a2a2a'], ['longsleeve', '#27406b'], ['jeans', '#1f2a44'], ['boots', '#1f1f1f'], ['cap', '#1c2a4a'])),
    day: { kind: 'post', x: RAIL_MID_X + 1.3, z: STATIONS.avery.z + 13, y: PLATFORM_Y, yaw: S },
    night: { kind: 'post', x: RAIL_MID_X + 1.3, z: STATIONS.avery.z + 13, y: PLATFORM_Y, yaw: S },
    lines: [
      'All aboard! The Domain, Downtown Austin, and all the way to Bastrop. Just walk on when the doors open.',
      'Six trains run all day — one leaves about every minute and a half.',
      'It\'s about five minutes to Bastrop. Walk around! Look out the windows!',
      'Watch for the limestone cut, the big quarry at McNeil, and MoPac right before the Domain.',
      'After Downtown we cross Lady Bird Lake, pass the airport — and keep your eyes peeled for a GIANT squirrel.',
      'Trains going the other way whoosh past on the next track. Give them a wave!',
      'Stand right behind the driver if you want to see the track ahead.',
    ],
    duskLines: ['Evening trains are my favorite — the city lights up as you roll in.'],
    nightLines: ['Trains run all night. And don\'t you worry — Siren Head never comes near the station.'],
  },
  {
    id: 'josie', name: 'Ms. Josie', role: 'station agent', where: 'on the platform at the Domain station',
    look: npcLook('penny', 1.68, '#c98f65', A(['ponytail', '#3a2416'], ['longsleeve', '#c8102e'], ['jeans', '#2b2f3a'], ['sneakers', '#f2f2f0'], ['none', ''])),
    day: { kind: 'post', x: RAIL_MID_X - 1.3, z: STATIONS.domain.z + 13, y: PLATFORM_Y, yaw: S },
    night: { kind: 'post', x: RAIL_MID_X - 1.3, z: STATIONS.domain.z + 13, y: PLATFORM_Y, yaw: S },
    lines: [
      'Welcome to the Domain! Down the ramp, over the crossing, and Rock Rose is straight across Burnet Road.',
      'Trains to Downtown and Bastrop leave from the west side of the platform; Avery Ranch from the east side.',
      'Fun fact: the real Domain station is still being built. You got here early!',
      'Head for the Lawn at the far end — there\'s a fountain you can run right through.',
    ],
    nightLines: ['It\'s pretty at night with all the string lights. The trains keep running, so no rush.'],
  },
  {
    id: 'marisol', name: 'Marisol', role: 'taco truck', where: 'at the taco truck by the Domain station',
    look: npcLook('penny', 1.64, '#d9a877', A(['long', '#1a1a1a'], ['tank', '#f2a51e'], ['jeans', '#3a4d6b'], ['sneakers', '#e8463f'], ['headband', '#c8102e'])),
    day: { kind: 'post', x: TACO_TRUCK.x - 2.9, z: TACO_TRUCK.z - 1.6, yaw: Math.PI / 2 },
    night: { kind: 'post', x: TACO_TRUCK.x - 2.9, z: TACO_TRUCK.z - 1.6, yaw: Math.PI / 2 },
    lines: [
      '¡Hola! Street tacos, fresh off the plancha. Step up to the window!',
      'Fresh off the train? You must be hungry.',
      'Breakfast tacos are an Austin thing. We eat them all day long.',
    ],
    nightLines: ['Late-night tacos are the best tacos. That\'s just science.'],
  },
  {
    id: 'wyatt', name: 'Wyatt', role: 'musician', where: 'on the stage at the Lawn',
    look: npcLook('dad', 1.76, '#e8b98f', A(['short', '#7a5636'], ['plaid', '#2f5d50'], ['jeans', '#3a4d6b'], ['boots', '#5a3a22'], ['cowboy', '#3d2a1c'])),
    day: { kind: 'post', x: STAGE.x + 0.6, z: STAGE.z, y: STAGE_Y, yaw: -Math.PI / 2 },
    night: { kind: 'post', x: STAGE.x + 0.6, z: STAGE.z, y: STAGE_Y, yaw: -Math.PI / 2 },
    lines: [
      'Howdy! Hop up on the stage if you want — plenty of room.',
      'Austin\'s the Live Music Capital of the World. Somebody\'s always playing somewhere.',
      'These big oaks were here long before any of the shops.',
    ],
    nightLines: ['Best time to play is right now, under the lights.'],
  },
  {
    id: 'nora', name: 'Nora', role: 'shopper', where: 'strolling Rock Rose at the Domain',
    look: npcLook('penny', 1.7, '#f4d0ab', A(['long', '#caa24a'], ['hoodie', '#6a4fc3'], ['athletic', '#2c2f3a'], ['sneakers', '#f2f2f0'], ['none', ''], ['backpack', '#e86a92'])),
    day: { kind: 'patrol', speed: 1.35, path: [[STREET.x1 - 5, WALK_Z - 3.6], [STREET.x0 + 4, WALK_Z - 3.6], [STREET.x0 + 4, WALK_Z + 3.6], [STREET.x1 - 5, WALK_Z + 3.6]] },
    night: { kind: 'patrol', speed: 1.2, path: [[STREET.x1 - 5, WALK_Z - 3.6], [STREET.x0 + 4, WALK_Z - 3.6], [STREET.x0 + 4, WALK_Z + 3.6], [STREET.x1 - 5, WALK_Z + 3.6]] },
    lines: [
      'Have you tried the kolaches? Warm from the oven!',
      'Walk up to any shop door and press E — there\'s a treat at every one.',
      'I took the train from Avery Ranch too. So much better than sitting in traffic on MoPac.',
    ],
  },
  {
    id: 'theo', name: 'Theo', role: 'kid', where: 'by the fountain on the Lawn',
    look: npcLook('luke', 1.22, '#c98f65', A(['short', '#1a1a1a'], ['tank', '#3fb6b2'], ['shorts', '#f0b429'], ['sneakers', '#2e7fd0'], ['none', ''])),
    day: { kind: 'wander', x: FOUNTAIN.x + 3.5, z: FOUNTAIN.z + 5, r: 3, period: 6 },
    night: { kind: 'wander', x: FOUNTAIN.x + 3.5, z: FOUNTAIN.z + 5, r: 3, period: 8 },
    lines: [
      'I ran through the fountain NINE times!',
      'You can go right through the middle. It doesn\'t even hurt.',
      'Did you come on the train? I sat right behind the driver!',
    ],
  },
  {
    id: 'earl', name: 'Mr. Earl', role: 'station agent', where: 'on the platform at Bastrop station',
    look: npcLook('dad', 1.82, '#b98a64', A(['buzz', '#8a8a8a'], ['longsleeve', '#27406b'], ['jeans', '#1f2a44'], ['boots', '#3a2a1c'], ['cap', '#c8102e'])),
    day: { kind: 'post', x: RAIL_MID_X + 1.3, z: STATIONS.bastrop.z + 13, y: PLATFORM_Y, yaw: S },
    night: { kind: 'post', x: RAIL_MID_X + 1.3, z: STATIONS.bastrop.z + 13, y: PLATFORM_Y, yaw: S },
    lines: [
      'End of the line — Bastrop! Welcome to The Colony.',
      'Chinaberry Bend? Go east on Sam Houston Drive, past the pool park, and it\'s on your right.',
      'The school is the other way — west along Sam Houston Drive, past the Lakehouse.',
      'There\'s no real train out here, you know. This one\'s just for you.',
      'Every train from here goes back to Downtown, the Domain and Avery Ranch.',
    ],
    nightLines: ['Quiet out here at night. You can hear the frogs down at the lake.'],
  },
  {
    id: 'beto', name: 'Beto', role: 'snow cones', where: 'at the snow-cone cart by Bastrop station',
    look: npcLook('dad', 1.74, '#c99872', A(['short', '#1a1a1a'], ['tee', '#39b6c9'], ['shorts', '#f2f2f0'], ['sneakers', '#e8477a'], ['cap', '#e8477a'])),
    day: { kind: 'post', x: SNOW_CONE.x - 2.6, z: SNOW_CONE.z + 1.7, yaw: Math.PI / 2 },
    night: { kind: 'post', x: SNOW_CONE.x - 2.6, z: SNOW_CONE.z + 1.7, yaw: Math.PI / 2 },
    lines: [
      'Snow cones! Tiger\'s blood, blue raspberry, or piña colada?',
      'Hot day for a train ride. Best cure is shaved ice.',
      'The pool\'s open over at the pocket park — you can wade right in.',
    ],
  },
  {
    id: 'dee', name: 'Coach Dee', role: 'Colony Oaks Elementary', where: 'out front of Colony Oaks Elementary',
    look: npcLook('penny', 1.7, '#8a5a3c', A(['ponytail', '#1a1a1a'], ['tee', '#35a84a'], ['shorts', '#1f2a5c'], ['sneakers', '#f2f2f0'], ['cap', '#1f2a5c'])),
    day: { kind: 'post', x: SCHOOL.entry.x + 5, z: SCHOOL.entry.z - 12, yaw: 0 },
    night: { kind: 'post', x: SCHOOL.entry.x + 5, z: SCHOOL.entry.z - 12, yaw: 0 },
    lines: [
      'Welcome to Colony Oaks — home of the Cougars! Go Cougars!',
      'The playgrounds are under the big green shade sails, one at each end of the school.',
      'Navy and green, that\'s us. Can you find the paw prints on the way to the doors?',
      'The pickleball courts and the pump track are next door at Lakehouse Park.',
    ],
    nightLines: ['School\'s closed for the night — but the playground never is.'],
  },
];
