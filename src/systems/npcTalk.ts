import { useNpcStore } from '../state/npcStore';
import { useSkyStore } from '../state/skyStore';
import { usePetStore } from '../state/petStore';
import { npcById, type NpcDef } from '../world/npcs';
import { sunElevation, NPC_DUSK_BELOW_EL, NPC_HOME_BELOW_EL } from '../world/npcTime';
import { pupById } from '../world/pets';
import { CHARACTERS } from '../world/characters';
import { chatPop, cheerSound, petChime } from '../audio';
import { broadcastNpcSay } from '../net/room';
import type { CharacterId } from '../types';

// "Press E to talk." One function decides what an NPC says back:
//   1. I'm carrying something FOR them  → they thank me, I earn a helper star.
//   2. They have an errand and my hands are free → they ask me to deliver it.
//   3. Otherwise small talk — aware of dusk/night, my pup, and (if I'm carrying
//      something for somebody else) where that somebody is.

function smallTalk(def: NpcDef, by: CharacterId): string {
  const ns = useNpcStore.getState();
  const el = sunElevation(useSkyStore.getState().dayFraction);
  if (el < NPC_HOME_BELOW_EL && def.nightLines?.length) return def.nightLines[ns.nextLine(`${def.id}:n`, def.nightLines.length)];
  if (el < NPC_DUSK_BELOW_EL && def.duskLines?.length && Math.random() < 0.7) return def.duskLines[ns.nextLine(`${def.id}:d`, def.duskLines.length)];
  // Now and then, notice the kid's dog.
  const pup = pupById(usePetStore.getState().pets[by]);
  if (pup && Math.random() < 0.22) return `Oh, is that ${pup.name}? What a good ${pup.breed === 'pomeranian' ? 'little fluffball' : 'pup'}!`;
  if (Math.random() < 0.12) return `Hi, ${CHARACTERS[by].name}! Good to see you.`;
  return def.lines[ns.nextLine(def.id, def.lines.length)];
}

export function talkToNpc(zoneId: string, by: CharacterId): void {
  const def = npcById(zoneId.replace(/^npc-/, ''));
  if (!def) return;
  const ns = useNpcStore.getState();
  const carrying = ns.carrying;
  let text: string;

  if (carrying && carrying.toId === def.id) {
    // Delivered!
    const errand = npcById(carrying.errandId.split('-')[0])?.errands?.find((e) => e.id === carrying.errandId);
    text = errand?.thanks ?? 'For me? Thank you!';
    ns.markDone(carrying.errandId);
    ns.setCarrying(null);
    ns.addStar();
    cheerSound();
    petChime();
  } else if (!carrying) {
    const mine = def.errands ?? [];
    let open = mine.filter((e) => !ns.done[e.id] && !!npcById(e.to));
    if (open.length === 0 && mine.length > 0 && Math.random() < 0.5) {
      // Done them all — they come round again later.
      for (const e of mine) delete useNpcStore.getState().done[e.id];
      open = mine.filter((e) => !!npcById(e.to));
    }
    const errand = open.length > 0 ? open[0] : null;
    if (errand) {
      const to = npcById(errand.to)!;
      text = errand.ask;
      ns.setCarrying({ errandId: errand.id, item: errand.item, toId: to.id, toName: to.name, where: to.where });
      chatPop();
    } else {
      text = smallTalk(def, by);
      chatPop();
    }
  } else {
    // Carrying something for someone else: half the time, point the way.
    text = Math.random() < 0.55
      ? `That ${carrying.item} is for ${carrying.toName}? You'll find them ${carrying.where}.`
      : smallTalk(def, by);
    chatPop();
  }

  ns.say(def.id, text, by);
  void broadcastNpcSay(def.id, text, by);
}
