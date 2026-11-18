// Runs the Burmese benchmark: predicted pronunciation against the forms published in Chang (2003, 2009).
// Usage: npx tsx scripts/run-my-benchmark.ts [--list]
import { writeFileSync } from 'node:fs';
import { loadEngine } from '../src/node';
import { runIpaBenchmark, summarize } from '../src/benchmark';

const rows = runIpaBenchmark(loadEngine(), 'benchmark/my-loanwords.csv', 'my');
const lines = ['name,set,published,predicted,similarity_percent,exact_match'];
for (const r of [...rows].sort((a, b) => a.similarity - b.similarity)) {
  lines.push([r.name, r.origin, r.real, r.predicted, Math.round(r.similarity * 100), r.exact ? 'yes' : 'no'].join(','));
}
writeFileSync('benchmark/my-results.csv', lines.join('\n') + '\n');
if (process.argv.includes('--list')) for (const l of lines.slice(1)) console.log(l);
console.log('tune half :', summarize(rows.filter((r) => r.origin === 'tune')));
console.log('check half:', summarize(rows.filter((r) => r.origin === 'check')));
