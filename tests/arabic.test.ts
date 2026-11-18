// Automatic checks for the Arabic pack. Run with: npx vitest run tests/arabic.test.ts
// The pack is loaded here directly, so the checks work whether or not it is listed in src/packs.ts.
import { describe, expect, it } from 'vitest';
import { summarize } from '../src/benchmark';
import pack from '../packs/ar/pack.json';
import jaPack from '../packs/ja/pack.json';
import { loadArabicEngine, normalizeArabic, runArabicBenchmark, runPaperBenchmark } from '../scripts/run-ar-benchmark';

const engine = loadArabicEngine();
const ar = (name: string, profile = 'traditional') => engine.check(name, 'ar').words[0].profiles[profile];

describe('Arabic: rules stated in Al-Athwary (2017)', () => {
  it('a name that starts with a vowel gets a catch in the throat first (Intel, Amazon)', () => {
    expect(ar('Intel').ipa!.startsWith('ʔ')).toBe(true);
    expect(ar('Amazon').ipa!.startsWith('ʔ')).toBe(true);
    expect(ar('Tesla').ipa!.startsWith('ʔ')).toBe(false);
  });
  it('a consonant pair at the start is split by a vowel that copies the next vowel (cream, bronze)', () => {
    expect(ar('cream').respelling).toBe('ki-riim');
    expect(ar('bronze').respelling).toBe('bu-runz');
    const c = ar('cream').changes.find((x) => x.kind === 'epenthesis')!;
    expect(c.ruleId).toBe('ar-start-pair');
    expect(c.confidence).toBe('high');
    expect(c.effort).toBe(12);
    expect(c.where).toBe('start');
  });
  it('S plus a consonant at the start gets "i" in front (Starbucks, sketch)', () => {
    const r = ar('Starbucks');
    expect(r.respelling).toBe('is-tar-baks');
    expect(r.ipa).toBe('ʔis.tar.baks');
    const c = r.changes.find((x) => x.ruleId === 'ar-start-s')!;
    expect(c.confidence).toBe('high');
    expect(c.effort).toBe(12);
    expect(ar('sketch').respelling.startsWith('is-k')).toBe(true);
  });
  it('three consonants at the start get both repairs (Sprite, strategy)', () => {
    const r = ar('Sprite');
    expect(r.respelling).toBe('is-ba-rayt');
    expect(r.changes.some((x) => x.ruleId === 'ar-start-s')).toBe(true);
    expect(r.changes.some((x) => x.ruleId === 'ar-start-pair')).toBe(true);
    expect(ar('strategy').respelling.startsWith('is-ta-raa')).toBe(true);
  });
  it('three consonants in the middle get a vowel after the second (control, computer)', () => {
    expect(ar('control').respelling).toBe('kun-tu-ruul');
    expect(ar('computer').respelling).toBe('kum-bi-yuu-tar');
    expect(ar('control').changes.some((x) => x.ruleId === 'ar-middle-three' && x.confidence === 'high')).toBe(true);
  });
  it('two consonants are allowed in the middle and at the end (Pepsi, Ford, bronze)', () => {
    expect(ar('Pepsi').changes.some((x) => x.kind === 'epenthesis')).toBe(false);
    expect(ar('Ford').respelling).toBe('furd');
    expect(ar('bronze').changes.filter((x) => x.kind === 'epenthesis').length).toBe(1);
  });
  it('two vowels in a row get a Y or W between them (radio, video)', () => {
    expect(ar('radio').respelling).toBe('ray-di-yuu');
    expect(ar('video').respelling).toBe('fii-di-yuu');
    const c = ar('radio').changes.find((x) => x.ruleId === 'ar-glide')!;
    expect(c.confidence).toBe('high');
    expect(c.effort).toBe(0);
  });
  it('an L written double between vowels is held longer (villa, gorilla)', () => {
    expect(ar('villa').respelling).toBe('fil-la');
    expect(ar('gorilla').respelling).toBe('ghuu-ril-la');
    expect(ar('villa').changes.some((x) => x.ruleId === 'ar-double-l')).toBe(true);
  });
});

describe('Arabic: rules inferred from the study\'s examples', () => {
  it('P becomes B and V becomes F, graded medium (Pepsi, video)', () => {
    expect(ar('Pepsi').respelling).toBe('bib-sii');
    const p = ar('Pepsi').changes.find((x) => x.from === 'P')!;
    expect(p.to).toBe('B');
    expect(p.confidence).toBe('medium');
    expect(p.span).toEqual([0, 1]);
    const v = ar('video').changes.find((x) => x.from === 'V')!;
    expect(v.to).toBe('F');
    expect(v.confidence).toBe('medium');
  });
  it('a hard G becomes GH and CH becomes T plus SH (Google, sketch)', () => {
    expect(ar('Google').respelling).toBe('ghuu-ghil');
    expect(ar('Google').changes.filter((x) => x.ruleId === 'ar-c-g').length).toBe(2);
    expect(ar('sketch').changes.some((x) => x.ruleId === 'ar-c-ch' && x.to === 'T + SH')).toBe(true);
    expect(ar('sketch').script.endsWith('تش')).toBe(true);
  });
  it('R is said where it is written (computer, Starbucks)', () => {
    expect(ar('computer').respelling.endsWith('tar')).toBe(true);
    expect(ar('Starbucks').changes.some((x) => x.kind === 'rDropped')).toBe(false);
  });
  it('rules with no source are graded low (NG, ZH, three final consonants)', () => {
    for (const [name, id] of [['king', 'ar-c-ng'], ['vision', 'ar-c-zh'], ['text', 'ar-end-three']]) {
      const c = ar(name).changes.find((x) => x.ruleId === id)!;
      expect(c.confidence).toBe('low');
      expect(c.source).toBe(pack.sources.unverified);
    }
  });
});

