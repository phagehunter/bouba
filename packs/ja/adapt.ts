// Japanese adapter. Turns the English sounds of one word into the katakana form Japanese
// speakers use, and lists every change made on the way. All rules are read from pack.json;
// this file only applies them. Pitch accent is not predicted.
//
// Japanese is counted in beats (one katakana letter is roughly one beat), so the word is
// built beat by beat. Three beats have no vowel of their own and are written N (ン),
// Q (ッ, which doubles the next consonant) and L (ー, which lengthens the vowel before it).
import packJson from './pack.json';
import { alignLetters } from '../../src/english';
import type { AdaptInput, AdaptOutput, Change, ChangeKind } from '../../src/types';

const pack: any = packJson;

interface Seg {
  p: string; // ARPAbet sound without the stress digit
  i: number; // position in input.phones (-1 when unknown)
  v: boolean; // vowel
  stress: number;
  letters?: string; // vowels: the vowel letters that spell it
  sp: string; // consonants: the letters that spell it ('' when unknown)
  dbl: boolean; // consonants: the spelling doubles it (pp, ck, tch ...)
  rule?: any; // vowels: the pack rule that matched
  to?: string; // vowels: the Japanese vowel beats, e.g. "a", "aa", "ai"
}

const LABEL: Record<string, string> = { JH: 'J', HH: 'H', DH: 'TH' };
const label = (p: string) => LABEL[p] ?? p;
const VOWEL_LETTERS = /[aeiouy]+/g;

/**
 * The vowel letters behind each vowel sound. A group of vowel letters may spell one sound
 * (the "ea" of "team") or two sounds that meet with no consonant between them (the "io" of
 * "radio"); a lone "e" may be silent. Every way of lining the two lists up gets a cost, and
 * the cheapest wins. A stressed vowel paired with letters that do not usually spell it costs
 * extra (pack.vowels.usualLetters), which keeps a silent "e" from shifting the whole line-up.
 */
