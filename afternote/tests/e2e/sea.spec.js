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

test('the on-screen pads build stones too (touch, mouse or pen): a keyboard is never needed', async ({ page }) => {
  const errors = await boot(page);
  await toChart(page);
  await pickEdge(page, 'lighthouse~garden');
  await page.click('[data-chart="build"]');
  let s = await until(page, 's.phase === "play" && s.gateWaiting');
  const pads = page.locator('.keys .key');
  expect(await pads.count()).toBe(5);
  await pads.nth(4).dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await pads.nth(4).dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  s = await advance(page, 900);
  expect(s.gateWaiting).toBe(false);
  expect(s.entries.hits).toBe(1);
  for (const k of [0, 2, 3]) {
    await pads.nth(k).dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
    await pads.nth(k).dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
    s = await advance(page, 800);
  }
  expect(s.entries.hits).toBe(4);
  expect(s.entries.misses).toBe(0);
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

test('the end of the lighthouse leads out to sea, and the way back is still there', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'resonant' }));
  let s = await until(page, 's.phase === "end"', 900);
  await page.evaluate(() => window.__afternote.bot(null));
  expect(s.ui.end).toBe(true);
  await page.click('.end-card [data-action="sea"]');
  s = await advance(page, 900);
  expect(s.phase).toBe('sea');
  expect(s.ui.chart).toBe(true);
  expect(s.ui.end).toBe(false);
  expect(s.sea.at).toBe('lighthouse');
  // a crossing begun now is a sea crossing, not a lighthouse movement
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="build"]');
  s = await until(page, 's.phase === "play" && s.gateWaiting');
  expect(s.sea.crossing.edge).toBe('lighthouse~chimes');
  expect(s.next.offers).toEqual(['C', 'D', 'E', 'G', 'A']);
  await page.keyboard.press('Escape');
  await page.click('.overlay:not(.hidden) [data-action="leave"]');
  await advance(page, 400);
  await page.click('[data-action="sea-home"]');
  s = await advance(page, 600);
  expect(s.phase).toBe('title');
  // the finished lighthouse is still finished
  expect(s.records.every((r) => r && r.hits > 0)).toBe(true);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------
// Bridges sent by link
// ---------------------------------------------------------------------------------

/** Someone else: another browser with nothing saved. */
async function someoneElse(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(url);
  await page.waitForFunction(() => !!window.render_game_to_text);
  return { context, page, errors };
}

/** The link the game shows, turned into one this test can open (the test clock, no effects). */
const testable = (link) => link.replace('/afternote/#', '/afternote/?test=1&fx=0#');

/** Open a link the way it is opened from a message: as a fresh visit to the page. */
async function openLink(page, link) {
  await page.goto('about:blank');
  await page.goto(testable(link));
  await page.waitForFunction(() => !!window.render_game_to_text);
  return advance(page, 500);
}

/** Build the first bridge, and come back with its link. */
async function buildAndSend(page) {
  await toChart(page);
  await pickEdge(page, 'lighthouse~chimes');
  await page.click('[data-chart="build"]');
  await playThrough(page);
  await page.click('[data-arrive="send"]');
  const s = await advance(page, 500);
  expect(s.ui.chart).toBe(true);
  expect(s.ui.sending).toBe(true);
  return page.inputValue('.link-box');
}

test('a bridge can be sent as a link that holds its notes and nothing else', async ({ page }) => {
  const errors = await boot(page);
  const link = await buildAndSend(page);
  expect(link).toMatch(/\/afternote\/#b=1[0-9a-z]{6}-[0-9a-z]{2,65}$/);
  expect(link.length).toBeLessThan(120);
  // the code in the link is the saved bridge, and only that
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('afternote.sea.v1')).sea.bridges['lighthouse~chimes']);
  const decoded = await page.evaluate(async (code) => (await import('/afternote/src/music/sea.js')).decodeBridge(code), link.split('#b=')[1]);
  expect(decoded).toEqual({ edge: 'lighthouse~chimes', bridge: saved });
  await page.click('[data-chart="copy"]');
  await expect(page.locator('[data-chart="copy"]')).toHaveText(/Copied|Copy by hand/);
  await page.click('[data-chart="send-done"]');
  const s = await state(page);
  expect(s.ui.sending).toBe(false);
  // the same link is there again from the chart
  await page.click('[data-chart="send"]');
  expect(await page.inputValue('.link-box')).toBe(link);
  expect(errors).toEqual([]);
});

