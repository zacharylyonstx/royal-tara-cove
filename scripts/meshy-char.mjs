#!/usr/bin/env node
// Meshy character pipeline: image-to-3d (likeness from a photo) -> auto-rig
// (adds skeleton + downloads walk/run animation GLBs). Outputs:
//   <slug>.glb        rigged character (T/A-pose skeleton)
//   <slug>-walk.glb   walking animation
//   <slug>-run.glb    running animation
//   <slug>-base.glb   the un-rigged textured model (fallback)
// Usage:
//   MESHY_API_KEY=... node scripts/meshy-char.mjs --slug luke --image /tmp/faces/luke.png --height 1.2 [--no-rig] [--no-optimize]
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { readFileSync, createWriteStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const API = 'https://api.meshy.ai/openapi';
const KEY = process.env.MESHY_API_KEY;
if (!KEY) { console.error('FATAL: MESHY_API_KEY not set'); process.exit(1); }

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const flag = (n) => argv.includes(`--${n}`);
const slug = arg('slug');
const image = arg('image');
const height = parseFloat(arg('height', '1.4'));
const out = arg('out', 'public/assets/models');
const noRig = flag('no-rig');
const noOpt = flag('no-optimize');
const textureSize = arg('texture-size', '768');
if (!slug || !image) { console.error('FATAL: --slug and --image required'); process.exit(1); }

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`POST ${url} ${r.status}: ${t}`);
  const j = JSON.parse(t); return j.result || j.id;
}
async function get(url) {
  const r = await fetch(url, { headers });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${url} ${r.status}: ${t}`);
  return JSON.parse(t);
}
async function poll(url, label) {
  for (;;) {
    const j = await get(url);
    process.stdout.write(`\r[${slug}] ${label}: ${j.status} ${j.progress || 0}%    `);
    if (j.status === 'SUCCEEDED') { process.stdout.write('\n'); return j; }
    if (j.status === 'FAILED' || j.status === 'CANCELED') { process.stdout.write('\n'); throw new Error(`${label} ${j.status}: ${JSON.stringify(j.task_error || {})}`); }
    await sleep(5000);
  }
}
async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
}
function optimize(dest) {
  if (noOpt) return;
  const raw = statSync(dest).size;
  const tmp = dest.replace(/\.glb$/, '.tmp.glb');
  try {
    execFileSync('npx', ['--yes', '@gltf-transform/cli@latest', 'resize', dest, tmp, '--width', textureSize, '--height', textureSize], { stdio: 'pipe' });
    execFileSync('npx', ['--yes', '@gltf-transform/cli@latest', 'webp', tmp, dest, '--quality', '85'], { stdio: 'pipe' });
    execFileSync('rm', ['-f', tmp]);
    console.log(`[${slug}] optimized ${(raw / 1e6).toFixed(2)}MB -> ${(statSync(dest).size / 1e3).toFixed(0)}KB`);
  } catch (e) { execFileSync('rm', ['-f', tmp]); console.warn(`[${slug}] optimize skipped: ${String(e.message).split('\n')[0]}`); }
}

(async () => {
  await mkdir(out, { recursive: true });
  // 1) image -> 3d (likeness from the photo crop)
  const buf = readFileSync(image);
  const ext = path.extname(image).slice(1) || 'png';
  const dataUri = `data:image/${ext};base64,${buf.toString('base64')}`;
  const imgTask = await post(`${API}/v1/image-to-3d`, {
    image_url: dataUri, ai_model: 'latest', should_texture: true, enable_pbr: false,
    topology: 'triangle', target_polycount: 20000, should_remesh: true,
  });
  console.log(`[${slug}] image-to-3d task: ${imgTask}`);
  const imgDone = await poll(`${API}/v1/image-to-3d/${imgTask}`, 'image-to-3d');
  const baseDest = path.join(out, `${slug}-base.glb`);
  await download(imgDone.model_urls.glb, baseDest);
  optimize(baseDest);
  console.log(`[${slug}] base saved ${baseDest}`);

  const meta = { slug, image, imgTask, height, thumbnail: imgDone.thumbnail_url, generatedAt: new Date().toISOString() };

  // 2) rig -> skeleton + walk/run animations
  if (!noRig) {
    try {
      const rigTask = await post(`${API}/v1/rigging`, { input_task_id: imgTask, height_meters: height });
      console.log(`[${slug}] rigging task: ${rigTask}`);
      const rigDone = await poll(`${API}/v1/rigging/${rigTask}`, 'rigging');
      meta.rigTask = rigTask;
      const rg = rigDone.result || rigDone;
      const riggedUrl = rg.rigged_character_glb_url || rg.model_urls?.glb;
      if (riggedUrl) { const d = path.join(out, `${slug}.glb`); await download(riggedUrl, d); optimize(d); console.log(`[${slug}] rigged saved ${d}`); }
      const anims = rg.basic_animations || rg.animations || {};
      const walkUrl = anims.walking_glb_url || anims.walk_glb_url || anims.walking || anims.walk;
      const runUrl = anims.running_glb_url || anims.run_glb_url || anims.running || anims.run;
      if (walkUrl) { const d = path.join(out, `${slug}-walk.glb`); await download(walkUrl, d); optimize(d); console.log(`[${slug}] walk saved`); }
      if (runUrl) { const d = path.join(out, `${slug}-run.glb`); await download(runUrl, d); optimize(d); console.log(`[${slug}] run saved`); }
      meta.anims = { walk: !!walkUrl, run: !!runUrl };
      meta.rigRaw = rg; // keep raw for inspecting clip/url names
    } catch (e) {
      console.warn(`[${slug}] RIGGING FAILED: ${e.message}`);
      meta.rigError = e.message;
    }
  }
  await writeFile(path.join(out, `${slug}.char.meta.json`), JSON.stringify(meta, null, 2));
  console.log(`[${slug}] done`);
})().catch((e) => { console.error(`\n[${slug}] ERROR: ${e.message}`); process.exit(1); });
