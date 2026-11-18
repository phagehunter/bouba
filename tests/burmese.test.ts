// Automatic checks for the Burmese pack. Run with: npm test
import { describe, expect, it } from 'vitest';
import { loadEngine } from '../src/node';
import { runIpaBenchmark, summarize } from '../src/benchmark';

const engine = loadEngine();
const my = (name: string, profile = 'traditional') => engine.check(name, 'my').words[0].profiles[profile];

describe('Burmese: behaviors reported in the published studies', () => {
  it('a final consonant becomes a catch in the throat (gas, police)', () => {
    expect(my('gas').respelling).toBe("geh'");
    expect(my('police').respelling).toBe("puh-lay'");
  });
  it('a final N or M makes the vowel nasal and a final L is not said', () => {
    expect(my('phone').ipa).toBe('pʰoũ');
    expect(my('uncle').changes.some((c) => c.from === 'L' && c.to === '')).toBe(true);
  });
  it('two consonants at the start are split by a weak vowel, and none is dropped (Spain, Sprite)', () => {
    expect(my('Spain').respelling).toBe('suh-payn');
    expect(my('Sprite').changes.filter((c) => c.kind === 'epenthesis').length).toBe(2);
  });
  it('a consonant followed by W is kept as it is (queen)', () => {
    expect(my('queen').changes.some((c) => c.kind === 'epenthesis')).toBe(false);
  });
  it('S before a consonant in the middle of a word starts a new weak syllable (Boston)', () => {
    expect(my('Boston').ipa).toBe('bɔ.sə.tʊ̃');
  });
  it('F is P in the established pattern and kept in the newer one; R is Y or a tapped R', () => {
    expect(my('coffee', 'traditional').ipa).toBe('kɔ.pʰi');
    expect(my('coffee', 'younger').ipa).toBe('kɔ.fi');
    expect(my('radio', 'traditional').respelling.startsWith('y')).toBe(true);
    expect(my('radio', 'younger').respelling.startsWith('r')).toBe(true);
  });
  it('gives no Burmese-script spelling', () => {
    expect(my('Starbucks').script).toBe('');
  });
});

describe('Burmese: agreement with published loanword pronunciations does not drop', () => {
  const rows = runIpaBenchmark(engine, 'benchmark/my-loanwords.csv', 'my');
  it('half used for adjustments', () => {
    expect(summarize(rows.filter((r) => r.origin === 'tune')).meanSimilarity).toBeGreaterThanOrEqual(85);
  });
  it('half set aside', () => {
    expect(summarize(rows.filter((r) => r.origin === 'check')).meanSimilarity).toBeGreaterThanOrEqual(86);
  });
});
