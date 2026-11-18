// Automatic checks for the Mandarin pack. Run with: npx vitest run tests/mandarin.test.ts
// The pack is loaded here directly, so the checks work whether or not it is listed in src/packs.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine';
import { summarize } from '../src/benchmark';
import pack from '../packs/zh/pack.json';
import thPack from '../packs/th/pack.json';
import { adapt } from '../packs/zh/adapt';
import { runList, runMiao } from '../scripts/run-zh-benchmark';

const dictText = readFileSync('data/cmudict.txt', 'utf8');
const features = JSON.parse(readFileSync('data/features.json', 'utf8'));
const engine = new Engine(dictText, features, { zh: { pack, adapt } });
const zh = (name: string, profile = 'traditional') => engine.check(name, 'zh').words[0].profiles[profile];

describe('Mandarin: best-documented behaviors', () => {
  it('each consonant with no vowel after it becomes its own syllable (Starbucks -> si-ta-ba-ke-si)', () => {
    const r = zh('Starbucks');
    expect(r.respelling).toBe('si-ta-ba-ke-si');
    expect(r.script).toBe('斯塔巴克斯');
    expect(r.changes.filter((c) => c.kind === 'epenthesis').length).toBe(3);
  });
  it('the added vowel depends on the consonant: u after P, e after T, D and K, fu for F and V, si for S', () => {
    expect(zh('Jeep').respelling).toBe('ji-pu');
    expect(zh('Kit').respelling).toBe('ji-te');
    expect(zh('Mead').respelling).toBe('mi-de');
    expect(zh('Facebook').respelling).toBe('fei-si-bu-ke');
    expect(zh('Dove').respelling.endsWith('-fu')).toBe(true);
    const last = zh('Jeep').changes.find((c) => c.kind === 'epenthesis')!;
    expect(last.where).toBe('end');
    expect(last.confidence).toBe('high');
    expect(last.loss).toBe(0.5);
  });
  it('R before a vowel becomes L (Reebok starts with "li")', () => {
    const r = zh('Reebok');
    expect(r.respelling.startsWith('li-')).toBe(true);
    const c = r.changes.find((x) => x.ruleId === 'zh-c-r')!;
    expect(c.to).toBe('L');
    expect(c.confidence).toBe('high');
  });
  it('V before a vowel becomes W (Vodafone -> wo-da-feng, as printed in Miao 2006)', () => {
    const r = zh('Vodafone');
    expect(r.respelling).toBe('wo-da-feng');
    expect(r.script).toBe('沃达丰');
    expect(r.changes.some((c) => c.ruleId === 'zh-c-v-w' && c.to === 'W')).toBe(true);
  });
  it('K, G, S and H change before an "ee" sound (ji, ji, xi, xi)', () => {
    expect(zh('King').respelling).toBe('jin');
    expect(zh('Gift').respelling).toBe('ji-fu-te');
    expect(zh('Sears').respelling).toBe('xi-er-si');
    expect(zh('Hilton').respelling.startsWith('xi-')).toBe(true);
    for (const [name, id] of [['King', 'zh-c-k-j'], ['Gift', 'zh-c-g-j'], ['Sears', 'zh-c-s-x'], ['Hilton', 'zh-c-h-x']]) {
      expect(zh(name).changes.find((c) => c.ruleId === id)?.confidence).toBe('high');
    }
  });
  it('a final N or NG stays in its syllable and adds nothing (Lincoln -> lin-ken)', () => {
    const r = zh('Lincoln');
    expect(r.respelling).toBe('lin-ken');
    expect(r.script).toBe('林肯');
    expect(r.changes.some((c) => c.kind === 'epenthesis')).toBe(false);
  });
  it('an L with no vowel after it becomes "er" (Bill -> bi-er)', () => {
    const r = zh('Bill');
    expect(r.respelling).toBe('bi-er');
    expect(r.script).toBe('比尔');
    expect(r.changes.some((c) => c.ruleId === 'zh-l-er' && c.kind === 'finalChanged')).toBe(true);
  });
  it('M before B or P uses an N syllable; elsewhere a final M becomes "mu"', () => {
    expect(zh('Tampa').respelling).toBe('tan-pa');
    expect(zh('Tampa').changes.some((c) => c.ruleId === 'zh-m-n')).toBe(true);
    expect(zh('Sam').respelling).toBe('sa-mu');
  });
  it('"tr" is the T character plus an L-row character (Tracy -> te-lei-xi)', () => {
    expect(zh('Tracy').respelling).toBe('te-lei-xi');
    expect(zh('Tracy').script).toBe('特雷西');
  });
  it('word-final "ia" ends in 亚 (Cumbria, Virginia)', () => {
    expect(zh('Cumbria').script.endsWith('里亚')).toBe(true);
    expect(zh('Virginia').respelling).toBe('fu-ji-ni-ya');
  });
  it('弗 is used at the start of a word and 夫 elsewhere', () => {
    expect(zh('Frank').script).toBe('弗兰克');
    expect(zh('Netflix').script).toBe('内特夫利克斯');
  });
  it('T + S share one character (Scottsdale has 茨)', () => {
    expect(zh('Scottsdale').script.startsWith('斯科茨')).toBe(true);
  });
  it('an R after "ah" or "aw" and before a consonant is silent in both groups (Ford, Norfolk)', () => {
    expect(zh('Norfolk').respelling).toBe('nuo-fu-ke');
    expect(zh('Ford', 'traditional').respelling).toBe('fu-de');
    expect(zh('Ford', 'younger').respelling).toBe('fu-de');
    expect(zh('Ford').changes.some((c) => c.kind === 'rDropped')).toBe(true);
  });
  it('matches real sound-based names that use the standard characters', () => {
    expect(zh('Tesla').script).toBe('特斯拉');
    expect(zh('Intel').respelling).toBe('yin-te-er');
    expect(zh('Disney').respelling).toBe('di-si-ni');
    expect(engine.check('Sprint', 'zh').overall.traditional.respelling).toBe('si-pu-lin-te');
  });
});

