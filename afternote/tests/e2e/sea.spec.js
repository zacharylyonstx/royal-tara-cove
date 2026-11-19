import { test, expect } from '@playwright/test';

// The Sea of Bridges, driven the same way as the lighthouse: ?test=1 (manual clock),
// render_game_to_text(), advanceTime(), and the rule-following bot.

const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((t) => JSON.parse(window.advanceTime(t)), ms);

async function until(page, pred, maxSeconds = 400) {
  const ok = await page.evaluate(async ([src, max]) => {
    const f = new Function('s', `return (${src});`);
    for (let i = 0; i < max * 10; i++) {
      const s = JSON.parse(window.advanceTime(100));
      if (f(s)) return true;
    }
    return false;
  }, [pred, maxSeconds]);
  expect(ok, `never reached: ${pred}`).toBe(true);
  return state(page);
}

async function boot(page, { keep = false } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/afternote/?test=1&fx=0');
  await page.waitForFunction(() => !!window.render_game_to_text);
  if (!keep) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => !!window.render_game_to_text);
  }
  return errors;
}

/** From the title to the chart. */
async function toChart(page) {
  await page.click('[data-action="sea"]');
  const s = await advance(page, 800);
  expect(s.phase).toBe('sea');
  expect(s.ui.chart).toBe(true);
  return s;
}

/** Choose a line on the chart (its hit area is a wide invisible stroke). */
const pickEdge = (page, id) => page.click(`[data-edge="${id}"]`, { force: true });

/** Let the bot play the crossing that has just been begun, through to the arrival card. */
async function playThrough(page, bot = { strategy: 'wander', miss: 0.3, seed: 4 }) {
  await until(page, 's.phase === "play" && s.gateWaiting');
  await page.evaluate((o) => window.__afternote.bot(o), bot);
  const s = await until(page, 's.ui.arrival');
  await page.evaluate(() => window.__afternote.bot(null)); // the next crossing waits for a person again
  return s;
}

test('the sea is open from the first moment: nothing has to be finished first', async ({ page }) => {
  const errors = await boot(page);
  const s = await toChart(page);
  expect(s.sea.at).toBe('lighthouse');
  expect(s.sea.awake).toEqual(['lighthouse']);
  expect(s.sea.sounds).toEqual(['bell', 'root', 'glass']);
  expect(s.sea.moods).toEqual(['firstlight']);
  // the chart draws every place and every possible bridge
  expect(await page.locator('.chart-map [data-place]').count()).toBe(7);
  expect(await page.locator('.chart-map [data-edge]').count()).toBe(10);
  expect(await page.locator('.chart-map .edge.open').count()).toBe(3); // the three that leave the lighthouse
  expect(await page.locator('.chart-map .edge.far').count()).toBe(7);
  expect(errors).toEqual([]);
});

test('a crossing waits for the first note, every key builds a stone, and nothing is ever missed', async ({ page }) => {
  const errors = await boot(page);
  await toChart(page);
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="build"]');
  let s = await until(page, 's.phase === "play" && s.gateWaiting');
  expect(s.sea.crossing).toMatchObject({ edge: 'lighthouse~chimes', from: 'lighthouse', to: 'chimes', layer: 0, beats: 32 });
  expect(s.next.offers).toEqual(['C', 'D', 'E', 'G', 'A']);
  expect(s.ui.prompt).toContain('Play any note');
  // a long wait changes nothing
  const before = s.beat;
  s = await advance(page, 15000);
  expect(s.gateWaiting).toBe(true);
  expect(s.beat).toBe(before);
  // the far key is as good as any other, from the very first note
  await page.keyboard.press('Digit5');
  s = await advance(page, 900);
  expect(s.gateWaiting).toBe(false);
  expect(s.entries.hits).toBe(1);
  await page.keyboard.press('Digit1');
  s = await advance(page, 900);
  expect(s.entries.hits).toBe(2);
  // leave it alone for a while: Kite is carried, and there is no miss
  s = await advance(page, 6000);
  expect(s.entries.misses).toBe(0);
  expect(s.lastEvents).toContain('rest');
  expect(s.lastEvents).not.toContain('miss');
  expect(s.kite.pose).not.toBe('stumble');
  expect(errors).toEqual([]);
});

