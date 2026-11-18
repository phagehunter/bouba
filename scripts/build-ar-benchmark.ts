// Builds the Arabic benchmark lists: for each English name, the title of its Arabic Wikipedia
// article, which is taken as the real Arabic spelling of the name.
// Usage: npx tsx scripts/build-ar-benchmark.ts
//
// Input (existing lists of names and English Wikipedia article titles):
//   benchmark/th-brand-list.csv     -> benchmark/ar-brands.csv    (tuning list)
//   benchmark/th-holdout-list.csv   -> benchmark/ar-holdout.csv   (held out)
//   benchmark/th-holdout2-list.csv  -> benchmark/ar-holdout2.csv  (held out)
// plus the extra names in EXTRA below, which go to the tuning list only.
//
// Output layout (the one src/benchmark.ts reads): name,wiki_title,origin,title,real
//   title = the Arabic Wikipedia title as fetched
//   real  = the cleaned spelling used for comparison ('' when the row is not usable)
//   origin = en | other | translated | mismatch
//     translated: the Arabic title holds a word that translates part of the name by meaning
//     mismatch:   the Arabic title is far too long or too short to be a spelling of the name
//
// The only network use is the Wikipedia API on en.wikipedia.org (langlinks to ar.wikipedia.org).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

// Words that say what kind of thing the article is about. They are removed and the row is kept.
const GENERIC = ['شركة', 'مؤسسة', 'مجموعة', 'ولاية', 'مدينة', 'تطبيق', 'برنامج', 'موقع', 'مطاعم', 'سلسلة', 'فنادق', 'ومنتجعات',
  'منتجعات', 'منتجات', 'منصة', 'خدمة', 'لعبة', 'متصفح', 'نظام', 'تشغيل', 'مشروب', 'علامة', 'تجارية', 'سيارات', 'للسيارات'];
// Words that translate part of the name by meaning (north, south, new, international ...). The row is flagged.
const MEANING = ['الشمالية', 'الجنوبية', 'الغربية', 'الشرقية', 'الجديدة', 'الجديد', 'الدولية', 'العالمية', 'المتحدة', 'الأمريكية',
  'الأمريكي', 'البريطانية', 'الوطنية', 'العامة', 'جزيرة', 'جزر', 'نهر', 'بحيرة', 'جبل', 'مقاطعة', 'جامعة', 'نادي', 'خطوط', 'الجوية'];

// The name to compare with the Arabic title, where the Arabic article is named after a shorter
// or differently split form than the one in the Thai list. Set from the tuning list only.
const AR_NAME: Record<string, string> = {
  'Shell plc': 'Shell',
  'Oracle Corporation': 'Oracle',
  'Adobe Inc.': 'Adobe',
  'Ford Motor Company': 'Ford',
  'Jaguar Cars': 'Jaguar',
  'Goodyear Tire and Rubber Company': 'Goodyear',
  'The Walt Disney Company': 'Walt Disney',
  'Marriott International': 'Marriott',
  'Firefox': 'Firefox',
  'Airbnb': 'Airbnb',
  'Rolls-Royce Motor Cars': 'Rolls-Royce Motor',
  'Tesla, Inc.': 'Tesla Motors',
  "Kellogg's": "Kellogg's",
  'Levi Strauss & Co.': "Levi's",
  'Kraft Foods': 'Kraft Foods',
  'Seagate Technology': 'Seagate Technology',
  'Kingston Technology': 'Kingston Technology',
  'Blizzard Entertainment': 'Blizzard Entertainment',
  'Lloyds Bank': 'Lloyds Bank',
  "Victoria's Secret": 'Victoria Secret',
};
// Tuning-list rows whose Arabic title was read and found to be something other than a spelling
// of the name. They are flagged as translated and left out of the figures.
const TUNE_EXCLUDE: Record<string, string> = {
  'Twitter': 'the article is now titled after the new name, X',
  'Hyatt': 'the title is an Arabic word, not a spelling of the name',
  'Spider-Man': 'translated by meaning',
  'Star Wars': 'translated by meaning',
  'Procter & Gamble': '"and" is translated',
};

