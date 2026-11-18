// Shared helpers for the app screen: the engine instance and the plain-language wording.
import { Engine, band } from '../engine';
import { PACKS } from '../packs';
import { syllabify } from '../english';
import features from '../../data/features.json';
import marketData from '../../data/markets.json';
import dictText from '../../data/cmudict.txt?raw';
import type { Change, CheckResult } from '../types';

export const engine = new Engine(dictText, features as any, PACKS);
export { band };
export type Band = 'green' | 'amber' | 'red';

export interface Language {
  id: string;
  name: string; // "Thai"
  country: string; // "Thailand"
  speakers: number; // people in that country who speak the language (approximate)
  pack: any;
  profiles: { id: string; label: string; hint: string }[];
}

const MARKETS = (marketData as any).markets as Record<string, { country: string; speakers: number }>;

export const LANGUAGES: Language[] = Object.values(PACKS).map(({ pack }) => ({
  id: pack.id,
  name: pack.name,
  country: pack.market?.country ?? pack.name,
  speakers: MARKETS[pack.market?.code]?.speakers ?? 0,
  pack,
  profiles: Object.keys(pack.profiles).map((id) => ({ id, label: pack.profileLabels?.[id] ?? id, hint: pack.profiles[id] })),
}));
export const languageOf = (id: string) => LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
export const profileLabel = (lang: Language, profile: string) => lang.profiles.find((p) => p.id === profile)?.label ?? profile;

export const easeWords = (lang: Language): Record<Band, string> => ({
  green: `Fits ${lang.name} well`, amber: 'Needs some repair', red: 'Needs a lot of repair',
});
export const SURVIVAL_WORDS: Record<Band, string> = { green: 'Stays recognizable', amber: 'Partly changed', red: 'Changes a lot' };
export const FIT_WORDS: Record<Band, string> = { green: 'Little change', amber: 'Some change', red: 'Large change' };

const place = (c: Change) => (c.where === 'start' ? 'at the start' : c.where === 'end' ? 'at the end' : 'in the middle');
const target = (c: Change) => (c.to === "'" ? 'a catch in the throat' : c.ruleId.includes('nasal') ? 'a nasal vowel' : c.to);

/** One short line describing a change, with no linguistics terms. */
export function headline(c: Change, lang: Language): string {
  const from = c.from.replace(/ \+ /g, '');
  switch (c.kind) {
    case 'vowels': return `Vowels shift to the nearest ${lang.name} vowels`;
    case 'epenthesis': return c.where === 'start' && c.to.endsWith('-') ? `A short vowel is added in front of ${from}` : c.from.includes('+') ? `An extra vowel is added inside ${from}` : `An extra vowel is added after ${from}`;
    case 'clusterKept': return `${from} is kept, but is not a native ${lang.name} pair`;
    case 'nonNativeFinalKept': return `${c.from} ${place(c)} is kept (older speakers change it)`;
    case 'rDropped': return 'R after a vowel is not said';
    default: return c.to ? `${c.from} ${place(c)} becomes ${target(c)}` : `${c.from} ${place(c)} is not said`;
  }
}

/** How strongly to mark a change in the name: lost (red), changed (amber) or minor (not marked). */
export function severity(c: Change): 'lost' | 'changed' | 'minor' {
  if (c.kind === 'vowels' || c.kind === 'rDropped') return 'minor';
  if (!c.to) return 'lost';
  if (c.effort > 0) return 'changed';
  return 'minor';
}

export function allChanges(r: CheckResult, profile: string): { word: string; wordIndex: number; change: Change; key: string }[] {
  return r.words.flatMap((w, wi) => w.profiles[profile].changes.map((change, ci) => ({ word: w.word, wordIndex: wi, change, key: `${wi}-${ci}` })));
}

export function fitBand(ease: number, survival: number): Band {
  const order: Band[] = ['red', 'amber', 'green'];
  return order[Math.min(order.indexOf(band(ease)), order.indexOf(band(survival)))];
}

/** The one-sentence answer shown first. */
export function verdict(r: CheckResult, profile: string, lang: Language): { lead: string; detail: string; tone: Band } {
  const o = r.overall[profile];
  const real = allChanges(r, profile).filter((x) => severity(x.change) !== 'minor').sort((a, b) => b.change.loss - a.change.loss);
  const tone = fitBand(o.ease, o.survival);
  if (!real.length) return { lead: `${lang.name} speakers can say this almost as it is ("${o.respelling}").`, detail: '', tone };
  const lead = `${lang.name} speakers will likely say "${o.respelling}".`;
  const sb = band(o.survival);
  const main = real.find((x) => x.change.kind !== 'nonNativeFinalKept');
  if (!main) return { lead, detail: 'It stays close to the original.', tone };
  const top = headline(main.change, lang).replace(/^An /, 'an ');
  const detail = sb === 'green'
    ? `It stays close to the original; the main change is that ${top}.`
    : sb === 'amber'
      ? `Part of the sound changes, mainly that ${top}.`
      : `A large part of the sound changes, mainly that ${top}.`;
  return { lead, detail, tone };
}

