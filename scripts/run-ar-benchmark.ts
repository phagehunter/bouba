// Runs the Arabic benchmarks.
// Usage: npx tsx scripts/run-ar-benchmark.ts [--list] [--holdout]
//
// 1. Spelling: the predicted Arabic spelling against Arabic Wikipedia titles
//    (benchmark/ar-brands.csv, the tuning list). With --holdout the two held-out lists
//    (benchmark/ar-holdout.csv, benchmark/ar-holdout2.csv) are run as well. The rules must not be
//    changed after looking at held-out results.
// 2. Pronunciation: the predicted transcription against the example words printed in
//    Al-Athwary (2017) (benchmark/ar-athwary-examples.csv), in the paper's own notation.
//
// What is made the same on both sides before spellings are compared (normalizeArabic):
//   the lengthening stroke (tatweel) and all vowel and doubling marks are removed;
//   the alef forms أ إ آ ٱ become ا, and ى becomes ي;
//   the extra letters ڤ پ گ چ, which some writers use for V, P, G and CH, become ف ب ك ج;
//   spaces and punctuation are removed.
// Brackets, the article ال in front of the first word, and words such as شركة ("company") were
// already removed when the lists were built (scripts/build-ar-benchmark.ts).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { Engine } from '../src/engine';
import { editDistance, summarize, type BenchRow } from '../src/benchmark';
import pack from '../packs/ar/pack.json';
import { adapt } from '../packs/ar/adapt';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadArabicEngine(): Engine {
  const dictText = readFileSync(join(root, 'data/cmudict.txt'), 'utf8');
  const features = JSON.parse(readFileSync(join(root, 'data/features.json'), 'utf8'));
  return new Engine(dictText, features, { ar: { pack, adapt } });
}

export const normalizeArabic = (s: string) => s
  .replace(/[ـً-ٰٟ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
  .replace(/ڤ/g, 'ف').replace(/پ/g, 'ب').replace(/گ/g, 'ك').replace(/چ/g, 'ج')
  .replace(/[^ء-ي]/g, '');

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
const similarity = (a: string, b: string) => 1 - editDistance(a, b) / Math.max([...a].length, [...b].length, 1);

/** Predicted Arabic spelling against the Wikipedia spelling. Rows without a usable spelling are skipped. */
export function runArabicBenchmark(engine: Engine, file: string): BenchRow[] {
  const rows = parseCsv(readFileSync(join(root, file), 'utf8')).slice(1);
  const out: BenchRow[] = [];
  for (const [name, , origin, , real] of rows) {
    if (!real) continue;
    const predicted = Object.values(engine.check(name, 'ar').overall)[0].script;
    const a = normalizeArabic(predicted);
    const b = normalizeArabic(real);
    out.push({ name, origin, real, predicted, similarity: similarity(a, b), exact: a === b });
  }
  return out;
}

/** The pack's transcription rewritten in the notation Al-Athwary (2017) uses. */
export const toPaperNotation = (ipa: string) => ipa.replace(/\./g, '').replace(/j/g, 'y').replace(/dʒ/g, 'j')
  .replace(/tʃ/g, 'tš').replace(/ʃ/g, 'š').replace(/ɣ/g, 'ġ').replace(/ʔ/g, '?').replace(/ː/g, ':').replace(/θ/g, 'th').replace(/ð/g, 'dh');
// The paper marks a few consonants as "emphatic" (ţ, ş). The pack does not predict these, so the mark is removed.
const plainPaper = (s: string) => s.replace(/ţ/g, 't').replace(/ş/g, 's').replace(/đ/g, 'd');

/** Predicted pronunciation (first speaker group) against the paper's form; the closest of the paper's variants counts. */
export function runPaperBenchmark(engine: Engine, file: string): BenchRow[] {
  const rows = parseCsv(readFileSync(join(root, file), 'utf8')).slice(1);
  const out: BenchRow[] = [];
  for (const [name, set, forms] of rows) {
    const p = Object.values(engine.check(name, 'ar').words[0].profiles)[0];
    const predicted = toPaperNotation(p.ipa ?? '');
    let best = { real: '', similarity: -1 };
    for (const f of forms.split('/')) {
      const s = similarity(predicted, plainPaper(f));
      if (s > best.similarity) best = { real: f, similarity: s };
    }
    out.push({ name, origin: set, real: best.real, predicted, similarity: best.similarity, exact: predicted === plainPaper(best.real) });
  }
  return out;
}

function report(rows: BenchRow[], outFile: string, list: boolean) {
  const lines = ['name,origin,real,predicted,similarity_percent,exact_match'];
  for (const r of [...rows].sort((a, b) => a.similarity - b.similarity)) {
    lines.push([r.name.includes(',') ? `"${r.name}"` : r.name, r.origin, r.real, r.predicted, Math.round(r.similarity * 100), r.exact ? 'yes' : 'no'].join(','));
  }
  writeFileSync(join(root, outFile), lines.join('\n') + '\n');
  if (list) for (const l of lines.slice(1)) console.log(l);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const list = process.argv.includes('--list');
  const engine = loadArabicEngine();
  const tune = runArabicBenchmark(engine, 'benchmark/ar-brands.csv');
  report(tune, 'benchmark/ar-results.csv', list);
  console.log('Tuning list, English-origin names:', summarize(tune.filter((r) => r.origin === 'en')));
  console.log('Tuning list, other-origin names (English reading assumed):', summarize(tune.filter((r) => r.origin !== 'en')));
  const paper = runPaperBenchmark(engine, 'benchmark/ar-athwary-examples.csv');
  report(paper, 'benchmark/ar-athwary-results.csv', list);
  console.log('Al-Athwary examples, plain words:', summarize(paper.filter((r) => r.origin === 'plain' || r.origin === 'stem')));
  console.log('Al-Athwary examples, words with an Arabic ending or a shortened form (not expected to match):', summarize(paper.filter((r) => r.origin !== 'plain' && r.origin !== 'stem')));
  if (process.argv.includes('--holdout')) {
    for (const [file, outFile] of [['benchmark/ar-holdout.csv', 'benchmark/ar-holdout-results.csv'], ['benchmark/ar-holdout2.csv', 'benchmark/ar-holdout2-results.csv']]) {
      const rows = runArabicBenchmark(engine, file);
      report(rows, outFile, false);
      console.log(file, 'English-origin names:', summarize(rows.filter((r) => r.origin === 'en')));
    }
  }
}
