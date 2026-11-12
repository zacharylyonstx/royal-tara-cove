// The townsfolk of Royal Tara Cove (Free Play): neighbours, shopkeepers, and the
// staff + students of the school. All fictional. Pure data + a pure planner:
// "where should NPC X be at real-second T?" — the same answer on every client.
import type { CharacterId } from '../types';
import type { Appearance } from './wardrobe';
import { hash01 } from './npcTime';
import { CART_X, CART_Z, DOCK_END_Z, DOCK_Y, GARDEN_HOMES, PEN_X, PLAYGROUND_X, PLAYGROUND_Z, POND_X } from './acrossBlvd';
import { SCHOOL_NPCS } from './schoolNpcs';

export type NpcPlace =
  /** Stands (or sits) at one spot. */
  | { kind: 'post'; x: number; z: number; y?: number; yaw: number; sit?: boolean }
  /** Walks a closed loop at a steady pace. */
  | { kind: 'patrol'; path: [number, number][]; speed: number }
  /** Potters about a spot, picking a new place to stand every `period` s. */
  | { kind: 'wander'; x: number; z: number; r: number; period: number; y?: number }
  /** A pupil: desk during lessons, playground at recess. */
  | { kind: 'student'; seat: [number, number, number]; recess: [number, number, number] };

export interface NpcLook {
  /** Which family rig to borrow face details from ('dad' = bearded). */
  base: CharacterId;
  height: number;
  skin: string;
  appearance: Appearance;
}

export interface Errand {
  id: string;
  item: string;
  /** NPC id to deliver to. */
  to: string;
  ask: string;
  thanks: string;
}

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  look: NpcLook;
  day: NpcPlace;
  /** After dark: a place to be, or 'home' = walk to `home` and go indoors. */
  night: NpcPlace | 'home';
  home?: [number, number];
  /** "…at the school", for errand directions. */
  where: string;
  lines: string[];
  duskLines?: string[];
  nightLines?: string[];
  errands?: Errand[];
}

const A = (
  hair: [string, string], top: [string, string], bottom: [string, string], shoes: [string, string],
  hat: [string, string] = ['none', ''], accessory: [string, string] = ['none', ''],
): Appearance => ({
  hair: { item: hair[0], color: hair[1] }, top: { item: top[0], color: top[1] },
  bottom: { item: bottom[0], color: bottom[1] }, shoes: { item: shoes[0], color: shoes[1] },
  hat: { item: hat[0], color: hat[1] }, accessory: { item: accessory[0], color: accessory[1] },
});
export const npcLook = (base: CharacterId, height: number, skin: string, appearance: Appearance): NpcLook => ({ base, height, skin, appearance });
export const npcAppearance = A;

const bakery = GARDEN_HOMES.find((h) => h.bakery) ?? GARDEN_HOMES[0];

