// Builds the Mandarin benchmark lists from Wikipedia article titles.
// Usage: npx tsx scripts/build-zh-benchmark.ts
//
// Input lists (name, English Wikipedia article title, origin):
//   tuning:   benchmark/th-brand-list.csv plus half of benchmark/zh-extra-list.csv
//   held out: benchmark/th-holdout-list.csv, benchmark/th-holdout2-list.csv plus the other half of zh-extra-list.csv
// The extra list is split by a hash of the name, so the split does not depend on the results.
//
// For each name the script asks en.wikipedia.org for the Chinese article title, then asks
// zh.wikipedia.org for that title in the mainland variant (zh-cn) with
// `action=query&converttitles=1&prop=info&inprop=varianttitles`. Chinese Wikipedia stores a title
// in either traditional or simplified characters; this request converts the characters. It does
// not apply the regional names set inside a single article, so a title stored in its Taiwan or
// Hong Kong form (哈特斯菲 for Huddersfield) stays in that form and counts against the pack.
//
// With --display-titles the script also asks for each article's title as a mainland reader sees
// it (`action=parse&prop=displaytitle&variant=zh-cn`, one request per article; 愛迪達 is shown as
// 阿迪达斯). That is the better figure, but it needs about 430 single requests, and on 2026-11-18
// Wikipedia's rate limit stopped it after a few dozen. The lists in benchmark/ were built without it.
//
// Chinese names for the same sounds can be written with many different characters, so the
// benchmark compares pinyin. The character-to-pinyin map below covers only the characters of the
// Xinhua table in packs/zh/pack.json and the characters printed in Miao (2006). A title with any
// other character is marked "not-comparable". Names known to be translated by meaning are marked
// "meaning". Names whose Chinese form comes from another language are marked "other".
//
// Output: benchmark/zh-tune.csv and benchmark/zh-holdout.csv
//   name, wiki_title, origin, zh_title, real, real_pinyin, status
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import pack from '../packs/zh/pack.json';

const UA = { headers: { 'User-Agent': 'name-pronunciation-benchmark/0.0.0 (research script)' } };

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
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').replace(/'/g, '');

// ---------- character -> pinyin (no tones)
export function charMap(): Map<string, string> {
  const map = new Map<string, string>();
  const addCell = (cell: string) => {
    for (const part of cell.split('|')) {
      const [chars, py] = part.trim().split(' ');
      if (!chars || !py) continue;
      const cs = [...chars];
      const syl = strip(py).split('-');
      if (cs.length === syl.length) cs.forEach((c, k) => { if (!map.has(c)) map.set(c, syl[k]); });
    }
  };
  for (const row of Object.values<any>((pack as any).table.rows)) for (const cell of Object.values<string>(row)) addCell(cell);
  // Characters printed in Miao (2006) with their pinyin: the legible example names (section E of
  // the reader notes) and Table 5.5. Characters of the names Miao lists as translations are left out.
  const MIAO = '比 bi,尔 er,英 ying,特 te,迪 di,斯 si,尼 ni,西 xi,阿 a,什 shi,兰 lan,康 kang,柏 bai,米 mi,德 de,诺 nuo,卡 ka,'
    + '雅 ya,芳 fang,纺 fang,必 bi,适 shi,悍 han,马 ma,锐 rui,步 bu,舒 shu,肤 fu,佳 jia,加 jia,普 pu,嘉 jia,'
    + '浦 pu,仆 pu,坡 po,破 po,婆 po,布 bu,勃 bo,卜 bo,博 bo,波 bo,伯 bo,得 de,的 de,克 ke,科 ke,可 ke,格 ge,各 ge,哥 ge,个 ge,葛 ge';
  for (const pair of MIAO.split(',')) { const [c, py] = pair.split(' '); if (!map.has(c)) map.set(c, py); }
  return map;
}

