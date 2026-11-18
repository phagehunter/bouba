// Builds the Hindi benchmark lists: looks up the Hindi Wikipedia title for each name in a list
// and writes it out. The Hindi title is the "real" Devanagari spelling the pack is tested against.
//
// Usage: npx tsx scripts/build-hi-benchmark.ts tune      (writes benchmark/hi-tune.csv)
//        npx tsx scripts/build-hi-benchmark.ts holdout   (writes benchmark/hi-holdout.csv)
//
// Input lists (shared with the Thai benchmark; name, English Wikipedia article title, origin):
//   tune:    benchmark/th-brand-list.csv plus benchmark/hi-extra-list.csv (more English names,
//            added for Hindi). Names that are also on a held-out list are left out.
//   holdout: benchmark/th-holdout-list.csv plus benchmark/th-holdout2-list.csv
//
// Output layout (the one runBenchmark reads): name, wiki_title, origin, hi_title, hi.
// The origin column is changed for rows that should not count as English names said in Hindi:
//   "other"       the list already marks the name as not English
//   "en-meaning"  the Hindi title does not start with the sound the English name starts with, or
//                 its length is far from the name's length, or it has more words than the name
//                 (a middle name, for example). Such a title is a translation by
//                 meaning, a different name, or a longer descriptive title. The check is mechanical
//                 (see `plausible` below) so that it can be applied to the held-out list without
//                 reading that list.
// Extra words at the end of a Hindi title are dropped the same mechanical way (see `trimTitle`).
// Rows with no Hindi article, or a title that is not in Devanagari, have an empty last column
// and are skipped by the benchmark.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseCsv(text: string): string[][] {
  return text.trim().split('\n').map((line) => {
    const cells: string[] = [];
    let cur = '';
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}

const SETS: Record<string, { lists: string[]; out: string }> = {
  tune: { lists: ['th-brand-list.csv', 'hi-extra-list.csv'], out: 'hi-tune.csv' },
  holdout: { lists: ['th-holdout-list.csv', 'th-holdout2-list.csv'], out: 'hi-holdout.csv' },
};
const set = SETS[process.argv[2] ?? ''];
if (!set) { console.error('Usage: npx tsx scripts/build-hi-benchmark.ts tune|holdout'); process.exit(1); }

const rows: string[][] = [];
const seenNames = new Set<string>();
// A name on a held-out list never goes into the tuning list. Only the name column is read here.
if (set === SETS.tune) {
  for (const list of SETS.holdout.lists) {
    for (const r of parseCsv(readFileSync(join(root, 'benchmark', list), 'utf8')).slice(1)) seenNames.add(r[0]);
  }
}
for (const list of set.lists) {
  const file = join(root, 'benchmark', list);
  if (!existsSync(file)) continue;
  for (const r of parseCsv(readFileSync(file, 'utf8')).slice(1)) {
    if (r.length < 3 || seenNames.has(r[0])) continue;
    seenNames.add(r[0]);
    rows.push(r);
  }
}

const found = new Map<string, string>();
for (let i = 0; i < rows.length; i += 40) {
  const batch = rows.slice(i, i + 40).map((r) => r[1]);
  const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=langlinks&lllang=hi&lllimit=500&titles='
    + encodeURIComponent(batch.join('|'));
  // The API refuses requests that come too fast, so batches are spaced out and a refused one is tried again.
  let json: any = null;
  for (let attempt = 0; attempt < 5 && !json; attempt++) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt * 3 + 1)));
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'name-pronunciation-benchmark/0.0.0 (research script)' } });
      json = JSON.parse(await res.text());
    } catch { json = null; }
    if (!json?.query) json = null;
  }
  if (!json) { console.error('The Wikipedia API did not answer; nothing was written.'); process.exit(1); }
  const alias = new Map<string, string>(); // final title -> requested title
  for (const n of json.query.normalized ?? []) alias.set(n.to, n.from);
  for (const r of json.query.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);
  for (const page of Object.values<any>(json.query.pages ?? {})) {
    const hi = page.langlinks?.[0]?.['*'];
    if (hi) found.set(alias.get(page.title) ?? page.title, hi);
  }
}

