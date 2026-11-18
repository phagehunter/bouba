// Arabic adapter (Modern Standard Arabic). Turns the English sounds of one word into the form
// the rules predict for Standard Arabic, and lists every change made on the way. All tables and
// rule texts are read from pack.json; this file only applies them. Stress is not predicted.
//
// The word is built as a line of consonants and vowels. Standard Arabic has three vowels
// (a, i, u), each short or long, and every syllable starts with exactly one consonant, so the
// line is then repaired: a vowel is added inside or in front of consonant groups, a Y or W goes
// between two vowels, and a word that starts with a vowel gets a light catch in the throat first.
// The Arabic spelling writes long vowels with a letter and leaves short vowels out.
import packJson from './pack.json';
import { alignLetters } from '../../src/english';
import type { AdaptInput, AdaptOutput, Change, ChangeKind } from '../../src/types';

const pack: any = packJson;

interface Seg {
  t: 'C' | 'V';
  key: string; // consonants: key of pack.sounds; vowels: 'a' | 'i' | 'u'
  long?: boolean; // vowels
  ar: string; // Arabic letters this sound writes ('' = not written)
  i: number; // position of the English sound in input.phones (-1 = added by a repair)
  inserted?: boolean; // added by a repair
  glide?: boolean; // the Y or W that ends a two-part vowel ("ay", "aw", "uy")
  double?: boolean; // said in both syllables (doubled L, or a glide before a vowel)
  finalAr?: string; // the letters written when the sound ends the word
  initialAr?: string; // vowels: the letters written when the vowel starts the word
  withNext?: boolean; // starts a syllable together with the next consonant (a kept pair)
}

const LABEL: Record<string, string> = { JH: 'J', HH: 'H', DH: 'TH' };
const label = (p: string) => LABEL[p] ?? p;
const VOWEL_LETTERS = /[aeiouy]+/g;
const base = (p: string) => p.replace(/\d/, '');
const isVowelPhone = (p: string) => /\d$/.test(p);

/**
 * The vowel letters behind each vowel sound (same method as the Japanese adapter). A group of
 * vowel letters may spell one sound ("ea" in "team") or two sounds ("io" in "radio"); a lone "e"
 * may be silent. Every way of lining the two lists up gets a cost, and the cheapest wins.
 */
function vowelLetters(word: string, phones: string[]): ({ text: string; end: number } | undefined)[] {
  // "qu" is shortened to one letter for the line-up; 'shift' turns a position back into one in the typed word.
  const w = word.replace(/qu/g, 'q').replace(/^y(?=[aeiou])/, 'j');
  const shift = (pos: number) => { let n = pos; for (let k = 0, j = 0; j < pos && k < word.length; k++, j++) if (word[k] === 'q' && word[k + 1] === 'u') { k++; n++; } return n; };
  const groups = [...w.matchAll(VOWEL_LETTERS)].map((m) => ({ text: m[0], end: m.index! + m[0].length }));
  const vowels = phones.map((p, k) => ({ p, k })).filter((x) => isVowelPhone(x.p));
  const adjacent = (a: number) => a + 1 < vowels.length
    && phones.slice(vowels[a].k + 1, vowels[a + 1].k).every((x) => x === 'W' || x === 'Y');
  const usual: Record<string, string> = pack.vowels.usualLetters;
  const fit = (text: string, v: number) => {
    const p = vowels[v].p;
    if (p.endsWith('0') || !usual[base(p)]) return 0;
    return new RegExp(usual[base(p)]).test(text) ? 0 : 2;
  };
  const G = groups.length;
  const V = vowels.length;
  const INF = 1e9;
  const cost: number[][] = Array.from({ length: G + 1 }, () => Array(V + 1).fill(INF));
  const back: string[][] = Array.from({ length: G + 1 }, () => Array(V + 1).fill(''));
  cost[0][0] = 0;
  for (let g = 0; g <= G; g++) {
    for (let v = 0; v <= V; v++) {
      const c = cost[g][v];
      if (c >= INF) continue;
      const step = (g2: number, v2: number, add: number, how: string) => {
        if (c + add < cost[g2][v2]) { cost[g2][v2] = c + add; back[g2][v2] = how; }
      };
      if (g < G && v < V) step(g + 1, v + 1, fit(groups[g].text, v), 'one');
      if (g < G && v + 1 < V && groups[g].text.length >= 2 && adjacent(v)) {
        step(g + 1, v + 2, 0.5 + fit(groups[g].text.slice(0, -1), v) + fit(groups[g].text.slice(-1), v + 1), 'two');
      }
      if (g < G) step(g + 1, v, groups[g].text !== 'e' ? 3 : groups[g].end === w.length ? 0.6 : 1.2, 'silent');
      if (v < V) step(g, v + 1, 3, 'unspelled');
    }
  }
  const out: ({ text: string; end: number } | undefined)[] = Array(V).fill(undefined);
  let g = G;
  let v = V;
  while (g > 0 || v > 0) {
    const how = back[g][v];
    if (how === 'one') { out[v - 1] = { text: groups[g - 1].text, end: shift(groups[g - 1].end) }; g--; v--; }
    else if (how === 'two') {
      out[v - 2] = { text: groups[g - 1].text.slice(0, -1), end: -1 };
      out[v - 1] = { text: groups[g - 1].text.slice(-1), end: shift(groups[g - 1].end) };
      g--; v -= 2;
    }
    else if (how === 'silent') g--;
    else if (how === 'unspelled') v--;
    else break;
  }
  return out;
}

