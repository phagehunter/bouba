// Runs the Thai brand benchmark and writes benchmark/th-results.csv.
// Usage: npm run benchmark            (main list)
//        npx tsx scripts/run-benchmark.ts benchmark/th-holdout.csv benchmark/th-holdout-results.csv
import { writeFileSync } from 'node:fs';
import { loadEngine } from '../src/node';
import { runBenchmark, summarize } from '../src/benchmark';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const rows = runBenchmark(loadEngine(), args[0] ?? 'benchmark/th-brands.csv', 'th');
const en = rows.filter((r) => r.origin === 'en');
const other = rows.filter((r) => r.origin !== 'en');
const lines = ['name,origin,real_thai,predicted_thai,similarity_percent,exact_match'];
for (const r of [...rows].sort((a, b) => a.similarity - b.similarity)) {
  lines.push([r.name.includes(',') ? `"${r.name}"` : r.name, r.origin, r.real, r.predicted, Math.round(r.similarity * 100), r.exact ? 'yes' : 'no'].join(','));
}
writeFileSync(args[1] ?? 'benchmark/th-results.csv', lines.join('\n') + '\n');
if (process.argv.includes('--list')) for (const l of lines.slice(1)) console.log(l);
console.log('English-origin names:', summarize(en));
console.log('Other-origin names (not expected to match; English reading assumed):', summarize(other));