const NEIGHBOURS: NpcDef[] = [
  {
    id: 'hank', name: 'Mr. Hank', role: 'neighbor', where: 'in his front yard on Royal Tara',
    look: npcLook('dad', 1.78, '#d9a877', A(['buzz', '#d8d4cc'], ['plaid', '#b03a2e'], ['jeans', '#3a4d6b'], ['boots', '#5a3a22'], ['cowboy', '#c9a26b'])),
    day: { kind: 'wander', x: 9.2, z: -62, r: 2.2, period: 14 }, night: 'home', home: [12.6, -62],
    lines: [
      'Howdy, neighbor! Lawn looks good this year, doesn\'t it?',
      'I\'ve lived on Royal Tara longer than anybody. Best street in Austin.',
      'You kids ride safe now — watch for cars at the boulevard.',
      'That Sparky is a good dog. Give him a pat for me.',
      'Hot one today. Good day for ice cream down by the pond!',
    ],
    duskLines: ['Sun\'s going down. I\'m fixin\' to head inside — you should too.'],
    errands: [
      { id: 'hank-tomatoes', item: '🍅', to: 'dot', ask: 'Would you run these garden tomatoes over to Ms. Dot at the bakery on Casitas? She makes a fine tomato pie.', thanks: 'Hank\'s tomatoes! Bless him. Tell him pie\'s on Friday.' },
      { id: 'hank-wrench', item: '🔧', to: 'ramos', ask: 'Coach borrowed my wrench for the goal posts and then I borrowed it back. Take it to him at the school, would you?', thanks: 'The wrench! Now I can fix that wobbly goal. Thanks, champ!' },
    ],
  },
  {
    id: 'otis', name: 'Mr. Otis', role: 'mail carrier', where: 'walking his mail route on Royal Tara',
    look: npcLook('luke', 1.74, '#8a5a3c', A(['short', '#1a1a1a'], ['longsleeve', '#6d8fc0'], ['shorts', '#3a4d6b'], ['sneakers', '#1f1f1f'], ['cap', '#3a4d6b'], ['backpack', '#3a6db0'])),
    day: { kind: 'patrol', speed: 1.55, path: [[5.7, -170], [5.7, -26], [-5.7, -26], [-5.7, -170]] },
    night: 'home', home: [5.7, -178],
    lines: [
      'Mail\'s here! Twenty-five houses, rain or shine.',
      'Morning! Anything for the Lyons house? Let me check my bag…',
      'I walk this whole street every day. Keeps me young!',
      'Careful on that bike ramp — I\'ve seen some big jumps off it.',
    ],
    duskLines: ['Last house, then I\'m done before dark. You head in soon too!'],
    errands: [
      { id: 'otis-letter', item: '✉️', to: 'bell', ask: 'This letter\'s for Principal Bell at the school and my route doesn\'t go that far. Could you deliver it?', thanks: 'A letter, hand-delivered! You\'re an honorary mail carrier.' },
      { id: 'otis-parcel', item: '📦', to: 'wren', ask: 'Got a parcel of puppy toys for Miss Wren at Woof Gang. Mind dropping it off?', thanks: 'The squeaky toys! The Pomeranians are going to lose their minds.' },
    ],
  },
  {
    id: 'jules', name: 'Jules', role: 'jogger', where: 'jogging along Avery Ranch Blvd',
    look: npcLook('penny', 1.68, '#e8b98f', A(['ponytail', '#caa24a'], ['tank', '#3aa6a0'], ['athletic', '#2c2f3a'], ['sneakers', '#e8463f'], ['headband', '#f6c945'])),
    day: { kind: 'patrol', speed: 3.3, path: [[-112, -190.4], [48, -190.4], [48, -176.8], [-112, -176.8]] },
    night: 'home', home: [48, -176.8],
    lines: [
      'Whew! Three laps of the boulevard. Want to race to the pond?',
      'Hydrate, hydrate, hydrate! That\'s my motto.',
      'I love this trail in the morning — you can hear the ducks.',
      'Nice running form! Keep those knees up.',
    ],
    duskLines: ['Last lap! I don\'t run after dark around here… you know why.'],
  },
  {
    id: 'sam', name: 'Scoops Sam', role: 'ice cream cart', where: 'at the ice cream cart by the pond',
    look: npcLook('luke', 1.72, '#f1cca4', A(['curly', '#5a3216'], ['stripe', '#e26aa1'], ['shorts', '#f6f2e8'], ['sneakers', '#ffffff'], ['cap', '#f6f2e8'])),
    day: { kind: 'post', x: CART_X + 1.7, z: CART_Z + 0.9, yaw: 0.6 }, night: 'home', home: [CART_X + 4, CART_Z + 2],
    lines: [
      'Ice cream! Get your ice cream! Press E at the cart, it\'s on the house.',
      'Today\'s special is strawberry. Or was it mint? I ate the sign.',
      'The ducks keep asking for sprinkles. I keep saying no.',
    ],
    duskLines: ['Closing up the cart for the night. Come back tomorrow!'],
    errands: [
      { id: 'sam-cone', item: '🍦', to: 'gus', ask: 'Captain Gus on the dock ordered a vanilla cone and it\'s melting! Quick, take it to him!', thanks: 'My cone! Only a little melted. You\'re a lifesaver.' },
    ],
  },
  {
    id: 'gus', name: 'Captain Gus', role: 'duck feeder', where: 'at the end of the dock on the pond',
    look: npcLook('dad', 1.76, '#e3b98c', A(['short', '#d8d4cc'], ['longsleeve', '#f6f2e8'], ['cargo', '#6b7280'], ['boots', '#2c2f3a'], ['beanie', '#3a6db0'])),
    day: { kind: 'post', x: POND_X, z: DOCK_END_Z + 0.9, y: DOCK_Y, yaw: 0 }, night: 'home', home: [POND_X, -199.5],
    lines: [
      'Ahoy! These ducks know me. That one\'s Admiral Quackers.',
      'You can wade right in, you know. The ducks love a pat.',
      'Forty years at sea, and now I captain a duck pond. Best job yet.',
      'Shh… watch the water. There\'s a turtle in here somewhere.',
    ],
    duskLines: ['Ducks are tucking in for the night. So should we, sailor.'],
    errands: [
      { id: 'gus-bread', item: '🥖', to: 'lou', ask: 'I\'ve too much duck bread. Take this loaf to Chef Lou in the school cafeteria, would you?', thanks: 'Fresh bread! This is going straight into tomorrow\'s lunch.' },
    ],
  },
  {
    id: 'dot', name: 'Ms. Dot', role: 'baker', where: 'at Little Twist Bakery on Casitas',
    look: npcLook('penny', 1.62, '#c98f63', A(['bun', '#2a1c12'], ['dress', '#f6c945'], ['skirt', '#f6c945'], ['sandals', '#f6f2e8'], ['bow', '#e8463f'])),
    day: { kind: 'wander', x: bakery.x, z: bakery.z + 4.4, r: 1.3, period: 11 }, night: 'home', home: [bakery.x, bakery.z + 3.2],
    lines: [
      'Welcome to Little Twist! Everything\'s baked right here at home.',
      'Cinnamon twists come out of the oven at four. Don\'t be late!',
      'The secret ingredient is butter. The other secret is more butter.',
      'You look like a cookie kind of kid. Am I right?',
    ],
    duskLines: ['Ovens are off. I\'m locking up before it gets dark out.'],
    errands: [
      { id: 'dot-cookies', item: '🍪', to: 'hank', ask: 'Mr. Hank fixed my fence, so I owe him cookies. Could you take this box to him on Royal Tara?', thanks: 'Dot\'s cookies! Well I\'ll be. You want one? …I ate it. Sorry.' },
      { id: 'dot-cupcakes', item: '🧁', to: 'marigold', ask: 'It\'s a birthday in Ms. Marigold\'s class! Carry these cupcakes to her classroom at the school — carefully!', thanks: 'Cupcakes! The class is going to cheer. Thank you!' },
    ],
  },
  {
    id: 'wren', name: 'Miss Wren', role: 'Woof Gang', where: 'at Woof Gang in the Plaza',
    look: npcLook('penny', 1.66, '#f4d0ab', A(['long', '#b5532a'], ['hoodie', '#3a6db0'], ['jeans', '#2b2f3a'], ['hightops', '#f6c945'], ['none', ''], ['bandana', '#e8463f'])),
    day: { kind: 'post', x: PEN_X - 2.5, z: -201.0, yaw: Math.PI / 2 }, night: { kind: 'post', x: PEN_X - 2.5, z: -201.0, yaw: Math.PI / 2 },
    lines: [
      'Welcome to Woof Gang! Every pup here is looking for a best friend.',
      'Grab treats from the jar and give one to a dog — they\'ll do a trick!',
      'The Pomeranians are Peaches, Snowball and Bear. All fluff, no brakes.',
      'Hold E on your own pup if you want it to go back to its pen.',
    ],
    nightLines: ['We\'re safe under the awning. The pups and I are staying right here till morning.'],
    errands: [
      { id: 'wren-biscuits', item: '🦴', to: 'hank', ask: 'Mr. Hank ordered biscuits for the neighborhood dogs. Could you run this bag over to him on Royal Tara?', thanks: 'Dog biscuits! Sparky\'s going to be my best friend now.' },
    ],
  },
  {
    id: 'maya', name: 'Maya', role: 'neighbor kid', where: 'at the playground by the pond',
    look: npcLook('penny', 1.3, '#b9825a', A(['curly', '#1a1a1a'], ['tee', '#7a52c8'], ['leggings', '#3aa6a0'], ['sneakers', '#ffffff'], ['none', ''], ['backpack', '#f6c945'])),
    day: { kind: 'wander', x: PLAYGROUND_X + 1, z: PLAYGROUND_Z + 6, r: 3.2, period: 7 }, night: 'home', home: [PLAYGROUND_X + 6, PLAYGROUND_Z + 9],
    lines: [
      'Tag! You\'re it! …Okay, I\'m it. Okay nobody\'s it.',
      'Did you know you can pet the ducks? They like it!',
      'My favorite is the slide. What\'s yours?',
      'I\'m going to be a vet when I grow up. Or a dragon.',
    ],
    duskLines: ['Streetlights are on — that means go home! Bye!'],
  },
];

