import * as THREE from 'three';

// All textures are generated procedurally on a 2D canvas, then wrapped in a
// THREE.CanvasTexture. They're cached so we never re-render the same one.

const cache = new Map<string, THREE.Texture>();

function makeCanvas(size: number): { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return { ctx, canvas };
}

function finish(canvas: HTMLCanvasElement, repeat: [number, number] = [1, 1]): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// --- Helpers ---

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.08, scale = 1) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() - 0.5) * 2 * 255 * alpha;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  // Composite multiplicatively-ish via globalCompositeOperation
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = scale;
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

// --- Texture factories ---

export function grassTexture(): THREE.Texture {
  const key = 'grass';
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(512);
  // Base mottled greens
  const grad = ctx.createRadialGradient(256, 256, 60, 256, 256, 380);
  grad.addColorStop(0, '#5fa242');
  grad.addColorStop(1, '#3a7128');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  // Random darker/lighter blobs
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 4 + Math.random() * 18;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(40,80,30,0.35)' : 'rgba(140,180,90,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Tiny dry patches
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 5 + Math.random() * 12;
    ctx.fillStyle = 'rgba(180,150,80,0.18)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  noise(ctx, 512, 512, 0.04, 0.5);
  const tex = finish(canvas, [12, 12]);
  cache.set(key, tex);
  return tex;
}

export function asphaltTexture(): THREE.Texture {
  const key = 'asphalt';
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(512);
  ctx.fillStyle = '#34343a';
  ctx.fillRect(0, 0, 512, 512);
  // Speckled aggregate
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.random();
    const c = v < 0.5 ? '#222226' : v < 0.85 ? '#454550' : '#5a5a60';
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  // Faint cracks
  ctx.strokeStyle = 'rgba(20,20,22,0.7)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.5) * 80;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = finish(canvas, [4, 4]);
  cache.set(key, tex);
  return tex;
}

export function concreteTexture(): THREE.Texture {
  const key = 'concrete';
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(512);
  ctx.fillStyle = '#bcb6a8';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.random();
    const c = v < 0.5 ? 'rgba(140,135,125,0.5)' : 'rgba(210,205,195,0.4)';
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  // Slab joints
  ctx.strokeStyle = 'rgba(80,75,68,0.6)';
  ctx.lineWidth = 1.2;
  for (let y = 0; y < 512; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  const tex = finish(canvas, [3, 3]);
  cache.set(key, tex);
  return tex;
}

export function sidewalkTexture(): THREE.Texture {
  const key = 'sidewalk';
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(512);
  ctx.fillStyle = '#c5beae';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(150,144,134,0.55)' : 'rgba(220,213,200,0.5)';
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.strokeStyle = 'rgba(80,75,68,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();
  const tex = finish(canvas, [4, 1]);
  cache.set(key, tex);
  return tex;
}

export function stuccoTexture(color: string): THREE.Texture {
  const key = `stucco-${color}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  // Bumpy noise
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.random();
    ctx.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  const tex = finish(canvas, [3, 3]);
  cache.set(key, tex);
  return tex;
}

export function brickTexture(color: string): THREE.Texture {
  const key = `brick-${color}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(512);
  const base = new THREE.Color(color);
  // Light mortar joints (real brick has pale grey-tan mortar, not dark).
  const mortar = base.clone().lerp(new THREE.Color('#cfc9bc'), 0.78);
  const to255 = (c: THREE.Color) =>
    [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)] as const;
  const clamp = (v: number) => Math.max(0, Math.min(255, v)) | 0;
  const [mr, mg, mb] = to255(mortar);
  ctx.fillStyle = `rgb(${mr},${mg},${mb})`;
  ctx.fillRect(0, 0, 512, 512);

  const [br, bg, bb] = to255(base);
  const brickW = 60;
  const brickH = 22;
  const m = 4; // mortar joint width
  for (let row = 0; row * brickH < 512; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col * brickW < 512; col++) {
      const x = col * brickW + offset + m / 2;
      const y = row * brickH + m / 2;
      const w = brickW - m;
      const h = brickH - m;
      // Strong per-brick tonal variance — multi-tone "blend" look. A few bricks
      // are noticeably flashed (darker) or lighter than the family.
      const roll = Math.random();
      const v = roll < 0.14 ? 0.66 + Math.random() * 0.14   // flashed/dark brick
        : roll > 0.86 ? 1.12 + Math.random() * 0.16          // light brick
        : 0.84 + Math.random() * 0.3;                        // normal spread
      const jit = () => (Math.random() - 0.5) * 22;
      ctx.fillStyle = `rgb(${clamp(br * v + jit())},${clamp(bg * v + jit())},${clamp(bb * v + jit())})`;
      ctx.fillRect(x, y, w, h);
      // Mottled speckle within the brick (light + dark grains).
      for (let i = 0; i < 14; i++) {
        const dark = Math.random() < 0.5;
        ctx.fillStyle = dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 1.4, 1.4);
      }
    }
  }
  const tex = finish(canvas, [3, 3]);
  cache.set(key, tex);
  return tex;
}

