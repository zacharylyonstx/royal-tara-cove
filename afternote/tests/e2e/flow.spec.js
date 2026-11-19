import { test, expect } from '@playwright/test';

// The game is driven through its agent hooks: ?test=1 gives a manual clock (time only moves
// when advanceTime is called), render_game_to_text() reports state, and __afternote.bot()
// plays by the rules through the same handlers a person's keys use.

const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((t) => JSON.parse(window.advanceTime(t)), ms);

/** Advance until a predicate over the state holds. `pred` is JS source using `s`. */
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

async function boot(page, query = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`/afternote/?test=1&fx=0${query}`);
  await page.waitForFunction(() => !!window.render_game_to_text);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.render_game_to_text);
  return errors;
}

test('boots clean to the title', async ({ page }) => {
  const errors = await boot(page);
  const s = await state(page);
  expect(s.phase).toBe('title');
  expect(s.ui.title).toBe(true);
  expect(errors).toEqual([]);
});

test('the first note waits, then starts everything', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-action="begin"]');
  let s = await advance(page, 4000);
  expect(s.phase).toBe('play');
  expect(s.gateWaiting).toBe(true);
  expect(s.next.offers).toEqual(['C']);
  expect(s.ui.prompt).toBe('Play the glowing note.');
  // a long wait changes nothing: no miss, no fall
  s = await advance(page, 20000);
  expect(s.gateWaiting).toBe(true);
  expect(s.entries.misses).toBe(0);
  const beatBefore = s.beat;
  // a wrong key builds nothing (5 is the note A; so is the letter A; S is no key at all)
  for (const wrong of ['Digit5', 'KeyA', 'KeyS']) {
    await page.keyboard.press(wrong);
    s = await advance(page, 100);
    expect(s.gateWaiting).toBe(true);
    expect(s.pieces).toBe(1);
  }
  // the first key (1) builds the first stone and the music moves
  await page.keyboard.press('Digit1');
  s = await advance(page, 1000);
  expect(s.gateWaiting).toBe(false);
  expect(s.entries.hits).toBe(1);
  expect(s.melody).toBe('C');
  expect(s.beat).toBeGreaterThan(beatBefore);
  expect(errors).toEqual([]);
});

test('plays movement one: keys build stones, misses get a rescue step, the Echo is born', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'high', miss: 0.15, seed: 3 }));
  let s = await until(page, 's.phase === "echoBirth"');
  expect(s.records[0]).not.toBeNull();
  expect(s.records[0].hits).toBeGreaterThan(20);
  expect(s.records[0].misses).toBeGreaterThan(0); // some notes absent, and Kite still arrived
  expect(s.records[0].choices['tide-or-arch']).toBe('high');
  s = await until(page, 's.phase === "play" && s.movement === 1');
  expect(s.echoes).toEqual([0]);
  expect(errors).toEqual([]);
});

test('plays the whole lighthouse to the end card, with crossings', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'resonant' }));
  let s = await until(page, 's.phase === "ignite"');
  expect(s.records.every((r) => r && r.misses === 0)).toBe(true);
  s = await until(page, 's.lighthouseLit');
  s = await until(page, 's.phase === "reveal"');
  expect(s.echoes).toEqual([0, 1, 2]);
  s = await until(page, 's.phase === "end"');
  expect(s.ui.end).toBe(true);
  expect(s.awake).toBeGreaterThan(0.9);
  for (const d of ['crossing1', 'crossing2', 'crossing3', 'fish', 'lantern3', 'lighthouseWheel', 'lens']) expect(s.discoveries).toContain(d);
  expect(errors).toEqual([]);
});

test('save and return: the restored island and song survive a reload', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'wander', seed: 11 }));
  const before = await until(page, 's.phase === "end"');
  await page.reload();
  await page.waitForFunction(() => !!window.render_game_to_text);
  let s = await state(page);
  expect(s.phase).toBe('title');
  expect(s.records).toEqual(before.records);
  expect(s.lighthouseLit).toBe(true);
  await page.click('[data-action="continue"]');
  s = await advance(page, 500);
  expect(s.phase).toBe('end');
  // hear my song: all three recorded parts play back
  await page.click('[data-action="listen"]');
  s = await advance(page, 3000);
  expect(s.phase).toBe('listen');
  expect(s.echoes).toEqual([0, 1, 2]);
  expect(errors).toEqual([]);
});

