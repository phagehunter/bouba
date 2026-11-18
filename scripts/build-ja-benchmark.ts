// Builds the Japanese loanword benchmark from JMdict (data/raw/JMdict_e.gz, already on disk).
// Usage: npx tsx scripts/build-ja-benchmark.ts
//
// Output: benchmark/ja-loanwords-tune.csv and benchmark/ja-loanwords-test.csv, in the layout
// runBenchmark reads (name, wiki_title, origin, title, real). wiki_title holds the JMdict entry
// number, title holds every katakana reading the entry lists (joined with "/"), and real holds
// the first reading.
//
// Two kinds of rows are kept:
//   origin "en-marked": the entry has an <lsource> tag for English (no xml:lang, or xml:lang="eng",
//     and no ls_wasei="y" or ls_type="part"), and the tag's text is one English word.
//   origin "en": the entry has no <lsource> tag at all. JMdict leaves English, its default source
//     language, unmarked unless the source word differs from the meaning given, so the marked rows
//     alone are few (about 100) and unusual. For these rows the first meaning listed is taken as
//     the source word, and the checks below drop rows where that is clearly wrong.
// In both kinds the entry has no kanji form, its first reading is all katakana, and the English
// word is letters a-z only and is in the CMU dictionary (data/cmudict.txt).
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAP = 1500;

const xml = gunzipSync(readFileSync(join(root, 'data/raw/JMdict_e.gz'))).toString('utf8');
const cmu = new Set(readFileSync(join(root, 'data/cmudict.txt'), 'utf8').split('\n').map((l) => l.slice(0, l.indexOf(' '))));

const KATAKANA = /^[ァ-ヴー]+$/;
const isWord = (s: string) => /^[a-z]{2,}$/.test(s) && cmu.has(s);

// The consonant row of the first katakana letter ("" = a vowel).
const ROWS: [string, string][] = [
  ['アイウエオァィゥェォ', ''], ['カキクケコ', 'k'], ['ガギグゲゴ', 'g'], ['サスセソ', 's'], ['シ', 'sh'], ['ザズゼゾ', 'z'], ['ジヂ', 'j'],
  ['タテト', 't'], ['チ', 'ch'], ['ツ', 'ts'], ['ダデド', 'd'], ['ヅ', 'z'], ['ナニヌネノ', 'n'], ['ハヒヘホ', 'h'], ['フ', 'f'],
  ['バビブベボ', 'b'], ['パピプペポ', 'p'], ['マミムメモ', 'm'], ['ヤユヨ', 'y'], ['ラリルレロ', 'r'], ['ワヲ', 'w'], ['ヴ', 'v'], ['ン', 'n'],
];
const rowOf = (ch: string) => ROWS.find(([chars]) => chars.includes(ch))?.[1] ?? '?';
// Which first katakana rows are plausible for each first English letter. Kept loose on purpose:
// it only removes rows where the meaning listed is plainly a different word from the reading.
const VOWELISH = ['', 'y', 'w', 'h'];
const FIRST: Record<string, string[]> = {
  a: VOWELISH, e: VOWELISH, i: VOWELISH, o: VOWELISH, u: VOWELISH,
  b: ['b'], c: ['k', 's', 'sh', 'ch'], d: ['d', 'j', 'z'], f: ['f', 'h'], g: ['g', 'j'], h: ['h', 'f', ''], j: ['j', 'y'],
  k: ['k', 'n'], l: ['r'], m: ['m'], n: ['n'], p: ['p', 'f', 's', 'n'], q: ['k'], r: ['r'], s: ['s', 'sh', 'z'],
  t: ['t', 'ch', 'ts', 's', 'z'], v: ['b', 'v'], w: ['w', '', 'h', 'r'], x: ['z', '', 'k'], y: ['y', ''], z: ['z', 'j'],
};
const plausible = (word: string, kana: string) => {
  const n = [...kana].length;
  return (FIRST[word[0]] ?? []).includes(rowOf(kana[0])) && n >= 0.45 * word.length && n <= 2.2 * word.length;
};

// FNV-1a, 32 bit. Decides both the tune/test split and which rows survive the cap.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

interface Row { name: string; seq: string; origin: string; readings: string[] }
const seen = new Set<string>();
const rows: Row[] = [];
const counts = { marked: 0, unmarked: 0, droppedByChecks: 0 };

for (const entry of xml.split('<entry>').slice(1)) {
  if (entry.includes('<k_ele>')) continue;
  const readings = [...entry.matchAll(/<reb>([^<]*)<\/reb>/g)].map((m) => m[1]).filter((r) => KATAKANA.test(r));
  const first = entry.match(/<reb>([^<]*)<\/reb>/)?.[1] ?? '';
  if (!KATAKANA.test(first)) continue;
  const seq = entry.match(/<ent_seq>(\d+)<\/ent_seq>/)?.[1] ?? '';
  const sources = [...entry.matchAll(/<lsource([^>]*?)(?:\/>|>([^<]*)<\/lsource>)/g)];
  const firstGloss = entry.match(/<gloss>([^<]*)<\/gloss>/)?.[1] ?? '';
  let name = '';
  let origin = '';
  if (sources.length) {
    for (const m of sources) {
      const attrs = m[1];
      if (/ls_wasei="y"|ls_type="part"/.test(attrs) || /xml:lang="(?!eng")/.test(attrs)) continue;
      const text = m[2] ?? firstGloss; // an empty tag means the source word is the meaning given
      if (isWord(text)) { name = text; origin = 'en-marked'; break; }
    }
  } else if (!/&abbr;|&on-mim;/.test(entry) && isWord(firstGloss)) {
    if (plausible(firstGloss, first)) { name = firstGloss; origin = 'en'; } else counts.droppedByChecks++;
  }
  if (!name || seen.has(name)) continue;
  seen.add(name);
  rows.push({ name, seq, origin, readings });
  if (origin === 'en') counts.unmarked++; else counts.marked++;
}

const pick = (parity: number) => rows
  .filter((r) => hash(r.name) % 2 === parity)
  .sort((a, b) => hash('cap:' + a.name) - hash('cap:' + b.name) || a.name.localeCompare(b.name))
  .slice(0, CAP)
  .sort((a, b) => a.name.localeCompare(b.name));

const write = (file: string, list: Row[]) => {
  const lines = ['name,wiki_title,origin,title,real', ...list.map((r) => [r.name, r.seq, r.origin, r.readings.join('/'), r.readings[0]].join(','))];
  writeFileSync(join(root, 'benchmark', file), lines.join('\n') + '\n');
  console.log(file, list.length, 'rows,', list.filter((r) => r.origin === 'en-marked').length, 'of them marked');
};

console.log('Entries kept before the split:', counts);
write('ja-loanwords-tune.csv', pick(0));
write('ja-loanwords-test.csv', pick(1));
