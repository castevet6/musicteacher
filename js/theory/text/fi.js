// Finnish words for the theory output; mirrors text/en.js. Note names follow
// the Finnish convention (H is B natural, B is B♭) and come out as display
// glyphs. Where a chord symbol needs a case ending it is written as a
// compound ("C7-sointu") or the sentence is built so the symbol stays bare.

import { chordLabel, diatonicChords } from '../chords.js';
import { prettyName } from '../notes.js';

// Nominative, genitive and translative of the chord-tone names.
const ROLES = {
  R: ['pohjasävel', 'pohjasävelen', 'pohjasäveleksi'],
  3: ['terssi', 'terssin', 'terssiksi'],
  5: ['kvintti', 'kvintin', 'kvintiksi'],
  7: ['septimi', 'septimin', 'septimiksi'],
};
const ROLE_NAMES = Object.fromEntries(Object.entries(ROLES).map(([role, forms]) => [role, forms[0]]));

const S = (chord) => chordLabel(chord, 'fi');
const N = (note) => prettyName(note, 'fi');
const pick = (level, texts) => texts[level] ?? texts.intermediate;
const tonicOf = (key) => diatonicChords(key)[0].chord;

const SOURCE_LABELS = {
  diatonic: 'diatoninen',
  chromatic: 'kromaattinen',
  'secondary dominant': 'välidominantti',
  'parallel minor': 'samanniminen molli',
  'parallel major': 'samanniminen duuri',
  'harmonic minor': 'harmoninen molli',
};
const SOURCE_FROM = {
  'parallel minor': 'samannimisestä mollista',
  'parallel major': 'samannimisestä duurista',
  'harmonic minor': 'harmonisesta mollista',
};
const mapSources = (label, table) => label.split(' / ').map((id) => table[id] ?? id).join(' / ');

/** What the chord does in the key. */
function functionText(analysis, key, level) {
  const { chord, roman } = analysis;
  const s = S(chord);
  const home = S(tonicOf(key));
  const target = analysis.target && S(analysis.target);
  let text;
  if (analysis.source === 'secondary') {
    text = pick(level, {
      beginner: `${s} on "osoitinsointu": se vetää kohti sointua ${target}.`,
      intermediate: `${roman}: välidominantti. Se lainaa V-soinnun vetovoiman ja johtaa sointuun ${target}.`,
    });
  } else if (analysis.function === 'tonic') {
    text = pick(level, {
      beginner: `${s} tuntuu kodilta.`,
      intermediate: `${roman}: tonikatoiminto, levon paikka.`,
    });
  } else if (analysis.function === 'subdominant') {
    text = pick(level, {
      beginner: `${s} lähtee pois kodista ja valmistelee seuraavaa sointua.`,
      intermediate: `${roman}: subdominanttitoiminto (esidominantti). Se etääntyy I-soinnusta ja johtaa usein V-sointuun.`,
    });
  } else if (analysis.function === 'dominant') {
    text = pick(level, {
      beginner: `${s} luo jännitettä ja haluaa kotiin, sointuun ${home}.`,
      intermediate: `${roman}: dominanttitoiminto. Sen jännite haluaa purkautua I-sointuun (${home}).`,
    });
  } else {
    text = pick(level, {
      beginner: `${s} tulee sävellajin ulkopuolelta, joten se kuulostaa yllättävältä.`,
      intermediate: `${roman}: kromaattinen sointu, sävellajin ja sen tavallisten lainojen ulkopuolelta.`,
    });
  }
  if (analysis.source === 'borrowed') {
    text += pick(level, {
      beginner: ' Se on lainattu läheiseltä sävellajilta, mikä antaa sille erilaisen värin.',
      intermediate: ` Lainattu: ${mapSources(analysis.sourceLabel, SOURCE_FROM)}.`,
    });
  }
  if (analysis.alsoActsAs) {
    text += pick(level, {
      beginner: ` Se voi myös johtaa voimakkaasti sointuun ${target}.`,
      intermediate: ` Dominanttiseptimisointuna se voi toimia myös ${analysis.alsoActsAs}-soinnun tavoin ja johtaa sointuun ${target}.`,
    });
  }
  return text;
}

