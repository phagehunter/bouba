// Automatic checks. Run with: npm test
// If a rule change breaks a known behavior or lowers benchmark accuracy, a test fails.
import { describe, expect, it } from 'vitest';
import { loadEngine } from '../src/node';
import { runBenchmark, summarize } from '../src/benchmark';

const engine = loadEngine();
const th = (name: string, profile = 'traditional') => engine.check(name, 'th').words[0].profiles[profile];

describe('Thai: documented behaviors', () => {
  it('final L becomes N (Shell -> chen)', () => {
    const r = th('Shell');
    expect(r.respelling).toBe('chen');
    expect(r.changes.some((c) => c.kind === 'finalChanged' && c.from === 'L' && c.to === 'N')).toBe(true);
  });
  it('S + consonant at the start gets an inserted "a" (Starbucks -> sa-...)', () => {
    const r = th('Starbucks');
    expect(r.respelling.startsWith('sa-')).toBe(true);
    expect(r.changes.some((c) => c.kind === 'epenthesis')).toBe(true);
  });
  it('final R is silent and only the first final consonant is said (Starbucks -> ...bak)', () => {
    expect(th('Starbucks').respelling).toBe('sa-tah-bak');
  });
  it('a consonant after "ai" is silent in everyday speech (Line -> lai)', () => {
    expect(th('Line').respelling).toBe('lai');
  });
  it('final S becomes T for most speakers but is kept by younger speakers (Tesla)', () => {
    expect(th('Tesla', 'traditional').respelling).toBe('tet-lah');
    expect(th('Tesla', 'younger').respelling).toBe('tes-lah');
    expect(th('Tesla', 'younger').survival).toBeGreaterThan(th('Tesla', 'traditional').survival);
  });
  it('V becomes W and Z becomes S', () => {
    expect(th('Visa').respelling.startsWith('w')).toBe(true);
    expect(th('Zoom').respelling.startsWith('s')).toBe(true);
  });
  it('writes the official-style Thai spelling', () => {
    expect(th('Netflix').script).toBe('เน็ตฟลิกซ์');
    expect(th('Google').script).toBe('กูเกิล');
  });
  it('the spelling is the same for both speaker groups', () => {
    expect(th('Sprite', 'younger').script).toBe(th('Sprite', 'traditional').script);
  });
});

describe('Stage 3 additions', () => {
  it('an unstressed "er" before a vowel hands its R to the next syllable (General -> je-ne-ran)', () => {
    expect(th('General').respelling).toBe('je-ne-ran');
  });
  it('marks which letters of the typed name each change belongs to', () => {
    const l = th('Shell').changes.find((c) => c.ruleId === 'th-co-l')!;
    expect(l.span).toEqual([3, 5]);
    const x = th('Netflix').changes.find((c) => c.kind === 'finalDropped')!;
    expect('Netflix'.slice(x.span![0], x.span![1])).toBe('x');
  });
  it('offers the W-like ending as an alternative to N for a final L', () => {
    expect(th('Shell').alternative?.respelling).toBe('cheo');
    expect(th('Zoom').alternative).toBeUndefined();
  });
  it('gives a plain-language suggestion with changes that can be avoided', () => {
    expect(th('Shell').changes.find((c) => c.ruleId === 'th-co-l')!.tip).toMatch(/vowel, N, M or NG/);
  });
  it('accepts a "say it like" hint for a word', () => {
    const r = engine.check('Zyntrova', 'th', { sayAs: { zyntrova: 'zin troh va' } });
    expect(r.words[0].soundsFrom).toBe('override');
    expect(r.words[0].word).toBe('Zyntrova');
  });
});

describe('phrases and unusual input', () => {
  it('handles phrases word by word', () => {
    const r = engine.check('Burger King', 'th');
    expect(r.words.length).toBe(2);
    expect(r.overall.traditional.respelling).toBe('ber-ger king');
  });
  it('flags invented names as guessed', () => {
    const r = engine.check('Zyntrova', 'th');
    expect(r.words[0].soundsFrom).toBe('guessed');
    expect(r.notes.length).toBeGreaterThan(0);
  });
  it('keeps scores between 0 and 100', () => {
    for (const name of ['Strengths', 'Schwarzkopf', 'A', 'Worcestershire sauce']) {
      for (const o of Object.values(engine.check(name, 'th').overall)) {
        expect(o.ease).toBeGreaterThanOrEqual(0);
        expect(o.ease).toBeLessThanOrEqual(100);
        expect(o.survival).toBeGreaterThanOrEqual(0);
        expect(o.survival).toBeLessThanOrEqual(100);
      }
    }
  });
  it('does not crash on empty or non-letter input', () => {
    expect(engine.check('', 'th').words.length).toBe(0);
    expect(engine.check('123 !!!', 'th').words.length).toBe(0);
  });
});

describe('benchmark accuracy does not drop', () => {
  it('main brand list (rules were tuned on this list)', () => {
    const s = summarize(runBenchmark(engine, 'benchmark/th-brands.csv', 'th').filter((r) => r.origin === 'en'));
    expect(s.meanSimilarity).toBeGreaterThanOrEqual(86);
  });
  it('second list (untouched in Stage 2; seen since)', () => {
    const s = summarize(runBenchmark(engine, 'benchmark/th-holdout.csv', 'th'));
    expect(s.meanSimilarity).toBeGreaterThanOrEqual(85);
  });
  it('third list, US state names (never used for tuning)', () => {
    const s = summarize(runBenchmark(engine, 'benchmark/th-holdout2.csv', 'th'));
    expect(s.meanSimilarity).toBeGreaterThanOrEqual(85);
  });
});
