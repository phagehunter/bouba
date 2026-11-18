// Hindi adapter. Turns the English sounds of one word into the form Hindi speakers probably
// use, writes it in Devanagari and in an easy respelling, and lists every change made on the
// way. All rules are read from pack.json; this file only applies them. Stress is not predicted.
//
// The word is built as a row of pieces: consonants, vowels and the nasal dot (anusvara). The
// respelling and the Devanagari spelling are both written from that row. A few pieces belong
// to one of the two only: the short "i" that some speakers add before S plus a consonant is
// said but not spelled, and the ग written after the nasal dot for NG is spelled but not shown
// in the respelling.
import packJson from './pack.json';
import { alignLetters } from '../../src/english';
import type { AdaptInput, AdaptOutput, Change, ChangeKind } from '../../src/types';

const pack: any = packJson;

interface Seg {
  p: string; // ARPAbet sound without the stress digit
  i: number; // position in input.phones (-1 when unknown)
  v: boolean; // vowel
  stress: number;
  syl: number; // which English syllable it belongs to
  coda: boolean; // consonants: it closes its syllable
  letters?: string; // vowels: the vowel letters that spell it
  sp: string; // consonants: the letters that spell it ('' when unknown)
  rule?: any; // vowels: the pack rule that matched
}

interface Piece {
  kind: 'C' | 'V' | 'N'; // consonant, vowel, nasal dot
  text: string; // C: the Devanagari letter; V: a key of pack.vowelLetters
  roman: string;
  ipa: string;
  phone: string; // the English sound it stands for
  syl: number;
  coda: boolean;
  brk?: boolean; // a new syllable of the respelling starts here
  join?: boolean; // C: joined to the next consonant with a halant
  saidOnly?: boolean; // in the respelling, not in the spelling
  writtenOnly?: boolean; // in the spelling, not in the respelling
}

const LABEL: Record<string, string> = { JH: 'J', HH: 'H', DH: 'TH' };
const label = (p: string) => LABEL[p] ?? p;
const VOWEL_LETTERS = /[aeiouy]+/g;

/**
 * The vowel letters behind each vowel sound (the same method as the Japanese adapter). A group
 * of vowel letters may spell one sound (the "ea" of "team") or two sounds that meet with no
 * consonant between them (the "io" of "radio"); a lone "e" may be silent. Every way of lining
 * the two lists up gets a cost, and the cheapest wins.
 */