/** The distinct fix suggestions for a result, most important first. */
export function tips(r: CheckResult, profile: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of allChanges(r, profile).sort((a, b) => b.change.loss + b.change.effort / 10 - (a.change.loss + a.change.effort / 10))) {
    const t = x.change.tip;
    if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

export interface MarketRow { lang: Language; said: string; ease: number; survival: number; total: number; fit: Band }

/** The same name checked in every language the app has, in the app's fixed language order. Uses each language's first speaker group. */
export function checkMarkets(text: string, sayAs: Record<string, string> = {}): MarketRow[] {
  return LANGUAGES.map((lang) => {
    const o = engine.check(text, lang.id, { sayAs }).overall[lang.profiles[0].id];
    return { lang, said: o.respelling, ease: o.ease, survival: o.survival, total: Math.round((o.ease + o.survival) / 2), fit: fitBand(o.ease, o.survival) };
  });
}

/** The markets with the highest average score first. */
export function sortMarkets(rows: MarketRow[]): MarketRow[] {
  return [...rows].sort((a, b) => b.total - a.total || b.survival - a.survival);
}

export function rankMarkets(text: string, sayAs: Record<string, string> = {}): MarketRow[] {
  return sortMarkets(checkMarkets(text, sayAs));
}

/** The markets under the three change bands, least change first. Inside a band the market with the most speakers comes first. Empty bands are left out. */
export function groupMarkets(rows: MarketRow[]): { band: Band; rows: MarketRow[] }[] {
  return (['green', 'amber', 'red'] as Band[])
    .map((b) => ({ band: b, rows: rows.filter((r) => r.fit === b).sort((x, y) => y.lang.speakers - x.lang.speakers) }))
    .filter((g) => g.rows.length > 0);
}

export function millions(n: number): string {
  if (n >= 1e9) return `about ${(n / 1e9).toFixed(1)} billion`;
  return n >= 1e6 ? `about ${Math.round(n / 1e6)} million` : n.toLocaleString('en-US');
}

const EN_PLAIN: Record<string, string> = {
  AA: 'ah', AE: 'a', AH: 'uh', AO: 'aw', AW: 'ow', AY: 'ai', EH: 'e', ER: 'er', EY: 'ay', IH: 'i', IY: 'ee', OW: 'oh', OY: 'oy', UH: 'u', UW: 'oo',
  CH: 'ch', JH: 'j', SH: 'sh', TH: 'th', DH: 'th', ZH: 'zh', NG: 'ng', HH: 'h',
};
/** A rough plain respelling of the English reading, so users can see what the app assumed.
 *  Syllables are separated by dots and the stressed vowel is in capitals: "stAHr·buhks". */
export function englishReading(sounds: string[]): string {
  const plain = (s: string) => EN_PLAIN[s] ?? s.toLowerCase();
  return syllabify(sounds)
    .map((syl) => syl.onset.map(plain).join('') + (syl.stress === 1 ? plain(syl.vowel).toUpperCase() : plain(syl.vowel)) + syl.coda.map(plain).join(''))
    .join('·');
}

export const SOURCE_WORDS: Record<string, string> = {
  dictionary: 'from the English dictionary',
  split: 'worked out from known words inside it',
  guessed: 'guessed from the spelling',
  letters: 'read letter by letter',
  override: 'using the text typed below',
};

export function resultAsText(r: CheckResult, profile: string, lang: Language): string {
  const o = r.overall[profile];
  const v = verdict(r, profile, lang);
  const lines = [
    `"${r.input}" for ${lang.name} speakers (${profileLabel(lang, profile)})`,
    `Likely said: ${o.respelling}`,
    ...(o.script ? [`Likely ${lang.name} spelling: ${o.script}`] : []),
    `Ease ${o.ease}/100 (${easeWords(lang)[band(o.ease)]}), Survival ${o.survival}/100 (${SURVIVAL_WORDS[band(o.survival)]})`,
    ...(v.detail ? [v.detail] : []),
    ...allChanges(r, profile).filter((x) => severity(x.change) !== 'minor').map((x) => `- ${r.words.length > 1 ? x.word + ': ' : ''}${headline(x.change, lang)}. ${x.change.why}`),
    'Prediction only; scores are provisional and not yet checked with native speakers.',
  ];
  return lines.join('\n');
}

export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
}

export function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}
