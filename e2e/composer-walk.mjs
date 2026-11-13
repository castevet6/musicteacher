// The Composer walkthrough of IMPLEMENTATION-PLAN.md §8, steps 7–15, with the
// values verified when the Composer shipped as the expected results.
// Usage: node e2e/composer-walk.mjs [viewport width] [guitar|piano]
import { session } from './lib.mjs';

const instrument = process.argv[3] ?? 'guitar';
const t = await session(`walk-${instrument}`);
const { page } = t;
const R = (lane) => `#${lane}-roll`;
const notes = (lane) => page.$$eval(`${R(lane)} .note`, (els) => els.map((e) => `${e.dataset.start}:${e.querySelector('.note-label')?.textContent ?? '?'}${e.dataset.rules ? `[${e.dataset.rules}]` : ''}`).join(' '));
const dots = () => page.$$eval('.bars .slot', (els) => els.map((e) => e.querySelector('.fit-dot')?.dataset.fit ?? '-').join(' '));
const slots = () => page.$$eval('.bars .slot', (els) => els.map((e) => e.querySelector('.slot-symbol')?.textContent || '·').join(' '));
const ghosts = (lane) => page.$$eval(`${R(lane)} .ghost`, (els) => els.map((e) => `${e.dataset.midi}:${e.dataset.reason}`).join(' '));
const text = async (sel) => ((await page.textContent(sel).catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
/** FAIL unless `actual` equals `expected`; both shown on failure. */
const is = (label, actual, expected) => t.check(actual === expected, label, actual === expected ? '' : `got "${actual}", want "${expected}"`);

if (instrument === 'piano') await t.pick('Piano');
await t.composer();

await t.step('7 preset and chord tones', async () => {
  await page.locator('.bars .slot').first().click();
  is('7 chords', await slots(), 'C G Am F');
  is('7 lit chord tones', await page.$$eval('.pos.chord-tone', (els) => [...new Set(els.map((e) => e.dataset.pc))].sort((a, b) => a - b).join(',')), '0,4,7');
});

await t.step('8 avoid note', async () => {
  await dragNote('melody', 0, 20, 65);
  await page.locator(`${R('melody')} .note`).first().click();
  is('8 melody', await notes('melody'), '0:F[nct-strong-beat avoid-held bar-no-chord-tone ends-off-chord]');
  is('8 dots', await dots(), 'clash - - -');
  is('8 ghosts', await ghosts('melody'), '64:resolves 67:chord-tone 60:leap-to-chord-tone');
  await page.keyboard.press('Delete');
  is('8 after delete', await notes('melody'), '');
});

await t.step('9 chord ranking', async () => {
  await page.keyboard.press('Escape');
  await dragNote('melody', 48, 68, 64);
  await dragNote('melody', 72, 92, 67);
  await page.click('.strip-toolbar [data-act=clear]');
  await page.locator('.bars .slot').nth(1).click();
  is('9 ranking', await page.$$eval('#chords [data-id^=rank-]', (els) => els.slice(0, 4).map((e) => e.dataset.id).join(' ')), 'rank-C rank-Em rank-Cmaj7 rank-Em7');
  await page.locator('#chords [data-id^=rank-]').first().click();
  is('9 chords', await slots(), '+ C + +');
  is('9 dots', await dots(), '- good - -');
});

await t.step('10 key guess and undo', async () => {
  await page.selectOption('[name=preset]', { index: 1 });
  await page.locator('[data-act=keep]').click({ timeout: 1000 }).catch(() => {});
  await page.locator('[data-act=suggest-key]').click();
  is('10 key guess', await page.$$eval('.key-pick', (els) => els.map((e) => e.getAttribute('aria-label')).join(' | ')), 'Use A natural minor | Use G major | Use C major');
  await page.locator('.key-pick').nth(1).click();
  is('10 applied key', `${await page.inputValue('[name=root]')} ${await page.inputValue('[name=scale]')}`, '7 major');
  is('10 melody unmoved', await notes('melody'), '48:E[nct-strong-beat] 72:G');
  await page.click('[data-act=undo]');
  is('10 undo key', await page.inputValue('[name=root]'), '0');
});

await t.step('11 walking bass and playback', async () => {
  await page.keyboard.press('Escape');
  await page.click('[data-id=panel-tab-bass]');
  await page.click('[data-id=pattern-scope-all]', { timeout: 1000 }).catch(() => {});
  await page.click('[data-id=pattern-walking]');
  is('11 bass', await notes('bass'), '0:C 12:E 24:G 36:F♯ 48:G 60:B 72:D 84:A♭ 96:A 108:C 120:E 132:E 144:F 156:A 168:C 180:B');
  await page.click('[data-act=play]');
  await page.waitForTimeout(250);
  const lit = await page.$$eval(`#${instrument} .pos.sounding`, (els) => els.map((e) => `${e.dataset.midi}${e.classList.contains('sounding-bass') ? 'b' : 'm'}`).join(' '));
  is('11 lit bass', lit, instrument === 'guitar' ? '48b 48b' : '36b');
  await page.click('[data-act=play]');
  await page.locator('.bars .slot').nth(1).click();
  await page.locator('[data-act=play-from]').click();
  await page.waitForTimeout(200);
  is('11 play from bar 2', await page.$$eval('.bars .slot', (els) => els.findIndex((e) => e.dataset.playing === 'true')), 1);
  await page.click('[data-act=play]');
});

await t.step('12 bass clash', async () => {
  await page.click(`${R('bass')} .roll-clear`);
  await page.click(`${R('melody')} .roll-clear`);
  await t.rollClick('melody', 0, 65);
  await page.keyboard.press('Escape');
  await t.rollClick('bass', 0, 40);
  is('12 bass', await notes('bass'), '0:?[clash-with-melody]');
  await page.keyboard.press('Escape');
});

await t.step('13 transpose', async () => {
  await page.selectOption('[name=root]', '2');
  await page.locator('[data-act=transpose]').click();
  is('13 chords', await slots(), 'D A Bm G');
});

await t.step('14 file round trip and undo', async () => {
  await page.fill('[name=title]', 'Walk test');
  await page.locator('[name=title]').blur();
  const before = `${await slots()} | ${await notes('melody')} | ${await notes('bass')}`;
  const { file } = await t.exportJson('walk');
  await page.click(`${R('bass')} .roll-clear`);
  await page.click(`${R('melody')} .roll-clear`);
  await t.importFile(file);
  is('14 round trip', `${await slots()} | ${await notes('melody')} | ${await notes('bass')}`, before);
  is('14 title', await page.inputValue('[name=title]'), 'Walk test');
  const kept = await notes('melody');
  await page.locator(`${R('melody')} .note`).first().click();
  await page.keyboard.press('Delete');
  is('14 deleted', await notes('melody'), '');
  await page.click('[data-act=undo]');
  is('14 undo brings it back', await notes('melody'), kept);
});

await t.step('15 beginner and Finnish', async () => {
  await t.pick('Beginner');
  await page.click('[data-id=panel-tab-piece]');
  t.check((await text('#chords')).includes('Off the chord on a strong beat'), '15 beginner piece remark');
  await t.pick('Suomi');
  for (const tab of ['chord', 'melody', 'bass', 'piece']) {
    await page.click(`[data-id=panel-tab-${tab}]`);
    await t.noOverflow(`15 fi ${tab} tab fits`);
  }
  is('15 fi chords (B is H)', await slots(), 'D A Hm G');
});

await t.finish();

/** Draw a note from `from` and drag it to `to` (ticks), then deselect. */
async function dragNote(lane, from, to, midi) {
  const cell = (tick) => page.evaluate(([sel, tick, midi]) => {
    const roll = document.querySelector(sel);
    const svg = roll.querySelector('.roll-svg');
    const css = getComputedStyle(roll);
    const barW = parseFloat(css.getPropertyValue('--bar-width'));
    const gap = parseFloat(css.getPropertyValue('--bar-gap'));
    const rowH = parseFloat(css.getPropertyValue('--roll-row'));
    const high = Number(roll.querySelector('.roll-label').dataset.midi);
    const bar = Math.floor(tick / 48);
    return {
      x: svg.getBoundingClientRect().left + bar * (barW + gap) + ((tick % 48) / 48) * barW + 3,
      y: svg.getBoundingClientRect().top + (high - midi) * rowH + rowH / 2,
    };
  }, [R(lane), tick, midi]);
  await page.locator(`${R(lane)} .roll-label[data-midi="${midi}"]`).scrollIntoViewIfNeeded();
  const a = await cell(from);
  const b = await cell(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
}
