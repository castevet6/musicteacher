// The sound engine (IMPLEMENTATION-PLAN.md §11): playback and Stop run clean,
// the mixer faders save to the file and reset on double-click, and the sound
// editor keeps on OK and reverts on Cancel, Escape and a backdrop click.
// Usage: node e2e/sound.mjs [viewport width]
import { session } from './lib.mjs';

const t = await session('sound');
const { page } = t;
const fader = (lane) => page.locator(`.mix-level[name=level-${lane}]`);
const dialog = () => page.locator('dialog.sound-editor[open]');
const closed = () => page.waitForFunction(() => !document.querySelector('dialog.sound-editor[open]'));
const preset = () => dialog().locator('select[name=sound-preset]');
const melodyPreset = async (label) => (await t.exportJson(label)).json.sounds?.melody?.preset;
const playing = (on) => page.waitForFunction((on) => document.querySelector('[data-act=play]').getAttribute('aria-pressed') === String(on), on);

async function openMelody() {
  await page.click('.mix-lane[data-lane=melody] [data-act=sound]');
  await dialog().waitFor();
}
async function press(name) {
  await dialog().getByRole('button', { name, exact: true }).click();
  await closed();
}

await t.composer();

await t.step('play and stop', async () => {
  await t.rollClick('melody', 0, 64);
  await t.rollClick('bass', 0, 36);
  await page.keyboard.press('Escape');
  await page.click('[data-act=play]');
  await page.waitForTimeout(1500);
  await page.click('[data-act=play]');
  await playing(false);
  t.check(true, 'played 1.5 s and stopped');
});

await t.step('faders', async () => {
  const values = await Promise.all(['chords', 'melody', 'bass', 'click'].map((lane) => fader(lane).inputValue()));
  t.check(values.every((v) => v === '75'), 'four faders at 75', values.join(' '));
  await fader('melody').fill('30');
  const { json } = await t.exportJson('levels');
  t.check(json.levels?.melody === 30, 'a level is saved in the file', JSON.stringify(json.levels));
  await fader('melody').dblclick();
  await page.waitForTimeout(100);
  t.check((await fader('melody').inputValue()) === '75', 'double-click resets to 75');
});

await t.step('cancel reverts, a slider makes custom', async () => {
  await openMelody();
  await preset().selectOption('flute');
  await t.setRange('dialog.sound-editor #sound-cutoff', 50);
  t.check((await preset().inputValue()) === 'custom', 'moving a slider turns the preset to custom');
  await press('Cancel');
  const got = await melodyPreset('cancel');
  t.check(got === 'softLead', 'Cancel reverts', got);
});

let fluteFile;
await t.step('OK keeps', async () => {
  await openMelody();
  await preset().selectOption('flute');
  await press('OK');
  const { file, json } = await t.exportJson('ok');
  fluteFile = file;
  t.check(json.sounds?.melody?.preset === 'flute', 'OK keeps the change', json.sounds?.melody?.preset);
});

await t.step('Escape reverts', async () => {
  await openMelody();
  await preset().selectOption('squareLead');
  await page.keyboard.press('Escape');
  await closed();
  const got = await melodyPreset('escape');
  t.check(got === 'flute', 'Escape closes and reverts', got);
});

await t.step('backdrop or full-screen sheet', async () => {
  await openMelody();
  await preset().selectOption('brightSaw');
  if (t.mobile) {
    const box = await dialog().boundingBox();
    t.check(box.x === 0 && Math.round(box.width) === t.width, 'the editor is a full-screen sheet', JSON.stringify(box));
    await press('Cancel');
  } else {
    await page.mouse.click(5, 5);
    await closed();
    const got = await melodyPreset('backdrop');
    t.check(got === 'flute', 'a backdrop click reverts', got);
  }
});

await t.step('reset and preview', async () => {
  await openMelody();
  await dialog().getByRole('button', { name: 'Reset to default', exact: true }).click();
  t.check((await preset().inputValue()) === 'softLead', 'Reset loads the default preset');
  await press('Cancel');
  await page.click('[data-act=play]');
  await playing(true);
  await openMelody();
  t.check(await dialog().getByRole('button', { name: '▶ Preview' }).isDisabled(), 'Preview is disabled while playing');
  await press('Cancel');
  await page.click('[data-act=play]');
  await playing(false);
});

await t.step('import keeps sounds', async () => {
  await t.pick('Explore');
  await t.composer({ preset: null });
  await t.importFile(fluteFile);
  await openMelody();
  t.check((await preset().inputValue()) === 'flute', 'an imported file brings its sounds', await preset().inputValue());
  await t.noOverflow('no horizontal scroll with the editor open');
  await t.shot('editor-en');
  await press('Cancel');
});

await t.step('Finnish', async () => {
  await t.pick('Suomi');
  await openMelody();
  const title = await dialog().locator('.sound-title').textContent();
  t.check(title === 'Melodian ääni', 'the editor is in Finnish', title);
  await t.shot('editor-fi');
  await press('Peruuta');
});

await t.finish();