test('reaching a place wakes it and gives its sound and mood; the bridge is kept', async ({ page }) => {
  const errors = await boot(page);
  await toChart(page);
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="build"]');
  let s = await playThrough(page);
  expect(s.phase).toBe('arrived');
  expect(s.sea.at).toBe('chimes');
  expect(s.sea.awake).toEqual(['lighthouse', 'chimes']);
  expect(s.sea.sounds).toContain('musicbox');
  expect(s.sea.moods).toContain('lullaby');
  const bridge = s.sea.bridges['lighthouse~chimes'];
  expect(bridge.from).toBe('lighthouse');
  expect(bridge.parts.length).toBe(1);
  expect(bridge.parts[0].notes).toBeGreaterThan(10);
  expect(await page.locator('.gift-box').innerText()).toMatch(/Music Box[\s\S]*Lullaby/i);
  // it survives a reload
  await page.reload();
  await page.waitForFunction(() => !!window.render_game_to_text);
  s = await advance(page, 300);
  expect(s.sea.bridges['lighthouse~chimes'].parts[0].notes).toBe(bridge.parts[0].notes);
  expect(s.sea.at).toBe('chimes');
  await toChart(page);
  expect(await page.locator('.chart-map .edge.built').count()).toBe(1);
  expect(await page.locator('.chart-map .place.awake').count()).toBe(2);
  expect(errors).toEqual([]);
});

test('parts stack on a bridge: each new one is played with the Echoes of the others, up to three', async ({ page }) => {
  const errors = await boot(page);
  await toChart(page);
  await pickEdge(page, 'lighthouse~harp');
  await page.click('[data-chart="build"]');
  let s = await playThrough(page, { strategy: 'low', miss: 0.4, seed: 2 });
  await page.click('[data-arrive="add"]');
  s = await until(page, 's.phase === "play" && s.gateWaiting');
  expect(s.sea.crossing.layer).toBe(1);
  expect(s.echoes).toEqual([0]);
  s = await playThrough(page, { strategy: 'high', miss: 0.5, seed: 3 });
  expect(s.sea.bridges['lighthouse~harp'].parts.length).toBe(2);
  await page.click('[data-arrive="add"]');
  s = await until(page, 's.phase === "play" && s.gateWaiting');
  expect(s.sea.crossing.layer).toBe(2);
  expect(s.echoes).toEqual([0, 1]);
  s = await playThrough(page, { strategy: 'wander', miss: 0.6, seed: 5 });
  const parts = s.sea.bridges['lighthouse~harp'].parts;
  expect(parts.length).toBe(3);
  // each part took a different sound without being asked
  expect(new Set(parts.map((p) => p.sound)).size).toBe(3);
  // a full bridge offers no fourth part
  expect(await page.locator('[data-arrive="add"]').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('a bridge can be heard again, part by part, and listening carries Kite across', async ({ page }) => {
  const errors = await boot(page);
  await toChart(page);
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="build"]');
  await playThrough(page);
  await page.click('[data-arrive="add"]');
  await playThrough(page, { strategy: 'high', miss: 0.5, seed: 9 });
  await page.click('[data-arrive="listen"]');
  let s = await advance(page, 3000);
  expect(s.phase).toBe('bridgeSong');
  expect(s.sea.listening).toBe('lighthouse~chimes');
  expect(s.echoes).toEqual([0, 1]);
  const stems = page.locator('.listen-bar [data-action="stem"]:not([hidden])');
  expect(await stems.count()).toBe(2);
  // one part can be silenced, never both
  await stems.nth(0).click();
  await stems.nth(1).click();
  expect(await page.locator('.listen-bar [data-action="stem"].on:not([hidden])').count()).toBe(1);
  s = await until(page, 's.ui.chart');
  expect(s.phase).toBe('sea');
  expect(s.sea.at).toBe('chimes');
  expect(errors).toEqual([]);
});

test('leaving a crossing keeps nothing of it; starting a bridge over keeps the old one until the new one is finished', async ({ page }) => {
  const errors = await boot(page);
  await toChart(page);
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="build"]');
  let s = await playThrough(page);
  const old = s.sea.bridges['lighthouse~chimes'].parts[0].notes;
  await page.click('[data-arrive="chart"]');
  await advance(page, 500);
  // start it over, play a little, then leave
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="over"]');
  await page.click('[data-chart="build"]');
  s = await until(page, 's.phase === "play" && s.gateWaiting');
  await page.keyboard.press('Digit2');
  await advance(page, 2500);
  await page.keyboard.press('Escape');
  await page.click('.overlay:not(.hidden) [data-action="leave"]');
  s = await advance(page, 600);
  expect(s.phase).toBe('sea');
  expect(s.sea.bridges['lighthouse~chimes'].parts.length).toBe(1);
  expect(s.sea.bridges['lighthouse~chimes'].parts[0].notes).toBe(old);
  // this time finish it: one stone only
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="over"]');
  await page.click('[data-chart="build"]');
  await until(page, 's.phase === "play" && s.gateWaiting');
  await page.keyboard.press('Digit4');
  s = await until(page, 's.ui.arrival');
  // (Kite was standing at Chime Rocks, so the new bridge was begun from there, in that place's own sound)
  expect(s.sea.bridges['lighthouse~chimes']).toMatchObject({ from: 'chimes', parts: [{ sound: 'musicbox', notes: 1 }] });
  expect(errors).toEqual([]);
});