const barList = (bars) => bars.join(', ');

/** One item from progressionAdvice(). */
function adviceText(item, level) {
  const p = item.params;
  const chord = p.chord && S(p.chord);
  const tonic = p.tonic && S(p.tonic);
  const target = p.target && S(p.target);
  const next = p.next && S(p.next);
  switch (item.kind) {
    case 'starts-away-from-tonic':
      return pick(level, {
        beginner: `Sointukulku alkaa soinnulla ${chord}, kaukana kodista (${tonic}). Korva odottaa sointua ${tonic}.`,
        intermediate: `Alkaa tonikan ulkopuolelta: ensin ${chord}, joten I (${tonic}) viivästyy ja sävellaji rakentuu vähitellen.`,
      });
    case 'ends-on-tonic':
      return pick(level, {
        beginner: `Se päättyy soinnulle ${chord}, kotiin, joten se kuulostaa valmiilta.`,
        intermediate: `Päättyy tonikaan (${p.roman}): sointukulku on ratkennut.`,
      });
    case 'ends-on-dominant':
      if (p.turnaround) {
        return pick(level, {
          beginner: `Viimeinen sointu, ${chord}, haluaa sointuun ${target}. Kun kierros alkaa alusta, se pääsee sinne, joten toisto pysyy liikkeessä.`,
          intermediate: `Päättyy soinnulle ${p.roman}: kiertokulku (turnaround). Se ratkeaa tahtiin 1, kun sointukulku toistuu; lopettaaksesi päätä sointuun ${target}.`,
        });
      }
      return pick(level, {
        beginner: `Viimeinen sointu, ${chord}, haluaa kotiin sointuun ${target}. Päätä sointuun ${target} tai palaa alkuun.`,
        intermediate: `Päättyy soinnulle ${p.roman} (dominantti): ratkaisematta. Ratkaise sointuun ${target} tai pidä se kiertokulkuna tahtiin 1.`,
      });
    case 'ends-on-subdominant':
      return pick(level, {
        beginner: `Se päättyy soinnulle ${chord}, joka kuulostaa avoimelta, kuin yksi sointu puuttuisi. Lisää ${tonic} päätökseksi${p.loop && p.firstIsTonic ? ' tai palaa alkuun' : ''}.`,
        intermediate: `Päättyy soinnulle ${p.roman} (subdominantti): avoin. ${p.roman} → I on plagaalikadenssi ("aamen")${p.loop && p.firstIsTonic ? ', jonka paluu tahtiin 1 tuottaa' : `; lisää ${tonic} päätökseksi`}.`,
      });
    case 'ends-on-other':
      return pick(level, {
        beginner: `Se päättyy soinnulle ${chord}, joka ei kuulosta kodilta. Päätä sointuun ${tonic}, niin se kuulostaa valmiilta.`,
        intermediate: `Päättyy soinnulle ${p.roman}: ei selvää ratkeamista. Päätä I-sointuun (${tonic}) tai valmistele se V-soinnulla.`,
      });
    case 'secondary-resolves':
      return pick(level, {
        beginner: `${chord} osoittaa sointuun ${target}, ja seuraavaksi mennäänkin sinne.`,
        intermediate: `${chord} (${p.roman}) ratkeaa kohteeseensa ${target}.`,
      });
    case 'secondary-unresolved':
      return pick(level, {
        beginner: `${chord} osoittaa sointuun ${target}, mutta ${next ? `seuraavana on ${next}` : 'mitään ei seuraa'}. Se on yllätys, joka voi toimia; tai kokeile seuraavaksi sointua ${target}.`,
        intermediate: `${chord} (${p.roman}) ei ratkea sointuun ${target}${next ? `; se siirtyy soinnulle ${next}` : ''}. Sen ratkeaminen lykkääntyy.`,
      });
    case 'empty-bars': {
      const many = p.bars.length > 1;
      return pick(level, {
        beginner: many ? `Tahdit ${barList(p.bars)} ovat vielä tyhjiä.` : `Tahti ${p.bars[0]} on vielä tyhjä.`,
        intermediate: `Tyhjä: ${many ? 'tahdit' : 'tahti'} ${barList(p.bars)}.`,
      });
    }
    default:
      throw new Error(`Unknown advice: ${item.kind}`);
  }
}

