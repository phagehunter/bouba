// Runs the Hindi benchmark: the predicted Devanagari spelling against Hindi Wikipedia titles.
// Usage: npx tsx scripts/run-hi-benchmark.ts            (tuning list, benchmark/hi-tune.csv)
//        npx tsx scripts/run-hi-benchmark.ts holdout    (held-out list, benchmark/hi-holdout.csv)
//        add --list to print every row
// Writes benchmark/hi-tune-results.csv or benchmark/hi-holdout-results.csv.
//
// The pack is loaded here directly, so the script works whether or not Hindi is listed in src/packs.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Engine } from '../src/engine';
import { editDistance, runBenchmark, summarize } from '../src/benchmark';
import pack from '../packs/hi/pack.json';
import { adapt } from '../packs/hi/adapt';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const engine = new Engine(
  readFileSync(join(root, 'data/cmudict.txt'), 'utf8'),
  JSON.parse(readFileSync(join(root, 'data/features.json'), 'utf8')),
  { hi: { pack, adapt } },
);

const set = process.argv.slice(2).find((a) => !a.startsWith('--')) === 'holdout' ? 'holdout' : 'tune';
const rows = runBenchmark(engine, join(root, `benchmark/hi-${set}.csv`), 'hi');
const en = rows.filter((r) => r.origin === 'en');
const meaning = rows.filter((r) => r.origin === 'en-meaning');
const other = rows.filter((r) => r.origin === 'other');

const lines = ['name,origin,real_hindi,predicted_hindi,similarity_percent,exact_match'];
for (const r of [...rows].sort((a, b) => a.similarity - b.similarity)) {
  lines.push([r.name.includes(',') ? `"${r.name}"` : r.name, r.origin, r.real, r.predicted, Math.round(r.similarity * 100), r.exact ? 'yes' : 'no'].join(','));
}
writeFileSync(join(root, `benchmark/hi-${set}-results.csv`), lines.join('\n') + '\n');
if (process.argv.includes('--list')) for (const l of lines.slice(1)) console.log(l);

// The dot under फ़ and ज़ (nukta) is often left out in everyday writing. This second figure shows
// how much of the gap comes from that dot alone.
const noDot = (s: string) => s.normalize('NFD').replace(/़/g, '');
const withoutDot = en.map((r) => {
  const a = noDot(r.predicted);
  const b = noDot(r.real);
  return { ...r, similarity: 1 - editDistance(a, b) / Math.max([...a].length, [...b].length), exact: a === b };
});

console.log(`List: ${set}`);
console.log('English names:', summarize(en));
console.log('English names, ignoring the dot under letters:', summarize(withoutDot));
console.log('Set aside, title is a translation or a different name:', meaning.length);
console.log('Other-origin names (not expected to match; English reading assumed):', summarize(other));