test('someone who opens the link hears the bridge, lays a part over it and sends it back; it comes home grown', async ({ page, browser }) => {
  const errors = await boot(page);
  const link = await buildAndSend(page);

  // --- the other person
  const other = await someoneElse(browser, testable(link));
  const B = other.page;
  let s = await advance(B, 500);
  expect(s.phase).toBe('title');
  expect(s.ui.incoming).toBe('A bridge has arrived from another sea.');
  expect(B.url()).not.toContain('#'); // taken out of the address, so a reload does not bring it twice
  expect(s.sea.afar.length).toBe(1);
  expect(s.sea.afar[0]).toMatchObject({ edge: 'lighthouse~chimes', from: 'lighthouse', mood: 'firstlight' });
  expect(s.sea.awake).toEqual(['lighthouse']); // it wakes nothing by arriving
  expect(s.sea.bridges).toEqual({});
  await B.click('[data-action="sea-incoming"]');
  s = await advance(B, 2500);
  expect(s.phase).toBe('bridgeSong');
  expect(s.sea.listening).toBe('afar:0');
  s = await until(B, 's.ui.chart');
  expect(s.sea.at).toBe('lighthouse'); // hearing it does not carry Kite anywhere
  expect(await B.locator('.chart-map [data-afar]').count()).toBe(1);
  expect(await B.locator('.chart-panel .panel-kicker').innerText()).toMatch(/from another sea/i);
  // their own part, over the sender's Echo
  await B.click('[data-chart="add"]');
  s = await until(B, 's.phase === "play" && s.gateWaiting');
  expect(s.sea.crossing).toMatchObject({ edge: 'lighthouse~chimes', layer: 1, ref: 'afar:0' });
  expect(s.echoes).toEqual([0]);
  s = await playThrough(B, { strategy: 'high', miss: 0.5, seed: 9 });
  expect(s.sea.afar[0].parts.length).toBe(2);
  expect(s.sea.awake).toEqual(['lighthouse', 'chimes']); // they played their way there
  expect(s.sea.sounds).toContain('musicbox');
  expect(s.sea.bridges).toEqual({});
  await B.click('[data-arrive="send"]');
  await advance(B, 400);
  const back = await B.inputValue('.link-box');
  expect(back.startsWith(link + '-')).toBe(true); // the same bridge, with one more part
  expect(other.errors).toEqual([]);
  await other.context.close();

  // --- home again
  s = await openLink(page, back);
  expect(s.ui.incoming).toBe('Your bridge has come back with a new part.');
  expect(s.sea.bridges['lighthouse~chimes'].parts.length).toBe(2);
  expect(s.sea.afar).toEqual([]);
  // opening it again changes nothing
  s = await openLink(page, back);
  expect(s.ui.incoming).toBe('This is your own bridge, just as you left it.');
  expect(s.sea.bridges['lighthouse~chimes'].parts.length).toBe(2);
  expect(s.sea.afar).toEqual([]);
  expect(errors).toEqual([]);
});