describe('Mandarin: the two groups', () => {
  it('a final R is written 尔 in the standard transcription and left out in the brand style (Blair)', () => {
    expect(zh('Blair', 'traditional').respelling).toBe('bu-lai-er');
    expect(zh('Blair', 'traditional').script).toBe('布莱尔');
    expect(zh('Blair', 'younger').respelling).toBe('bu-lai');
    expect(zh('Blair', 'younger').script).toBe('布莱');
    expect(zh('Blair', 'younger').changes.find((c) => c.kind === 'rDropped')?.confidence).toBe('high');
  });
  it('a final D after N is kept in the standard transcription and left out in the brand style (Ashland)', () => {
    expect(zh('Ashland', 'traditional').respelling).toBe('a-shi-lan-de');
    expect(zh('Ashland', 'younger').respelling).toBe('a-shi-lan');
    expect(zh('Ashland', 'younger').changes.some((c) => c.kind === 'finalDropped' && c.from === 'D')).toBe(true);
  });
  it('final stops and final L are kept in both groups, and a dropped sound raises Ease', () => {
    expect(zh('Jeep', 'younger').respelling).toBe('ji-pu');
    expect(zh('Bill', 'younger').respelling).toBe('bi-er');
    expect(zh('Blair', 'younger').ease).toBeGreaterThan(zh('Blair', 'traditional').ease);
  });
});

