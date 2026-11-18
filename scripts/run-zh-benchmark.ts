// Runs the Mandarin benchmark. The pack is loaded here directly, so the script works whether
// or not the pack is listed in src/packs.ts.
// Usage: npx tsx scripts/run-zh-benchmark.ts [--holdout] [--list]
//   default:    the tuning list (benchmark/zh-tune.csv) and the first 40 name pairs printed in Miao (2006)
//   --holdout:  also the held-out list (benchmark/zh-holdout.csv) and the last 40 Miao pairs
//
// Chinese can write the same sounds with many different characters, so the main figure compares
// pinyin without tones: the predicted respelling against the pinyin of the real name. Only rows
// with status "ok" in the list files are scored (see scripts/build-zh-benchmark.ts). The share of
// names whose characters also match exactly is reported as a second figure.
import { readFileSync, writeFileSync } from 'node:fs';
import { Engine } from '../src/engine';
import { editDistance, summarize, type BenchRow } from '../src/benchmark';
import pack from '../packs/zh/pack.json';
import { adapt } from '../packs/zh/adapt';

export const PROFILES = ['traditional', 'younger'] as const;

export function makeEngine(): Engine {
  const dictText = readFileSync('data/cmudict.txt', 'utf8');
  const features = JSON.parse(readFileSync('data/features.json', 'utf8'));
  return new Engine(dictText, features, { zh: { pack, adapt } });
}

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

const flat = (s: string) => s.replace(/[\s-]/g, '');
function score(name: string, origin: string, realPinyin: string, predicted: string): BenchRow {
  const a = flat(predicted);
  const b = flat(realPinyin);
  const similarity = 1 - editDistance(a, b) / Math.max(a.length, b.length, 1);
  return { name, origin, real: realPinyin, predicted: predicted.replace(/ /g, '-'), similarity, exact: a === b };
}

export interface ZhRow extends BenchRow { realScript: string; predictedScript: string }

/** Scores the rows marked "ok" in a list built by build-zh-benchmark.ts, for one profile. */
export function runList(engine: Engine, file: string, profile: string): ZhRow[] {
  const out: ZhRow[] = [];
  for (const [name, , origin, , real, realPinyin, status] of parseCsv(readFileSync(file, 'utf8')).slice(1)) {
    if (status !== 'ok') continue;
    const o = engine.check(name, 'zh').overall[profile];
    out.push({ ...score(name, origin, realPinyin, o.respelling), realScript: real, predictedScript: o.script });
  }
  return out;
}

/** Scores the name pairs printed in Miao (2006); set is "tune" (first 40) or "check" (last 40). */
export function runMiao(engine: Engine, set: string, profile: string): BenchRow[] {
  return parseCsv(readFileSync('benchmark/zh-miao-pairs.csv', 'utf8')).slice(1)
    .filter((r) => r[1] === set)
    .map(([name, , pinyin]) => score(name, set, pinyin, engine.check(name, 'zh').overall[profile].respelling));
}

function counts(file: string) {
  const c: Record<string, number> = {};
  for (const r of parseCsv(readFileSync(file, 'utf8')).slice(1)) c[r[6]] = (c[r[6]] ?? 0) + 1;
  return c;
}

if (process.argv[1]?.endsWith('run-zh-benchmark.ts')) {
  const engine = makeEngine();
  const list = process.argv.includes('--list');
  const sets: [string, string, string][] = [['tuning', 'benchmark/zh-tune.csv', 'benchmark/zh-tune-results.csv']];
  if (process.argv.includes('--holdout')) sets.push(['held out', 'benchmark/zh-holdout.csv', 'benchmark/zh-holdout-results.csv']);
  for (const [label, file, outFile] of sets) {
    console.log(`\n${label}: ${file}`, counts(file));
    const lines = ['name,real,real_pinyin,profile,predicted,predicted_pinyin,similarity_percent,pinyin_match,characters_match'];
    for (const profile of PROFILES) {
      const rows = runList(engine, file, profile);
      const chars = rows.filter((r) => r.realScript === r.predictedScript).length;
      console.log(`  ${profile.padEnd(12)}`, summarize(rows), 'characters also match:', chars);
      for (const r of [...rows].sort((a, b) => a.similarity - b.similarity)) {
        lines.push([r.name, r.realScript, r.real, profile, r.predictedScript, r.predicted, Math.round(r.similarity * 100), r.exact ? 'yes' : 'no', r.realScript === r.predictedScript ? 'yes' : 'no'].join(','));
        if (list && profile === 'traditional') console.log('   ', Math.round(r.similarity * 100), r.name, r.realScript, r.real, '|', r.predictedScript, r.predicted);
      }
    }
    writeFileSync(outFile, lines.join('\n') + '\n');
  }
  const miaoSets = process.argv.includes('--holdout') ? ['tune', 'check'] : ['tune'];
  const lines = ['name,set,published_pinyin,profile,predicted_pinyin,similarity_percent,pinyin_match'];
  for (const set of miaoSets) {
    console.log(`\nMiao (2006) pairs, ${set === 'tune' ? 'first 40 (tuning check)' : 'last 40 (held-out check)'}`);
    for (const profile of PROFILES) {
      const rows = runMiao(engine, set, profile);
      console.log(`  ${profile.padEnd(12)}`, summarize(rows));
      for (const r of [...rows].sort((a, b) => a.similarity - b.similarity)) {
        lines.push([r.name, set, r.real, profile, r.predicted, Math.round(r.similarity * 100), r.exact ? 'yes' : 'no'].join(','));
        if (list && profile === 'traditional') console.log('   ', Math.round(r.similarity * 100), r.name, r.real, '|', r.predicted);
      }
    }
  }
  writeFileSync('benchmark/zh-miao-results.csv', lines.join('\n') + '\n');
}
