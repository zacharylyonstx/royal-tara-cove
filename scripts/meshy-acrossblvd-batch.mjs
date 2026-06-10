#!/usr/bin/env node
// Batch driver for the "Across the Boulevard" expansion (pond/park/shops/pets).
// Same shape as meshy-batch.mjs: spawns meshy-gen.mjs children with bounded
// concurrency; idempotent (skips slugs whose .glb already exists).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const OUT = 'public/assets/models';
const CONCURRENCY = 3;

const MODELS = [
  {
    slug: 'dog',
    polycount: 5000,
    lowpoly: true,
    prompt:
      'a friendly golden retriever family dog standing on all four paws, fluffy golden coat, happy open mouth smile with pink tongue out, feathered tail raised, stylized low poly game asset, single animal, all four paws flat on the ground, facing forward',
  },
  {
    slug: 'duck',
    polycount: 2500,
    lowpoly: true,
    prompt:
      'a mallard duck in a calm swimming pose with folded wings, glossy green head, white neck ring, yellow bill, warm brown body, stylized low poly game asset, single bird, flat underside as if resting on water',
  },
  {
    slug: 'playground',
    polycount: 9000,
    lowpoly: true,
    pbr: true,
    prompt:
      'a colorful kids playground play structure: a red wavy slide coming off a small raised platform with a green pitched roof, a short climbing ladder, and an attached swing set frame with two swings on chains, bright primary colors, stylized low poly game asset, one grouped object resting flat on the ground',
  },
  {
    slug: 'icecreamstand',
    polycount: 6000,
    lowpoly: true,
    pbr: true,
    prompt:
      'a cute ice cream vendor cart with a pink and white striped canopy awning, a glass display case with colorful ice cream tubs, two small wheels, and a big waffle cone with a swirl on a sign, stylized low poly game asset, single object',
  },
  {
    slug: 'picnictable',
    polycount: 3000,
    lowpoly: true,
    prompt:
      'a classic wooden park picnic table with two attached bench seats, warm weathered brown planks, A-frame legs, stylized low poly game asset, single object resting flat on the ground',
  },
  {
    slug: 'parkbench',
    polycount: 2500,
    lowpoly: true,
    prompt:
      'a classic park bench with green painted wooden slats and black cast iron frame with curved armrests, stylized low poly game asset, single object resting flat on the ground',
  },
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

const results = await pool(MODELS, CONCURRENCY, genOne);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok${failed.length ? ` — failed: ${failed.map((f) => f.slug).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