// Extra English-origin names for the tuning list (name, English Wikipedia title).
const EXTRA: [string, string][] = [
  ['Twitter', 'Twitter'], ['Coca-Cola Zero', 'Coca-Cola Zero Sugar'], ['Seven Up', '7 Up'], ['Mountain Dew', 'Mountain Dew'],
  ['Dr Pepper', 'Dr Pepper'], ['Kellogg', "Kellogg's"], ['Heinz', 'Heinz'], ['Kraft', 'Kraft Foods'], ['Mars', 'Mars Inc.'],
  ['Cadbury', 'Cadbury'], ['Unilever', 'Unilever'], ['Johnson and Johnson', 'Johnson & Johnson'], ['Procter and Gamble', 'Procter & Gamble'],
  ['Dove', 'Dove (brand)'], ['Lux', 'Lux (soap)'], ['Nescafe', 'Nescafé'], ['Maybelline', 'Maybelline'], ['Revlon', 'Revlon'],
  ['Avon', 'Avon Products'], ['Levi Strauss', 'Levi Strauss & Co.'], ['Gap', 'Gap Inc.'], ['Skechers', 'Skechers'], ['Crocs', 'Crocs'],
  ['New Balance', 'New Balance'], ['Puma', 'Puma (brand)'], ['Lenovo', 'Lenovo'], ['Nvidia', 'Nvidia'], ['Qualcomm', 'Qualcomm'],
  ['Broadcom', 'Broadcom'], ['Salesforce', 'Salesforce'], ['Dropbox', 'Dropbox'], ['Hewlett-Packard', 'Hewlett-Packard'],
  ['Texas Instruments', 'Texas Instruments'], ['Western Digital', 'Western Digital'], ['Seagate', 'Seagate Technology'],
  ['Kingston', 'Kingston Technology'], ['Logitech', 'Logitech'], ['Garmin', 'Garmin'], ['Fitbit', 'Fitbit'], ['GoPro', 'GoPro'],
  ['Blizzard', 'Blizzard Entertainment'], ['Electronic Arts', 'Electronic Arts'], ['Rockstar Games', 'Rockstar Games'],
  ['Steam', 'Steam (service)'], ['Disney', 'Disney+'], ['Hulu', 'Hulu'], ['Vimeo', 'Vimeo'], ['Shazam', 'Shazam (application)'],
  ['Duolingo', 'Duolingo'], ['Quora', 'Quora'], ['Medium', 'Medium (website)'], ['Wordpress', 'WordPress'], ['Blogger', 'Blogger (service)'],
  ['Myspace', 'Myspace'], ['Craigslist', 'Craigslist'], ['Groupon', 'Groupon'], ['Booking', 'Booking.com'], ['Delta', 'Delta Air Lines'],
  ['Caterpillar', 'Caterpillar Inc.'], ['Lockheed Martin', 'Lockheed Martin'], ['Chrysler', 'Chrysler'], ['Dodge', 'Dodge'],
  ['Cadillac', 'Cadillac'], ['Buick', 'Buick'], ['Lincoln', 'Lincoln Motor Company'], ['Aston Martin', 'Aston Martin'],
  ['McLaren', 'McLaren'], ['Mini', 'Mini (marque)'], ['Lotus', 'Lotus Cars'], ['Vodafone', 'Vodafone'], ['Barclays', 'Barclays'],
  ['Lloyds', 'Lloyds Bank'], ['Reuters', 'Reuters'], ['Bloomberg', 'Bloomberg L.P.'], ['Forbes', 'Forbes'], ['Rolling Stone', 'Rolling Stone'],
  ['Newsweek', 'Newsweek'], ['Playboy', 'Playboy'], ['Monopoly', 'Monopoly (game)'], ['Scrabble', 'Scrabble'], ['Tetris', 'Tetris'],
  ['Pacman', 'Pac-Man'], ['Batman', 'Batman'], ['Superman', 'Superman'], ['Spiderman', 'Spider-Man'], ['Mickey Mouse', 'Mickey Mouse'],
  ['Sherlock Holmes', 'Sherlock Holmes'], ['Harry Potter', 'Harry Potter'], ['Star Wars', 'Star Wars'], ['Titanic', 'Titanic'],
];

