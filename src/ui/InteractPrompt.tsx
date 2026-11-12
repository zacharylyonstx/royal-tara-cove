import { useGameStore } from '../state/gameStore';
import { usePlayStore } from '../state/playStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import { useZoneStore } from '../state/zoneStore';
import { useNetStore } from '../state/netStore';
import { isTouchDevice } from '../systems/touchInput';
import { friendLevel, heartBadge } from '../world/petStorage';
import { usePetStore } from '../state/petStore';
import { dogName, isDogZone } from '../world/pets';

const PLAY_LABELS: Record<string, string> = {
  ride: 'ride bike',
  drive: 'drive 🚗',
  getoff: 'get off',
  pickup: 'pick up ball',
};

export function InteractPrompt() {
  const hover = useGameStore((s) => s.hoverDoorId);
  const doors = useGameStore((s) => s.doors);
  const hoverPlay = usePlayStore((s) => s.hoverPlay);
  const hoverDresser = useWardrobeStore((s) => s.hoverDresser);
  const hoverZoneId = useZoneStore((s) => s.hoverId);
  const zoneInteractables = useZoneStore((s) => s.interactables);
  const me = useNetStore((s) => s.myCharacterId);
  const fallbackMe = useGameStore((s) => s.activeCharacterId);
  const meId = me ?? fallbackMe;
  const affection = useZoneStore((s) => s.affection);
  const myPup = usePetStore((s) => (meId ? s.pets[meId] : null));
  const treats = usePetStore((s) => s.treats);
  const ridingVehicle = usePlayStore((s) => (me ? s.riding[me]?.vehicle : undefined));
  const hoverSeat = usePlayStore((s) => s.hoverSeat);
  // On iPad the kid has no E key — show the on-screen button glyphs instead.
  const touch = isTouchDevice();

  // PlayerController publishes exactly ONE hover (best by distance + facing),
  // so at most one of these is set; the order here is just a tie-break.
  let label: string | null = null;
  let key = touch ? '✋' : 'E';
  if (hoverDresser) {
    label = 'open wardrobe 👗';
  } else if (hoverZoneId && zoneInteractables[hoverZoneId]) {
    label = zoneInteractables[hoverZoneId].label;
    const zk = zoneInteractables[hoverZoneId].kind;
    // A treat in hand changes what E does on any dog.
    const feeding = treats > 0 && (zk === 'pet' || zk === 'adopt') && isDogZone(hoverZoneId);
    if (feeding) label = `give ${dogName(hoverZoneId)} a treat 🦴`;
    // Friendship badge on pets: "pet Sparky 🐶 · ♥♥♡ Good Friend"
    if (zoneInteractables[hoverZoneId].kind === 'pet' && meId) {
      const n = affection[hoverZoneId]?.[meId] ?? 0;
      const lv = friendLevel(n);
      label = `${label} · ${heartBadge(lv.hearts)} ${lv.name}`;
      // Hold = "stay": Sparky goes home; your own pup returns to the pen.
      if (feeding) { /* keep the treat prompt short */ }
      else if (hoverZoneId === 'sparky') label += ` · hold ${key}: stay home`;
      else if (meId && hoverZoneId === `pup-${myPup ?? ''}`) label += ` · hold ${key}: back to pen`;
    }
  } else if (hoverPlay === 'shoot') {
    label = 'shoot';
    key = touch ? '⤴' : 'click';
  } else if (hoverPlay === 'hopin') {
    label = hoverSeat?.label ?? 'hop in 🚗';
  } else if (hoverPlay === 'getoff') {
    label = ridingVehicle === 'car' ? 'hop out' : 'get off';
  } else if (hoverPlay && PLAY_LABELS[hoverPlay]) {
    label = PLAY_LABELS[hoverPlay];
  } else if (hover) {
    label = doors[hover]?.open ? 'close door' : 'open door';
  }
  if (!label) return treats > 0 ? <TreatChip n={treats} /> : null;

  return (
    <>
    {treats > 0 && <TreatChip n={treats} />}
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 90,
        transform: 'translateX(-50%)',
        padding: '8px 16px',
        background: 'rgba(20, 30, 40, 0.7)',
        color: 'white',
        borderRadius: 10,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 16,
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <kbd
        style={{
          padding: '3px 10px',
          background: '#3a5a25',
          color: 'white',
          borderRadius: 6,
          fontWeight: 700,
          marginRight: 8,
        }}
      >
        {key}
      </kbd>
      {label}
    </div>
    </>
  );
}

/** "You're holding dog treats" — a little chip above the prompt. */
function TreatChip({ n }: { n: number }) {
  return (
    <div
      style={{
        position: 'fixed', left: '50%', bottom: 148, transform: 'translateX(-50%)',
        background: 'rgba(255,248,236,0.95)', color: '#7a4a1a', border: '2px solid #d9a866',
        padding: '4px 14px', borderRadius: 999, fontSize: 16, fontWeight: 800,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: '0 3px 10px rgba(0,0,0,0.25)', pointerEvents: 'none', zIndex: 60, whiteSpace: 'nowrap',
      }}
    >
      {'🦴'.repeat(n)} treats
    </div>
  );
}