test('try another path replaces one movement and keeps the others', async ({ page }) => {
  const errors = await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  const first = await until(page, 's.phase === "end"');
  expect(first.records[0].choices['tide-or-arch']).toBe('low');
  await page.click('[data-action="again"]');
  await page.click('[data-action="replay"][data-value="0"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'high' }));
  let s = await advance(page, 3000);
  expect(s.phase).toBe('play');
  expect(s.replaying).toBe(true);
  expect(s.echoes).toEqual([1, 2]); // the other two keep performing
  s = await until(page, 's.phase === "end"');
  expect(s.records[0].choices['tide-or-arch']).toBe('high');
  expect(s.records[1]).toEqual(first.records[1]);
  expect(s.records[2]).toEqual(first.records[2]);
  expect(errors).toEqual([]);
});

test('leaving a replay keeps the old performance untouched', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  const first = await until(page, 's.phase === "end"');
  await page.click('[data-action="again"]');
  await page.click('[data-action="replay"][data-value="1"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'high' }));
  await until(page, 's.phase === "play" && s.beat > 20');
  await page.keyboard.press('Escape');
  await page.click('[data-action="leave"]');
  const s = await advance(page, 300);
  expect(s.phase).toBe('title');
  expect(s.records).toEqual(first.records);
});

test('pause and count-in: time stops, and resumes only after a count', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  await until(page, 's.phase === "play" && s.beat > 6');
  await page.keyboard.press('Escape');
  let s = await advance(page, 200);
  expect(s.paused).toBe(true);
  expect(s.ui.pause).toBe(true);
  const frozen = s.beat;
  s = await advance(page, 5000);
  expect(s.beat).toBe(frozen);
  expect(s.entries.misses).toBe(0);
  await page.click('[data-action="resume"]');
  s = await state(page);
  expect(s.paused).toBe(false);
  expect(s.countIn).toBeGreaterThan(0);
  expect(s.beat).toBe(frozen); // still held during the count
  s = await until(page, 's.countIn === 0', 5);
  s = await advance(page, 1000);
  expect(s.beat).toBeGreaterThan(frozen);
  // the bot carries on and nothing was silently missed while paused
  s = await until(page, 's.phase === "echoBirth"');
  expect(s.records[0].misses).toBe(0);
});

test('remap: a different key drives the same pitch', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="settings"]');
  await page.click('[data-action="remap"][data-value="0"]');
  await page.keyboard.press('KeyJ');
  let s = await state(page);
  expect(s.settings.keys[0]).toBe('KeyJ');
  await page.click('[data-action="close-settings"]');
  await page.click('[data-action="begin"]');
  s = await advance(page, 4000);
  expect(s.gateWaiting).toBe(true);
  await page.keyboard.press('Digit1'); // no longer C
  s = await advance(page, 100);
  expect(s.gateWaiting).toBe(true);
  await page.keyboard.press('KeyJ');
  s = await advance(page, 200);
  expect(s.entries.hits).toBe(1);
  expect(s.melody).toBe('C');
});

test('touch pads play notes', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  await page.goto('/afternote/?test=1&fx=0');
  await page.waitForFunction(() => !!window.render_game_to_text);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!window.render_game_to_text);
  await page.tap('[data-action="begin"]');
  let s = await advance(page, 4000);
  expect(s.gateWaiting).toBe(true);
  const box = await page.locator('.key[data-pitch="0"]').boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.tap('.key[data-pitch="0"]');
  s = await advance(page, 200);
  expect(s.entries.hits).toBe(1);
  await context.close();
});

test('a slower pace changes the tempo, not the music', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="settings"]');
  await page.click('.seg[data-setting="pace"] button[data-value="unhurried"]');
  await page.click('[data-action="close-settings"]');
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  const s = await until(page, 's.phase === "play" && s.beat > 12');
  expect(s.bpm).toBeCloseTo(96 * 0.8, 5);
  expect(s.melody.startsWith('C D E D C D E')).toBe(true);
});