const UA = 'name-pronunciation-benchmark/0.0.0 (research script)';

async function arabicTitles(titles: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=langlinks&lllang=ar&lllimit=500&titles='
      + encodeURIComponent(batch.join('|'));
    // The API answers with plain text when too many requests arrive; wait and try again.
    let json: any = null;
    for (let attempt = 0; attempt < 6 && !json; attempt++) {
      await new Promise((r) => setTimeout(r, attempt === 0 ? 1500 : 15000 * attempt));
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      const text = await res.text();
      try { json = JSON.parse(text); } catch { json = null; }
      if (json && !json.query) json = null;
    }
    if (!json) throw new Error('The Wikipedia API did not answer for a batch of titles.');
    const alias = new Map<string, string>(); // final title -> requested title
    for (const n of json.query.normalized ?? []) alias.set(n.to, n.from);
    for (const r of json.query.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);
    for (const page of Object.values<any>(json.query.pages ?? {})) {
      const ar = page.langlinks?.[0]?.['*'];
      if (ar) found.set(alias.get(page.title) ?? page.title, ar);
    }
  }
  return found;
}

/** The Arabic title with brackets, kind-of-thing words, spaces and punctuation removed. */
function clean(title: string, name: string): { real: string; flag: '' | 'translated' | 'mismatch' } {
  const words = title.replace(/\(.*?\)/g, ' ').replace(/[\-.,'’&!+،:]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.some((w) => MEANING.includes(w))) return { real: '', flag: 'translated' };
  let kept = words.filter((w) => !GENERIC.includes(w));
  // The article "al-" in front of the first word is dropped, unless the name itself may start with "al".
  if (kept.length && /^ال/.test(kept[0]) && !/^[aeiou]/i.test(name)) kept = [kept[0].slice(2), ...kept.slice(1)];
  const real = kept.join('');
  if (!/^[ء-يٱ-ۓ]+$/.test(real)) return { real: '', flag: '' };
  const letters = name.replace(/[^A-Za-z]/g, '').length;
  const n = [...real].length;
  if (n < 0.35 * letters || n > 1.3 * letters) return { real: '', flag: 'mismatch' };
  return { real, flag: '' };
}

async function build(rows: string[][], outFile: string, useOverrides: boolean) {
  const found = await arabicTitles(rows.map((r) => r[1]));
  const out = ['name,wiki_title,origin,title,real'];
  const counts = { rows: rows.length, withTitle: 0, usable: 0, translated: 0, mismatch: 0 };
  const cell = (c: string) => (c.includes(',') ? `"${c}"` : c);
  for (const [listName, title, origin] of rows) {
    const name = (useOverrides && AR_NAME[title]) || listName;
    const arTitle = found.get(title) ?? '';
    if (arTitle) counts.withTitle++;
    let { real, flag } = arTitle ? clean(arTitle, name) : { real: '', flag: '' as const };
    if (useOverrides && TUNE_EXCLUDE[title]) { real = ''; flag = 'translated'; }
    if (flag === 'translated') counts.translated++;
    if (flag === 'mismatch') counts.mismatch++;
    if (real) counts.usable++;
    out.push([name, title, flag || origin, arTitle, real].map(cell).join(','));
  }
  writeFileSync(join(root, 'benchmark', outFile), out.join('\n') + '\n');
  console.log(outFile, counts);
}

const read = (file: string) => parseCsv(readFileSync(join(root, 'benchmark', file), 'utf8')).slice(1);
const tuning = read('th-brand-list.csv');
const have = new Set(tuning.map((r) => r[1]));
const heldOut = new Set([...read('th-holdout-list.csv'), ...read('th-holdout2-list.csv')].map((r) => r[1]));
for (const [name, title] of EXTRA) if (!have.has(title) && !heldOut.has(title)) { tuning.push([name, title, 'en']); have.add(title); }

const which = process.argv[2] ?? 'all';
if (which === 'all' || which === 'tune') await build(tuning, 'ar-brands.csv', true);
if (which === 'all' || which === 'holdout') {
  await build(read('th-holdout-list.csv'), 'ar-holdout.csv', false);
  await build(read('th-holdout2-list.csv'), 'ar-holdout2.csv', false);
}