const CADENCE_TEXT = {
  authentic: {
    beginner: (a, b) => `${a} → ${b}: jännite purkautuu, koti saavutettu.`,
    intermediate: (a, b) => `Autenttinen kadenssi: ${a} → ${b} (V → I), vahvin ratkeaminen.`,
  },
  plagal: {
    beginner: (a, b) => `${a} → ${b}: pehmeä tie kotiin, "aamen"-päätös.`,
    intermediate: (a, b) => `Plagaalikadenssi: ${a} → ${b} (IV → I).`,
  },
  deceptive: {
    beginner: (a, b) => `${a} → ${b}: kuulostaa siltä, että mennään kotiin, mutta tie kääntyykin.`,
    intermediate: (a, b) => `Petekadenssi: ${a} → ${b}. V siirtyy vi-sointuun I:n sijaan.`,
  },
  half: {
    beginner: (a) => `Tauko soinnulla ${a}: fraasi pysähtyy jännittyneeseen sointuun kuin kysymykseen.`,
    intermediate: (a) => `Puolikadenssi soinnulla ${a}: fraasi päättyy V-sointuun.`,
  },
  'ii-V-I': {
    beginner: (a, b) => `${a} … ${b}: klassinen kolmen askeleen reitti kotiin.`,
    intermediate: (a, b) => `ii–V–I soinnusta ${a} sointuun ${b}: esidominantti → dominantti → tonika.`,
  },
};

/** A cadence from findCadences(); `slots` gives the chords. */
function cadenceText(cadence, slots, level) {
  const a = S(slots[cadence.from].chord);
  const b = S(slots[cadence.to].chord);
  const text = pick(level, CADENCE_TEXT[cadence.type])(a, b);
  return cadence.wrap ? `${text} ${pick(level, { beginner: '(toistossa)', intermediate: '(toiston rajan yli)' })}` : text;
}

const REASONS = {
  'secondary-target': { beginner: 'tähän tämä sointu osoittaa', intermediate: 'ratkaisee välidominantin' },
  resolve: { beginner: 'menee kotiin', intermediate: 'ratkeaa tonikaan' },
  deceptive: { beginner: 'yllättävä käänne', intermediate: 'petekadenssi' },
  plagal: { beginner: 'pehmeä tie kotiin', intermediate: 'plagaalikadenssi' },
  'to-dominant': { beginner: 'rakentaa jännitettä', intermediate: 'siirtyy dominanttiin' },
  'to-predominant': { beginner: 'etääntyy kodista', intermediate: 'siirtyy esidominanttiin' },
  'tonic-substitute': { beginner: 'surullisempi koti', intermediate: 'tonikan korvike' },
  circle: { beginner: 'luonteva seuraava askel', intermediate: 'pohjasävel laskee kvintin' },
  step: { beginner: 'liikkuu yhden askeleen', intermediate: 'pohjasävel etenee asteittain' },
  'start-on-tonic': { beginner: 'aloita kotoa', intermediate: 'vakiinnuta tonika' },
};

const reasonText = (reason, level) => pick(level, REASONS[reason]);

const TIERS = {
  chord: { beginner: 'Turvallisimmat sävelet: itse sointu', intermediate: 'Soinnun sävelet' },
  scale: { beginner: 'Myös hyviä: ne tuovat väriä', intermediate: 'Asteikon sävelet (tensiot)' },
  parent: { beginner: 'Sopivat myös, valitun asteikon ulkopuolelta', intermediate: 'Sopii myös (pääasteikko)' },
  avoid: { beginner: 'Varo: ne hankaavat sointua vasten', intermediate: 'Vältettävät sävelet' },
  blue: { beginner: 'Blues-sävel: bluesmainen ohimennen', intermediate: 'Blues-sävel' },
};