describe('Arabic: the two speaker groups', () => {
  it('lists the standard group first', () => {
    expect(Object.keys(pack.profiles)).toEqual(['traditional', 'younger']);
    expect(pack.profileLabels.traditional).toBe('Standard pronunciation');
  });
  it('English-exposed speakers keep a starting pair and keep P and V (cream, Pepsi, video)', () => {
    expect(ar('cream', 'younger').respelling).toBe('kriim');
    const kept = ar('cream', 'younger').changes.find((x) => x.kind === 'clusterKept')!;
    expect(kept.effort).toBe(5);
    expect(kept.confidence).toBe('medium');
    expect(ar('Pepsi', 'younger').respelling).toBe('pip-sii');
    expect(ar('Pepsi', 'younger').changes.find((x) => x.from === 'P')!.confidence).toBe('low');
    expect(ar('video', 'younger').respelling).toBe('vii-di-yuu');
  });
  it('S plus a consonant gets "i" in front for both groups (Starbucks, Sprite)', () => {
    expect(ar('Starbucks', 'younger').respelling).toBe('is-tar-baks');
    expect(ar('Sprite', 'younger').respelling).toBe('is-prayt');
  });
  it('fewer repairs give the English-exposed group a higher Ease score (Sprite)', () => {
    expect(ar('Sprite', 'younger').ease).toBeGreaterThan(ar('Sprite').ease);
  });
});

describe('Arabic: spelling and housekeeping', () => {
  it('long vowels get a letter and short vowels do not (Starbucks, Facebook, Amazon)', () => {
    expect(ar('Starbucks').script).toBe('ستاربكس');
    expect(ar('Facebook').script).toBe('فيسبوك');
    expect(ar('Amazon').script).toBe('أمازون');
    expect(ar('Microsoft').script).toBe('مايكروسوفت');
  });
  it('the spelling is the same for both groups and writes P as ب', () => {
    expect(ar('Pepsi', 'younger').script).toBe(ar('Pepsi').script);
    expect(ar('Pepsi').script).toBe('بيبسي');
  });
  it('every change has a reason, a rule name, a source and a confidence level', () => {
    for (const name of ['Starbucks', 'Sprite', 'Google', 'Netflix', 'king', 'vision', 'villa', 'radio', 'Zyntrova']) {
      for (const profile of ['traditional', 'younger']) {
        for (const c of ar(name, profile).changes) {
          expect(c.why.length).toBeGreaterThan(20);
          expect(c.ruleId.startsWith('ar-')).toBe(true);
          expect(c.source.length).toBeGreaterThan(20);
          expect(['high', 'medium', 'low']).toContain(c.confidence);
        }
      }
    }
  });
  it('uses the common Ease points table', () => {
    expect(pack.effortPoints).toEqual({ substitution: 6, epenthesis: 12, finalChanged: 10, finalDropped: 8, clusterKept: 5, rDropped: 1, codaAfterDiphthong: 10, nonNativeFinalKept: 10 });
    expect(Object.keys(pack.effortPoints)).toEqual(Object.keys(jaPack.effortPoints));
  });
  it('keeps scores between 0 and 100', () => {
    for (const name of ['Strengths', 'Schwarzkopf', 'A', 'Worcestershire sauce', 'Zyntrova']) {
      for (const o of Object.values(engine.check(name, 'ar').overall)) {
        expect(o.ease).toBeGreaterThanOrEqual(0);
        expect(o.ease).toBeLessThanOrEqual(100);
        expect(o.survival).toBeGreaterThanOrEqual(0);
        expect(o.survival).toBeLessThanOrEqual(100);
      }
    }
  });
  it('treats the alef forms as one letter when spellings are compared', () => {
    expect(normalizeArabic('أمازون')).toBe(normalizeArabic('امازون'));
    expect(normalizeArabic('ريڤلون')).toBe('ريفلون');
  });
});

// Floors sit a little below the figures measured when the pack was written (2026-11-18):
// tuning list 94.7; held-out lists 91.6 and 91.5 (first and only run); Al-Athwary's plain example words 87.1.
describe('Arabic: benchmark accuracy does not drop', () => {
  it('tuning list (rules were tuned on this list)', () => {
    const rows = runArabicBenchmark(engine, 'benchmark/ar-brands.csv').filter((r) => r.origin === 'en');
    expect(summarize(rows).meanSimilarity).toBeGreaterThanOrEqual(93.7);
  });
  it('held-out lists (never used for tuning)', () => {
    const a = runArabicBenchmark(engine, 'benchmark/ar-holdout.csv').filter((r) => r.origin === 'en');
    const b = runArabicBenchmark(engine, 'benchmark/ar-holdout2.csv').filter((r) => r.origin === 'en');
    expect(summarize(a).meanSimilarity).toBeGreaterThanOrEqual(90.6);
    expect(summarize(b).meanSimilarity).toBeGreaterThanOrEqual(90.5);
  });
  it('pronunciation of the example words printed in Al-Athwary (2017)', () => {
    const rows = runPaperBenchmark(engine, 'benchmark/ar-athwary-examples.csv').filter((r) => r.origin === 'plain' || r.origin === 'stem');
    expect(summarize(rows).meanSimilarity).toBeGreaterThanOrEqual(86);
  });
});
