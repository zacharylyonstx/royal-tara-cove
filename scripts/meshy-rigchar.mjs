#!/usr/bin/env node
// Meshy RIGGED character pipeline via TEXT-to-3d (A-pose → riggable). image-to-3d
// from photos produces arms-at-sides meshes that Meshy's auto-rigger can't
// pose-estimate; a text-prompted A-pose full-body humanoid rigs reliably.
// Outputs: <slug>-rig.glb (rigged), <slug>-walk.glb, <slug>-run.glb, <slug>-apose.glb (textured base)
// Usage: MESHY_API_KEY=... node scripts/meshy-rigchar.mjs --slug penny --prompt "..." --height 1.38 [--no-optimize]
import { writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream, statSync } from 'node:fs';
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
const prompt = arg('prompt');
const height = parseFloat(arg('height', '1.4'));
const out = arg('out', 'public/assets/models');
const noOpt = flag('no-optimize');
const textureSize = arg('texture-size', '768');
const refineIdArg = arg('refine-id'); // resume from an existing text-to-3d refine task (skip gen)
const poly = parseInt(arg('poly', '10000'), 10); // preview polycount; keep refine under the 300k rig face limit
if (!slug || (!prompt && !refineIdArg)) { console.error('FATAL: --slug and (--prompt or --refine-id) required'); process.exit(1); }

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
  // 1) text-to-3d: preview (geometry) -> refine (texture)  [skipped if --refine-id]
  let refineId = refineIdArg;
  let refined;
  if (!refineId) {
    const previewId = await post(`${API}/v2/text-to-3d`, { mode: 'preview', prompt, ai_model: 'latest', topology: 'triangle', target_polycount: poly });
    console.log(`[${slug}] preview task: ${previewId} (poly ${poly})`);
    await poll(`${API}/v2/text-to-3d/${previewId}`, 'preview');
    refineId = await post(`${API}/v2/text-to-3d`, { mode: 'refine', preview_task_id: previewId, enable_pbr: false });
    console.log(`[${slug}] refine task: ${refineId}`);
    refined = await poll(`${API}/v2/text-to-3d/${refineId}`, 'refine');
  } else {
    console.log(`[${slug}] resuming from refine task ${refineId}`);
    refined = await get(`${API}/v2/text-to-3d/${refineId}`);
  }

  // Save the textured A-pose base (for reference). NOTE: do NOT remesh — remesh
  // breaks Meshy's rig pose-estimation. Keep poly low enough that the refine is
  // already under the 300k-face rig limit, then rig the refine directly.
  const aposeDest = path.join(out, `${slug}-apose.glb`);
  if (refined.model_urls?.glb) { await download(refined.model_urls.glb, aposeDest); optimize(aposeDest); console.log(`[${slug}] A-pose base saved ${aposeDest}`); }

  const meta = { slug, prompt, refineId, height, poly, generatedAt: new Date().toISOString() };

  // 2) rig the textured A-pose refine directly + walk/run. If the refine exceeds
  // the 300k-face rig limit, remesh down to 250k (keeps limb detail) and retry.
  async function submitRig(inputId) {
    try {
      return await post(`${API}/v1/rigging`, { input_task_id: inputId, height_meters: height });
    } catch (e) {
      if (/300,?000 face limit|exceeds the 300/i.test(e.message)) {
        console.log(`[${slug}] over face limit — remeshing to 250k then retrying rig`);
        const rm = await post(`${API}/v1/remesh`, { input_task_id: inputId, target_polycount: 250000, topology: 'triangle' });
        await poll(`${API}/v1/remesh/${rm}`, 'remesh');
        meta.remeshId = rm;
        return await post(`${API}/v1/rigging`, { input_task_id: rm, height_meters: height });
      }
      throw e;
    }
  }
  const rigTask = await submitRig(refineId);
  console.log(`[${slug}] rigging task: ${rigTask}`);
  const rigDone = await poll(`${API}/v1/rigging/${rigTask}`, 'rigging');
  meta.rigTask = rigTask;
  const rg = rigDone.result || rigDone;
  const riggedUrl = rg.rigged_character_glb_url || rg.model_urls?.glb;
  if (riggedUrl) { const d = path.join(out, `${slug}-rig.glb`); await download(riggedUrl, d); optimize(d); console.log(`[${slug}] rigged saved ${d}`); }
  const anims = rg.basic_animations || rg.animations || {};
  const walkUrl = anims.walking_glb_url || anims.walk_glb_url || anims.walking || anims.walk;
  const runUrl = anims.running_glb_url || anims.run_glb_url || anims.running || anims.run;
  if (walkUrl) { const d = path.join(out, `${slug}-walk.glb`); await download(walkUrl, d); optimize(d); console.log(`[${slug}] walk saved`); }
  if (runUrl) { const d = path.join(out, `${slug}-run.glb`); await download(runUrl, d); optimize(d); console.log(`[${slug}] run saved`); }
  meta.anims = { walk: !!walkUrl, run: !!runUrl };
  meta.rigRaw = rg;
  await writeFile(path.join(out, `${slug}.rigchar.meta.json`), JSON.stringify(meta, null, 2));
  console.log(`[${slug}] DONE — rig:${!!riggedUrl} walk:${!!walkUrl} run:${!!runUrl}`);
})().catch((e) => { console.error(`\n[${slug}] ERROR: ${e.message}`); process.exit(1); });
