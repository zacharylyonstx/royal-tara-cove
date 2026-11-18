// People of the Red Line and the Domain (Free Play). All fictional. Same pure
// data as the rest of the townsfolk (world/npcs.ts plans where they stand).
import type { NpcDef } from './npcs';
import { npcAppearance as A, npcLook } from './npcLook';
import { RAIL_MID_X } from './westAvery';
import { PLATFORM_Y, STATIONS } from './redLine';
import { FOUNTAIN, STAGE, STAGE_Y, STREET, TACO_TRUCK, WALK_Z } from './domain';
import { SCHOOL, SNOW_CONE } from './colony';
import { X as SU, Z as SV, FLOOR2 } from './colonySchool';

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
      'There are bikes and a golf cart on the plaza, and the cars on Burnet Road are yours to drive.',
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
      'Too far to walk? Take the golf cart by the snow cones, or a bike off the rack. Every car you see out here will start, too.',
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
      'Come on in, the doors are open! Library in the middle, gym and cafeteria at the back, big kids upstairs.',
      'There are real basketballs in the gym. Pick one up and shoot!',
      'The playgrounds are under the big green shade sails, one at each end of the school.',
      'Navy and green, that\'s us. Can you find the paw prints on the way to the doors?',
      'The pickleball courts and the pump track are next door at Lakehouse Park.',
    ],
    nightLines: ['School\'s closed for the night — but the playground never is.'],
  },
  // --- inside Colony Oaks Elementary (made-up people, apart from a friend's first name) ---
  {
    id: 'coe-emilyrose', name: 'Emily Rose', role: 'Colony Oaks Elementary', where: 'in the library at Colony Oaks Elementary',
    look: npcLook('penny', 1.28, '#f1cca4', A(['long', '#6b4226'], ['tee', '#35a84a'], ['skirt', '#1f2a5c'], ['sneakers', '#ffffff'], ['none', ''], ['backpack', '#e86a92'])),
    day: { kind: 'wander', x: SU(55.6), z: SV(31), r: 1.4, period: 7 },
    night: { kind: 'wander', x: SU(55.6), z: SV(31), r: 1.4, period: 7 },
    lines: [
      "Hi! It's me, Emily Rose! Want to read under the big oak tree with me?",
      "Penny! Luke! You came to school! Come on, I'll show you around.",
      'The bean bags by the tree are the comfiest spot in the whole school.',
      'Have you been up on the bridge? You can see the whole library from up there!',
      'After this, race you to the gym!',
    ],
  },
  {
    id: 'coe-mateo', name: 'Mateo', role: 'Colony Oaks Elementary', where: 'in the gym at Colony Oaks Elementary',
    look: npcLook('luke', 1.3, '#c98f65', A(['short', '#1a1a1a'], ['tee', '#1f2a5c'], ['shorts', '#35a84a'], ['sneakers', '#f2f2f0'], ['none', ''])),
    day: { kind: 'wander', x: SU(73.5), z: SV(76), r: 4, period: 5 },
    night: { kind: 'wander', x: SU(73.5), z: SV(76), r: 4, period: 5 },
    lines: [
      'Wanna play? Grab a ball - press E - then shoot at the basket!',
      "I made three baskets in a row. Bet you can't beat that!",
      'Go Cougars!',
    ],
  },
  {
    id: 'coe-zoe', name: 'Zoe', role: 'Colony Oaks Elementary', where: 'in the cafeteria at Colony Oaks Elementary',
    look: npcLook('penny', 1.2, '#8a5a3c', A(['ponytail', '#1a1a1a'], ['stripe', '#f2b632'], ['jeans', '#2b2f3a'], ['sneakers', '#e0533c'], ['none', ''])),
    day: { kind: 'post', x: SU(84.6), z: SV(56), yaw: -Math.PI / 2 },
    night: { kind: 'post', x: SU(84.6), z: SV(56), yaw: -Math.PI / 2 },
    lines: [
      "It's pizza day! Best day of the whole week.",
      'You can climb up on the stage. Sometimes we do plays up there.',
      'Chocolate milk or regular? I always pick chocolate.',
    ],
  },
  {
    id: 'coe-owen', name: 'Owen', role: 'Colony Oaks Elementary', where: 'in a Pre-K room at Colony Oaks Elementary',
    look: npcLook('luke', 1.05, '#f4d0ab', A(['tousled', '#caa24a'], ['tee', '#e0533c'], ['shorts', '#2f7fd1'], ['sneakers', '#35a84a'], ['none', ''])),
    day: { kind: 'wander', x: SU(81.6), z: SV(16.2), r: 1.3, period: 6 },
    night: { kind: 'wander', x: SU(81.6), z: SV(16.2), r: 1.3, period: 6 },
    lines: [
      "I builded a tower! It's THIS tall.",
      'We have a play kitchen. I made you soup.',
      "My teacher says I'm a good line leader.",
    ],
  },
  {
    id: 'coe-lily', name: 'Lily', role: 'Colony Oaks Elementary', where: 'walking the hall at Colony Oaks Elementary',
    look: npcLook('penny', 1.25, '#e9c39c', A(['bun', '#b5532a'], ['hoodie', '#8a5cc7'], ['athletic', '#2c2f3a'], ['sneakers', '#f2f2f0'], ['none', ''], ['backpack', '#2aa3a0'])),
    day: { kind: 'patrol', speed: 1.5, path: [[SU(70), SV(24.6)], [SU(124), SV(24.6)], [SU(124), SV(27.1)], [SU(70), SV(27.1)]] },
    night: { kind: 'patrol', speed: 1.5, path: [[SU(70), SV(24.6)], [SU(124), SV(24.6)], [SU(124), SV(27.1)], [SU(70), SV(27.1)]] },
    lines: [
      "I'm the hall monitor today. Walking feet, please!",
      'Follow the paw prints - they go all the way down the hall.',
      'Kindergarten is down at the end. The big kids are upstairs.',
    ],
  },
  {
    id: 'coe-jack', name: 'Jack', role: 'Colony Oaks Elementary', where: 'upstairs in 3rd grade at Colony Oaks Elementary',
    look: npcLook('luke', 1.34, '#b98a64', A(['short', '#3a2a1c'], ['longsleeve', '#2f7fd1'], ['jeans', '#1f2a44'], ['sneakers', '#1f1f1f'], ['none', ''], ['glasses', '#2c2f3a'])),
    day: { kind: 'wander', x: SU(7.4), z: SV(43), r: 1.3, period: 8, y: FLOOR2 },
    night: { kind: 'wander', x: SU(7.4), z: SV(43), r: 1.3, period: 8, y: FLOOR2 },
    lines: [
      'Third grade is the best grade. We get the upstairs!',
      "There's a secret way down - the steel stairs outside, at the end of the hall.",
      "The science lab is across the bridge. There's a skeleton in there!",
    ],
  },
  {
    id: 'coe-paige', name: 'Ms. Paige', role: 'Colony Oaks Elementary', where: 'at the library desk at Colony Oaks Elementary',
    look: npcLook('penny', 1.68, '#a8744e', A(['bun', '#1a1a1a'], ['longsleeve', '#1f2a5c'], ['skirt', '#35a84a'], ['sandals', '#1f1f1f'], ['none', ''], ['glasses', '#e8463f'])),
    day: { kind: 'post', x: SU(49.7), z: SV(31.1), yaw: 0 },
    night: { kind: 'post', x: SU(49.7), z: SV(31.1), yaw: 0 },
    lines: [
      'Welcome to the library! Readers are leaders.',
      'Shhh... just kidding. You can talk in here.',
      "The reading oak is everybody's favorite spot. It's why we're called Colony OAKS.",
    ],
  },
  {
    id: 'coe-lou', name: 'Chef Lou', role: 'Colony Oaks Elementary', where: 'in the kitchen at Colony Oaks Elementary',
    look: npcLook('dad', 1.8, '#c98f63', A(['buzz', '#8a8a8a'], ['tee', '#f6f2e8'], ['jeans', '#2c2f3a'], ['sneakers', '#1f1f1f'], ['beanie', '#f6f2e8'])),
    day: { kind: 'post', x: SU(91.3), z: SV(56), yaw: Math.PI / 2 },
    night: { kind: 'post', x: SU(91.3), z: SV(56), yaw: Math.PI / 2 },
    lines: [
      'Pizza, apples and milk today. Grab a tray!',
      "Secret ingredient? Extra cheese. Don't tell.",
      "You can come round the back and see the kitchen, just don't touch the ovens.",
    ],
  },
];