test("numbers are keys, letters are notes: the HUD says which key, and typing the note's own letter works", async ({ page }) => {
  await boot(page);
  // every tile shows its note as a letter and its key as a keycap with a digit
  const tiles = await page.$$eval('.key', (els) => els.map((e) => [e.querySelector('.key-letter').textContent, e.querySelector('.key-cap').textContent]));
  expect(tiles).toEqual([['C', '1'], ['D', '2'], ['E', '3'], ['G', '4'], ['A', '5']]);
  await page.click('[data-action="begin"]');
  let s = await advance(page, 4000);
  expect(s.gateWaiting).toBe(true);
  expect(s.labels).toEqual({ mode: 'both', keys: ['1', '2', '3', '4', '5'], capsInWorld: true, notesInWorld: true });
  // reading "C" and pressing C is not a mistake
  await page.keyboard.press('KeyC');
  s = await advance(page, 200);
  expect(s.entries.hits).toBe(1);
  expect(s.melody).toBe('C');
});

test('label modes: keys only really removes the note letters; notes only removes the keycaps', async ({ page }) => {
  await boot(page);
  const visible = (sel) => page.$$eval(sel, (els) => els.filter((e) => getComputedStyle(e).display !== 'none').length);
  expect(await visible('.key .key-letter')).toBe(5);
  expect(await visible('.key .key-cap')).toBe(5);
  await page.click('[data-action="settings"]');
  await page.click('.seg[data-setting="labels"] button[data-value="keys"]');
  expect(await visible('.key .key-letter')).toBe(0);
  expect(await visible('.key .key-cap')).toBe(5);
  let s = await state(page);
  expect(s.labels.mode).toBe('keys');
  expect(s.labels.notesInWorld).toBe(false);
  await page.click('.seg[data-setting="labels"] button[data-value="notes"]');
  expect(await visible('.key .key-letter')).toBe(5);
  expect(await visible('.key .key-cap')).toBe(0);
  s = await state(page);
  expect(s.labels.capsInWorld).toBe(false);
  expect(s.labels.notesInWorld).toBe(true);
});

test('the home-row preset swaps the keys and the labels together', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="settings"]');
  await page.click('[data-action="preset-keys"][data-value="home"]');
  let s = await state(page);
  expect(s.settings.keys).toEqual(['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon']);
  expect(s.labels.keys.slice(0, 4)).toEqual(['H', 'J', 'K', 'L']);
  await page.click('[data-action="close-settings"]');
  await page.click('[data-action="begin"]');
  s = await advance(page, 4000);
  await page.keyboard.press('Digit1'); // numbers are no longer the keys
  s = await advance(page, 100);
  expect(s.gateWaiting).toBe(true);
  await page.keyboard.press('KeyH');
  s = await advance(page, 200);
  expect(s.melody).toBe('C');
});

// ---------------------------------------------------------------------------------
// Choosing a movement from the title
// ---------------------------------------------------------------------------------
const chips = (page) => page.$$eval('.movement-chip', (els) => els.map((e) => ({ state: e.dataset.state, disabled: e.disabled })));

test('the title shows three movements, and none of them is locked', async ({ page }) => {
  await boot(page);
  expect(await chips(page)).toEqual([
    { state: 'next', disabled: false },
    { state: 'open', disabled: false },
    { state: 'open', disabled: false },
  ]);
  await page.click('.movement-chip[data-value="0"]');
  const s = await advance(page, 4000);
  expect(s.phase).toBe('play');
  expect(s.movement).toBe(0);
  expect(s.gateWaiting).toBe(true);
});