const tierText = (tier, level) => pick(level, TIERS[tier]);

/** Why an avoid note is avoided. */
function avoidReasonText(info, level) {
  const tone = info.reason?.tone;
  if (!tone) return '';
  const t = N(tone.note);
  if (info.reason.kind === 'clash') {
    return pick(level, {
      beginner: `törmää soinnun säveleen ${t}`,
      intermediate: `törmää soinnun ${ROLES[tone.role][1]} (${t}) kanssa`,
    });
  }
  return pick(level, {
    beginner: `puoliaskel sävelen ${t} yläpuolella; käytä vain ohimennen`,
    intermediate: `puoliaskel soinnun ${ROLES[tone.role][1]} (${t}) yläpuolella`,
  });
}

const MOTION = {
  1: 'nousee puoliaskeleen verran sävelelle',
  2: 'nousee kokoaskeleen verran sävelelle',
  '-1': 'laskee puoliaskeleen verran ja ratkeaa sävelelle',
  '-2': 'laskee kokoaskeleen verran sävelelle',
};

/** One guide-tone move from guideTones(). */
function guideToneText(move, from, to, level) {
  const a = N(move.from);
  const b = N(move.to);
  if (level === 'beginner') {
    if (move.motion === 0) return `Pidä sävel ${a}, kun sointu vaihtuu sointuun ${S(to)}: se sopii molempiin sointuihin.`;
    return `Liu'uta sävel ${a} ${move.motion < 0 ? 'alas' : 'ylös'} sävelelle ${b}, kun sointu vaihtuu sointuun ${S(to)}.`;
  }
  const source = `${a} (soinnun ${S(from)} ${ROLES[move.fromRole][0]})`;
  if (move.motion === 0) return `Ohjaussävel: ${source} pysyy paikallaan ja muuttuu soinnun ${S(to)} ${ROLES[move.toRole][2]}.`;
  return `Ohjaussävel: ${source} ${MOTION[move.motion]} ${b} (soinnun ${S(to)} ${ROLES[move.toRole][0]}).`;
}

/** "E soinnun C päällä: terssi, soinnun sävel." for a clicked note. */
function noteOverChordText(info, chord, level) {
  const name = N(info.note);
  const label = info.tier === 'chord' ? ROLE_NAMES[info.label] : info.label;
  const what = {
    chord: pick(level, { beginner: 'soinnun sävel, aina turvallinen', intermediate: 'soinnun sävel' }),
    scale: pick(level, { beginner: 'tuo väriä', intermediate: 'tensio' }),
    parent: pick(level, { beginner: 'sopii, vaikka onkin valitun asteikon ulkopuolella', intermediate: 'pääasteikon sävel' }),
    avoid: pick(level, { beginner: 'hankaa sointua vasten', intermediate: 'vältettävä sävel' }),
    blue: pick(level, { beginner: 'bluesmainen sävel, hyvä ohimennen', intermediate: 'blues-sävel' }),
    outside: pick(level, { beginner: 'sävellajin ja soinnun ulkopuolella', intermediate: 'ulkopuolinen sävel' }),
  }[info.tier];
  const head = `${name} soinnun ${S(chord)} päällä:`;
  return info.tier === 'outside' ? `${head} ${what}.` : `${head} ${label}, ${what}.`;
}

const SCALE_LABELS = {
  major: 'Duuri',
  naturalMinor: 'Luonnollinen molli',
  majorPentatonic: 'Duuripentatoninen',
  minorPentatonic: 'Mollipentatoninen',
  blues: 'Blues',
};

