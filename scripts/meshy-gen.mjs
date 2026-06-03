#!/usr/bin/env node
// Zero-dependency Meshy text-to-3d generator.
// Pipeline: preview (geometry) -> [refine (texture)] -> download GLB + meta.json
// Usage:
//   MESHY_API_KEY=... node scripts/meshy-gen.mjs --slug mailbox \
//     --prompt "a low poly mailbox" [--polycount 6000] [--lowpoly] [--pbr] \
//     [--preview-only] [--texture-prompt "..."] [--out public/assets/models]
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';

const API = 'https://api.meshy.ai/openapi';
const KEY = process.env.MESHY_API_KEY;
if (!KEY) { console.error('FATAL: MESHY_API_KEY not set'); process.exit(1); }

const argv = process.argv.slice(2);
const arg = (name, def = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(`--${name}`);

const prompt = arg('prompt');
const slug = arg('slug');
const out = arg('out', 'public/assets/models');
const polycount = parseInt(arg('polycount', '8000'), 10);
const lowpoly = flag('lowpoly');
const pbr = flag('pbr');
const previewOnly = flag('preview-only');
const texturePrompt = arg('texture-prompt', '');
const textureSize = arg('texture-size', '512');
const noOptimize = flag('no-optimize');
if (!prompt || !slug) { console.error('FATAL: --prompt and --slug are required'); process.exit(1); }

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function post(body) {
  const r = await fetch(`${API}/v2/text-to-3d`, { method: 'POST', headers, body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`POST ${r.status}: ${t}`);
  const j = JSON.parse(t);
  return j.result || j.id;
}
async function get(id) {
  const r = await fetch(`${API}/v2/text-to-3d/${id}`, { headers });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${r.status}: ${t}`);
  return JSON.parse(t);
}
async function poll(id, label) {
  for (;;) {
    const j = await get(id);
    process.stdout.write(`\r[${slug}] ${label}: ${j.status} ${j.progress || 0}%    `);
    if (j.status === 'SUCCEEDED') { process.stdout.write('\n'); return j; }
    if (j.status === 'FAILED' || j.status === 'CANCELED') {
      process.stdout.write('\n');
      throw new Error(`${label} ${j.status}: ${JSON.stringify(j.task_error || j.error || {})}`);
    }
    await new Promise((res) => setTimeout(res, 5000));
  }
}
async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} for ${url}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
}

(async () => {
  await mkdir(out, { recursive: true });
  const previewBody = { mode: 'preview', prompt, ai_model: 'latest', topology: 'triangle', target_polycount: polycount };
  if (lowpoly) previewBody.model_type = 'lowpoly';
  const previewId = await post(previewBody);
  console.log(`[${slug}] preview task: ${previewId}`);
  await poll(previewId, 'preview');

  let finalTask;
  let finalId = previewId;
  if (previewOnly) {
    finalTask = await get(previewId);
  } else {
    const refineBody = { mode: 'refine', preview_task_id: previewId, enable_pbr: pbr };
    if (texturePrompt) refineBody.texture_prompt = texturePrompt;
    const refineId = await post(refineBody);
    finalId = refineId;
    console.log(`[${slug}] refine task: ${refineId}`);
    finalTask = await poll(refineId, 'refine');
  }

  const glbUrl = finalTask.model_urls?.glb;
  if (!glbUrl) throw new Error(`no glb url in task ${finalId}: ${JSON.stringify(finalTask.model_urls || {})}`);
  const dest = path.join(out, `${slug}.glb`);
  await download(glbUrl, dest);

  // Optimize textures in-place (resize -> WebP). Meshy GLBs ship ~5MB of full-res
  // PBR maps; this drops them ~90% with no geometry/material change (so per-mesh
  // tinting survives). The gltf-transform CLI is run via npx (cached after 1st use).
  if (!noOptimize) {
    const raw = statSync(dest).size;
    const tmp = path.join(out, `${slug}.tmp.glb`);
    try {
      execFileSync('npx', ['--yes', '@gltf-transform/cli@latest', 'resize', dest, tmp,
        '--width', textureSize, '--height', textureSize], { stdio: 'pipe' });
      execFileSync('npx', ['--yes', '@gltf-transform/cli@latest', 'webp', tmp, dest,
        '--quality', '80'], { stdio: 'pipe' });
      await rm(tmp, { force: true });
      const opt = statSync(dest).size;
      console.log(`[${slug}] optimized ${(raw / 1e6).toFixed(2)}MB -> ${(opt / 1e3).toFixed(0)}KB`);
    } catch (e) {
      await rm(tmp, { force: true });
      console.warn(`[${slug}] WARN optimize failed, keeping raw GLB: ${e.message?.split('\n')[0]}`);
    }
  }

  await writeFile(
    path.join(out, `${slug}.meta.json`),
    JSON.stringify(
      { slug, prompt, previewId, finalId, polycount, lowpoly, pbr, texturePrompt, model_urls: finalTask.model_urls, thumbnail_url: finalTask.thumbnail_url, generatedAt: new Date().toISOString() },
      null, 2,
    ),
  );
  console.log(`[${slug}] ✓ saved ${dest}`);
})().catch((e) => { console.error(`\n[${slug}] ERROR: ${e.message}`); process.exit(1); });