/** Everyone in town. */
export const NPCS: NpcDef[] = [...NEIGHBOURS, ...SCHOOL_NPCS];

export function npcById(id: string): NpcDef | undefined {
  return NPCS.find((n) => n.id === id);
}

// ---------------------------------------------------------------- planner --

/** Lessons and recess alternate on this beat (real seconds): two periods of
 *  class, then one of recess. */
export const SCHOOL_PERIOD_S = 80;
export function isRecess(T: number): boolean {
  return Math.floor(T / SCHOOL_PERIOD_S) % 3 === 2;
}

export interface NpcPlan {
  x: number; z: number; y: number;
  /** Facing to settle into on arrival (null = face the way you walked). */
  yaw: number | null;
  sit: boolean;
  /** Walk here, then vanish indoors. */
  hide: boolean;
  /** Preferred walking speed (m/s). */
  speed: number;
}

function planPlace(p: NpcPlace, T: number, salt: number): NpcPlan {
  switch (p.kind) {
    case 'post':
      return { x: p.x, z: p.z, y: p.y ?? 0, yaw: p.yaw, sit: !!p.sit, hide: false, speed: 1.5 };
    case 'wander': {
      const k = Math.floor(T / p.period);
      const a = hash01(k, salt) * Math.PI * 2;
      const r = Math.sqrt(hash01(k + 17, salt)) * p.r;
      return { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, y: p.y ?? 0, yaw: null, sit: false, hide: false, speed: 1.3 };
    }
    case 'patrol': {
      const pts = p.path;
      let total = 0;
      const seg: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const b = pts[(i + 1) % pts.length];
        const d = Math.hypot(b[0] - pts[i][0], b[1] - pts[i][1]);
        seg.push(d); total += d;
      }
      let s = ((T * p.speed + salt * 37) % total + total) % total;
      for (let i = 0; i < pts.length; i++) {
        if (s <= seg[i]) {
          const b = pts[(i + 1) % pts.length];
          const k = seg[i] > 0 ? s / seg[i] : 0;
          return { x: pts[i][0] + (b[0] - pts[i][0]) * k, z: pts[i][1] + (b[1] - pts[i][1]) * k, y: 0, yaw: null, sit: false, hide: false, speed: p.speed };
        }
        s -= seg[i];
      }
      return { x: pts[0][0], z: pts[0][1], y: 0, yaw: null, sit: false, hide: false, speed: p.speed };
    }
    case 'student': {
      if (isRecess(T)) {
        const k = Math.floor(T / 6);
        const a = hash01(k, salt) * Math.PI * 2;
        const r = Math.sqrt(hash01(k + 5, salt)) * p.recess[2];
        return { x: p.recess[0] + Math.cos(a) * r, z: p.recess[1] + Math.sin(a) * r, y: 0, yaw: null, sit: false, hide: false, speed: 2.6 };
      }
      return { x: p.seat[0], z: p.seat[1], y: 0, yaw: p.seat[2], sit: true, hide: false, speed: 2.0 };
    }
  }
}

/** Where should this NPC be heading right now? */
export function planNpc(def: NpcDef, index: number, T: number, night: boolean): NpcPlan {
  if (night) {
    if (def.night === 'home') {
      const h = def.home ?? [0, 0];
      return { x: h[0], z: h[1], y: 0, yaw: null, sit: false, hide: true, speed: 2.4 };
    }
    return planPlace(def.night, T, index + 1);
  }
  return planPlace(def.day, T, index + 1);
}
