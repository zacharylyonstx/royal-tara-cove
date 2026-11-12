// Rutledge Elementary's people: staff at their posts, and six pupils who sit
// in class, pour out to the playground at recess, and (because Siren Head owns
// the street after dark) camp out inside for a school sleepover at night.
//
// Positions inside the building are written in world/school.ts's authoring
// frame and slid to the real site with schoolX().
import type { NpcDef, NpcPlace } from './npcs';
import { npcAppearance as A, npcLook } from './npcLook';
import { schoolX, CLASSA_DESK_ZS, CLASSB_DESK_ZS, DESK_ROW_XS, CHAIR_DX, SCHOOL_DOOR_Z } from './school';
import { CAMPUS } from './westAvery';

const W = Math.PI / 2;   // facing west (toward the whiteboards)
const E = -Math.PI / 2;  // facing east (toward the front door)
const post = (x: number, z: number, yaw: number, sit = false): NpcPlace => ({ kind: 'post', x: schoolX(x), z, yaw, sit });

/** Just outside the front door (world). */
const FRONT_OUT: [number, number] = [schoolX(-64.4), SCHOOL_DOOR_Z];
/** Seat → classroom door → hall → out the front. */
const routeA: [number, number][] = [[schoolX(-86), -211.2], [schoolX(-86), -208], FRONT_OUT];
const routeB: [number, number][] = [[schoolX(-86), -204.8], [schoolX(-86), -208], FRONT_OUT];
const routeHall: [number, number][] = [[schoolX(-67.6), SCHOOL_DOOR_Z], FRONT_OUT];