export function lapSidingTexture(color: string): THREE.Texture {
  const key = `lapsiding-${color}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(256);
  const base = new THREE.Color(color);
  const to255 = (c: THREE.Color) =>
    [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)] as const;
  const [r, g, b] = to255(base);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 256, 256);
  // Horizontal HardiPlank lap boards: each board lighter at top, with a thin
  // shadow line under its bottom lip.
  const boardH = 22;
  for (let y = 0; y < 256; y += boardH) {
    // faint highlight along the top of the board
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, y + 1, 256, 2);
    // shadow line under the lap
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, y + boardH - 2, 256, 2);
    // very subtle per-board tonal drift
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`;
    ctx.fillRect(0, y + 2, 256, boardH - 4);
  }
  noise(ctx, 256, 256, 0.03, 0.4);
  const tex = finish(canvas, [3, 3]);
  cache.set(key, tex);
  return tex;
}

export function limestoneTexture(color: string): THREE.Texture {
  const key = `limestone-${color}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(512);
  // Mortar base
  ctx.fillStyle = '#8a7e62';
  ctx.fillRect(0, 0, 512, 512);

  // Stack-bond limestone block pattern (Texas hill-country style)
  const stoneW = 96;
  const stoneH = 56;
  const mortar = 5;
  for (let row = 0; row * stoneH < 512; row++) {
    const offset = (row % 2) * (stoneW / 2);
    for (let col = -1; col * stoneW < 512; col++) {
      const x = col * stoneW + offset + mortar / 2;
      const y = row * stoneH + mortar / 2;
      const w = stoneW - mortar;
      const h = stoneH - mortar;
      // Color jitter from base
      const base = new THREE.Color(color);
      const hsl = { h: 0, s: 0, l: 0 };
      base.getHSL(hsl);
      const jh = hsl.h + (Math.random() - 0.5) * 0.02;
      const js = hsl.s + (Math.random() - 0.5) * 0.05;
      const jl = hsl.l + (Math.random() - 0.5) * 0.07;
      const c = new THREE.Color().setHSL(jh, Math.max(0, js), Math.max(0, Math.min(1, jl)));
      ctx.fillStyle = `rgb(${Math.floor(c.r * 255)},${Math.floor(c.g * 255)},${Math.floor(c.b * 255)})`;
      // Slight rounded corners by clipping
      ctx.fillRect(x, y, w, h);
      // Speckle
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 1.4, 1.4);
      }
    }
  }
  const tex = finish(canvas, [2, 2]);
  cache.set(key, tex);
  return tex;
}

export function shingleTexture(color: string): THREE.Texture {
  const key = `shingle-${color}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(512);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 512);

  const tabW = 80;
  const tabH = 28;
  // Darker color for shadow lines
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const dark = new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, hsl.l - 0.15));
  const darkRgb = `rgb(${Math.floor(dark.r * 255)},${Math.floor(dark.g * 255)},${Math.floor(dark.b * 255)})`;

  for (let row = 0; row * tabH < 512; row++) {
    const offset = (row % 2) * (tabW / 2);
    // Horizontal shadow line at bottom of each course
    ctx.fillStyle = darkRgb;
    ctx.fillRect(0, row * tabH + tabH - 4, 512, 4);
    // Tab cuts
    for (let col = 0; col * tabW < 512 + tabW; col++) {
      const x = col * tabW + offset;
      ctx.fillStyle = darkRgb;
      ctx.fillRect(x - 1, row * tabH, 2, tabH);
    }
    // Per-shingle color variance
    for (let col = -1; col * tabW < 512 + tabW; col++) {
      const x = col * tabW + offset + 2;
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + Math.random() * 0.04})`;
      ctx.fillRect(x, row * tabH + 2, tabW - 4, tabH - 6);
    }
  }
  const tex = finish(canvas, [4, 4]);
  cache.set(key, tex);
  return tex;
}

export function woodPlankTexture(color: string): THREE.Texture {
  const key = `wood-${color}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  // Vertical plank divisions
  const plankW = 32;
  for (let x = 0; x < 256; x += plankW) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, 0, 1.5, 256);
    // Grain — wavy lines per plank
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '40,25,15' : '180,150,110'},${0.08 + Math.random() * 0.06})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const px = x + 4 + Math.random() * (plankW - 8);
      ctx.moveTo(px, 0);
      for (let y = 0; y < 256; y += 16) {
        ctx.lineTo(px + (Math.random() - 0.5) * 4, y);
      }
      ctx.stroke();
    }
  }
  const tex = finish(canvas, [2, 1]);
  cache.set(key, tex);
  return tex;
}

