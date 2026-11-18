// Converts the two raw downloads into the small files the engine reads.
//   data/raw/cmudict.dict  ->  data/cmudict.txt   (one "word PHONES" line per word, first pronunciation only)
//   data/raw/ipa_all.csv   ->  data/features.json (sound-feature rows for only the sounds the packs use)
import { readFileSync, writeFileSync } from 'node:fs';

const raw = readFileSync('data/raw/cmudict.dict', 'utf8').split('\n');
const out: string[] = [];
for (const line of raw) {
  const clean = line.split('#')[0].trim();
  if (!clean) continue;
  const sp = clean.indexOf(' ');
  const word = clean.slice(0, sp);
  if (word.includes('(')) continue; // alternative pronunciations: keep the first only
  if (!/^[a-z][a-z'.-]*$/.test(word)) continue;
  out.push(word + ' ' + clean.slice(sp + 1).trim());
}
writeFileSync('data/cmudict.txt', out.join('\n'));
console.log('cmudict words:', out.length);

// Sounds needed for distance calculations (English source sounds and target-language sounds).
const NEEDED = ['p', 'b', 't', 'd', 'k', 'ɡ', 't͡ʃ', 'd͡ʒ', 't͡ɕ', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h',
  'm', 'n', 'ŋ', 'l', 'ɹ', 'r', 'w', 'j', 'ʔ', 'ɾ'];
const csv = readFileSync('data/raw/ipa_all.csv', 'utf8').split('\n');
const header = csv[0].split(',').slice(1);
const features: Record<string, string> = {};
for (const row of csv.slice(1)) {
  const cells = row.split(',');
  if (NEEDED.includes(cells[0])) features[cells[0]] = cells.slice(1).map((c) => c.trim()).join('');
}
const missing = NEEDED.filter((s) => !(s in features));
if (missing.length) console.warn('Missing from PanPhon table:', missing);
writeFileSync('data/features.json', JSON.stringify({ featureNames: header, segments: features }, null, 1));
console.log('feature rows:', Object.keys(features).length);

// Country figures for the markets the packs cover, from the Unicode CLDR country-language table.
// To add a market: add its country code and language code here and rebuild.
// A market that spans several countries lists them as a third item; their speakers are added up.
const ARAB = ['EG', 'SA', 'DZ', 'IQ', 'MA', 'SD', 'YE', 'SY', 'TN', 'JO', 'AE', 'LY', 'LB', 'OM', 'KW', 'MR', 'QA', 'BH', 'PS'];
const MARKETS: Record<string, [string, string, string[]?]> = {
  TH: ['Thailand', 'th'], MM: ['Myanmar', 'my'], JP: ['Japan', 'ja'],
  IN: ['India', 'hi'], CN: ['China', 'zh'], EG: ['Arab countries', 'ar', ARAB],
};
const info = JSON.parse(readFileSync('data/raw/territoryInfo.json', 'utf8')).supplemental.territoryInfo;
const markets: Record<string, unknown> = {};
for (const [code, [country, lang, codes]] of Object.entries(MARKETS)) {
  let population = 0;
  let speakers = 0;
  for (const c of codes ?? [code]) {
    const pop = Number(info[c]._population);
    population += pop;
    speakers += (pop * Number(info[c].languagePopulation[lang]._populationPercent)) / 100;
  }
  markets[code] = { country, population, languagePercent: Math.round((100 * speakers) / population), speakers: Math.round(speakers), ...(codes ? { countries: codes } : {}) };
}
writeFileSync('data/markets.json', JSON.stringify({ source: 'Unicode CLDR, supplemental/territoryInfo.json (figures are approximate)', markets }, null, 1));
console.log('markets:', Object.keys(markets).join(', '));