const STAFF: NpcDef[] = [
  {
    id: 'bell', name: 'Principal Bell', role: 'principal', where: 'in the front hall at Rutledge Elementary',
    look: npcLook('penny', 1.7, '#a8744e', A(['bun', '#1a1a1a'], ['suit', '#1f3a5f'], ['skirt', '#1f3a5f'], ['sandals', '#1f1f1f'], ['none', ''], ['glasses', '#2c2f3a'])),
    day: post(-68.4, -208.9, E), night: post(-68.4, -208.9, E),
    lines: [
      'Welcome to Rutledge Elementary! Walk, please — no running in the halls.',
      'We\'re a Leader in Me school. What kind of leader will you be today?',
      'Classrooms are down the hall, the cafeteria\'s on the right, library on the left.',
      'Recess is out front, across Staked Plains. Mind the crossing guard!',
    ],
    nightLines: ['It\'s our school sleepover! Everyone is safe inside until the sun comes up.', 'Lights out soon. Did you bring a sleeping bag?'],
    errands: [
      { id: 'bell-trophy', item: '🏆', to: 'ramos', ask: 'The field-day trophy arrived! Would you carry it out to Coach Ramos on the field?', thanks: 'The trophy! Field day is ON. You\'re team captain today.' },
    ],
  },
  {
    id: 'marigold', name: 'Ms. Marigold', role: 'teacher', where: 'in her classroom at Rutledge (down the hall, on the right)',
    look: npcLook('penny', 1.64, '#f1cca4', A(['long', '#caa24a'], ['longsleeve', '#f6c945'], ['skirt', '#3aa6a0'], ['sneakers', '#ffffff'], ['none', ''], ['glasses', '#e8463f'])),
    day: post(-85.6, -213.2, E), night: post(-85.6, -213.2, E),
    lines: [
      'Good morning, class! Today we\'re learning about Texas wildflowers.',
      'Can you spell "bluebonnet"? B-L-U-E… you finish it!',
      'Find a seat anywhere. We raise our hands in here.',
      'Story time is after recess. I\'m thinking… dragons.',
    ],
    nightLines: ['Shh — sleepover story time. Once upon a time, on a cul-de-sac in Austin…'],
    errands: [
      { id: 'marigold-books', item: '📚', to: 'page', ask: 'These books are overdue! Could you return them to Mr. Page in the library across the hall?', thanks: 'Overdue books, returned! No fine for helpers.' },
    ],
  },
  {
    id: 'flores', name: 'Mr. Flores', role: 'teacher', where: 'in his classroom at Rutledge (down the hall, on the left)',
    look: npcLook('dad', 1.8, '#c98f63', A(['short', '#2a1c12'], ['stripe', '#3a6db0'], ['jeans', '#2b2f3a'], ['sneakers', '#1f1f1f'])),
    day: post(-85.6, -202.8, E), night: post(-85.6, -202.8, E),
    lines: [
      'Math time! If Sparky has 3 treats and eats 2… how hungry is Sparky?',
      'Science fair is coming. Volcano or robot? Tough choice.',
      'High five! That\'s the Rutledge way.',
      'Who can tell me how many houses are on Royal Tara Cove? …Twenty-five!',
    ],
    nightLines: ['Sleepover science: how many marshmallows fit in a cup of cocoa? Let\'s find out.'],
    errands: [
      { id: 'flores-lunch', item: '🥪', to: 'stan', ask: 'Mr. Stan the crossing guard forgot his lunch. Could you run it out to him at the crosswalk?', thanks: 'My sandwich! I was getting hungry out here. Thank you!' },
    ],
  },
  {
    id: 'page', name: 'Mr. Page', role: 'librarian', where: 'in the library at Rutledge',
    look: npcLook('luke', 1.75, '#e9c39c', A(['tousled', '#b5532a'], ['hoodie', '#7a52c8'], ['cargo', '#6b7280'], ['sneakers', '#3a6db0'], ['none', ''], ['glasses', '#2c2f3a'])),
    day: post(-70.5, -203.4, 0), night: post(-70.5, -203.4, 0),
    lines: [
      'Welcome to the library. Every book in here is an adventure.',
      'Looking for something? Dinosaurs are on the left, dragons on the right.',
      'Quiet voices, big imaginations.',
    ],
    nightLines: ['Flashlight reading under a blanket — the best kind of reading.'],
  },
  {
    id: 'lou', name: 'Chef Lou', role: 'cafeteria', where: 'in the cafeteria at Rutledge',
    look: npcLook('dad', 1.72, '#8a5a3c', A(['buzz', '#1a1a1a'], ['tee', '#f6f2e8'], ['jeans', '#2c2f3a'], ['sneakers', '#1f1f1f'], ['beanie', '#f6f2e8'])),
    day: post(-72.6, -213.8, Math.PI), night: post(-72.6, -213.8, Math.PI),
    lines: [
      'Lunch today: pizza, apples, and chocolate milk. Best menu all week!',
      'Trays on the left, forks on the right, smiles in the middle.',
      'I make four hundred lunches a day. Four hundred!',
    ],
    nightLines: ['Sleepover snacks! Popcorn\'s popping and the cocoa is hot.'],
    errands: [
      { id: 'lou-apples', item: '🍎', to: 'marigold', ask: 'An apple for the teacher! Take this basket to Ms. Marigold\'s classroom for me.', thanks: 'Apples from Chef Lou! One for every student. How sweet.' },
    ],
  },
  {
    id: 'ramos', name: 'Coach Ramos', role: 'P.E. coach', where: 'on the field at Rutledge Elementary',
    look: npcLook('dad', 1.82, '#b9825a', A(['short', '#2a1c12'], ['jersey', '#e8463f'], ['athletic', '#2c2f3a'], ['cleats', '#f6f2e8'], ['cap', '#e8463f'])),
    day: { kind: 'wander', x: CAMPUS.field.x - 6, z: CAMPUS.field.z + 2, r: 4, period: 12 },
    night: post(-73.5, -207.2, 0), route: routeHall,
    lines: [
      'Hustle, hustle! Two laps of the track and then free play!',
      'Great form! Have you tried the basketball court?',
      'Field day is the best day. Don\'t tell the other days.',
      'Drink water! Texas sun doesn\'t play around.',
    ],
    duskLines: ['Whistle\'s blown — everybody inside before it gets dark!'],
    nightLines: ['Sleepover rule one: no dodgeball in the hallway. …Okay, a little dodgeball.'],
  },
  {
    id: 'stan', name: 'Mr. Stan', role: 'crossing guard', where: 'at the crosswalk on Staked Plains Dr, by the school',
    look: npcLook('dad', 1.76, '#e3b98c', A(['buzz', '#d8d4cc'], ['longsleeve', '#f6c945'], ['jeans', '#3a4d6b'], ['boots', '#2c2f3a'], ['cap', '#f0883a'])),
    day: { kind: 'post', x: -226.4, z: -194.6, yaw: W }, night: post(-67.2, -206.6, W), route: routeHall,
    lines: [
      'Hold up — look both ways! …Okay, all clear. Cross on over.',
      'I\'ve been the crossing guard here for eleven years. Not one scraped knee.',
      'Hear that bell at the tracks? Always wait for the gates to go up.',
      'Bikes walk across the crosswalk. Them\'s the rules!',
    ],
    duskLines: ['Getting dark. Last crossing of the day — let\'s get you inside.'],
    nightLines: ['I\'m guarding the front door tonight. Nothing gets past Stan.'],
  },
];

