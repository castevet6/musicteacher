import { mod12 } from './notes.js';
import { textFor } from './text/index.js';

/** Why `pc` is outside the key's parent scale, and how it is usually used. */
export function explain(key, pc, { isBlueNote = false, note, lang } = {}) {
  const { explain: words, noteName } = textFor(lang);
  const distance = mod12(pc - key.rootPc);
  const text = words.texts[key.parent][distance] ?? words.fallback;
  const body = note ? words.is(noteName(note), text) : text;
  return (isBlueNote ? words.blue : '') + body;
}
