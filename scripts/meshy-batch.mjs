#!/usr/bin/env node
// Batch driver: generates the full Phase-1 + augments model set by spawning
// meshy-gen.mjs children with bounded concurrency. Idempotent — skips any slug
// whose .glb already exists, so it's safe to re-run after partial failures.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const OUT = 'public/assets/models';
const CONCURRENCY = 4;

// stylized low-poly, single-object prompts. Neutral light-gray base where the
// game tints per-instance at runtime (vehicles); baked color elsewhere.
const MODELS = [
  // — vegetation —
  { slug: 'oak', polycount: 4000, lowpoly: true, prompt: 'a stylized low poly Texas live oak tree, one thick gnarled brown trunk with a few spreading horizontal branches and a broad rounded multi-lobe green canopy, flat-shaded faceted foliage, single tree, game asset, upright, centered at origin' },
  { slug: 'crepemyrtle', polycount: 3500, lowpoly: true, prompt: 'a stylized low poly crepe myrtle tree, several slender smooth pale trunks and an airy rounded crown of soft pink blossom clusters, flat-shaded, single tree, game asset, upright, centered at origin' },
  { slug: 'shrub', polycount: 1200, lowpoly: true, prompt: 'a stylized low poly rounded evergreen boxwood shrub ball, mid-green flat-shaded foliage, single bush, game asset, centered at origin' },
  // — vehicles (neutral light-gray body, recolored at runtime) —
  { slug: 'truck', polycount: 6000, lowpoly: true, pbr: true, prompt: 'a stylized low poly pickup truck like a Ford F-150, friendly rounded cartoon proportions, four clearly separate wheels, simple dark tinted windows, a single flat light-gray body paint, game asset, facing -Z, resting flat on the ground, clean topology, single vehicle' },
  { slug: 'sedan', polycount: 6000, lowpoly: true, pbr: true, prompt: 'a stylized low poly four-door family sedan, smooth rounded silhouette, four separate wheels, dark tinted glass, a single flat light-gray body paint, game asset, facing -Z, resting flat on the ground, single vehicle' },
  { slug: 'bike', polycount: 4000, lowpoly: true, prompt: 'a stylized low poly kids BMX bicycle, chunky cartoon proportions, a single recolorable gray frame, round spoked wheels, handlebars and a seat, game asset, side profile, both wheels touching the ground, single object' },
  // — outdoor props —
  { slug: 'grill', polycount: 4000, lowpoly: true, pbr: true, prompt: 'a stainless steel propane backyard BBQ gas grill with a closed lid, two side shelves, control knobs, two wheels and a propane tank, stylized low poly game asset, single object' },
  { slug: 'patioset', polycount: 6000, lowpoly: true, prompt: 'an outdoor patio dining set: a round table with four chairs and an open canvas market umbrella, wicker and metal style, stylized low poly game asset, one grouped object about two meters wide' },
  { slug: 'trashbins', polycount: 3000, lowpoly: true, prompt: 'a pair of plastic wheelie curbside bins standing side by side, one green recycling bin and one dark gray trash bin, hinged lids and two rear wheels each, stylized low poly game asset, single grouped object' },
  { slug: 'gardenbed', polycount: 3000, lowpoly: true, prompt: 'a raised rectangular wooden garden bed planter filled with colorful flowers and dark mulch, stylized low poly game asset, about three meters long, single object' },
  { slug: 'basketballhoop', polycount: 3000, lowpoly: true, prompt: 'a portable driveway basketball hoop: a weighted base, an adjustable pole, a fan-shaped backboard with a red square, and an orange rim with a white hanging net, stylized low poly game asset, single object' },
  // — neighbor interior (composed from separate pieces) —
  { slug: 'sofa', polycount: 4000, lowpoly: true, prompt: 'a cozy low poly three-seat fabric sofa with back and seat cushions and armrests, neutral light-gray upholstery, stylized game asset, single object, facing +Z' },
  { slug: 'coffeetable', polycount: 2000, lowpoly: true, prompt: 'a low poly rectangular wooden coffee table with a couple of books stacked on top, stylized game asset, single object' },
  { slug: 'tv', polycount: 2000, lowpoly: true, prompt: 'a low poly flat-screen television sitting on a low wooden media console stand, black screen, stylized game asset, single object, facing +Z' },
  { slug: 'floorlamp', polycount: 1500, lowpoly: true, prompt: 'a low poly floor lamp with a round base, a tall slim stand and a conical fabric shade, stylized game asset, single object' },
  { slug: 'houseplant', polycount: 1500, lowpoly: true, prompt: 'a low poly potted houseplant, a leafy green plant in a terracotta pot, stylized game asset, single object' },
  // — hero interior augments —
  { slug: 'fridge', polycount: 2500, lowpoly: true, pbr: true, prompt: 'a low poly stainless steel double-door refrigerator with handles, stylized game asset, single object, facing +Z' },
  { slug: 'stove', polycount: 2500, lowpoly: true, pbr: true, prompt: 'a low poly kitchen stove range with an oven door, control knobs and four burners on top, stainless and black, stylized game asset, single object, facing +Z' },
  { slug: 'barstool', polycount: 1500, lowpoly: true, prompt: 'a low poly modern bar stool with a round padded seat, a footrest ring and four metal legs, stylized game asset, single object' },
  { slug: 'bookshelf', polycount: 3000, lowpoly: true, prompt: 'a low poly tall wooden bookshelf with several shelves filled with rows of colorful books, stylized game asset, single object, facing +Z' },
  // — pickups & set-pieces —
  { slug: 'gnome', polycount: 3000, lowpoly: true, prompt: 'a cute low poly garden gnome with a tall red pointed hat, a bushy white beard, a blue coat and brown boots, stylized game asset, single object, standing upright' },
  { slug: 'milk', polycount: 2000, lowpoly: true, prompt: 'a cute classic clear glass milk bottle full of white milk, short and chubby with a rounded shoulder, soft rounded cartoon style, stylized low poly game asset, single object' },
  { slug: 'bonuscookie', polycount: 2500, lowpoly: true, prompt: 'an oversized golden brown chocolate-chip cookie with melty dark chocolate chips, glossy appetizing cartoon style, stylized low poly game asset, single round object' },
  { slug: 'ufo', polycount: 6000, lowpoly: true, pbr: true, prompt: 'a classic chrome flying saucer UFO, a flattened metallic disc body, a glowing dome glass cockpit with a small green alien silhouette inside, a ring of round lights around the rim and three landing legs, retro sci-fi, stylized low poly game asset, single object' },
  { slug: 'bossbody', polycount: 5000, lowpoly: true, prompt: 'a giant menacing alien blob boss, a translucent glowing green dome body with a wide toothy maw underneath, slimy bioluminescent, stylized cartoon, kid-friendly not gory, low poly game asset, single object' },
];