function vowelLetters(word: string, segs: Seg[]): (string | undefined)[] {
  const w = word.replace(/qu/g, 'q').replace(/^y(?=[aeiou])/, 'j');
  const groups = [...w.matchAll(VOWEL_LETTERS)].map((m) => ({ text: m[0], end: m.index! + m[0].length }));
  const vowels = segs.map((s, k) => ({ s, k })).filter((x) => x.s.v);
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
  const segs: Seg[] = [];
  input.syllables.forEach((s, syl) => {
    s.onset.forEach((p, k) => {
      const i = s.onsetIdx[k] ?? -1;
      segs.push({ p, i, v: false, stress: 0, syl, coda: false, sp: p === 'R' && i === s.vowelIdx ? 'r' : spell(i) });
    });
    if (s.vowel) segs.push({ p: s.vowel, i: s.vowelIdx, v: true, stress: s.stress, syl, coda: false, letters: s.letters, sp: '' });
    // A consonant the engine copied back from the next syllable (the "pp" of "apple") is said once in Hindi.
    if (s.doubled) return;
    s.coda.forEach((p, k) => {
      const i = s.codaIdx[k] ?? -1;
      segs.push({ p, i, v: false, stress: 0, syl, coda: true, sp: spell(i) });
    });
  });
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
  const segs = buildSegs(input, word);
  const pieces: Piece[] = [];

  const add = (kind: ChangeKind, from: string, to: string, where: Change['where'], rule: any, effort: number, loss: number, idx: number[]) => {
    changes.push({
      kind, from, to, where, why: rule.why, tip: rule.tip, effort, loss, confidence: rule.confidence ?? 'low',
      ruleId: rule.ruleId ?? 'hi-' + kind, source: pack.sources[rule.source] ?? rule.source ?? '', phoneIdx: idx.filter((k) => k >= 0),
    });
  };
  const whereOf = (k: number): Change['where'] => {
    if (!segs.slice(0, k).some((x) => x.v)) return 'start';
    if (!segs.slice(k + 1).some((x) => x.v)) return 'end';
    return 'middle';
  };
  /** A consonant entry of the pack, with the values for this speaker group laid over it. */
  const consonant = (key: string): any => {
    const base = pack.consonants[key] ?? {};
    return { ...base, ...(base[profile] ?? {}) };
  };
  const inProfile = (rule: any) => !rule.profiles || rule.profiles.includes(profile);

  // ---------- step 1: choose the Hindi vowel for every English vowel
  const phonesFrom = (k: number) => segs.slice(k).map((s) => s.p).join(' ');
  const phonesBefore = (k: number) => segs.slice(0, k).map((s) => s.p).join(' ');
  const test = (pattern: string, text: string) => new RegExp(pattern).test(text);
  const stressOk = (want: string, s: number) =>
    want === 'main' ? s === 1 : want === 'any' ? s > 0 : want === 'none' ? s === 0 : want === 'notMain' ? s !== 1 : true;
  const vowelRule = (k: number) => {
    const s = segs[k];
    const nextR = segs[k + 1]?.p === 'R';
    const afterR = !!segs[k + 2]?.v;
    return pack.vowels.rules.find((r: any) =>
      (Array.isArray(r.phone) ? r.phone.includes(s.p) : r.phone === s.p) &&
      (!r.stress || stressOk(r.stress, s.stress)) &&
      (!r.profile || r.profile === profile) &&
      (!r.letters || (s.letters !== undefined && test(r.letters, s.letters))) &&
      (!r.initial || k === 0) &&
      (!r.beforeR || (nextR && !afterR)) &&
      (!r.beforeRV || (nextR && afterR)) &&
      (!r.beforeVowel || !!segs[k + 1]?.v) &&
      (!r.beforeWeakVowel || (!!segs[k + 1]?.v && segs[k + 1].stress === 0)) &&
      (!r.wordEnd || k === segs.length - 1) &&
      (!r.lastSyl || !segs.slice(k + 1).some((x) => x.v)) &&
      (!r.notLastSyl || segs.slice(k + 1).some((x) => x.v)) &&
      (!r.firstSyl || !segs.slice(0, k).some((x) => x.v)) &&
      (!r.notFirstSyl || segs.slice(0, k).some((x) => x.v)) &&
      (!r.rest || test(r.rest, phonesFrom(k + 1))) &&
      (!r.prev || test(r.prev, phonesBefore(k))) &&
      (!r.word || test(r.word, word)));
  };
  segs.forEach((s, k) => { if (s.v) s.rule = vowelRule(k) ?? { to: 'a' }; });

  // ---------- step 2: walk through the sounds and lay down the pieces
  let vowelLoss = 0;
  let noBreak = false; // the next sound continues the syllable a glide or an R has just started
  let breakNext = false; // the next consonant starts a new syllable of the respelling
  const pushConsonant = (key: string, seg: Seg, k: number, opts: Partial<Piece> = {}): Piece => {
    const e = consonant(key);
    const piece: Piece = { kind: 'C', text: e.letter ?? '', roman: e.roman ?? '', ipa: e.ipa ?? '', phone: seg.v ? key : seg.p, syl: seg.syl, coda: seg.coda, ...opts };
    pieces.push(piece);
    if (e.ruleId) add('substitution', label(seg.v ? key : seg.p), e.label ?? e.roman.toUpperCase(), whereOf(k), e, e.effort ?? (e.missing ? pts.substitution : 0), e.loss ?? 0.3, [seg.i]);
    return piece;
  };

  segs.forEach((seg, k) => {
    const next = segs[k + 1];
    let brk = k > 0 && segs[k - 1].syl !== seg.syl && !noBreak;
    noBreak = false;
    if (breakNext && !seg.v) { brk = true; breakNext = false; }

    if (seg.v) {
      const rule = seg.rule;
      const parts: string[] = String(rule.to).split(' ').filter(Boolean);
      let firstVowel = true;
      parts.forEach((part, n) => {
        if (/^[A-Z]/.test(part)) {
          // A consonant that belongs to the vowel: the R of "er", a Y between two vowels, or
          // the quick Y in front of "oo" (new -> nyoo), which joins the consonant before it.
          const startsNext = part === 'R' && !!next?.v;
          pushConsonant(part, seg, k, { coda: part === 'R' && !next?.v, brk: n === 0 ? brk : part !== 'R' || startsNext });
          if (n === 0) brk = false;
          if (startsNext) noBreak = true;
          return;
        }
        const vl = pack.vowelLetters[part];
        pieces.push({
          kind: 'V', text: part, roman: rule.roman !== undefined ? (firstVowel ? rule.roman : '') : vl.roman, ipa: vl.ipa,
          phone: seg.p, syl: seg.syl, coda: false, brk: firstVowel && brk,
        });
        firstVowel = false;
      });
      vowelLoss += rule.loss ?? 0;
      // Two vowels in a row: a Y or W sound is written between them (Victoria -> ...ri-yaa).
      if (next?.v && !/[A-Z]/.test(parts[parts.length - 1])) {
        const nextFirst = String(next.rule.to).split(' ')[0];
        for (const g of ['Y', 'W']) {
          const rule2 = pack.glides[g];
          if (rule2.after.includes(seg.p) && rule2.before.includes(nextFirst)) {
            const e = consonant(g);
            pieces.push({ kind: 'C', text: e.letter, roman: e.roman, ipa: e.ipa, phone: g, syl: next.syl, coda: false, brk: true });
            noBreak = true;
            break;
          }
        }
      }
      return;
    }

    // ----- consonants
    if (seg.p === 'NG') {
      const beforeVelar = pack.nasals.ngSkipBefore.includes(next?.p ?? '');
      pieces.push({ kind: 'N', text: pack.nasals.anusvara, roman: beforeVelar ? 'n' : 'ng', ipa: 'ŋ', phone: 'NG', syl: seg.syl, coda: true, brk });
      if (!beforeVelar) pieces.push({ kind: 'C', text: pack.nasals.ngLetter, roman: '', ipa: '', phone: 'G', syl: seg.syl, coda: seg.coda, writtenOnly: true });
      return;
    }
    // S plus a consonant at the start: a short vowel in front, in the respelling only.
    const pro = pack.prothesis;
    if (k === 0 && seg.p === 'S' && next && !next.v && pro.before.includes(next.p) && inProfile(pro)) {
      const vl = pack.vowelLetters[pro.vowel];
      pieces.push({ kind: 'V', text: pro.vowel, roman: vl.roman, ipa: vl.ipa, phone: '', syl: seg.syl, coda: false, saidOnly: true });
      add('epenthesis', 'S + ' + label(next.p), vl.roman + 's-', 'start', pro, pts.epenthesis, pro.loss, [seg.i, next.i]);
      breakNext = true;
    }
    let key = seg.p;
    for (const r of pack.spelledAs.rules) {
      if (r.phone === seg.p && seg.sp && test(r.spelled, seg.sp) && !(r.notBefore ?? []).includes(next?.p ?? '')) key = r.use;
    }
    // A Y that English spells "i" between a consonant and a vowel (William): Hindi writes the "i" too.
    if (seg.p === 'Y' && seg.sp === 'i' && k > 0 && !segs[k - 1].v && next?.v) {
      const vl = pack.vowelLetters.i;
      const before = pieces[pieces.length - 1];
      if (before?.kind === 'C' && before.coda) { before.brk = true; before.coda = false; }
      pieces.push({ kind: 'V', text: 'i', roman: vl.roman, ipa: vl.ipa, phone: 'Y', syl: seg.syl, coda: false });
      brk = true;
    }
    if (seg.p === 'Z' && !next && k > 0 && (!segs[k - 1].v || segs[k - 1].p === 'ER')) key = 'Zs';
    const piece = pushConsonant(key, seg, k, { brk });
    if (seg.p === 'W' && seg.sp === 'wh') piece.text = pack.spelledAs.wh.letters.join(pack.joins.halant);
    const ptk = pack.startPTK;
    if (k === 0 && ptk.phones.includes(seg.p) && next?.v) add('substitution', seg.p, ptk.label[seg.p], 'start', ptk, ptk.effort, ptk.loss, [seg.i]);
    // A final pair such as L + M: a weak vowel in between, in the respelling only.
    const fp = pack.finalPairs;
    if (k === segs.length - 2 && next && seg.coda && inProfile(fp) && fp.pairs.some((p: string[]) => p[0] === seg.p && p[1] === next.p)) {
      const vl = pack.vowelLetters[fp.vowel];
      piece.brk = true;
      pieces.push({ kind: 'V', text: fp.vowel, roman: vl.roman, ipa: vl.ipa, phone: '', syl: seg.syl, coda: false, saidOnly: true });
      add('epenthesis', label(seg.p) + ' + ' + label(next.p), piece.roman + vl.roman + consonant(next.p).roman, 'end', fp, pts.epenthesis, fp.loss, [seg.i, next.i]);
    }
  });

  // "ks" and "ps" stay together when another consonant follows (express -> eks-pres, written क्स + प्रे).
  pieces.forEach((p, n) => {
    const before = pieces[n - 1];
    const after = pieces[n + 1];
    if (p.kind === 'C' && p.phone === 'S' && p.brk && before?.kind === 'C' && pack.joins.sAfter.includes(before.phone) && after?.kind === 'C' && !after.writtenOnly) {
      p.brk = false;
      p.coda = true;
      after.brk = true;
    }
  });

  if (vowelLoss > 0) add('vowels', 'vowels', 'nearest vowels', 'middle', pack.vowels.summaryRule, 0, Math.round(vowelLoss * 100) / 100, []);

  // ---------- step 3: the spelling. Decide the nasal dot and which consonants are joined.
  const written = pieces.filter((p) => !p.saidOnly);
  const stressOf = (syl: number) => input.syllables[syl]?.stress ?? 0;
  // The second part of a compound name (Face-book, Wal-mart) starts with a stressed syllable
  // that follows an earlier stressed one. Nothing is joined or merged across that line.
  const compoundStart = (syl: number) => stressOf(syl) > 0 && input.syllables.slice(0, syl).some((s) => s.stress > 0);
  const hasVowelAfter = (n: number) => written.slice(n + 1).some((p) => p.kind === 'V');
  const hasVowelBefore = (n: number) => written.slice(0, n).some((p) => p.kind === 'V');
  written.forEach((p, n) => {
    const nx = written[n + 1];
    if (p.kind !== 'C' || p.phone !== 'N' || !nx || nx.kind !== 'C' || written[n - 1]?.kind !== 'V') return;
    if (!written[n + 2] && pack.nasals.finalNS.includes(nx.phone)) return; // final N + S stays न्स
    if (!pack.nasals.nBefore.includes(nx.phone)) return;
    if (pack.nasals.notAfterTwoVowels && written[n - 2]?.kind === 'V') return;
    p.kind = 'N';
    p.text = pack.nasals.anusvara;
    if (nx.phone === 'K' || nx.phone === 'G') { p.roman = 'ng'; p.ipa = 'ŋ'; }
    if (nx.phone === 'P' || nx.phone === 'B') { p.roman = 'm'; p.ipa = 'm'; }
  });
  const pairs = pack.joins.pairs;
  const joinsWith = (a: string, b: string) => pairs[a] === '*' || (Array.isArray(pairs[a]) && pairs[a].includes(b));
  for (let n = 0; n < written.length; n++) {
    if (written[n].kind !== 'C') continue;
    let end = n;
    while (written[end + 1]?.kind === 'C') end++;
    const run = written.slice(n, end + 1);
    if (!hasVowelBefore(n) || !hasVowelAfter(end)) {
      run.slice(0, -1).forEach((p) => { p.join = true; }); // start or end of the word: one group
    } else {
      const codaLen = run.findIndex((p) => !p.coda) < 0 ? run.length : run.findIndex((p) => !p.coda);
      const onsetLen = run.length - codaLen;
      run.forEach((p, m) => {
        if (m === run.length - 1) return;
        if (m !== codaLen - 1) { p.join = true; return; } // inside one syllable
        p.join = codaLen === 1 && onsetLen === 1 && !compoundStart(run[m + 1].syl) && joinsWith(p.phone, run[m + 1].phone);
      });
    }
    n = end;
  }
  let script = '';
  written.forEach((p, n) => {
    if (p.kind === 'V') {
      const vl = pack.vowelLetters[p.text];
      script += written[n - 1]?.kind === 'C' ? vl.matra : vl.letter;
    } else {
      script += p.text;
      if (p.kind === 'C' && p.join && written[n + 1]?.kind === 'C') script += pack.joins.halant;
    }
  });

  // ---------- step 4: the respelling and the phonetic transcription
  const said = pieces.filter((p) => !p.writtenOnly);
  const spell = (field: 'roman' | 'ipa', sep: string, swap?: Record<string, string>) => {
    const groups: string[] = [];
    said.forEach((p, n) => {
      const text = swap?.[p[field]] ?? p[field];
      if (n === 0 || p.brk) groups.push(text); else groups[groups.length - 1] += text;
    });
    return groups.filter(Boolean).join(sep);
  };
  const respelling = spell('roman', '-');
  const result: AdaptOutput = { respelling, script, changes, ipa: spell('ipa', '.') };
  const alt = pack.alternative;
  if (inProfile(alt)) {
    const other = spell('roman', '-', alt.swap);
    if (other !== respelling) result.alternative = { respelling: other, note: alt.note };
  }
  return result;
}