// ---------- names whose Chinese title is a translation by meaning, in whole or in part
// (judged from the Chinese title alone, before any prediction was run on the held-out lists)
const MEANING = new Set<string>(readFileSync('benchmark/zh-meaning-names.csv', 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')[0]));

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

// One request at a time, with a pause between requests and a few retries when Wikipedia answers
// "too many requests". Set ZH_CACHE to a folder to keep the answers and avoid asking twice.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function getJson(url: string): Promise<any> {
  const dir = process.env.ZH_CACHE;
  const file = dir ? `${dir}/${hash(url)}.json` : '';
  if (file && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(2500 * (attempt * 4 + 1));
    try {
      const res = await fetch(url, UA);
      const text = await res.text();
      if (res.ok && text.startsWith('{') && !text.startsWith('{"error"')) { if (file) writeFileSync(file, text); return JSON.parse(text); }
    } catch { /* a dropped connection: try again after the pause */ }
  }
  throw new Error('Wikipedia did not answer after 5 tries: ' + url.slice(0, 80));
}

async function zhTitles(rows: string[][]): Promise<Map<string, string>> {
  const found = new Map<string, string>(); // English article title -> Chinese title as stored
  for (let i = 0; i < rows.length; i += 40) {
    const batch = rows.slice(i, i + 40).map((r) => r[1]);
    const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=langlinks&lllang=zh&lllimit=500&titles='
      + encodeURIComponent(batch.join('|'));
    const json: any = await getJson(url);
    const alias = new Map<string, string>();
    for (const n of json.query.normalized ?? []) alias.set(n.to, n.from);
    for (const r of json.query.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);
    for (const page of Object.values<any>(json.query.pages ?? {})) {
      const zh = page.langlinks?.[0]?.['*'];
      if (zh) found.set(alias.get(page.title) ?? page.title, zh);
    }
  }
  // Second step: the mainland (zh-cn) form of each Chinese title.
  const stored = [...new Set(found.values())];
  const cn = new Map<string, string>();
  for (let i = 0; i < stored.length; i += 40) {
    const batch = stored.slice(i, i + 40);
    const url = 'https://zh.wikipedia.org/w/api.php?action=query&format=json&redirects=1&converttitles=1&prop=info&inprop=varianttitles&titles='
      + encodeURIComponent(batch.join('|'));
    const json: any = await getJson(url);
    const alias = new Map<string, string>();
    for (const key of ['normalized', 'converted', 'redirects']) {
      for (const r of json.query[key] ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);
    }
    for (const page of Object.values<any>(json.query.pages ?? {})) {
      const v = page.varianttitles?.['zh-cn'];
      if (v) cn.set(alias.get(page.title) ?? page.title, v);
    }
  }
  // Optional: the title as displayed to a mainland reader (slow, see the note at the top).
  for (const zh of process.argv.includes('--display-titles') ? stored : []) {
    const url = 'https://zh.wikipedia.org/w/api.php?action=parse&format=json&redirects=1&prop=displaytitle&variant=zh-cn&page=' + encodeURIComponent(zh);
    try {
      const json: any = await getJson(url);
      const shown = String(json.parse?.displaytitle ?? '').replace(/<[^>]*>/g, '').trim();
      if (shown) cn.set(zh, shown);
    } catch { /* keep the character-converted title */ }
  }
  for (const [en, zh] of found) found.set(en, cn.get(zh) ?? zh);
  return found;
}

// Words Chinese Wikipedia adds to a title that the English name does not have.
const GENERIC = /(股份有限公司|有限公司|公司|集团|州|市|郡|大学|汽车|银行|酒店及度假村|酒店|摩托车|系统|漫画|国际|科技|石油|电气|足球俱乐部)$/;
function clean(title: string, name: string): string {
  let t = title.replace(/[（(].*?[)）]/g, '').replace(/[\s·・\-－.,'’&!]/g, '');
  // "-shire" is translated as 郡, so for those names 郡 is part of the name and stays (not comparable).
  for (let k = 0; k < 2; k++) if ([...t].length > 2 && !(/shire$/i.test(name) && t.endsWith('郡'))) t = t.replace(GENERIC, '');
  return t;
}

async function build(outFile: string, rows: string[][]) {
  const map = charMap();
  const titles = await zhTitles(rows);
  const out = ['name,wiki_title,origin,zh_title,real,real_pinyin,status'];
  const counts: Record<string, number> = {};
  for (const [listName, title, origin] of rows) {
    // The Thai lists name a few companies with a generic word that the Chinese title does not carry.
    const name = listName.replace(/^The /, '').replace(/ (Motor|Cars|Comics|Systems|Corporation|International|PLC)$/, '');
    const zhTitle = titles.get(title) ?? '';
    const real = clean(zhTitle, name);
    let status = 'ok';
    let pinyin = '';
    if (!zhTitle) status = 'no-title';
    else if (!/^[一-鿿]+$/.test(real)) status = 'latin';
    else if (origin !== 'en') status = 'other';
    else if (MEANING.has(name)) status = 'meaning';
    else if ([...real].some((c) => !map.has(c))) status = 'not-comparable';
    else pinyin = [...real].map((c) => map.get(c)).join('-');
    counts[status] = (counts[status] ?? 0) + 1;
    out.push([name, title, origin, zhTitle, status === 'latin' || status === 'no-title' ? '' : real, pinyin, status]
      .map((c) => (c.includes(',') ? `"${c}"` : c)).join(','));
  }
  writeFileSync(outFile, out.join('\n') + '\n');
  console.log(outFile, rows.length, 'names', counts);
}

const read = (f: string) => parseCsv(readFileSync(f, 'utf8')).slice(1);
const extra = read('benchmark/zh-extra-list.csv');
const tune = [...read('benchmark/th-brand-list.csv'), ...extra.filter((r) => hash(r[0]) % 2 === 0)];
const held = [...read('benchmark/th-holdout-list.csv'), ...read('benchmark/th-holdout2-list.csv'), ...extra.filter((r) => hash(r[0]) % 2 === 1)];
if (process.argv[1]?.endsWith('build-zh-benchmark.ts')) {
  await build('benchmark/zh-tune.csv', tune);
  await build('benchmark/zh-holdout.csv', held);
}
