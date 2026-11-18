// Looks up the Thai Wikipedia title for each name in a list (default benchmark/th-brand-list.csv)
// and writes it out (default benchmark/th-brands.csv). The Thai title is the "real" Thai spelling
// the engine is tested against.
// Usage: npx tsx scripts/fetch-thai-titles.ts [list.csv] [output.csv]
import { readFileSync, writeFileSync } from 'node:fs';

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

const listFile = process.argv[2] ?? 'benchmark/th-brand-list.csv';
const outFile = process.argv[3] ?? 'benchmark/th-brands.csv';
const rows = parseCsv(readFileSync(listFile, 'utf8')).slice(1);
const found = new Map<string, string>();
for (let i = 0; i < rows.length; i += 40) {
  const batch = rows.slice(i, i + 40).map((r) => r[1]);
  const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=langlinks&lllang=th&lllimit=500&titles='
    + encodeURIComponent(batch.join('|'));
  const res = await fetch(url, { headers: { 'User-Agent': 'name-pronunciation-benchmark/0.0.0 (research script)' } });
  const json: any = await res.json();
  const alias = new Map<string, string>(); // final title -> requested title
  for (const n of json.query.normalized ?? []) alias.set(n.to, n.from);
  for (const r of json.query.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);
  for (const page of Object.values<any>(json.query.pages ?? {})) {
    const th = page.langlinks?.[0]?.['*'];
    if (th) found.set(alias.get(page.title) ?? page.title, th);
  }
}

const out = ['name,wiki_title,origin,thai_title,thai'];
let kept = 0;
for (const [name, title, origin] of rows) {
  const thaiTitle = found.get(title) ?? '';
  // Strip brackets ("(บริษัท)"), the word for "company", spaces and punctuation.
  const thai = thaiTitle.replace(/\(.*?\)/g, '').replace(/^(บริษัท|สโมสรฟุตบอล|นคร|รัฐ)/, '').replace(/[\s\-.,'’&!]/g, '');
  const usable = /^[฀-๿]+$/.test(thai);
  if (usable) kept++;
  out.push([name, title, origin, thaiTitle, usable ? thai : ''].map((c) => (c.includes(',') ? `"${c}"` : c)).join(','));
}
writeFileSync(outFile, out.join('\n') + '\n');
console.log(`brands: ${rows.length}, with a Thai-script title: ${kept}`);