describe('Mandarin: pack data and unusual input', () => {
  it('every change names a rule, a reason, a source and the sounds involved', () => {
    for (const name of ['Starbucks', 'Twitter', "McDonald's", 'Zyntrova', 'Schwarzkopf', 'Vaseline', 'Xerox']) {
      for (const profile of ['traditional', 'younger']) {
        for (const c of zh(name, profile).changes) {
          expect(c.ruleId.startsWith('zh-')).toBe(true);
          expect(c.why.length).toBeGreaterThan(10);
          expect(['high', 'medium']).toContain(c.confidence);
          expect(c.source.length).toBeGreaterThan(20);
          if (c.kind !== 'vowels') expect(c.phoneIdx.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it('marks which letters of the typed name a change belongs to', () => {
    const l = zh('Shell').changes.find((c) => c.ruleId === 'zh-l-er')!;
    expect(l.span).toEqual([3, 5]);
  });
  it('has the two profiles in order, the common effort points and the limits users are shown', () => {
    expect(Object.keys(pack.profiles)).toEqual(['traditional', 'younger']);
    expect(pack.profileLabels).toEqual({ traditional: 'Standard transcription', younger: 'Brand-style shortening' });
    expect(pack.effortPoints).toEqual(thPack.effortPoints);
    expect(pack.packVersion).toBe('0.0.0-s6');
    expect(pack.validation.nativeChecked).toBe(false);
    const limits = pack.limits.join(' ');
    expect(limits).toMatch(/Tones are not predicted/);
    expect(limits).toMatch(/choose characters for their meaning/);
    expect(limits).toMatch(/translations by meaning/);
    expect(limits).toMatch(/Taiwan and in Hong Kong/);
    expect(limits).toMatch(/not been checked by native speakers/);
    expect(pack.speakerNote).toMatch(/29%/);
  });
  it('holds the whole Xinhua table as data: 17 rows, 26 columns, every cell a character and its pinyin', () => {
    expect(pack.table.columns.length).toBe(26);
    expect(Object.keys(pack.table.rows).length).toBe(17);
    for (const row of Object.values<Record<string, string>>(pack.table.rows)) {
      for (const [col, cell] of Object.entries(row)) {
        expect(pack.table.columns).toContain(col);
        for (const part of cell.split('|')) expect(part).toMatch(/^[一-鿿]+ \S+$/);
      }
    }
    expect(pack.table.rows.a.b).toBe('巴 bā');
    expect(pack.table.rows.alone.l).toBe('尔 ěr');
  });
  it('handles phrases, guessed names and empty input', () => {
    expect(engine.check('Burger King', 'zh').overall.traditional.respelling).toBe('bo-ge jin');
    expect(engine.check('Zyntrova', 'zh').words[0].soundsFrom).toBe('guessed');
    expect(engine.check('', 'zh').words.length).toBe(0);
  });
  it('keeps scores between 0 and 100 and the respelling free of tone marks', () => {
    for (const name of ['Strengths', 'Schwarzkopf', 'A', 'Worcestershire sauce', 'Queue', 'Hurry']) {
      for (const o of Object.values(engine.check(name, 'zh').overall)) {
        expect(o.ease).toBeGreaterThanOrEqual(0);
        expect(o.ease).toBeLessThanOrEqual(100);
        expect(o.survival).toBeGreaterThanOrEqual(0);
        expect(o.survival).toBeLessThanOrEqual(100);
        expect(o.respelling).toMatch(/^[a-z\- ]*$/);
      }
    }
  });
});

describe('Mandarin: accuracy floor', () => {
  it('pinyin of the tuning list of Chinese Wikipedia titles stays above the floor', () => {
    const s = summarize(runList(engine, 'benchmark/zh-tune.csv', 'traditional'));
    expect(s.count).toBeGreaterThanOrEqual(FLOOR.tuneCount);
    expect(s.meanSimilarity).toBeGreaterThanOrEqual(FLOOR.tuneSimilarity);
    expect(s.exact).toBeGreaterThanOrEqual(FLOOR.tuneExact);
  });
  it('pinyin of the first 40 name pairs printed in Miao (2006) stays above the floor', () => {
    const s = summarize(runMiao(engine, 'tune', 'younger'));
    expect(s.count).toBe(40);
    expect(s.meanSimilarity).toBeGreaterThanOrEqual(FLOOR.miaoSimilarity);
  });
});

// A little below the figures measured when the rules were tuned (see pack.json "accuracyData").
const FLOOR = { tuneCount: 65, tuneSimilarity: 81, tuneExact: 33, miaoSimilarity: 64 };
