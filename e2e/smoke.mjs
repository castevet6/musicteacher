// The AGENTS.md "done means" check: on both instruments in Explore, a
// chromatic note click lists chords and a chord click highlights its tones;
// the page fits the width and logs no errors.
// Usage: node e2e/smoke.mjs [viewport width]
import { session } from './lib.mjs';

const t = await session('smoke');
const { page } = t;

for (const instrument of ['Guitar', 'Piano']) {
  await t.step(`${instrument}: chromatic note and chord`, async () => {
    await t.pick(instrument);
    const view = `#${instrument.toLowerCase()}`;
    // C major is the default key; pc 1 (C♯/D♭) is outside it.
    await page.locator(`${view} .pos[data-pc="1"]`).first().click({ force: true });
    const chords = page.locator('#chords .chord');
    await chords.first().waitFor();
    t.check((await chords.count()) > 0, `${instrument}: a chromatic note lists chords`, `${await chords.count()} chords`);
    await chords.first().click();
    const tones = await page.locator(`${view} .pos.chord-tone`).count();
    t.check(tones > 0, `${instrument}: a chord click lights its tones`, `${tones} positions`);
    await page.keyboard.press('Escape');
  });
}

await t.noOverflow();
await t.finish();
