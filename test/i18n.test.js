import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, adviceText, avoidReasonText, cadenceText, functionText, guideToneText, noteOverChordText, reasonText, tierText,
} from '../js/theory/adviceText.js';
import { analyzeChord, findCadences, progressionAdvice } from '../js/theory/analysis.js';
import { buildChord, chordLabel } from '../js/theory/chords.js';
import { prettyName } from '../js/theory/notes.js';
import { guideTones, notesOverChord } from '../js/theory/overChord.js';
import {
  PRESETS, emptyProgression, flattenSlots, parseNumeral, presetLabel, presetProgression, setChordAt,
} from '../js/theory/progression.js';
import { SCALES, buildKey, keyIn, keyLabel, noteStatus, rootLabel, scaleLabel } from '../js/theory/scales.js';
import { suggestChords } from '../js/theory/suggest.js';
import { LANGS, sourceLabel, textFor } from '../js/theory/text/index.js';
import { detectLang } from '../js/ui/pageText.js';
import { ui } from '../js/ui/strings.js';

const n = (letter, acc = 0) => ({ letter, acc });
const C = buildKey(0, 'major');
const cmaj = buildChord(n('C'), 'maj');
const g7 = buildChord(n('G'), 'dom7');

/** Every path to a leaf of a nested object, with the leaf's type. */
function shape(value, path = '') {
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) => shape(v, path ? `${path}.${key}` : key));
  }
  return [`${path}:${typeof value}`];
}

test('Finnish names B natural H and B flat B', () => {
  assert.equal(prettyName(n('B'), 'fi'), 'H');
  assert.equal(prettyName(n('B', -1), 'fi'), 'B');
  assert.equal(prettyName({ letter: 'B', acc: -2 }, 'fi'), 'B♭');
  assert.equal(prettyName(n('B', 1), 'fi'), 'H♯');
  assert.equal(prettyName(n('E', -1), 'fi'), 'E♭');
  assert.equal(prettyName(n('B', -1), 'en'), 'B♭');
  assert.equal(prettyName(n('B'), 'en'), 'B');
});

test('chord symbols in Finnish: Bb7 is B7, B minor is Hm', () => {
  assert.equal(chordLabel(buildChord(n('B', -1), 'dom7'), 'fi'), 'B7');
  assert.equal(chordLabel(buildChord(n('B'), 'min'), 'fi'), 'Hm');
  assert.equal(chordLabel(buildChord(n('B'), 'm7b5'), 'fi'), 'Hm7♭5');
  assert.equal(chordLabel(buildChord(n('B', -1), 'dom7'), 'en'), 'B♭7');
  assert.equal(chordLabel(buildChord(n('F', 1), 'min'), 'fi'), 'F♯m');
});

test('key labels and note status in both languages', () => {
  const bFlatMajor = buildKey(10, 'major');
  const aMinor = buildKey(9, 'naturalMinor');
  const eBlues = buildKey(4, 'blues');
  assert.equal(keyLabel(C, 'en'), 'C major');
  assert.equal(keyLabel(C, 'fi'), 'C-duuri');
  assert.equal(keyLabel(bFlatMajor, 'en'), 'B♭ major');
  assert.equal(keyLabel(bFlatMajor, 'fi'), 'B-duuri');
  assert.equal(keyIn(aMinor, 'fi'), 'A-mollissa');
  assert.equal(keyIn(aMinor, 'en'), 'in A natural minor');
  assert.equal(noteStatus(true, C, 'fi'), 'Kuuluu C-duuriin');
  assert.equal(noteStatus(false, C, 'fi'), 'Ei kuulu C-duuriin');
  assert.equal(noteStatus(false, C, 'en'), 'Not in C major');
  assert.equal(keyIn(eBlues, 'fi'), 'E bluesasteikossa');
});

test('root menu labels follow the Finnish note names', () => {
  assert.equal(rootLabel(10, 'en'), 'A♯/B♭');
  assert.equal(rootLabel(10, 'fi'), 'A♯/B');
  assert.equal(rootLabel(11, 'fi'), 'H');
  assert.equal(rootLabel(11, 'en'), 'B');
  assert.equal(rootLabel(0, 'fi'), 'C');
});