// The consonant letters a Hindi title may start with for each first English letter. Kept loose
// on purpose: it only removes titles that are plainly a different word from the name.
const VOWELISH = 'अआइईउऊएऐओऔऑऍयवह';
const FIRST: Record<string, string> = {
  a: VOWELISH, e: VOWELISH, i: VOWELISH, o: VOWELISH, u: VOWELISH,
  b: 'ब', c: 'कसचशख', d: 'डद', f: 'फ', g: 'गज', h: 'हअआइईउऊएऐओऔऑ', j: 'जयह', k: 'कनख', l: 'ल', m: 'म', n: 'न',
  p: 'पफस', q: 'कख', r: 'र', s: 'सशज', t: 'टतथदच', v: 'वभ', w: 'वरहउ', x: 'एजज़', y: 'यइ', z: 'जज़',
};
const MARKS = /[\u093c\u094d\u0901-\u0903\u093e-\u094c\u0945\u0949]/g; // signs that are not letters of their own
const letterCount = (hi: string) => [...hi.replace(MARKS, '')].length;
const latin = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '');
const plausible = (name: string, hi: string): boolean => {
  const letters = latin(name);
  const n = letterCount(hi);
  return (FIRST[letters[0]] ?? '').includes([...hi][0]) && n >= 0.3 * letters.length && n <= 1.6 * letters.length;
};
// A Hindi title often adds words the list name does not have ("Tesla" is titled "टेस्ला मोटर्स",
// "Apple" is "एप्पल इंक॰"). Company words at the end are dropped. If the title still has more words
// than the name: for a one-word name, words are taken from the front until they hold at least half
// as many letters as the name has; for a longer name the row is set aside (null), because the
// extra word may sit in the middle (a middle name, for example).
const SUFFIX = new Set(['कंपनी', 'कम्पनी', 'इंक', 'इंक॰', 'इंक.', 'लिमिटेड', 'निगम', 'जुनियर', 'जूनियर']);
const trimTitle = (name: string, title: string): string | null => {
  const hiWords = title.split(/[\s\-]+/).filter(Boolean);
  const enWords = name.split(/[\s\-]+/).filter((w) => /[A-Za-z]/.test(w));
  while (hiWords.length > enWords.length && SUFFIX.has(hiWords[hiWords.length - 1])) hiWords.pop();
  if (hiWords.length <= enWords.length) return hiWords.join(' ');
  if (enWords.length > 1) return null;
  const need = 0.5 * latin(name).length;
  const kept: string[] = [];
  for (const w of hiWords) {
    kept.push(w);
    if (letterCount(kept.join('')) >= need) break;
  }
  return kept.join(' ');
};

const out = ['name,wiki_title,origin,hi_title,hi'];
const counts = { rows: rows.length, withHindiTitle: 0, en: 0, enMeaning: 0, other: 0 };
for (const [name, title, originIn] of rows) {
  const hiTitle = found.get(title) ?? '';
  // Strip brackets ("(कंपनी)"), spaces and punctuation.
  const trimmed = trimTitle(name, hiTitle.normalize('NFC').replace(/\(.*?\)/g, '').trim());
  const hi = (trimmed ?? hiTitle.normalize('NFC').replace(/\(.*?\)/g, '')).replace(/[\s\-.,'’&!·:॰]/g, '').replace(/[\u200c\u200d]/g, '');
  const usable = /^[\u0900-\u097f]+$/.test(hi);
  let origin = originIn;
  if (usable) {
    counts.withHindiTitle++;
    if (origin === 'en' && (trimmed === null || !plausible(name, hi))) origin = 'en-meaning';
    if (origin === 'en') counts.en++; else if (origin === 'en-meaning') counts.enMeaning++; else counts.other++;
  }
  out.push([name, title, origin, hiTitle, usable ? hi : ''].map((c) => (c.includes(',') ? `"${c}"` : c)).join(','));
}
writeFileSync(join(root, 'benchmark', set.out), out.join('\n') + '\n');
console.log(set.out, counts);