test('a bridge that comes home while the page is open is announced, and can be heard at once', async ({ page }) => {
  const errors = await boot(page);
  const link = await buildAndSend(page);
  // a second part, as if someone had laid it and sent the bridge back
  const grown = await page.evaluate(async (code) => {
    const sea = await import('/afternote/src/music/sea.js');
    const { edge, bridge } = sea.decodeBridge(code);
    bridge.layers.push({ sound: 'glass', score: [[0, 2], [4, 4], [9, 1]] });
    return sea.encodeBridge(edge, bridge);
  }, link.split('#b=')[1]);
  await page.click('[data-action="sea-home"]');
  let s = await advance(page, 500);
  expect(s.phase).toBe('title');
  await page.evaluate((code) => { location.hash = 'b=' + code; }, grown);
  await page.waitForFunction(() => !location.hash);
  s = await advance(page, 300);
  expect(s.ui.incoming).toBe('Your bridge has come back with a new part.');
  expect(s.sea.bridges['lighthouse~chimes'].parts).toEqual([expect.objectContaining({ sound: 'bell' }), { sound: 'glass', notes: 3 }]);
  await page.click('[data-action="sea-incoming"]');
  s = await advance(page, 2500);
  expect(s.phase).toBe('bridgeSong');
  expect(s.sea.listening).toBe('lighthouse~chimes');
  expect(s.echoes).toEqual([0, 1]);
  expect(s.ui.incoming).toBe('');
  expect(errors).toEqual([]);
});

test('a link that holds no bridge is turned away gently', async ({ page }) => {
  const errors = await boot(page);
  for (const junk of ['b=hello', 'b=10000lc-0', 'b=1z0000c-0a', 'b=' + 'a'.repeat(300), 'b=%3Cscript%3E10000lc-0a', 'x=10000lc-0a']) {
    await page.evaluate((h) => { location.hash = h; }, junk);
    await advance(page, 200);
  }
  let s = await state(page);
  expect(s.sea.afar).toEqual([]);
  // (one that is shaped like a code but is not a bridge says so; one that is not even that is ignored)
  await page.evaluate(() => { location.hash = 'b=10000lc-00a'; });
  await page.waitForFunction(() => !location.hash);
  s = await advance(page, 200);
  expect(s.ui.incoming).toBe('That link did not hold a bridge.');
  expect(await page.locator('[data-action="sea-incoming"]').isVisible()).toBe(false);
  expect(s.sea.afar).toEqual([]);
  expect(s.sea.bridges).toEqual({});
  // a real link with a full stop typed after it, or something a message app added, still opens
  await page.evaluate(() => { location.hash = 'b=10000lc-0a.%20utm=1'; });
  await page.waitForFunction(() => !location.hash);
  s = await advance(page, 200);
  expect(s.ui.incoming).toBe('A bridge has arrived from another sea.');
  expect(s.sea.afar).toEqual([{ edge: 'lighthouse~chimes', from: 'lighthouse', mood: 'firstlight', bpm: 76.8, parts: [{ sound: 'bell', notes: 2 }] }]);
  expect(errors).toEqual([]);
});