test('every language names every scale, preset, source and group', () => {
  const groupIds = ['diatonic', 'borrowed', 'secondary', 'chromatic'];
  for (const lang of LANGS) {
    const text = textFor(lang);
    for (const id of Object.keys(SCALES)) assert.ok(scaleLabel(id, lang), `${lang} scale ${id}`);
    for (const id of Object.keys(PRESETS)) assert.ok(presetLabel(id, lang), `${lang} preset ${id}`);
    for (const id of groupIds) assert.ok(text.groupTitles[id], `${lang} group ${id}`);
    for (const id of ['diatonic', 'borrowed', 'secondary']) assert.ok(text.paletteTitles[id], `${lang} palette ${id}`);
    for (const id of ['diatonic', 'chromatic', 'secondary dominant', 'parallel minor', 'parallel major', 'harmonic minor']) {
      assert.ok(text.sourceLabels[id], `${lang} source ${id}`);
    }
    for (const id of ['tonic', 'subdominant', 'dominant']) assert.ok(text.functionNames[id], `${lang} function ${id}`);
    for (const role of ['R', '3', '5', '7']) assert.ok(text.roleNames[role], `${lang} role ${role}`);
  }
});

test('the language bundles and interface strings have the same shape', () => {
  const [en, fi] = LANGS.map((lang) => textFor(lang));
  assert.deepEqual(shape(fi), shape(en));
  assert.deepEqual(shape(ui('fi')), shape(ui('en')));
});