// Each scale in the nominative, the inessive ("C-duurissa") and the illative ("C-duuriin").
const KEY_FORMS = {
  major: (n) => [`${n}-duuri`, `${n}-duurissa`, `${n}-duuriin`],
  naturalMinor: (n) => [`${n}-molli`, `${n}-mollissa`, `${n}-molliin`],
  majorPentatonic: (n) => [`${n} duuripentatoninen`, `${n} duuripentatonisessa asteikossa`, `${n} duuripentatoniseen asteikkoon`],
  minorPentatonic: (n) => [`${n} mollipentatoninen`, `${n} mollipentatonisessa asteikossa`, `${n} mollipentatoniseen asteikkoon`],
  blues: (n) => [`${n} blues`, `${n} bluesasteikossa`, `${n} bluesasteikkoon`],
};

const EXPLAIN_TEXTS = {
  major: {
    1: 'b2: ei kuulu duuriasteikkoon. Se on yleensä kromaattinen ohisävel tai soinnun V/ii terssi.',
    3: 'b3: lainattu samannimisestä mollista. Se on myös duurisävellajin bluesmainen pieni terssi.',
    6: '#4/b5: tritonus tonikan yläpuolella. #4 on V:n johtosävel (kuuluu soinnussa V/V). b5 on blues-sävel.',
    8: 'b6: lainattu samannimisestä mollista. Se antaa iv:lle ja bVI:lle tummemman värin.',
    10: 'b7: lainattu samannimisestä mollista (bVII), tai I7:n septimi, joka toimii V/IV:nä.',
  },
  minor: {
    1: 'b2: frygialainen/napolilainen sävel, yleensä kromaattinen ohisävel.',
    4: 'Suuri terssi: tulee samannimisestä duurista ("pikardialainen terssi"). Se on myös V/iv:n terssi.',
    6: '#4/b5: tritonus. #4 johtaa v:lle (V/v). b5 on bluesasteikon blues-sävel.',
    9: 'Suuri seksti: tulee samannimisestä duurista (doorinen sointi) ja tekee IV:stä duurin.',
    11: 'Suuri septimi: harmonisen mollin johtosävel. Se tekee V:stä duurin ja vii°:sta vähennetyn.',
  },
};

export const fi = {
  noteName: N,
  roleNames: ROLE_NAMES,
  functionNames: { tonic: 'tonika', subdominant: 'subdominantti', dominant: 'dominantti' },
  scaleLabels: SCALE_LABELS,
  keyLabel: (tonic, scaleId) => KEY_FORMS[scaleId](tonic)[0],
  keyIn: (tonic, scaleId) => KEY_FORMS[scaleId](tonic)[1],
  noteStatus: (inScale, tonic, scaleId) => `${inScale ? 'Kuuluu' : 'Ei kuulu'} ${KEY_FORMS[scaleId](tonic)[2]}`,
  notInScale: (scaleId, parent) =>
    `Ei kuulu asteikkoon "${SCALE_LABELS[scaleId].toLowerCase()}", mutta kuuluu pääasteikkoon (${parent === 'major' ? 'duuri' : 'molli'}), joten nämä soinnut silti sopivat.`,
  explain: {
    texts: EXPLAIN_TEXTS,
    fallback: 'Kromaattinen sävel sävellajin ulkopuolella.',
    blue: 'Blues-sävel: ',
    is: (name, text) => `${name} on ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
  },
  sourceLabels: SOURCE_LABELS,
  groupTitles: {
    diatonic: 'Diatoniset soinnut',
    borrowed: 'Lainasoinnut',
    secondary: 'Välidominantit',
    chromatic: 'Kromaattiset soinnut',
  },
  paletteTitles: { diatonic: 'Diatoniset', borrowed: 'Lainatut', secondary: 'Välidominantit' },
  presetLabels: {
    pop: 'I–V–vi–IV',
    doowop: 'I–vi–IV–V',
    twoFiveOne: 'ii–V–I',
    turnaround: 'I–vi–ii–V kiertokulku',
    blues: '12-tahtinen blues',
    andalusian: 'i–VII–VI–V (andalusialainen)',
    minorPop: 'i–VI–III–VII',
  },
  functionText,
  adviceText,
  cadenceText,
  reasonText,
  tierText,
  avoidReasonText,
  guideToneText,
  noteOverChordText,
};
