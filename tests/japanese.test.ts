// Automatic checks for the Japanese pack. Run with: npx vitest run tests/japanese.test.ts
// The pack is loaded here directly, so the checks work whether or not it is listed in src/packs.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import { analyzeEnglish } from '../src/english';
import { runBenchmark, summarize } from '../src/benchmark';
import pack from '../packs/ja/pack.json';
import { adapt } from '../packs/ja/adapt';

const dictText = readFileSync('data/cmudict.txt', 'utf8');
const features = JSON.parse(readFileSync('data/features.json', 'utf8'));
const engine = new Engine(dictText, features, { ja: { pack, adapt } });
// The benchmark reads the first profile listed, so a second engine lists the newer spelling first.
const newerFirst = { ...pack, profiles: { younger: pack.profiles.younger, traditional: pack.profiles.traditional } };
const engineNewer = new Engine(dictText, features, { ja: { pack: newerFirst, adapt } });

const ja = (name: string, profile = 'traditional') => engine.check(name, 'ja').words[0].profiles[profile];
// The engine shows one spelling for every profile, so the katakana of a given profile is read from the adapter.
const kana = (name: string, profile: string) => {
  const en = analyzeEnglish(name, engine.dict);
  return adapt({ word: name, phones: en.phones, syllables: en.syllables, profile, distance: () => 0.5 }).script;
};

describe('Japanese: best-known behaviors', () => {
  it('a group of consonants gets inserted vowels (Starbucks -> su-taa-bak-ku-su)', () => {
    const r = ja('Starbucks');
    expect(r.respelling).toBe('su-taa-bak-ku-su');
    expect(r.script).toBe('スターバックス');
    expect(r.changes.filter((c) => c.kind === 'epenthesis').length).toBe(3);
  });
  it('a final consonant gets a vowel: "u" as a rule, "o" after T and D, "i" after CH and J', () => {
    expect(ja('bus').respelling).toBe('ba-su');
    expect(ja('light').respelling).toBe('rai-to');
    expect(ja('bed').respelling).toBe('bed-do');
    expect(ja('match').respelling).toBe('mat-chi');
    const last = ja('bus').changes.find((c) => c.kind === 'epenthesis')!;
    expect(last.where).toBe('end');
    expect(last.loss).toBe(0.5);
  });
  it('a final N needs no vowel (Line -> rain)', () => {
    expect(ja('Line').respelling).toBe('rain');
    expect(ja('Line').script).toBe('ライン');
    expect(ja('Line').changes.some((c) => c.kind === 'epenthesis')).toBe(false);
  });
  it('L becomes R (Shell -> she-ru)', () => {
    const r = ja('Shell');
    expect(r.respelling).toBe('she-ru');
    expect(r.script).toBe('シェル');
    expect(r.changes.some((c) => c.kind === 'substitution' && c.from === 'L' && c.to === 'R')).toBe(true);
  });
  it('a consonant doubles after a short vowel (cat -> kyat-to)', () => {
    expect(ja('cat').respelling).toBe('kyat-to');
    expect(ja('cat').script).toBe('キャット');
    expect(ja('Netflix').script).toBe('ネットフリックス');
    expect(ja('apple').script).toBe('アップル');
  });
  it('no doubling after a long vowel or two-part vowel (Sprite, Google)', () => {
    expect(ja('Sprite').script).toBe('スプライト');
    expect(ja('Google').script).toBe('グーグル');
  });
  it('an R after a vowel is silent and the vowel is held longer', () => {
    expect(ja('Burger').respelling).toBe('baa-gaa');
    expect(ja('Starbucks').changes.some((c) => c.kind === 'rDropped')).toBe(true);
  });
  it('V becomes B, TH becomes S, and S before "i" becomes SH', () => {
    expect(ja('Visa').respelling.startsWith('b')).toBe(true);
    expect(ja('think').respelling).toBe('shin-ku');
  });
  it('small vowel shifts are reported as one summary line', () => {
    expect(ja('Tesla').changes.filter((c) => c.kind === 'vowels').length).toBe(1);
  });
});