const kid = (
  id: string, name: string, height: number, skin: string, look: ReturnType<typeof A>, base: 'luke' | 'penny',
  seat: [number, number], cls: 'A' | 'B', sleep: [number, number], lines: string[],
): NpcDef => ({
  id, name, role: 'student', where: 'at Rutledge Elementary',
  look: npcLook(base, height, skin, look),
  day: { kind: 'student', seat: [schoolX(seat[0]), seat[1], W], recess: [CAMPUS.playground.x + 1.5, CAMPUS.playground.z + 6.5, 5.5] },
  night: { kind: 'post', x: schoolX(sleep[0]), z: sleep[1], yaw: E, sit: true },
  route: cls === 'A' ? routeA : routeB,
  lines,
  nightLines: ['Best. Sleepover. Ever.', 'I heard Siren Head can\'t come inside. Right? …Right?', 'Want to tell spooky stories? Not TOO spooky.'],
});
const chairX = (row: number) => DESK_ROW_XS[row] + CHAIR_DX;

const STUDENTS: NpcDef[] = [
  kid('zoe', 'Zoe', 1.28, '#8a5a3c', A(['curly', '#1a1a1a'], ['tee', '#f6c945'], ['skirt', '#7a52c8'], ['sneakers', '#ffffff'], ['bow', '#e26aa1']), 'luke',
    [chairX(0), CLASSA_DESK_ZS[0]], 'A', [-74.6, -212.6], ['I love art class! I painted a horse. It looks like a potato.', 'Wanna be on my team at recess?', 'Ms. Marigold is the nicest teacher.']),
  kid('kai', 'Kai', 1.2, '#e3b98c', A(['tousled', '#2a1c12'], ['jersey', '#3aa6a0'], ['shorts', '#2c2f3a'], ['cleats', '#e8463f']), 'luke',
    [chairX(0), CLASSA_DESK_ZS[1]], 'A', [-72.8, -211.4], ['I can run the whole track without stopping!', 'Did you see the train? I counted the cars. Two.', 'My dog knows three tricks. Does yours?']),
  kid('ruby', 'Ruby', 1.32, '#f4d0ab', A(['ponytail', '#b5532a'], ['hoodie', '#e8463f'], ['leggings', '#2c2f3a'], ['hightops', '#f6c945'], ['none', ''], ['backpack', '#3a6db0']), 'penny',
    [chairX(1), CLASSA_DESK_ZS[2]], 'A', [-70.6, -212.8], ['I\'m reading a book about a girl detective. Don\'t spoil it!', 'The library has a secret reading corner. Shh.', 'Recess is my favorite subject.']),
  kid('finn', 'Finn', 1.16, '#f1cca4', A(['buzz', '#caa24a'], ['stripe', '#5cb85c'], ['cargo', '#6b7280'], ['sneakers', '#3a6db0'], ['cap', '#3a6db0']), 'luke',
    [chairX(0), CLASSB_DESK_ZS[0]], 'B', [-69.2, -211.6], ['I built a LEGO rocket this big. No, THIS big.', 'Mr. Flores does the best high fives.', 'Is it lunch yet? Is it lunch yet now?']),
  kid('amara', 'Amara', 1.3, '#6b4630', A(['bun', '#1a1a1a'], ['dress', '#3aa6a0'], ['leggings', '#f6f2e8'], ['sandals', '#f6c945'], ['headband', '#f6c945']), 'luke',
    [chairX(1), CLASSB_DESK_ZS[1]], 'B', [-73.6, -203.4], ['I know all the planets. Even the tiny ones.', 'We have a class hamster named Taco.', 'Do you live on Royal Tara? I\'ve seen your bikes!']),
  kid('leo', 'Leo', 1.24, '#c98f63', A(['short', '#2a1c12'], ['tee', '#f0883a'], ['jeans', '#3a4d6b'], ['sneakers', '#1f1f1f'], ['none', ''], ['glasses', '#2c2f3a']), 'luke',
    [chairX(0), CLASSB_DESK_ZS[2]], 'B', [-71.4, -202.6], ['I\'m going to be a train driver. Choo choo!', 'Coach says I\'m the fastest. Second fastest. Top five.', 'Have you pet the ducks at the pond? They quack back.']),
];

export const SCHOOL_NPCS: NpcDef[] = [...STAFF, ...STUDENTS];