function genOne(m) {
  return new Promise((resolve) => {
    if (existsSync(`${OUT}/${m.slug}.glb`)) {
      console.log(`[skip ] ${m.slug} (already exists)`);
      return resolve({ slug: m.slug, ok: true, skipped: true });
    }
    const args = ['scripts/meshy-gen.mjs', '--slug', m.slug, '--prompt', m.prompt,
      '--polycount', String(m.polycount || 8000), '--out', OUT];
    if (m.lowpoly) args.push('--lowpoly');
    if (m.pbr) args.push('--pbr');
    if (m.previewOnly) args.push('--preview-only');
    if (m.texturePrompt) args.push('--texture-prompt', m.texturePrompt);
    console.log(`[start] ${m.slug}`);
    const child = spawn('node', args, { env: process.env });
    let buf = '';
    child.stdout.on('data', (d) => { buf += d; });
    child.stderr.on('data', (d) => { buf += d; });
    child.on('close', (code) => {
      console.log(`[${code === 0 ? 'done ' : 'FAIL '}] ${m.slug}${code !== 0 ? ` (exit ${code})` : ''}`);
      if (code !== 0) console.log('   ' + buf.split('\n').filter(Boolean).slice(-3).join('\n   '));
      resolve({ slug: m.slug, ok: code === 0 });
    });
  });
}

async function pool(items, n, fn) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx]); }
  }));
  return results;
}

const res = await pool(MODELS, CONCURRENCY, genOne);
const ok = res.filter((r) => r.ok).length;
const skipped = res.filter((r) => r.skipped).length;
console.log(`\n=== BATCH DONE: ${ok}/${MODELS.length} ok (${skipped} skipped) ===`);
const failed = res.filter((r) => !r.ok).map((r) => r.slug);
if (failed.length) console.log('FAILED: ' + failed.join(', '));