describe('Japanese: the two spelling habits', () => {
  it('"ti" is "chi" in the established spelling and "ti" in the newer one', () => {
    expect(ja('team', 'traditional').respelling).toBe('chii-mu');
    expect(ja('team', 'younger').respelling).toBe('tii-mu');
    expect(kana('team', 'traditional')).toBe('チーム');
    expect(kana('team', 'younger')).toBe('ティーム');
  });
  it('"di" is "ji" in the established spelling and "di" in the newer one (Disney)', () => {
    expect(ja('Disney', 'traditional').respelling).toBe('ji-zu-nii');
    expect(ja('Disney', 'younger').respelling).toBe('di-zu-nii');
    expect(kana('Disney', 'younger')).toBe('ディズニー');
  });
  it('"tu" is "tsu" in the established spelling and "tu" in the newer one', () => {
    expect(kana('tool', 'traditional')).toBe('ツール');
    expect(kana('tool', 'younger')).toBe('トゥール');
  });
  it('"wi" is "u" plus "i" in the established spelling and one beat in the newer one', () => {
    expect(kana('wink', 'traditional')).toBe('ウインク');
    expect(kana('wink', 'younger')).toBe('ウィンク');
  });
  it('the newer spelling changes fewer sounds', () => {
    expect(ja('team', 'younger').survival).toBeGreaterThan(ja('team', 'traditional').survival);
  });
});

describe('Japanese: pack data and unusual input', () => {
  it('every change names a rule, a reason and the sounds involved', () => {
    for (const name of ['Starbucks', 'Twitter', "McDonald's", 'Zyntrova', 'Schwarzkopf']) {
      for (const profile of ['traditional', 'younger']) {
        for (const c of ja(name, profile).changes) {
          expect(c.ruleId.startsWith('ja-')).toBe(true);
          expect(c.why.length).toBeGreaterThan(10);
          expect(['medium', 'low']).toContain(c.confidence);
          expect(c.source.length).toBeGreaterThan(0);
          if (c.kind !== 'vowels') expect(c.phoneIdx.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it('marks which letters of the typed name a change belongs to', () => {
    const l = ja('Shell').changes.find((c) => c.ruleId === 'ja-c-l')!;
    expect(l.span).toEqual([3, 5]);
  });
  it('has exactly the two profiles and the limits users are shown', () => {
    expect(Object.keys(pack.profiles)).toEqual(['traditional', 'younger']);
    const limits = pack.limits.join(' ');
    expect(limits).toMatch(/Pitch accent is not predicted/);
    expect(limits).toMatch(/not been checked by native speakers/);
    expect(limits).toMatch(/Company-chosen spellings often differ/);
    expect(limits).toMatch(/read the English way/);
  });
  it('handles phrases, guessed names and empty input', () => {
    expect(engine.check('Burger King', 'ja').overall.traditional.respelling).toBe('baa-gaa kin-gu');
    expect(engine.check('Zyntrova', 'ja').words[0].soundsFrom).toBe('guessed');
    expect(engine.check('', 'ja').words.length).toBe(0);
  });
  it('keeps scores between 0 and 100', () => {
    for (const name of ['Strengths', 'Schwarzkopf', 'A', 'Worcestershire sauce']) {
      for (const o of Object.values(engine.check(name, 'ja').overall)) {
        expect(o.ease).toBeGreaterThanOrEqual(0);
        expect(o.ease).toBeLessThanOrEqual(100);
        expect(o.survival).toBeGreaterThanOrEqual(0);
        expect(o.survival).toBeLessThanOrEqual(100);
      }
    }
  });
});

// Floors sit a little below the mean similarity measured when the pack was written (2026-11-16):
// tune list 88.5 (established) and 90.8 (newer); test list 88.1 (established) and 89.9 (newer).
const TUNE_TRAD = 87.5;
const TUNE_NEW = 89.8;
const TEST_TRAD = 87;
const TEST_NEW = 88.8;
describe('Japanese: benchmark accuracy does not drop', () => {
  it('tune list, established spelling (rules were tuned on this list)', () => {
    const s = summarize(runBenchmark(engine, 'benchmark/ja-loanwords-tune.csv', 'ja'));
    expect(s.meanSimilarity).toBeGreaterThanOrEqual(TUNE_TRAD);
  });
  it('tune list, newer spelling', () => {
    const s = summarize(runBenchmark(engineNewer, 'benchmark/ja-loanwords-tune.csv', 'ja'));
    expect(s.meanSimilarity).toBeGreaterThanOrEqual(TUNE_NEW);
  });
  it('test list, established spelling (never used for tuning)', () => {
    const s = summarize(runBenchmark(engine, 'benchmark/ja-loanwords-test.csv', 'ja'));
    expect(s.meanSimilarity).toBeGreaterThanOrEqual(TEST_TRAD);
  });
  it('test list, newer spelling (never used for tuning)', () => {
    const s = summarize(runBenchmark(engineNewer, 'benchmark/ja-loanwords-test.csv', 'ja'));
    expect(s.meanSimilarity).toBeGreaterThanOrEqual(TEST_NEW);
  });
});