test('a later movement can be played first: it has no Echo to answer, and the journey still holds together', async ({ page }) => {
  const errors = await boot(page);
  await page.click('.movement-chip[data-value="2"]');
  let s = await advance(page, 2000);
  expect(s.phase).toBe('play');
  expect(s.movement).toBe(2);
  expect(s.echoes).toEqual([]);
  await page.evaluate(() => window.__afternote.bot({ strategy: 'high' }));
  s = await until(page, 's.phase === "end"');
  expect(s.records.map((r) => !!r)).toEqual([false, false, true]);
  expect(s.lighthouseLit).toBe(true);
  // home again: the other two are still there to play, in either order
  await page.evaluate(() => window.__afternote.game.conductor.leave());
  s = await advance(page, 300);
  expect(s.ui.movements).toEqual(['next', 'open', 'done']);
  await page.click('.movement-chip[data-value="1"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  s = await until(page, 's.phase === "title" || s.phase === "end" || (s.phase === "play" && s.movement !== 1)');
  expect(s.records.map((r) => !!r)).toEqual([false, true, true]);
  expect(errors).toEqual([]);
});

test('finishing a movement marks it done on the title, and the next one can be started from there', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  await until(page, 's.phase === "play" && s.movement === 1 && s.beat > 2');
  await page.keyboard.press('Escape');
  await page.click('.overlay:not(.hidden) [data-action="leave"]');
  let s = await advance(page, 300);
  expect(s.phase).toBe('title');
  expect(await chips(page)).toEqual([
    { state: 'done', disabled: false },
    { state: 'next', disabled: false },
    { state: 'open', disabled: false },
  ]);
  await page.click('.movement-chip[data-value="1"]');
  s = await advance(page, 2000);
  expect(s.phase).toBe('play');
  expect(s.movement).toBe(1);
  expect(s.replaying).toBe(false);
  expect(s.echoes).toEqual([0]); // the first Echo is there to play with
});

test('a finished movement chosen from the title is replayed, and replaced only when finished', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  const first = await until(page, 's.phase === "end"');
  await page.reload();
  await page.waitForFunction(() => !!window.render_game_to_text);
  expect((await chips(page)).map((c) => c.state)).toEqual(['done', 'done', 'done']);
  // start replaying II, then leave: nothing changes
  await page.click('.movement-chip[data-value="1"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'high' }));
  let s = await until(page, 's.phase === "play" && s.beat > 12');
  expect(s.movement).toBe(1);
  expect(s.replaying).toBe(true);
  expect(s.echoes).toEqual([0, 2]);
  await page.keyboard.press('Escape');
  await page.click('.overlay:not(.hidden) [data-action="leave"]');
  s = await advance(page, 300);
  expect(s.records).toEqual(first.records);
  // replay I to the end: only I changes, and with everything recorded we arrive at the end card
  await page.click('.movement-chip[data-value="0"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'high' }));
  s = await until(page, 's.phase === "end"');
  expect(s.records[0].choices['tide-or-arch']).toBe('high');
  expect(s.records[1]).toEqual(first.records[1]);
  expect(s.records[2]).toEqual(first.records[2]);
});

test('replaying the first movement mid-journey carries on into the next unfinished one', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  await until(page, 's.phase === "play" && s.movement === 1 && s.beat > 2');
  await page.keyboard.press('Escape');
  await page.click('.overlay:not(.hidden) [data-action="leave"]');
  await advance(page, 300);
  await page.click('.movement-chip[data-value="0"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'high' }));
  let s = await advance(page, 1000);
  expect(s.replaying).toBe(true);
  s = await until(page, 's.phase === "play" && s.movement === 1');
  expect(s.records[0].choices['tide-or-arch']).toBe('high');
  expect(s.replaying).toBe(false);
});

test('begin again asks before clearing a journey', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  await until(page, 's.phase === "play" && s.movement === 1 && s.beat > 2');
  await page.keyboard.press('Escape');
  await page.click('.overlay:not(.hidden) [data-action="leave"]');
  const before = await advance(page, 300);
  await page.click('.title-screen [data-action="begin"]');
  let s = await advance(page, 300);
  expect(s.phase).toBe('title');
  expect(s.ui.confirm).toBe(true);
  await page.click('[data-action="cancel-begin"]');
  s = await advance(page, 300);
  expect(s.ui.confirm).toBe(false);
  expect(s.records).toEqual(before.records);
  await page.click('.title-screen [data-action="begin"]');
  await page.click('[data-action="confirm-begin"]');
  s = await advance(page, 1000);
  expect(s.phase).toBe('play');
  expect(s.movement).toBe(0);
  expect(s.records).toEqual([null, null, null]);
});

