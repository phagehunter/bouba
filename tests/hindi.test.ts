// Automatic checks for the Hindi pack. Run with: npx vitest run tests/hindi.test.ts
// The pack is loaded here directly, so the checks work whether or not it is listed in src/packs.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import { runBenchmark, summarize } from '../src/benchmark';
import pack from '../packs/hi/pack.json';
import { adapt } from '../packs/hi/adapt';

const dictText = readFileSync('data/cmudict.txt', 'utf8');
const features = JSON.parse(readFileSync('data/features.json', 'utf8'));
const engine = new Engine(dictText, features, { hi: { pack, adapt } });

const hi = (name: string, profile = 'traditional') => engine.check(name, 'hi').words[0].profiles[profile];
const rule = (name: string, ruleId: string, profile = 'traditional') => hi(name, profile).changes.find((c) => c.ruleId === ruleId);

describe('Hindi: best-documented behaviors', () => {
  it('T and D are written with the curled-back letters ट and ड (Pal et al.)', () => {
    expect(hi('Tesla').script).toBe('टेस्ला');
    expect(hi('Dell').script).toBe('डेल');
    expect(rule('Tesla', 'hi-c-t')!.confidence).toBe('high');
    expect(rule('Dell', 'hi-c-d')!.kind).toBe('substitution');
  });
  it('TH becomes a T or D made on the teeth: थ and द (Pal et al.)', () => {
    expect(hi('think').script).toBe('थिंक');
    expect(hi('Smith').script).toBe('स्मिथ');
    expect(hi('this').script).toBe('दिस');
    expect(rule('think', 'hi-c-th')!.effort).toBe(6);
    expect(rule('this', 'hi-c-dh')!.to).toMatch(/teeth/);
  });
  it('P and K at the start are the plain letters प and क, with no puff of air (Narkar and Staroverov)', () => {
    expect(hi('Pepsi').script).toBe('पेप्सी');
    expect(hi('Kit').script.startsWith('क')).toBe(true);
    const c = rule('Pepsi', 'hi-c-ptk')!;
    expect(c.effort).toBe(0);
    expect(c.confidence).toBe('high');
  });
  it('V and W are both व (Fuchs)', () => {
    expect(hi('Visa').script.startsWith('व')).toBe(true);
    expect(hi('Walmart').script.startsWith('व')).toBe(true);
    expect(hi('Visa').respelling[0]).toBe(hi('Walmart').respelling[0]);
    expect(rule('Walmart', 'hi-c-w')).toBeTruthy();
    expect(rule('Visa', 'hi-c-v')).toBeTruthy();
  });
  it('the vowels of "day" and "go" are single steady vowels (Facebook, Coca-Cola)', () => {
    expect(hi('Facebook').respelling).toBe('fes-buk');
    expect(engine.check('Coca-Cola', 'hi').overall.traditional.script).toBe('कोकाकोला');
  });
  it('the vowel of "cup" is the weak vowel that the consonant letter carries (Starbucks, Subway)', () => {
    expect(hi('Starbucks').script).toBe('स्टारबक्स');
    expect(hi('Subway').script).toBe('सबवे');
  });
  it('R is kept wherever it is spelled (Burger, Starbucks)', () => {
    expect(hi('Burger').respelling).toBe('bar-gar');
    expect(hi('Burger').script).toBe('बर्गर');
    expect(hi('Starbucks').changes.some((c) => c.kind === 'rDropped')).toBe(false);
  });
  it('a final consonant is written with no vowel sign and no halant (Google, Jeep)', () => {
    expect(hi('Google').script).toBe('गूगल');
    expect(hi('Jeep').script).toBe('जीप');
    expect(hi('Google').script.endsWith('्')).toBe(false);
  });
});

describe('Hindi: the two speaker groups', () => {
  it('S plus a consonant at the start gets "i" in front for most speakers; the spelling keeps the pair', () => {
    expect(hi('school', 'traditional').respelling).toBe('is-kool');
    expect(hi('school', 'younger').respelling).toBe('skool');
    expect(hi('school', 'traditional').script).toBe('स्कूल');
    const c = rule('Starbucks', 'hi-s-start')!;
    expect(c.kind).toBe('epenthesis');
    expect(c.effort).toBe(12);
    expect(c.confidence).toBe('medium');
    expect(rule('Starbucks', 'hi-s-start', 'younger')).toBeUndefined();
  });
  it('Z is J for most speakers and Z for English-exposed speakers; the spelling is ज़ for both', () => {
    expect(hi('zoom', 'traditional').respelling).toBe('joom');
    expect(hi('zoom', 'younger').respelling).toBe('zoom');
    expect(hi('zoom', 'traditional').script).toBe('ज़ूम');
    expect(rule('zoom', 'hi-c-z', 'younger')).toBeUndefined();
  });
  it('a final L + M gets a weak vowel for most speakers (film -> fi-lam)', () => {
    expect(hi('film', 'traditional').respelling).toBe('fi-lam');
    expect(hi('film', 'younger').respelling).toBe('film');
    expect(hi('film', 'traditional').script).toBe('फ़िल्म');
  });
  it('F as "ph" and SH as "s" are offered as a second pronunciation for the first group only', () => {
    expect(hi('Shell', 'traditional').respelling).toBe('shel');
    expect(hi('Shell', 'traditional').alternative!.respelling).toBe('sel');
    expect(hi('Facebook', 'traditional').alternative!.respelling).toBe('phes-buk');
    expect(hi('Shell', 'younger').alternative).toBeUndefined();
    expect(hi('Google', 'traditional').alternative).toBeUndefined();
  });
  it('English-exposed speakers change fewer sounds', () => {
    expect(hi('Starbucks', 'younger').ease).toBeGreaterThan(hi('Starbucks', 'traditional').ease);
    expect(hi('zoom', 'younger').survival).toBeGreaterThan(hi('zoom', 'traditional').survival);
  });
});