export function adapt(input: AdaptInput): AdaptOutput {
  const profile = input.profile in pack.profiles ? input.profile : 'traditional';
  const word = input.word.toLowerCase().replace(/[^a-z]/g, '');
  const phones = input.phones;
  const pts = pack.effortPoints;
  const changes: Change[] = [];
  const sounds = pack.sounds;

  const vowelIdx = phones.map((p, k) => (isVowelPhone(p) ? k : -1)).filter((k) => k >= 0);
  const firstV = vowelIdx[0] ?? 0;
  const lastV = vowelIdx[vowelIdx.length - 1] ?? phones.length - 1;
  const whereOf = (i: number): Change['where'] => (i <= firstV ? 'start' : i > lastV ? 'end' : 'middle');
  const add = (kind: ChangeKind, from: string, to: string, where: Change['where'], rule: any, effort: number, loss: number, idx: number[]) => {
    changes.push({
      kind, from, to, where, why: rule.why, tip: rule.tip, effort, loss, confidence: rule.confidence ?? 'low',
      ruleId: rule.ruleId ?? 'ar-' + kind, source: pack.sources[rule.source] ?? rule.source ?? '', phoneIdx: idx.filter((k) => k >= 0),
    });
  };
  const test = (pattern: string, text: string) => new RegExp(pattern).test(text);

  // ---------- step 1: the Arabic sound for every English sound
  const spans = alignLetters(word, phones);
  const spelled = (i: number) => (spans[i] ? word.slice(spans[i]![0], spans[i]![1]) : '');
  const own = vowelLetters(word, phones);
  const lettersOf = new Map<number, string | undefined>();
  const lettersEnd = new Map<number, number>();
  vowelIdx.forEach((k, n) => { lettersOf.set(k, own[n]?.text); lettersEnd.set(k, own[n]?.end ?? -1); });
  // L spelled double after a short vowel (villa, gorilla): the engine marks the syllable before it.
  const doubledAt = new Set<number>();
  input.syllables.forEach((s, n) => {
    const next = input.syllables[n + 1];
    if (s.doubled && next && pack.doubling.sounds.includes(next.onset[0])) doubledAt.add(next.onsetIdx[0]);
  });

  const stressOk = (want: string, s: number) =>
    want === 'main' ? s === 1 : want === 'any' ? s > 0 : want === 'none' ? s === 0 : want === 'notMain' ? s !== 1 : true;
  const vowelRule = (k: number) => {
    const p = base(phones[k]);
    const stress = Number(phones[k].slice(-1));
    const rest = phones.slice(k + 1).map(base).join(' ');
    const prev = phones.slice(0, k).map(base).join(' ');
    const letters = lettersOf.get(k);
    return pack.vowels.rules.find((r: any) =>
      (Array.isArray(r.phone) ? r.phone.includes(p) : r.phone === p) &&
      (!r.stress || stressOk(r.stress, stress)) &&
      (!r.letters || (letters !== undefined && test(r.letters, letters))) &&
      (r.beforeR === undefined || r.beforeR === (base(phones[k + 1] ?? '') === 'R')) &&
      (!r.beforeVowel || isVowelPhone(phones[k + 1] ?? '')) &&
      (!r.wordStart || k === 0) &&
      (!r.wordEnd || k === phones.length - 1) &&
      (!r.lastSyl || k === lastV) &&
      (!r.firstSyl || k === firstV) &&
      (!r.rest || test(r.rest, rest)) &&
      (!r.prev || test(r.prev, prev)) &&
      (!r.word || test(r.word, word)));
  };

  let segs: Seg[] = [];
  let vowelLoss = 0;
  const cons = (key: string, i: number, extra: Partial<Seg> = {}): Seg => ({ t: 'C', key, ar: sounds[key].ar, i, ...extra });
  phones.forEach((ph, k) => {
    const p = base(ph);
    if (isVowelPhone(ph)) {
      const rule = vowelRule(k) ?? { to: 'a' };
      const m = /^(y?)(aa|ii|uu|ay|aw|uy|a|i|u)(r?)$/.exec(rule.to) ?? ['', '', 'a', ''];
      const v = m[2];
      // "yuu" (the "ew" of "new"): a Y is said first, unless the English sounds already have one.
      if (m[1] && base(phones[k - 1] ?? '') !== 'Y') segs.push(cons('y', k));
      const two = pack.vowels.twoPart[v]; // "ay" = a + y
      const q = two ? two.vowel : v[0];
      const long = !two && v.length === 2;
      const letter = pack.vowels.letters[q];
      const ar = rule.ar ?? (two ? two.ar : long ? letter : '');
      segs.push({ t: 'V', key: q, long, ar: two ? '' : ar, i: k, finalAr: rule.arFinal ?? (two ? undefined : letter), initialAr: rule.arInitial });
      if (two) segs.push(cons(two.glide, k, { glide: true, ar: rule.ar ?? two.ar, finalAr: rule.arFinal }));
      // R is said wherever it is written, also where the English sounds leave it out.
      const end = lettersEnd.get(k) ?? -1;
      const silentR = p !== 'ER' && end > 0 && word[end] === 'r' && !isVowelPhone(phones[k + 1] ?? '') && base(phones[k + 1] ?? '') !== 'R';
      if (m[3] || silentR) segs.push(cons('r', k));
      vowelLoss += rule.loss ?? 0;
      return;
    }
    const next = base(phones[k + 1] ?? '');
    if (p === 'NG') {
      segs.push(cons('n', k));
      if (next === 'K' || next === 'G') return;
      const e = pack.consonants.NG;
      segs.push(cons(e.adds, k));
      add('substitution', 'NG', e.label, whereOf(k), e, e.effort ?? pts.substitution, e.loss ?? 0.3, [k]);
      return;
    }
    const entry = pack.consonants[p] ?? { to: 'h' };
    const e = { ...entry, ...(entry[profile] ?? {}) };
    // The sound follows the spelling in a few cases (the "zz" of "pizza" is written and said as Z).
    const bySpelling = (e.spelled ?? []).find((s: any) => test(s.letters, spelled(k)));
    const key: string = bySpelling?.to ?? e.to;
    if (e.ruleId && !bySpelling?.to) {
      const loss = e.loss ?? input.distance(p, e.panphon);
      add('substitution', label(p), e.label ?? key.toUpperCase(), whereOf(k), e, e.effort ?? pts.substitution, loss, [k]);
    }
    const seg = cons(key, k, bySpelling?.ar ? { ar: bySpelling.ar } : {});
    if (doubledAt.has(k) && isVowelPhone(phones[k - 1] ?? '') && isVowelPhone(phones[k + 1] ?? '')) {
      seg.double = true;
      const d = pack.doubling.rule;
      add('substitution', label(p), label(p) + label(p), whereOf(k), d, d.effort, d.loss, [k]);
    }
    segs.push(seg);
  });

  // ---------- step 2: two vowels in a row get a Y or W between them
  const glideRule = pack.glides.rule;
  for (let k = 0; k < segs.length - 1; k++) {
    const a = segs[k];
    const b = segs[k + 1];
    if (a.t === 'C' && a.glide && b.t === 'V') { a.double = true; continue; } // "ay" + vowel: the Y is said twice (ion -> ay-yun)
    if (a.t !== 'V' || b.t !== 'V') continue;
    const g: string = pack.glides.after[a.key];
    // The glide is spelled by the long-vowel letter before it; after a short vowel it gets its own letter.
    segs.splice(k + 1, 0, cons(g, -1, { inserted: true, ar: a.long ? '' : sounds[g].ar }));
    add('substitution', glideRule.from, g.toUpperCase(), whereOf(b.i), glideRule, 0, 0, [a.i, b.i]);
  }

  // ---------- step 3: repair consonant groups
  const ins = pack.clusters;
  const vowelAfter = (k: number): string => {
    // The added vowel copies the next vowel; before W it is "u" and before Y it is "i".
    const nextC = segs[k];
    if (nextC?.t === 'C' && ins.beforeGlide[nextC.key] && !nextC.glide) return ins.beforeGlide[nextC.key];
    for (let j = k; j < segs.length; j++) if (segs[j].t === 'V') return segs[j].key;
    return ins.defaultVowel;
  };
  const enLabel = (s: Seg) => (s.i >= 0 && !isVowelPhone(phones[s.i]) ? label(base(phones[s.i])) : sounds[s.key].roman.toUpperCase());
  /** Adds a short vowel after the consonant at position k. */
  const insertAfter = (k: number, rule: any) => {
    const c = segs[k];
    const nextC = segs[k + 1];
    const q = vowelAfter(k + 1);
    segs.splice(k + 1, 0, { t: 'V', key: q, long: false, ar: '', i: -1, inserted: true });
    add('epenthesis', enLabel(c) + ' + ' + enLabel(nextC), sounds[c.key].roman + q + '-' + sounds[nextC.key].roman, whereOf(c.i), rule, pts.epenthesis, ins.loss, [c.i, nextC.i]);
  };
  const firstVowelSeg = () => segs.findIndex((s) => s.t === 'V');

  // start of the word
  let fv = firstVowelSeg();
  if (fv >= 2) {
    const sFirst = segs[0].key === 's' && !ins.beforeGlide[segs[1].key];
    if (sFirst) {
      // "i" in front of S + consonant; the S then ends the new first syllable.
      const group = segs.slice(0, 2);
      add('substitution', group.map(enLabel).join(''), 'I' + group.map((s) => sounds[s.key].roman.toUpperCase()).join(''), 'start', ins.frontRule, pts.epenthesis, ins.loss, group.map((s) => s.i));
      if (fv >= 3) {
        if (profile === 'younger') {
          add('clusterKept', segs.slice(1, 3).map(enLabel).join(' + '), segs.slice(1, 3).map(enLabel).join(''), 'start', ins.keptRule, pts.clusterKept, 0, segs.slice(1, 3).map((s) => s.i));
          segs[1].withNext = true;
        } else insertAfter(1, ins.insideRule);
      }
      segs.unshift(cons('q', -1, { inserted: true }), { t: 'V', key: ins.frontVowel, long: false, ar: '', i: -1, inserted: true });
    } else if (profile === 'younger' && fv === 2) {
      add('clusterKept', segs.slice(0, 2).map(enLabel).join(' + '), segs.slice(0, 2).map(enLabel).join(''), 'start', ins.keptRule, pts.clusterKept, 0, segs.slice(0, 2).map((s) => s.i));
    } else {
      for (let k = fv - 2; k >= 0; k--) insertAfter(k, ins.insideRule);
    }
  }
  // middle of the word: three or more consonants between two vowels
  for (let k = firstVowelSeg() + 1; k < segs.length; k++) {
    if (segs[k].t !== 'C') continue;
    if (segs[k].glide) continue; // the Y or W that ends a two-part vowel belongs to the vowel
    let end = k;
    while (end < segs.length && segs[end].t === 'C') end++;
    if (end >= segs.length) break; // the group at the end of the word is handled below
    const n = end - k;
    if (n >= 3 && !segs.slice(k, end).some((x) => x.withNext)) {
      // The first consonant ends the syllable before; the last one starts the syllable after.
      // Each consonant between them gets a vowel (control -> kun-tu-rul).
      let at = k + 1;
      let left = n - 2;
      while (left > 0) {
        insertAfter(at, ins.middleRule);
        if (left >= 2) { at += 3; left -= 2; } else { at += 2; left -= 1; }
      }
      k = at;
    } else k = end;
  }
  // end of the word: two consonants may end a word, three may not
  {
    let start = segs.length;
    while (start > 0 && segs[start - 1].t === 'C' && !segs[start - 1].glide) start--;
    const n = segs.length - start;
    if (n >= 3 && start > 0) insertAfter(segs.length - (n >= 4 ? 3 : 2), ins.endRule);
  }
  // A word may not start with a vowel: a light catch in the throat comes first.
  if (segs[0]?.t === 'V') segs.unshift(cons('q', -1, { inserted: true }));

  if (vowelLoss > 0) add('vowels', 'vowels', 'nearest vowels', 'middle', pack.vowels.summaryRule, 0, Math.round(vowelLoss * 100) / 100, []);

  // ---------- step 4: syllables, respelling, transcription and Arabic spelling
  const syls: { onset: Seg[]; v?: Seg; coda: Seg[] }[] = [];
  let buf: Seg[] = [];
  for (const s of segs) {
    if (s.t === 'C') { buf.push(s); continue; }
    if (!syls.length) syls.push({ onset: buf, v: s, coda: [] });
    else {
      const prev = syls[syls.length - 1];
      const take = buf.length >= 2 && buf[buf.length - 2].withNext ? 2 : 1;
      const onset = buf.slice(-take);
      prev.coda = buf.slice(0, -take);
      if (onset[0]?.double) prev.coda.push(onset[0]);
      syls.push({ onset, v: s, coda: [] });
    }
    buf = [];
  }
  if (syls.length) syls[syls.length - 1].coda.push(...buf);
  else if (buf.length) syls.push({ onset: buf, coda: [] });

  // A long vowel is said short in a syllable that a consonant closes, unless that syllable ends the
  // word with a single consonant (pack.vowels.shortening). The spelling keeps its vowel letter.
  const said = new Map<Seg, boolean>();
  syls.forEach((s, n) => {
    if (!s.v) return;
    const lastSyl = n === syls.length - 1;
    const closed = lastSyl ? s.coda.length >= pack.vowels.shortening.finalConsonants : s.coda.length >= pack.vowels.shortening.middleConsonants;
    said.set(s.v, !!s.v.long && !closed);
  });
  const vRoman = (s?: Seg) => (s ? (said.get(s) ? s.key + s.key : s.key) : '');
  const vIpa = (s?: Seg) => (s ? s.key + (said.get(s) ? 'ː' : '') : '');
  const vWritten = (s: Seg) => (s.long ? s.key + s.key : s.key);
  const respelling = syls.map((s) => s.onset.map((c) => sounds[c.key].roman).join('') + vRoman(s.v) + s.coda.map((c) => sounds[c.key].roman).join('')).join('-');
  const ipa = syls.map((s) => s.onset.map((c) => sounds[c.key].ipa).join('') + vIpa(s.v) + s.coda.map((c) => sounds[c.key].ipa).join('')).join('.');

  let script = '';
  segs.forEach((s, k) => {
    const last = k === segs.length - 1;
    const prev = segs[k - 1];
    if (s.t === 'C') {
      const letters = last && s.finalAr !== undefined ? s.finalAr : s.ar;
      // The same consonant letter twice in a row is written once (Arabic spelling does not double letters).
      script += prev?.t === 'C' && letters !== '' && letters === prev.ar && !s.glide && !prev.glide ? '' : letters;
      return;
    }
    const next = segs[k + 1];
    if (prev?.key === 'q' && k === 1) {
      // A vowel at the start of the word is written on an alef.
      if (s.inserted) return; // the "i" said in front of S + consonant is not written in names
      const two = next?.glide ? vWritten(s) + next.key : '';
      script += s.initialAr ?? pack.vowels.initial[two] ?? pack.vowels.initial[vWritten(s)] ?? '';
      if (two && (s.initialAr !== undefined || pack.vowels.initial[two] !== undefined)) { next.ar = ''; if (next.finalAr !== undefined) next.finalAr = ''; }
      return;
    }
    script += last ? (s.finalAr ?? s.ar) : s.ar; // a vowel that ends the word is always written
  });

  return { respelling, script, changes, ipa };
}
