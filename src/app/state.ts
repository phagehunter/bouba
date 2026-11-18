// What the app remembers and shares: the address after "#", the recent names and the shortlist.
// Everything here is a pure function with no browser access, so it can be tested directly.

export interface AddressState {
  name?: string;
  lang?: string;
}

const MAX_NAME = 200;
export const MAX_RECENT = 12;
export const MAX_SHORTLIST = 50;

const hasLetters = (s: string) => /[A-Za-z]/.test(s);
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The text that goes after "#" in the address, for example "n=Starbucks&l=th". */
export function encodeState(state: AddressState): string {
  const parts: string[] = [];
  const name = tidy(state.name ?? '');
  if (name) parts.push('n=' + encodeURIComponent(name.slice(0, MAX_NAME)));
  if (state.lang) parts.push('l=' + encodeURIComponent(state.lang));
  return parts.join('&');
}

/** Reads the text after "#". Unknown keys, broken encoding and unknown languages are ignored. */
export function decodeState(hash: string, languageIds?: readonly string[]): AddressState {
  const out: AddressState = {};
  for (const part of hash.replace(/^#/, '').split('&')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const key = part.slice(0, eq);
    let value: string;
    try { value = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' ')); } catch { continue; }
    if (key === 'n') out.name = tidy(value).slice(0, MAX_NAME);
    else if (key === 'l' && (!languageIds || languageIds.includes(value))) out.lang = value;
  }
  return out;
}

/** The recent-names list with one more name: newest first, no repeats (ignoring case), at most `max`. */
export function addRecent(list: readonly string[], name: string, max = MAX_RECENT): string[] {
  const clean = tidy(name).slice(0, MAX_NAME);
  if (!hasLetters(clean)) return [...list];
  const lower = clean.toLowerCase();
  return [clean, ...list.filter((n) => n.toLowerCase() !== lower)].slice(0, max);
}

/** Makes a stored value safe to use as the recent-names list. */
export function cleanRecent(value: unknown, max = MAX_RECENT): string[] {
  if (!Array.isArray(value)) return [];
  let out: string[] = [];
  for (const v of [...value].reverse()) if (typeof v === 'string') out = addRecent(out, v, max);
  return out;
}

/** The names in the shortlist box: one per line (commas and semicolons also separate). */
export function parseNames(text: string, max = MAX_SHORTLIST): string[] {
  return text.split(/[\n,;]+/).map((s) => s.trim()).filter(hasLetters).slice(0, max);
}

export function inShortlist(text: string, name: string): boolean {
  const lower = tidy(name).toLowerCase();
  return lower !== '' && parseNames(text, Infinity).some((n) => tidy(n).toLowerCase() === lower);
}

/** The shortlist text with the name added on a new line. Unchanged when the name is already there. */
export function addToShortlist(text: string, name: string): string {
  const clean = tidy(name);
  if (!hasLetters(clean) || inShortlist(text, clean)) return text;
  const base = text.replace(/\s+$/, '');
  return base ? base + '\n' + clean : clean;
}
