// Shared browser-check helpers for Music Teacher. A check script is a short
// list of steps; this module owns the browser, error collection, timeouts,
// OK/FAIL reporting and the common page moves.
//
//   import { session } from './lib.mjs';
//   const t = await session('sound-m3');             // width from argv[2], default 1400
//   await t.step('faders at 75', async () => {
//     t.check(await t.page.inputValue('.mix-level[name=level-melody]') === '75', 'melody at 75');
//   });
//   await t.finish();                                  // prints the report, exits 1 on any FAIL
//
// Needs `npm run serve` (http://localhost:8000). Nobody hears the audio:
// checks read state, DOM, exported files and errors. Screenshots and
// downloads go to e2e/out/ (gitignored).

import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

export const URL_ROOT = process.env.MT_URL ?? 'http://localhost:8000';
export const SHOTS = new URL('./out/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const STEP_TIMEOUT = 5000; // one Playwright wait; a missing selector fails fast
const RUN_TIMEOUT = 90000; // the whole script; a hung run exits instead of lingering

/**
 * Open the app at `width` (argv[2], default 1400) and return the test kit.
 * @param {string} name script name, used as the prefix of screenshots and downloads
 */
export async function session(name, { width = Number(process.argv[2] ?? 1400), height = 1000, runTimeout = RUN_TIMEOUT } = {}) {
  const lines = [];
  const errors = [];
  const tag = `[${name} ${width}]`;
  const report = () => {
    console.log(tag);
    for (const line of lines) console.log(line);
    for (const e of errors) console.log(`  ${e}`);
  };
  const killer = setTimeout(() => {
    lines.push(`FAIL run timed out after ${runTimeout / 1000} s`);
    report();
    process.exit(2);
  }, runTimeout);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width, height }, acceptDownloads: true })).newPage();
  page.setDefaultTimeout(STEP_TIMEOUT);
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  const t = {
    page,
    width,
    mobile: width < 600,

    /** Record one OK/FAIL line. */
    check(ok, label, detail = '') {
      lines.push(`${ok ? 'OK' : 'FAIL'} ${label}${detail !== '' ? ` (${detail})` : ''}`);
      return ok;
    },

    /** Run one named step; a thrown error becomes a FAIL line and the script goes on. */
    async step(label, fn) {
      try {
        await fn();
      } catch (error) {
        t.check(false, `${label}: script error`, String(error.message).split('\n')[0]);
      }
    },

    /** Click a segmented-control label by its visible text: Composer, Explore, Guitar, Piano, Suomi, English… */
    async pick(text) {
      await page.locator(`label:has-text("${text}")`).first().click();
    },

    /** Switch to Composer and load a progression preset (index 1 = the first real preset). */
    async composer({ preset = 1 } = {}) {
      await t.pick('Composer');
      if (preset !== null) await page.selectOption('[name=preset]', { index: preset });
    },

    /** Click a roll cell: `lane` 'melody' | 'bass', `tick` from bar 1 (48 per bar), `midi` the row. */
    async rollClick(lane, tick, midi) {
      const sel = `#${lane}-roll`;
      await page.locator(`${sel} .roll-label[data-midi="${midi}"]`).scrollIntoViewIfNeeded();
      const p = await page.evaluate(([sel, tick, midi]) => {
        const roll = document.querySelector(sel);
        const svg = roll.querySelector('.roll-svg');
        const css = getComputedStyle(roll);
        const barW = parseFloat(css.getPropertyValue('--bar-width'));
        const gap = parseFloat(css.getPropertyValue('--bar-gap'));
        const rowH = parseFloat(css.getPropertyValue('--roll-row'));
        const high = Number(roll.querySelector('.roll-label').dataset.midi);
        const timeline = document.querySelector('#timeline');
        const bar = Math.floor(tick / 48);
        const xAt = () => svg.getBoundingClientRect().left + bar * (barW + gap) + ((tick % 48) / 48) * barW + 3;
        let x = xAt();
        if (x > innerWidth - 20 || x < 60) {
          timeline.scrollLeft = Math.max(0, timeline.scrollLeft + x - innerWidth / 2);
          timeline.dispatchEvent(new Event('scroll'));
          x = xAt();
        }
        return { x, y: svg.getBoundingClientRect().top + (high - midi) * rowH + rowH / 2 };
      }, [sel, tick, midi]);
      await page.mouse.click(p.x, p.y);
    },

    /** Set a range input and fire `input`, as a drag would. */
    async setRange(selector, value) {
      await page.locator(selector).evaluate((el, v) => {
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
    },

    /** Press Export and return the saved composition file: { file, json }. */
    async exportJson(label = 'export') {
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=export]')]);
      const file = `${SHOTS}${name}-${width}-${label}-${download.suggestedFilename()}`;
      await download.saveAs(file);
      return { file, json: JSON.parse(readFileSync(file, 'utf8')) };
    },

    /** Import a composition file through the file input (confirms "Replace" when asked). */
    async importFile(file) {
      await page.setInputFiles('input[name=import]', file);
      await page.waitForTimeout(150); // an empty composition loads at once, otherwise "Replace?" appears
      const replace = page.locator('#file-prompt [data-act=replace]:visible');
      if (await replace.count()) await replace.click();
    },

    /** FAIL unless the page fits the viewport (no sideways scroll). */
    async noOverflow(label = 'no horizontal scroll') {
      const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      t.check(scroll <= inner, label, `scrollWidth ${scroll} / innerWidth ${inner}`);
    },

    /** Screenshot the page, or one element by selector, to shots/<name>-<width>-<label>.png. */
    async shot(label, selector = null) {
      const path = `${SHOTS}${name}-${width}-${label}.png`;
      await (selector ? page.locator(selector).screenshot({ path }) : page.screenshot({ path }));
      return path;
    },

    /** Print the report, close the browser and exit: 0 when every line is OK, 1 otherwise. */
    async finish() {
      t.check(errors.length === 0, 'no page or console errors', errors.length ? `${errors.length}` : '');
      clearTimeout(killer);
      report();
      await browser.close();
      process.exit(lines.some((l) => l.startsWith('FAIL')) ? 1 : 0);
    },
  };

  try {
    await page.goto(`${URL_ROOT}/?lang=en`); // English whatever the browser locale
    await page.waitForSelector('.guitar');
  } catch (error) {
    t.check(false, `app did not load at ${URL_ROOT}; is \`npm run serve\` running?`, String(error.message).split('\n')[0]);
    await t.finish();
  }
  return t;
}