test('a place that has been reached becomes somewhere to set out from, in its own mood', async ({ page }) => {
  const errors = await boot(page);
  await toChart(page);
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="build"]');
  await playThrough(page);
  await page.click('[data-arrive="chart"]');
  let s = await advance(page, 500);
  expect(await page.locator('.chart-map .edge.open').count()).toBe(4); // two more from the lighthouse, two from Chime Rocks
  await pickEdge(page, 'chimes~stacks');
  // the place's own sound and mood are offered first
  expect(await page.locator('[data-pick="sound"] .chip.on').innerText()).toMatch(/music box/i);
  expect(await page.locator('[data-pick="mood"] .chip.on').innerText()).toMatch(/lullaby/i);
  await page.click('[data-chart="build"]');
  s = await until(page, 's.phase === "play" && s.gateWaiting');
  expect(s.sea.crossing).toMatchObject({ from: 'chimes', to: 'stacks', sound: 'musicbox', mood: 'lullaby', beats: 48 });
  expect(s.bpm).toBeLessThan(70); // a lullaby is slow
  expect(errors).toEqual([]);
});

test('pause and restart work on a crossing, and the lighthouse journey is untouched by the sea', async ({ page }) => {
  const errors = await boot(page);
  await toChart(page);
  await pickEdge(page, 'lighthouse~harp');
  await page.click('[data-chart="build"]');
  let s = await until(page, 's.phase === "play" && s.gateWaiting');
  await page.keyboard.press('Digit3');
  s = await advance(page, 1500);
  await page.keyboard.press('Escape');
  s = await advance(page, 100);
  expect(s.paused).toBe(true);
  const held = s.beat;
  s = await advance(page, 3000);
  expect(s.beat).toBe(held);
  await page.click('.overlay:not(.hidden) [data-action="restart-phrase"]');
  s = await until(page, 's.phase === "play" && s.gateWaiting');
  expect(s.entries.hits).toBe(0);
  await page.keyboard.press('Escape');
  await page.click('.overlay:not(.hidden) [data-action="leave"]');
  await advance(page, 400);
  await page.click('[data-action="sea-home"]');
  s = await advance(page, 600);
  expect(s.phase).toBe('title');
  expect(s.records).toEqual([null, null, null]);
  // and the lighthouse still begins as it always did
  await page.click('[data-action="begin"]');
  s = await advance(page, 4000);
  expect(s.phase).toBe('play');
  expect(s.movement).toBe(0);
  expect(s.next.offers).toEqual(['C']);
  expect(errors).toEqual([]);
});

test('the chart and the arrival card keep every control on screen in every window', async ({ page }) => {
  await boot(page);
  await toChart(page);
  const sizes = [[1280, 720], [1024, 600], [844, 390], [740, 360], [390, 844], [820, 1180]];
  const onScreen = (sel) => page.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push(`${el.className || el.tagName} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    return out;
  }, sel);
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(60);
    expect(await onScreen('.chart-head, .chart-map, .chart-foot .btn'), `chart at ${w}x${h}`).toEqual([]);
    // the panel may scroll, but it must be on screen and its main button reachable by scrolling
    expect(await onScreen('.chart-panel'), `panel at ${w}x${h}`).toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="build"]');
  await playThrough(page);
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(60);
    expect(await onScreen('.arrival-inner'), `arrival at ${w}x${h}`).toEqual([]);
  }
});