describe('Hindi: writing Devanagari', () => {
  it('joins consonants inside a syllable with a halant (Sprite, Netflix, Twitter)', () => {
    expect(hi('Sprite').script).toBe('स्प्राइट');
    expect(hi('Netflix').script).toBe('नेटफ़्लिक्स');
    expect(hi('Twitter').script).toBe('ट्विटर');
  });
  it('writes a nasal before a consonant as a dot above the line (Instagram, King, Land)', () => {
    expect(hi('King').script).toBe('किंग');
    expect(hi('Land').script).toBe('लैंड');
    expect(hi('Intel').script).toBe('इंटेल');
  });
  it('uses ऑ and ॉ for the vowel of "hot", and vowel letters at the start of a word', () => {
    expect(hi('Xbox').script).toBe('एक्सबॉक्स');
    expect(hi('Oxford').script.startsWith('ऑ')).toBe(true);
    expect(hi('eBay').script).toBe('ईबे');
  });
  it('writes the dotted letters फ़ and ज़ for F and Z (Visa, Safari)', () => {
    expect(hi('Visa').script).toBe('वीज़ा');
    expect(hi('Safari').script).toBe('सफ़ारी');
  });
  it('puts a Y sound between two vowels (Wikipedia, Victoria)', () => {
    expect(hi('Wikipedia').script).toBe('विकिपीडिया');
    expect(hi('Victoria').respelling).toBe('vik-to-ri-yaa');
  });
  it('does not join the two parts of a compound name (Facebook, Walmart)', () => {
    expect(hi('Facebook').script).toBe('फ़ेसबुक');
    expect(hi('Walmart').script).toBe('वॉलमार्ट');
  });
});

describe('Hindi: pack data and unusual input', () => {
  it('every change names a rule, a reason, a source and the sounds involved', () => {
    const keys = Object.values(pack.sources);
    for (const name of ['Starbucks', 'Twitter', "McDonald's", 'Zyntrova', 'Schwarzkopf', 'vision', 'Thomas', 'film']) {
      for (const profile of ['traditional', 'younger']) {
        for (const c of hi(name, profile).changes) {
          expect(c.ruleId.startsWith('hi-')).toBe(true);
          expect(c.why.length).toBeGreaterThan(10);
          expect(['high', 'medium', 'low']).toContain(c.confidence);
          expect(keys).toContain(c.source);
          if (c.kind !== 'vowels') expect(c.phoneIdx.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it('marks which letters of the typed name a change belongs to', () => {
    expect(rule('Starbucks', 'hi-s-start')!.span).toEqual([0, 2]);
    expect(rule('Tesla', 'hi-c-t')!.span).toEqual([0, 1]);
  });
  it('has exactly the two profiles, the common effort table and the limits users are shown', () => {
    expect(Object.keys(pack.profiles)).toEqual(['traditional', 'younger']);
    expect(pack.effortPoints).toEqual({
      substitution: 6, epenthesis: 12, finalChanged: 10, finalDropped: 8, clusterKept: 5, rDropped: 1, codaAfterDiphthong: 10, nonNativeFinalKept: 10,
    });
    const limits = pack.limits.join(' ');
    expect(limits).toMatch(/not been checked by native speakers/);
    expect(limits).toMatch(/Indian speakers talking in English/);
    expect(limits).toMatch(/Stress and tone are not predicted/);
    expect(limits).toMatch(/Hindi only/);
    expect(limits).toMatch(/respelling and the Devanagari can differ/);
    expect(pack.validation.nativeChecked).toBe(false);
  });
  it('handles phrases, guessed names, letter names and empty input', () => {
    expect(engine.check('Burger King', 'hi').overall.traditional.respelling).toBe('bar-gar king');
    expect(engine.check('Zyntrova', 'hi').words[0].soundsFrom).toBe('guessed');
    expect(engine.check('IBM', 'hi').overall.traditional.script).toBe('आइबीएम');
    expect(engine.check('', 'hi').words.length).toBe(0);
  });
  it('keeps scores between 0 and 100', () => {
    for (const name of ['Strengths', 'Schwarzkopf', 'A', 'Worcestershire sauce']) {
      for (const o of Object.values(engine.check(name, 'hi').overall)) {
        expect(o.ease).toBeGreaterThanOrEqual(0);
        expect(o.ease).toBeLessThanOrEqual(100);
        expect(o.survival).toBeGreaterThanOrEqual(0);
        expect(o.survival).toBeLessThanOrEqual(100);
      }
    }
  });
});

// Floors sit a little below the mean similarity measured when the pack was written (2026-11-18):
// tuning list 91.6 (156 names); held-out list 83.5 on its first run (92 names).
const TUNE = 90.5;
const HOLDOUT = 82.5;
const english = (file: string) => summarize(runBenchmark(engine, file, 'hi').filter((r) => r.origin === 'en'));
describe('Hindi: benchmark accuracy does not drop', () => {
  it('tuning list (rules were tuned on this list)', () => {
    expect(english('benchmark/hi-tune.csv').meanSimilarity).toBeGreaterThanOrEqual(TUNE);
  });
  it('held-out list (never used for tuning)', () => {
    expect(english('benchmark/hi-holdout.csv').meanSimilarity).toBeGreaterThanOrEqual(HOLDOUT);
  });
});