test('waking the last place, and building the last bridge, are both marked', async ({ page }) => {
  const errors = await boot(page);
  // a sea with everything done but one bridge to the one place still asleep
  await page.evaluate(async () => {
    const { EDGES, PLACES } = await import('/afternote/src/music/sea.js');
    const bridges = {};
    for (const e of EDGES) if (e.id !== 'harbor~deep' && e.id !== 'harp~harbor') bridges[e.id] = { from: e.a, mood: 'firstlight', bpm: 76.8, layers: [{ sound: 'bell', score: [[0, 0], [2, 2]] }] };
    localStorage.setItem('afternote.sea.v1', JSON.stringify({ v: 1, at: 0, sea: { at: 'harp', awake: PLACES.map((p) => p.id).filter((id) => id !== 'harbor'), bridges, afar: [], seen: {} } }));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.render_game_to_text);
  let s = await toChart(page);
  expect(s.sea.awake.length).toBe(6);
  expect(Object.keys(s.sea.bridges).length).toBe(8);
  await pickEdge(page, 'harp~harbor');
  await page.click('[data-chart="build"]');
  s = await playThrough(page);
  expect(s.sea.awake.length).toBe(7);
  expect(await page.locator('.arrival-card .whole').allInnerTexts()).toEqual(['EVERY PLACE IN THE SEA IS AWAKE.']);
  await page.click('[data-arrive="chart"]');
  await advance(page, 400);
  await pickEdge(page, 'harbor~deep');
  await page.click('[data-chart="build"]');
  s = await playThrough(page, { strategy: 'low', miss: 0.4, seed: 3 });
  expect(Object.keys(s.sea.bridges).length).toBe(10);
  expect(await page.locator('.arrival-card .whole').allInnerTexts()).toEqual(['EVERY BRIDGE IN THE SEA IS BUILT.']);
  expect(await page.locator('.gift-box').count()).toBe(0); // nothing left to give: every place has been reached before
  // with nothing left to build, the chart turns to a bridge that can still take another part
  await page.click('[data-arrive="chart"]');
  s = await advance(page, 400);
  expect(await page.locator('.chart-tally').innerText()).toMatch(/10 of 10 bridges · 7 of 7 places awake · 9 of 9 sounds/i);
  expect(await page.locator('[data-chart="add"]').count()).toBe(1);
  expect(errors).toEqual([]);
});

test('a bridge from afar can be set on the chart, swapped with one already there, or let go', async ({ page }) => {
  const errors = await boot(page);
  const link = await buildAndSend(page);
  const make = (notes, sound = 'glass', mood = 'firstlight') => page.evaluate(async ([notes, sound, mood]) => {
    const sea = await import('/afternote/src/music/sea.js');
    return sea.encodeBridge('lighthouse~chimes', { from: 'chimes', mood, bpm: 76.8, layers: [{ sound, score: notes }] });
  }, [notes, sound, mood]);
  const arrive = async (code) => {
    await page.evaluate((c) => { location.hash = 'b=' + c; }, code);
    await page.waitForFunction(() => !location.hash);
    return advance(page, 400);
  };
  const mine = (await state(page)).sea.bridges['lighthouse~chimes'];
  // somebody else's bridge on the same water: it waits beside, and mine stands
  let s = await arrive(await make([[0, 1], [6, 3]]));
  expect(s.ui.chart).toBe(true);
  expect(s.sea.afar.length).toBe(1);
  expect(s.sea.bridges['lighthouse~chimes']).toEqual(mine);
  expect(await page.locator('.chart-map .afar.sel').count()).toBe(1);
  // both of its ends have been reached, so it may change places with mine: nothing is lost
  await page.click('[data-chart="keep-afar"]');
  s = await advance(page, 300);
  expect(s.sea.bridges['lighthouse~chimes']).toMatchObject({ from: 'chimes', parts: [{ sound: 'glass', notes: 2 }] });
  expect(s.sea.afar).toEqual([{ edge: 'lighthouse~chimes', ...mine }]);
  // and back again
  await page.click('.chart-map [data-afar="0"]', { force: true });
  await page.click('[data-chart="keep-afar"]');
  s = await advance(page, 300);
  expect(s.sea.bridges['lighthouse~chimes']).toEqual(mine);
  // a bridge to somewhere not yet reached cannot be set on the chart, only heard or added to
  const far = await page.evaluate(async () => (await import('/afternote/src/music/sea.js')).encodeBridge('garden~deep', { from: 'garden', mood: 'deep', bpm: 61.4, layers: [{ sound: 'firefly', score: [[0, 0], [3, 2]] }] }));
  s = await arrive(far);
  expect(s.sea.afar.length).toBe(2);
  expect(await page.locator('[data-chart="keep-afar"]').count()).toBe(0);
  expect(await page.locator('[data-chart="listen"]').count()).toBe(1);
  // letting one go asks first
  await page.click('[data-chart="release"]');
  await page.click('[data-chart="release-no"]');
  expect((await state(page)).sea.afar.length).toBe(2);
  await page.click('[data-chart="release"]');
  await page.click('[data-chart="release-yes"]');
  s = await advance(page, 300);
  expect(s.sea.afar.length).toBe(1);
  expect(s.sea.afar[0].edge).toBe('lighthouse~chimes');
  // what is left is still there after a reload
  await page.reload();
  await page.waitForFunction(() => !!window.render_game_to_text);
  s = await advance(page, 300);
  expect(s.sea.afar.length).toBe(1);
  expect(s.sea.bridges['lighthouse~chimes']).toEqual(mine);
  expect(errors).toEqual([]);
  expect(link).toBeTruthy();
});

test('the banner, the bridges from afar and the link panel keep every control on screen in every window', async ({ page }) => {
  const errors = await boot(page);
  const codes = await page.evaluate(async () => {
    const sea = await import('/afternote/src/music/sea.js');
    const mk = (edge, from, mood, parts) => sea.encodeBridge(edge, { from, mood, bpm: 76.8, layers: parts.map(([sound, n]) => ({ sound, score: Array.from({ length: n }, (_, i) => [i * 2, (i * 3) % 5]) })) });
    return [mk('lighthouse~chimes', 'lighthouse', 'firstlight', [['bell', 20], ['harp', 12]]), mk('garden~deep', 'garden', 'deep', [['firefly', 9]]), mk('lighthouse~harp', 'harp', 'tide', [['harp', 14], ['pan', 10], ['root', 8]])];
  });
  for (const c of codes) {
    await page.evaluate((code) => { location.hash = 'b=' + code; }, c);
    await page.waitForFunction(() => !location.hash);
    await advance(page, 200);
  }
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
    expect(await onScreen('.incoming, .incoming .btn, .title-actions .btn'), `title at ${w}x${h}`).toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.click('[data-action="sea"]');
  let s = await advance(page, 600);
  expect(s.sea.afar.length).toBe(3);
  expect(await page.locator('.chart-map .afar.sel').count()).toBe(1); // the chart turns to what has just arrived
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(60);
    expect(await onScreen('.chart-map [data-afar] .disc, .chart-panel, .panel-foot .btn'), `afar at ${w}x${h}`).toEqual([]);
  }
  await page.click('.chart-map [data-afar="0"]', { force: true });
  await page.click('[data-chart="send"]');
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(60);
    expect(await onScreen('.chart-panel, .panel-foot .btn, .link-box'), `link at ${w}x${h}`).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('a link opened in the middle of a crossing waits until the crossing is over', async ({ page }) => {
  const errors = await boot(page);
  await toChart(page);
  await pickEdge(page, 'lighthouse~harp');
  await page.click('[data-chart="build"]');
  let s = await until(page, 's.phase === "play" && s.gateWaiting');
  await page.keyboard.press('Digit3');
  await advance(page, 1200);
  const code = await page.evaluate(async () => (await import('/afternote/src/music/sea.js')).encodeBridge('lighthouse~chimes', { from: 'lighthouse', mood: 'firstlight', bpm: 76.8, layers: [{ sound: 'bell', score: [[0, 0], [2, 4]] }] }));
  await page.evaluate((c) => { location.hash = 'b=' + c; }, code);
  await page.waitForFunction(() => !location.hash);
  s = await advance(page, 600);
  expect(s.phase).toBe('play');
  expect(s.sea.afar).toEqual([]); // not yet
  expect(s.entries.hits).toBe(1);
  await page.evaluate(() => window.__afternote.bot({ strategy: 'wander', miss: 0.3, seed: 2 }));
  s = await until(page, 's.ui.arrival');
  await page.evaluate(() => window.__afternote.bot(null));
  expect(s.sea.afar).toEqual([]);
  await page.click('[data-arrive="chart"]');
  s = await advance(page, 500);
  expect(s.sea.afar.length).toBe(1);
  expect(await page.locator('.chart-map .afar.sel').count()).toBe(1);
  expect(errors).toEqual([]);
});