// ---------------------------------------------------------------------------------
// Layout: nothing is ever cut off, whatever the window's shape
// ---------------------------------------------------------------------------------
const SIZES = [[1240, 615], [1920, 1080], [1024, 600], [844, 390], [390, 844], [2560, 1300]];

test('the title fits every window: the logo is never cut off and every control is on screen', async ({ page }) => {
  await boot(page);
  // the fullest title: a journey in progress shows both buttons, the three movements and the hint
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  await until(page, 's.phase === "play" && s.movement === 1 && s.beat > 2');
  await page.keyboard.press('Escape');
  await page.click('.overlay:not(.hidden) [data-action="leave"]');
  await advance(page, 300);
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    const boxes = await page.evaluate(() => {
      const box = (sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      return {
        logo: box('.logo'),
        cont: box('.title-screen [data-action="continue"]'),
        begin: box('.title-screen [data-action="begin"]'),
        chips: [...document.querySelectorAll('.movement-chip')].map((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }),
      };
    });
    const label = `${w}x${h}`;
    expect(boxes.logo.top, `${label} logo top`).toBeGreaterThanOrEqual(0);
    expect(boxes.logo.left, `${label} logo left`).toBeGreaterThanOrEqual(0);
    for (const b of [boxes.cont, boxes.begin, ...boxes.chips]) {
      expect(b.top, `${label} control top`).toBeGreaterThanOrEqual(0);
      expect(b.bottom, `${label} control bottom`).toBeLessThanOrEqual(h);
      expect(b.left, `${label} control left`).toBeGreaterThanOrEqual(0);
      expect(b.right, `${label} control right`).toBeLessThanOrEqual(w);
    }
  }
});

test('in play, the keys, the prompt and the pause button stay on screen in every window', async ({ page }) => {
  await boot(page);
  await page.click('[data-action="begin"]');
  await advance(page, 4000);
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    const r = await page.evaluate(() => {
      const b = (el) => { const x = el.getBoundingClientRect(); return { top: x.top, bottom: x.bottom, left: x.left, right: x.right }; };
      return { keys: [...document.querySelectorAll('.key')].map(b), prompt: b(document.querySelector('.prompt')), pause: b(document.querySelector('.pause-btn')) };
    });
    const label = `${w}x${h}`;
    for (const k of [...r.keys, r.prompt, r.pause]) {
      expect(k.top, `${label} top`).toBeGreaterThanOrEqual(0);
      expect(k.bottom, `${label} bottom`).toBeLessThanOrEqual(h);
      expect(k.left, `${label} left`).toBeGreaterThanOrEqual(0);
      expect(k.right, `${label} right`).toBeLessThanOrEqual(w);
    }
    // the prompt never sits on the keys
    const keysTop = Math.min(...r.keys.map((k) => k.top));
    expect(r.prompt.bottom <= keysTop || r.prompt.top < h * 0.4, `${label} prompt clear of keys`).toBe(true);
  }
});

test('settings always keeps Done in reach, and pausing during playback offers no restart', async ({ page }) => {
  await boot(page);
  for (const [w, h] of [[1240, 615], [844, 390], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.click('.title-screen [data-action="settings"]');
    const done = await page.locator('[data-action="close-settings"]').boundingBox();
    expect(done.y, `${w}x${h}`).toBeGreaterThanOrEqual(0);
    expect(done.y + done.height, `${w}x${h}`).toBeLessThanOrEqual(h);
    await page.click('[data-action="close-settings"]');
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.click('[data-action="begin"]');
  await page.evaluate(() => window.__afternote.bot({ strategy: 'low' }));
  await until(page, 's.phase === "end"');
  await page.click('[data-action="listen"]');
  await advance(page, 2000);
  await page.keyboard.press('Escape');
  let s = await advance(page, 200);
  expect(s.paused).toBe(true);
  expect(await page.locator('.overlay:not(.hidden) [data-action="restart-phrase"]').isVisible()).toBe(false);
  await page.click('.overlay:not(.hidden) [data-action="resume"]');
  s = await until(page, 's.countIn === 0 && !s.paused', 5);
  expect(s.phase).toBe('listen');
});