function vowelLetters(word: string, segs: Seg[]): (string | undefined)[] {
  const w = word.replace(/qu/g, 'q').replace(/^y(?=[aeiou])/, 'j');
  const groups = [...w.matchAll(VOWEL_LETTERS)].map((m) => ({ text: m[0], end: m.index! + m[0].length }));
  const vowels = segs.map((s, k) => ({ s, k })).filter((x) => x.s.v);
  // Two vowel sounds can share one letter group when nothing, or only a W or Y glide, lies between them.
  const adjacent = (a: number) => a + 1 < vowels.length
    && segs.slice(vowels[a].k + 1, vowels[a + 1].k).every((x) => x.p === 'W' || x.p === 'Y');
  const usual: Record<string, string> = pack.vowels.usualLetters;
  const fit = (text: string, v: number) => {
    const s = vowels[v].s;
    if (s.stress === 0 || !usual[s.p]) return 0;
    return new RegExp(usual[s.p]).test(text) ? 0 : 2;
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
  const out: (string | undefined)[] = Array(V).fill(undefined);
  let g = G;
  let v = V;
  while (g > 0 || v > 0) {
    const how = back[g][v];
    if (how === 'one') { out[v - 1] = groups[g - 1].text; g--; v--; }
    else if (how === 'two') { out[v - 2] = groups[g - 1].text.slice(0, -1); out[v - 1] = groups[g - 1].text.slice(-1); g--; v -= 2; }
    else if (how === 'silent') g--;
    else if (how === 'unspelled') v--;
    else break;
  }
  return out;
}

function buildSegs(input: AdaptInput, word: string): Seg[] {
  const spans = alignLetters(word, input.phones);
  const spell = (i: number) => (i >= 0 && spans[i] ? word.slice(spans[i]![0], spans[i]![1]) : '');
  const doubledSpelling = new RegExp(pack.doubling.doubledSpelling);
  const segs: Seg[] = [];
  let carry = false; // the previous syllable ended in a copy of this syllable's first consonant
  for (const s of input.syllables) {
    s.onset.forEach((p, k) => {
      const i = s.onsetIdx[k] ?? -1;
      const sp = p === 'R' && i === s.vowelIdx ? 'r' : spell(i);
      segs.push({ p, i, v: false, stress: 0, sp, dbl: (k === 0 && carry) || doubledSpelling.test(sp) });
    });
    carry = false;
    if (s.vowel) segs.push({ p: s.vowel, i: s.vowelIdx, v: true, stress: s.stress, letters: s.letters, sp: '', dbl: false });
    if (s.doubled) { carry = true; continue; }
    s.coda.forEach((p, k) => {
      const i = s.codaIdx[k] ?? -1;
      const sp = spell(i);
      segs.push({ p, i, v: false, stress: 0, sp, dbl: doubledSpelling.test(sp) });
    });
  }
  const own = vowelLetters(word, segs);
  let n = 0;
  for (const s of segs) if (s.v) { s.letters = own[n] ?? s.letters; n++; }
  return segs;
}

export function adapt(input: AdaptInput): AdaptOutput {
  const profile = input.profile in pack.profiles ? input.profile : 'traditional';
  const word = input.word.toLowerCase().replace(/[^a-z]/g, '');
  const pts = pack.effortPoints;
  const changes: Change[] = [];
  const beats: string[] = []; // keys of pack.kana, plus N, Q and L
  const glued = new Set<number>(); // beats that are the second half of a two-part vowel (the "i" of "ai")
  let segs = buildSegs(input, word);
  // A value may be given once, or separately per spelling habit ({ traditional: ..., younger: ... }).
  const forProfile = (x: any) => (x && typeof x === 'object' && !Array.isArray(x) ? (profile in x ? x[profile] : x.traditional) : x);

  const add = (kind: ChangeKind, from: string, to: string, where: Change['where'], rule: any, effort: number, loss: number, idx: number[]): Change => {
    const c: Change = {
      kind, from, to, where, why: rule.why, tip: rule.tip, effort, loss, confidence: rule.confidence ?? 'low',
      ruleId: rule.ruleId ?? 'ja-' + kind, source: pack.sources[rule.source] ?? rule.source ?? '', phoneIdx: idx.filter((k) => k >= 0),
    };
    changes.push(c);
    return c;
  };

  // ---------- step 1: choose the Japanese vowel for every English vowel
  const phonesFrom = (k: number) => segs.slice(k).map((s) => s.p).join(' ');
  const phonesBefore = (k: number) => segs.slice(0, k).map((s) => s.p).join(' ');
  const rSilentAt = (k: number) => segs[k]?.p === 'R' && !segs[k + 1]?.v && !(segs[k + 1]?.p === 'Y' && segs[k + 2]?.v);
  const test = (pattern: string, text: string) => new RegExp(pattern).test(text);
  const stressOk = (want: string, s: number) =>
    want === 'main' ? s === 1 : want === 'any' ? s > 0 : want === 'none' ? s === 0 : want === 'notMain' ? s !== 1 : true;
  const vowelRule = (k: number) => {
    const s = segs[k];
    const rest = phonesFrom(k + 1);
    const prev = phonesBefore(k);
    return pack.vowels.rules.find((r: any) =>
      (Array.isArray(r.phone) ? r.phone.includes(s.p) : r.phone === s.p) &&
      (!r.stress || stressOk(r.stress, s.stress)) &&
      (!r.profile || r.profile === profile) &&
      (!r.letters || (s.letters !== undefined && test(r.letters, s.letters))) &&
      (r.beforeR === undefined || r.beforeR === rSilentAt(k + 1)) &&
      (!r.beforeRV || (segs[k + 1]?.p === 'R' && !rSilentAt(k + 1))) &&
      (!r.beforeVowel || !!segs[k + 1]?.v) &&
      (!r.wordEnd || k === segs.length - 1 || (k === segs.length - 2 && rSilentAt(k + 1))) &&
      (!r.lastSyl || !segs.slice(k + 1).some((x) => x.v)) &&
      (!r.firstSyl || !segs.slice(0, k).some((x) => x.v)) &&
      (!r.notFirstSyl || segs.slice(0, k).some((x) => x.v)) &&
      (!r.rest || test(r.rest, rest)) &&
      (!r.prev || test(r.prev, prev)) &&
      (!r.word || test(r.word, word)));
  };
  segs.forEach((s, k) => {
    if (!s.v) return;
    s.rule = vowelRule(k) ?? { to: 'a' };
    s.to = forProfile(s.rule.to);
  });
  // A vowel the rules mark as not said (the "e" of "apple") leaves its consonant without a vowel.
  segs = segs.filter((s) => !(s.v && s.to === ''));

  // ---------- helpers for writing beats
  /** The beat or beats for a consonant row plus a vowel, e.g. ("t", "i") -> ["chi"] or ["ti"]. */
  const resolve = (row: string, v: string, seg?: Seg, sub?: Change): string[] => {
    const combo = pack.combos[row + '+' + v];
    if (combo) {
      const keys: string[] = forProfile(combo.to);
      const toLabel = forProfile(combo.label);
      if (combo.ruleId && toLabel && seg && combo.fromPhones.includes(seg.p)) {
        const loss = combo.loss ?? input.distance(seg.p, forProfile(combo.panphon));
        if (sub) { sub.to = toLabel; sub.loss = Math.max(sub.loss, loss); }
        else add('substitution', label(seg.p), toLabel, whereOf(seg), combo, combo.effort ?? pts.substitution, loss, [seg.i]);
      }
      return keys;
    }
    if (pack.kana[row + v]) return [row + v];
    if (row.endsWith('y') && row.length > 1) {
      if (v === 'i' || v === 'e') return resolve(row.slice(0, -1), v, seg, sub);
      return [...resolve(row.slice(0, -1), 'i', seg, sub), ...resolve('y', v)];
    }
    return [...resolve(row, 'u', seg, sub), v];
  };
  const whereOf = (seg: Seg): Change['where'] => {
    const k = segs.indexOf(seg);
    if (!segs.slice(0, k).some((x) => x.v)) return 'start';
    if (!segs.slice(k + 1).some((x) => x.v)) return 'end';
    return 'middle';
  };
  /** Records the swap for a consonant Japanese does not have, and returns its Japanese row. */
  const mapConsonant = (seg: Seg): { row: string; sub?: Change } => {
    const base = pack.consonants[seg.p];
    const e = { ...base, ...(base?.[profile] ?? {}) };
    if (!e.to && e.to !== '') return { row: '' };
    let sub: Change | undefined;
    if (e.ruleId) {
      const loss = e.loss ?? input.distance(seg.p, e.panphon);
      sub = add('substitution', label(seg.p), e.label ?? e.to.toUpperCase(), whereOf(seg), e, e.effort ?? (e.missing ? pts.substitution : 0), loss, [seg.i]);
    }
    return { row: e.to, sub };
  };
  /** Whether the consonant at k is doubled (a small ッ before it). */
  const doubles = (k: number, position: string, skip = 1): boolean => {
    const prev = segs[k - 1];
    if (!prev?.v || prev.to!.length !== 1 || beats[beats.length - 1] === 'N') return false;
    const seg = segs[k];
    const rest = phonesFrom(k + skip);
    for (const r of pack.doubling.rules) {
      if (!r.cons.includes(seg.p) || !r.position.includes(position)) continue;
      if (r.stress && !stressOk(r.stress, prev.stress)) continue;
      if (r.doubledLetter && !seg.dbl) continue;
      if (r.spelled && !test(r.spelled, seg.sp)) continue;
      if (r.rest && !test(r.rest, rest)) continue;
      if (r.prev && !test(r.prev, phonesBefore(k))) continue;
      if (r.word && !test(r.word, word)) continue;
      return r.double;
    }
    return false;
  };
  const roman = (keys: string[]) => keys.join('');
  const mapRow = (p: string): string => pack.consonants[p]?.to ?? '';

  // ---------- step 2: walk through the sounds and write the beats
  let onset: { row: string; seg?: Seg; sub?: Change; afterConsonantW?: boolean } | null = null;
  let vowelLoss = 0;
  const insertVowelFor = (seg: Seg, next: Seg | undefined): string => {
    const iv = pack.insertedVowel;
    for (const s of iv.special) {
      if (s.cons !== seg.p) continue;
      if (s.before && !s.before.includes(next?.p ?? '')) continue;
      if (s.spelled && !test(s.spelled, seg.sp)) continue;
      if (s.prev && !test(s.prev, phonesBefore(segs.indexOf(seg)))) continue;
      if (s.word && !test(s.word, word)) continue;
      const v = forProfile(s.vowel);
      if (v) return v;
    }
    return iv.byConsonant[seg.p] ?? iv.default;
  };
  /** A consonant with no vowel after it: Japanese adds one. */
  const insert = (k: number, row: string, sub: Change | undefined, position: string) => {
    const seg = segs[k];
    const v = insertVowelFor(seg, segs[k + 1]);
    if (doubles(k, position)) beats.push('Q');
    const keys = resolve(row, v, seg, sub);
    beats.push(...keys);
    add('epenthesis', label(seg.p), roman(keys), whereOf(seg), pack.insertedVowel.rule, pts.epenthesis, pack.insertedVowel.loss, [seg.i]);
  };

  for (let k = 0; k < segs.length; k++) {
    const seg = segs[k];
    const next = segs[k + 1];
    const next2 = segs[k + 2];

    if (seg.v) {
      const rule = seg.rule;
      let row = onset?.row ?? '';
      if (rule.palatal && onset && rule.palatal.includes(onset.seg?.p)) row = pack.palatalRows[row] ?? row;
      if (rule.yGlide && onset && rule.yGlide.includes(onset.seg?.p)) row = pack.palatalRows[row] ?? row;
      // Split the vowel string into beats: "aa" = a + long mark, "ai" = a + i, "iyaa" = i + ya + long mark.
      const units: { c: string; v: string }[] = [];
      let c = '';
      for (const ch of seg.to!) { if ('aiueo'.includes(ch)) { units.push({ c, v: ch }); c = ''; } else c += ch; }
      units.forEach((u, n) => {
        if (n === 0) {
          if (onset?.afterConsonantW) {
            const keys: string[] = forProfile(pack.wAfterConsonant[u.v] ?? ['w' + u.v]);
            beats.push(...keys);
            const w = pack.wAfterConsonant.rule;
            if (!keys[0]?.startsWith('w') && onset.seg) add('substitution', 'W', w.label, whereOf(onset.seg), w, w.effort, w.loss, [onset.seg.i]);
          }
          else beats.push(...resolve(u.c && !onset ? u.c : row, u.v, onset?.seg, onset?.sub));
        } else if (!u.c && u.v === units[n - 1].v) beats.push('L');
        else { if (!u.c) glued.add(beats.length); beats.push(...resolve(u.c, u.v)); }
      });
      vowelLoss += rule.loss ?? 0;
      onset = null;
      // "er" straight before another vowel (current, hurry): its R starts the next beat.
      if (seg.p === 'ER' && next?.v) onset = { row: mapRow('R') };
      if (rSilentAt(k + 1)) {
        const r = segs[k + 1];
        if (!rule.beforeR && units.length === 1) beats.push('L');
        add('rDropped', 'R', '', whereOf(r), pack.rAfterVowel, pts.rDropped, pack.rAfterVowel.loss, [r.i]);
        k++;
      }
      continue;
    }

    // ----- consonants
    let p = seg.p;
    const prevocalic = !!next?.v;
    if (p === 'NG') {
      beats.push('N');
      if (next && (next.p === 'K' || next.p === 'G')) continue;
      p = 'G';
      seg.p = 'G';
      if (!pack.nasals.ngAddsG) continue;
    } else if (p === 'N' && !prevocalic && !(next?.p === 'Y' && next2?.v)) {
      beats.push('N');
      continue;
    } else if (p === 'M' && !prevocalic && pack.nasals.mBecomesNBefore.includes(next?.p ?? '')) {
      beats.push('N');
      continue;
    }
    // Y between a consonant and a vowel
    if (next?.p === 'Y' && next2?.v && p !== 'Y' && p !== 'W') {
      const m = mapConsonant(seg);
      const glide = pack.vowels.yGlidePhones.includes(next2.p) || (next2.letters !== undefined && test(pack.vowels.yGlideLetters, next2.letters));
      if (glide) onset = { row: pack.palatalRows[m.row] ?? m.row, seg, sub: m.sub };
      else { beats.push(...resolve(m.row, 'i', seg, m.sub)); onset = null; }
      k++; // the Y is used up
      continue;
    }
    if (p === 'W' && prevocalic) {
      const prev = segs[k - 1];
      if (prev && !prev.v && prev.p !== 'N' && prev.p !== 'NG' && prev.p !== 'M') onset = { row: 'w', seg, afterConsonantW: true };
      else if (prev?.v && pack.wDroppedAfter.includes(prev.p) && !word.includes('w')) onset = null; // "casual": the W is only a glide
      else if (k === 0 && /^wh/.test(word) && forProfile(pack.whSpelling.beat)) {
        beats.push(forProfile(pack.whSpelling.beat));
        add('substitution', 'WH', forProfile(pack.whSpelling.label), 'start', pack.whSpelling, pts.substitution, pack.whSpelling.loss, [seg.i]);
        onset = { row: 'w', seg, afterConsonantW: true };
      } else onset = { row: 'w', seg };
      continue;
    }
    // T + S and D + Z with no vowel after them are one Japanese sound (tsu, zu)
    const merge = pack.merges.find((m: any) => m.first === p && m.second === next?.p && !prevocalic && !next2?.v);
    if (merge) {
      if (doubles(k, next2 ? 'beforeCons' : 'beforeFinal', 2)) beats.push('Q');
      beats.push(merge.beat);
      add('epenthesis', label(p) + ' + ' + label(next!.p), merge.beat, whereOf(seg), pack.insertedVowel.rule, pts.epenthesis, pack.insertedVowel.loss, [seg.i, next!.i]);
      k++;
      continue;
    }
    const m = mapConsonant(seg);
    if (prevocalic) {
      if (doubles(k, 'medial')) beats.push('Q');
      onset = { row: m.row, seg, sub: m.sub };
    } else {
      insert(k, m.row, m.sub, !next ? 'final' : !next2 ? 'beforeFinal' : 'beforeCons');
    }
  }

  if (vowelLoss > 0) add('vowels', 'vowels', 'nearest vowels', 'middle', pack.vowels.summaryRule, 0, Math.round(vowelLoss * 100) / 100, []);

  // ---------- step 3: write the beats in katakana and in the easy respelling
  const script = beats.map((b) => pack.kana[b] ?? '').join('');
  const groups: string[] = [];
  beats.forEach((b, n) => {
    const last = groups.length - 1;
    if (b === 'N') { if (last >= 0) groups[last] += 'n'; else groups.push('n'); }
    else if (b === 'L') { if (last >= 0) groups[last] += groups[last].slice(-1); }
    else if (b === 'Q') {
      const nextKey = beats[n + 1] ?? '';
      const letter = pack.doubling.respellingLetter[nextKey.slice(0, 2)] ?? pack.doubling.respellingLetter[nextKey[0]] ?? nextKey[0] ?? '';
      if (last >= 0) groups[last] += letter;
    } else if (glued.has(n) && last >= 0) groups[last] += b;
    else groups.push(b);
  });
  return { respelling: groups.join('-'), script, changes };
}
