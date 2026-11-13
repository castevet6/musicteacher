// `npm run e2e`: every lasting browser check, one at a time, at desktop width
// and at 375 px. Exits 1 if any run fails. Needs `npm run serve` up.
import { spawnSync } from 'node:child_process';

const dir = new URL('.', import.meta.url).pathname;
const RUNS = [
  ['smoke.mjs', '1400'], ['smoke.mjs', '375'],
  ['sound.mjs', '1400'], ['sound.mjs', '375'],
  ['composer-walk.mjs', '1400', 'guitar'], ['composer-walk.mjs', '375', 'guitar'],
  ['composer-walk.mjs', '1400', 'piano'], ['composer-walk.mjs', '375', 'piano'],
];

const failed = [];
for (const [script, ...args] of RUNS) {
  const { status } = spawnSync(process.execPath, [`${dir}${script}`, ...args], { stdio: 'inherit' });
  if (status !== 0) failed.push(`${script} ${args.join(' ')}`);
}
console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : `\nAll ${RUNS.length} runs passed.`);
process.exit(failed.length ? 1 : 0);