test('the explanations cover every pitch class outside the key in both languages', () => {
  for (const lang of LANGS) {
    for (const scaleId of ['major', 'naturalMinor']) {
      const key = buildKey(0, scaleId);
      for (let pc = 0; pc < 12; pc++) {
        const result = suggestChords(key, pc, lang);
        if (!result.inParent) assert.ok(result.explanation.length > 20, `${lang} ${scaleId} ${pc}`);
      }
    }
  }
  const fSharp = suggestChords(C, 6, 'fi');
  assert.match(fSharp.explanation, /^F♯ on #4\/b5: tritonus/);
  for (const group of fSharp.groups) assert.equal(group.title, textFor('fi').groupTitles[group.id]);
  assert.equal(suggestChords(C, 3, 'fi').groups.find((g) => g.id === 'borrowed').title, 'Lainasoinnut');
  assert.match(suggestChords(C, 3, 'fi').explanation, /^E♭ on b3: lainattu samannimisestä mollista/);
  assert.match(suggestChords(buildKey(0, 'majorPentatonic'), 5, 'fi').explanation, /^Ei kuulu asteikkoon "duuripentatoninen"/);
  assert.match(suggestChords(buildKey(5, 'major'), 11, 'fi').explanation, /^H on #4/);
  assert.equal(suggestChords(C, 3, 'en').explanation.startsWith('Eb is the b3: borrowed'), true);
});

test('source labels are translated part by part', () => {
  assert.equal(sourceLabel('parallel major / harmonic minor', 'fi'), 'samanniminen duuri / harmoninen molli');
  assert.equal(sourceLabel('parallel minor', 'en'), 'parallel minor');
});

test('Finnish texts exist for every advice, cadence, tier and reason', () => {
  const slotsOf = (numerals) => {
    let p = emptyProgression(numerals.length);
    numerals.forEach((num, bar) => { p = setChordAt(p, { bar, half: 0 }, parseNumeral(num, 'major')); });
    return flattenSlots(C, p);
  };
  const cases = [
    slotsOf(['I', 'V', 'vi', 'IV']), slotsOf(['ii7', 'V7', 'Imaj7']), slotsOf(['I', 'II7', 'iii']),
    slotsOf(['I', 'II7', 'V', 'I']), slotsOf(['I', 'V7']), slotsOf(['I', 'iii']),
    flattenSlots(C, setChordAt(emptyProgression(2), { bar: 0, half: 0 }, parseNumeral('I', 'major'))),
    flattenSlots(buildKey(9, 'major'), presetProgression('blues')),
    flattenSlots(buildKey(10, 'major'), presetProgression('twoFiveOne')),
  ];
  const seen = new Set();
  for (const slots of cases) {
    for (const loop of [false, true]) {
      for (const level of LEVELS) {
        for (const item of progressionAdvice(C, slots, { loop })) {
          seen.add(item.kind);
          const fi = adviceText(item, level, 'fi');
          assert.ok(fi.length > 10);
          assert.notEqual(fi, adviceText(item, level, 'en'));
          assert.doesNotMatch(fi, /undefined|\[object/);
        }
        for (const cadence of findCadences(C, slots, { loop })) {
          seen.add(cadence.type);
          const fi = cadenceText(cadence, slots, level, 'fi');
          assert.ok(fi.length > 10);
          assert.doesNotMatch(fi, /undefined|\[object/);
        }
      }
    }
  }
  for (const kind of ['starts-away-from-tonic', 'ends-on-tonic', 'ends-on-dominant', 'ends-on-subdominant', 'ends-on-other',
    'secondary-resolves', 'secondary-unresolved', 'empty-bars', 'authentic', 'plagal', 'deceptive', 'half', 'ii-V-I']) {
    assert.ok(seen.has(kind), kind);
  }
  for (const level of LEVELS) {
    for (const tier of ['chord', 'scale', 'parent', 'avoid', 'blue']) assert.ok(tierText(tier, level, 'fi'));
    for (const reason of ['secondary-target', 'resolve', 'deceptive', 'plagal', 'to-dominant', 'to-predominant',
      'tonic-substitute', 'circle', 'step', 'start-on-tonic']) assert.ok(reasonText(reason, level, 'fi'));
    for (const chord of [g7, cmaj, buildChord(n('D'), 'dom7'), buildChord(n('F'), 'min'), buildChord(n('F', 1), 'maj')]) {
      assert.doesNotMatch(functionText(analyzeChord(C, chord), C, level, 'fi'), /undefined|\[object/);
    }
  }
});

test('Finnish golden texts', () => {
  const [b, f] = guideTones(g7, cmaj);
  assert.equal(guideToneText(f, g7, cmaj, 'intermediate', 'fi'),
    'Ohjaussävel: F (soinnun G7 septimi) laskee puoliaskeleen verran ja ratkeaa sävelelle E (soinnun C terssi).');
  assert.equal(guideToneText(f, g7, cmaj, 'beginner', 'fi'), "Liu'uta sävel F alas sävelelle E, kun sointu vaihtuu sointuun C.");
  assert.match(guideToneText(b, g7, cmaj, 'intermediate', 'fi'), /nousee puoliaskeleen verran sävelelle C \(soinnun C pohjasävel\)/);

  const notes = notesOverChord(C, cmaj, analyzeChord(C, cmaj));
  assert.equal(noteOverChordText(notes[5], cmaj, 'intermediate', 'fi'), 'F soinnun C päällä: 11, vältettävä sävel.');
  assert.equal(avoidReasonText(notes[5], 'intermediate', 'fi'), 'puoliaskel soinnun terssin (E) yläpuolella');
  assert.equal(noteOverChordText(notes[4], cmaj, 'intermediate', 'fi'), 'E soinnun C päällä: terssi, soinnun sävel.');

  // B-flat is spelled B in Finnish, and B natural is H.
  const bbKey = buildKey(10, 'major');
  const bb = buildChord(n('B', -1), 'maj');
  assert.match(functionText(analyzeChord(bbKey, bb), bbKey, 'beginner', 'fi'), /^B tuntuu kodilta\.$/);
  const bMinor = buildKey(11, 'naturalMinor');
  assert.match(functionText(analyzeChord(bMinor, buildChord(n('B'), 'min')), bMinor, 'beginner', 'fi'), /^Hm tuntuu kodilta\.$/);

  let p = setChordAt(emptyProgression(2), { bar: 0, half: 0 }, parseNumeral('I', 'major'));
  p = setChordAt(p, { bar: 1, half: 0 }, parseNumeral('V7', 'major'));
  const item = progressionAdvice(C, flattenSlots(C, p), { loop: false }).find((a) => a.kind === 'ends-on-dominant');
  assert.equal(adviceText(item, 'beginner', 'fi'),
    'Viimeinen sointu, G7, haluaa kotiin sointuun C. Päätä sointuun C tai palaa alkuun.');
});

test('English output is unchanged when no language is given', () => {
  assert.equal(guideToneText(guideTones(g7, cmaj)[1], g7, cmaj, 'beginner'), 'Slide F down to E as the chord changes to C.');
  assert.equal(keyLabel(C), 'C major');
  assert.equal(suggestChords(C, 3).groups.find((g) => g.id === 'borrowed').title, 'Borrowed chords');
});

test('detectLang: the query string wins, then the browser, then English', () => {
  assert.equal(detectLang(LANGS, '?lang=fi', ['en-US']), 'fi');
  assert.equal(detectLang(LANGS, '?lang=xx', ['fi-FI', 'en']), 'fi');
  assert.equal(detectLang(LANGS, '', ['sv-SE', 'en-GB']), 'en');
  assert.equal(detectLang(LANGS, '', ['sv-SE']), 'en');
  assert.equal(detectLang(LANGS, '?lang=en', ['fi-FI']), 'en');
});