export function carPaintTexture(color: string): THREE.Texture {
  const key = `car-${color}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(128);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  // Subtle metallic flake
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  const tex = finish(canvas, [1, 1]);
  cache.set(key, tex);
  return tex;
}

export function woodFloorTexture(): THREE.Texture {
  const key = 'wood-floor';
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(512);
  ctx.fillStyle = '#a07a52';
  ctx.fillRect(0, 0, 512, 512);
  // Plank rows
  const plankH = 56;
  for (let row = 0; row * plankH < 512; row++) {
    const offset = (row * 73) % 512;
    for (let col = -1; col * 256 < 512 + 256; col++) {
      const x = col * 256 + (row % 2 ? offset / 2 : offset);
      const y = row * plankH;
      // Plank base color jitter
      const lum = 0.85 + Math.random() * 0.3;
      ctx.fillStyle = `rgb(${Math.min(255, Math.floor(160 * lum))},${Math.min(255, Math.floor(122 * lum))},${Math.min(255, Math.floor(82 * lum))})`;
      ctx.fillRect(x, y, 256, plankH);
      // Grain lines
      for (let g = 0; g < 8; g++) {
        ctx.strokeStyle = `rgba(60,40,20,${0.1 + Math.random() * 0.1})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        const gy = y + Math.random() * plankH;
        ctx.moveTo(x, gy);
        for (let gx = x; gx < x + 256; gx += 10) {
          ctx.lineTo(gx, gy + (Math.random() - 0.5) * 1);
        }
        ctx.stroke();
      }
      // Plank seam
      ctx.fillStyle = 'rgba(40,25,10,0.6)';
      ctx.fillRect(x, y + plankH - 1.4, 256, 1.4);
      ctx.fillRect(x - 1, y, 2, plankH);
    }
  }
  const tex = finish(canvas, [4, 4]);
  cache.set(key, tex);
  return tex;
}

export function tileFloorTexture(): THREE.Texture {
  const key = 'tile-floor';
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(256);
  ctx.fillStyle = '#a89880';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(60,50,40,0.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 64);
    ctx.lineTo(256, i * 64);
    ctx.moveTo(i * 64, 0);
    ctx.lineTo(i * 64, 256);
    ctx.stroke();
  }
  // Tile speckle
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = 'rgba(140,120,90,0.5)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
  }
  const tex = finish(canvas, [3, 3]);
  cache.set(key, tex);
  return tex;
}

export function rugTexture(): THREE.Texture {
  const key = 'rug';
  const cached = cache.get(key);
  if (cached) return cached;
  const { ctx, canvas } = makeCanvas(256);
  // Race-car rug for Luke: black road with white center stripes on green grass border
  ctx.fillStyle = '#3e7a37';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#222';
  ctx.fillRect(40, 40, 176, 176);
  // Center white dashes
  ctx.fillStyle = '#f0f0f0';
  for (let y = 50; y < 216; y += 24) {
    ctx.fillRect(124, y, 8, 12);
  }
  // Lane edges
  ctx.fillStyle = '#f5d35a';
  ctx.fillRect(50, 40, 4, 176);
  ctx.fillRect(202, 40, 4, 176);
  const tex = finish(canvas, [1, 1]);
  cache.set(key, tex);
  return tex;
}
