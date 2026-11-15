// The Schmorgesblob invasion plan: where they land and who comes when.
//
// Wave 1 pours out of the crashed saucer in 10600's back yard. After that the
// mothership starts dropping pods around the neighbourhood, so the fight moves
// off the driveway — up the street, across the neighbours' lawns — and nobody
// can just stand in one spot facing one way.
import type { BlobKind } from '../state/combatStore';

export type SpawnSiteId = 'backyard' | 'street' | 'east' | 'west';

export interface SpawnSite {
  id: SpawnSiteId;
  x: number;
  z: number;
  /** Kid-facing name for the "they're coming from…" callout. */
  label: string;
  /** The crashed saucer is already there; the others arrive as falling pods. */
  pod: boolean;
}

// 'backyard' is where the saucer crashes (components/aliens/UFOCrash.tsx reads it from here).
export const SPAWN_SITES: Record<SpawnSiteId, SpawnSite> = {
  backyard: { id: 'backyard', x: 0, z: 62, label: 'our back yard', pod: false },
  street: { id: 'street', x: 0, z: -44, label: 'up the street', pod: true },
  east: { id: 'east', x: 38, z: -12, label: 'behind the east houses', pod: true },
  west: { id: 'west', x: -32, z: -4, label: 'on the west lawn', pod: true },
};

export interface WaveGroup {
  site: SpawnSiteId;
  kind: BlobKind;
  count: number;
}

export interface WaveDef {
  /** Banner subtitle. */
  title: string;
  /** Game hour (0..24) the sky drifts to during this wave. */
  hour: number;
  groups: WaveGroup[];
}

export const WAVES: WaveDef[] = [
  {
    title: 'They crawl out of the saucer!',
    hour: 15.5,
    groups: [{ site: 'backyard', kind: 'hopper', count: 5 }],
  },
  {
    title: 'A pod landed up the street!',
    hour: 17.2,
    groups: [
      { site: 'street', kind: 'sprinter', count: 3 },
      { site: 'street', kind: 'hopper', count: 3 },
      { site: 'backyard', kind: 'hopper', count: 2 },
    ],
  },
  {
    title: 'Splitters — pop them twice!',
    hour: 18.6,
    groups: [
      { site: 'east', kind: 'splitter', count: 2 },
      { site: 'west', kind: 'splitter', count: 2 },
      { site: 'backyard', kind: 'sprinter', count: 2 },
      { site: 'backyard', kind: 'brute', count: 1 },
    ],
  },
  {
    title: 'They are everywhere!',
    hour: 19.45,
    groups: [
      { site: 'street', kind: 'brute', count: 1 },
      { site: 'street', kind: 'hopper', count: 3 },
      { site: 'east', kind: 'sprinter', count: 2 },
      { site: 'west', kind: 'sprinter', count: 2 },
      { site: 'backyard', kind: 'splitter', count: 2 },
      { site: 'backyard', kind: 'brute', count: 1 },
    ],
  },
  {
    title: 'THE BIG ONE',
    hour: 20.3,
    groups: [
      { site: 'backyard', kind: 'boss', count: 1 },
      { site: 'backyard', kind: 'hopper', count: 3 },
      { site: 'street', kind: 'sprinter', count: 2 },
    ],
  },
];

export const WAVE_COUNT = WAVES.length;

/** The landing sites a wave uses (in first-use order). */
export function sitesForWave(waveIndex: number): SpawnSiteId[] {
  const def = WAVES[waveIndex - 1];
  if (!def) return [];
  const out: SpawnSiteId[] = [];
  for (const g of def.groups) if (!out.includes(g.site)) out.push(g.site);
  return out;
}

/**
 * The spawn order for a wave: sites take turns so every portal is busy at once,
 * and a bigger family gets a bigger wave (the boss never multiplies).
 */
export function spawnQueueFor(waveIndex: number, players: number): { site: SpawnSiteId; kind: BlobKind }[] {
  const def = WAVES[waveIndex - 1];
  if (!def) return [];
  const mult = players >= 3 ? 1.6 : players === 2 ? 1.3 : 1;
  const perSite = new Map<SpawnSiteId, BlobKind[]>();
  for (const g of def.groups) {
    const n = g.kind === 'boss' ? g.count : Math.max(g.count, Math.round(g.count * mult));
    const list = perSite.get(g.site) ?? [];
    for (let i = 0; i < n; i++) list.push(g.kind);
    perSite.set(g.site, list);
  }
  const out: { site: SpawnSiteId; kind: BlobKind }[] = [];
  let more = true;
  while (more) {
    more = false;
    for (const [site, list] of perSite) {
      const kind = list.shift();
      if (kind) { out.push({ site, kind }); more = true; }
    }
  }
  return out;
}
