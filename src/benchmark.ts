// Benchmark: compare the engine's predicted spelling with the real local spelling of
// well-known names (Wikipedia titles). Used by the benchmark script and the tests.
import { readFileSync } from 'node:fs';
import type { Engine } from './engine';

export interface BenchRow { name: string; origin: string; real: string; predicted: string; similarity: number; exact: boolean }

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

// Tone marks and the vowel-shortening mark are optional in practice and are not predicted,
// so they are removed from both sides before comparing.
export const normalize = (s: string) => s.replace(/[็-๋]/g, '');

export function editDistance(a: string, b: string): number {
  const A = [...a];
  const B = [...b];
  let prev = B.map((_, j) => j + 1);
  prev.unshift(0);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

export function runBenchmark(engine: Engine, file: string, language: string): BenchRow[] {
  const rows = parseCsv(readFileSync(file, 'utf8')).slice(1);
  const out: BenchRow[] = [];
  for (const [name, , origin, , real] of rows) {
    if (!real) continue;
    const predicted = Object.values(engine.check(name, language).overall)[0].script;
    const a = normalize(predicted);
    const b = normalize(real);
    const similarity = 1 - editDistance(a, b) / Math.max([...a].length, [...b].length);
    out.push({ name, origin, real, predicted, similarity, exact: a === b });
  }
  return out;
}

export function summarize(rows: BenchRow[]) {
  const mean = rows.reduce((s, r) => s + r.similarity, 0) / (rows.length || 1);
  return { count: rows.length, exact: rows.filter((r) => r.exact).length, meanSimilarity: Math.round(mean * 1000) / 10 };
}

// For languages tested against published pronunciations instead of spellings (Burmese).
// Tone marks, syllable dots and a few notation details are removed from both sides, because
// tone is not predicted and the sources mark aspiration more finely than the pack does.
export const normalizeIpa = (s: string) => s.normalize('NFD')
  .replace(/[\u0300\u0301\u0304\u030C\u0302\u0330]/g, '')
  .replace(/[.()ˈˌ\s]/g, '').replace(/t̪/g, '').replace(/([stk])ʰ/g, '$1').replace(/^ʔ/, '').normalize('NFC');

/** Compares the predicted transcription with a published one. Each word is scored on the closer of the pack's speaker groups. */
export function runIpaBenchmark(engine: Engine, file: string, language: string): BenchRow[] {
  const rows = parseCsv(readFileSync(file, 'utf8')).slice(1);
  const out: BenchRow[] = [];
  for (const [name, set, real] of rows) {
    if (!real) continue;
    const b = normalizeIpa(real);
    let best = { predicted: '', similarity: -1 };
    for (const p of Object.values(engine.check(name, language).words[0].profiles)) {
      const a = normalizeIpa(p.ipa ?? '');
      const similarity = 1 - editDistance(a, b) / Math.max([...a].length, [...b].length);
      if (similarity > best.similarity) best = { predicted: a, similarity };
    }
    out.push({ name, origin: set, real: b, predicted: best.predicted, similarity: best.similarity, exact: best.predicted === b });
  }
  return out;
}
