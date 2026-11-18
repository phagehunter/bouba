// Mandarin adapter. Turns the English sounds of one word into the sound-based Chinese form:
// a chain of consonant + vowel (+ N or NG) units, each looked up in the Xinhua transcription
// table stored in pack.json (row = vowel class, column = consonant). All rules are read from
// pack.json; this file only applies them. Tones are not predicted.
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
  dbl: boolean; // consonants: also closes the syllable before it (the spelling doubles the letter)
}

interface Cell { chars: string; pinyin: string[] }

const LABEL: Record<string, string> = { JH: 'J', HH: 'H', DH: 'TH' };
const label = (p: string) => LABEL[p] ?? p;
const noTone = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').replace(/'/g, '');

/** One table cell: the first character listed (or the alternate) and its pinyin without tones. */
function cell(row: string, col: string, alternate = false): Cell | null {
  const raw: string | undefined = pack.table.rows[row]?.[col];
  if (!raw) return null;
  const parts = raw.split('|');
  const [chars, py] = (alternate && parts[1] ? parts[1] : parts[0]).trim().split(' ');
  return { chars, pinyin: noTone(py).split('-') };
}
const initialOf = (py: string) => py.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/)?.[0] ?? '';

function buildSegs(input: AdaptInput, word: string): Seg[] {
  const spans = alignLetters(word, input.phones);
  const spell = (i: number) => (i >= 0 && spans[i] ? word.slice(spans[i]![0], spans[i]![1]) : '');
  const segs: Seg[] = [];
  let carry = false;
  for (const s of input.syllables) {
    s.onset.forEach((p, k) => {
      const i = s.onsetIdx[k] ?? -1;
      segs.push({ p, i, v: false, stress: 0, sp: p === 'R' && i === s.vowelIdx ? 'r' : spell(i), dbl: k === 0 && carry });
    });
    carry = false;
    if (s.vowel) {
      const fromSpan = spell(s.vowelIdx).replace(/r$/, '');
      segs.push({ p: s.vowel, i: s.vowelIdx, v: true, stress: s.stress, letters: s.letters ?? (fromSpan || undefined), sp: '', dbl: false });
    }
    if (s.doubled) { carry = true; continue; }
    s.coda.forEach((p, k) => segs.push({ p, i: s.codaIdx[k] ?? -1, v: false, stress: 0, sp: spell(s.codaIdx[k] ?? -1), dbl: false }));
  }
  // A final weak vowel spelled "a" (Tesla, Cumbria): the letter is known even when the others do not line up.
  const lastSeg = segs[segs.length - 1];
  if (lastSeg?.v && lastSeg.p === 'AH' && word.endsWith('a')) lastSeg.letters = 'a';
  // "er" straight before another vowel (hurry): its R starts the next syllable.
  for (let k = 0; k < segs.length - 1; k++) {
    if (segs[k].p === 'ER' && segs[k + 1].v) segs.splice(k + 1, 0, { p: 'R', i: segs[k].i, v: false, stress: 0, sp: 'r', dbl: false });
  }
  return segs;
}

export function adapt(input: AdaptInput): AdaptOutput {
  const profile = input.profile in pack.profiles ? input.profile : 'traditional';
  const brand = profile === 'younger';
  const word = input.word.toLowerCase().replace(/[^a-z]/g, '');
  const pts = pack.effortPoints;
  const changes: Change[] = [];
  const chars: string[] = [];
  const pinyin: string[] = [];
  const segs = buildSegs(input, word);
  let vowelLoss = 0;

  const add = (kind: ChangeKind, from: string, to: string, where: Change['where'], rule: any, effort: number, loss: number, idx: number[]) => {
    changes.push({
      kind, from, to, where, why: rule.why, tip: rule.tip, effort, loss, confidence: rule.confidence ?? 'low',
      ruleId: rule.ruleId ?? 'zh-' + kind, source: pack.sources[rule.source] ?? rule.source ?? '', phoneIdx: idx.filter((k) => k >= 0),
    });
  };
  const whereOf = (k: number): Change['where'] => {
    if (!segs.slice(0, k).some((x) => x.v)) return 'start';
    if (!segs.slice(k + 1).some((x) => x.v)) return 'end';
    return 'middle';
  };
  const write = (c: Cell) => { chars.push(c.chars); pinyin.push(...c.pinyin); };
  const test = (pattern: string, text: string) => new RegExp(pattern).test(text);
  const isLastVowel = (k: number) => !segs.slice(k + 1).some((x) => x.v);
  /** True when the consonant at k has no vowel (or Y + vowel) after it. */
  const closes = (k: number) => !!segs[k] && !segs[k].v && !segs[k + 1]?.v && !(segs[k + 1]?.p === 'Y' && !!segs[k + 2]?.v);

  // ---------- the table row for a vowel
  const vowelRule = (k: number) => {
    const s = segs[k];
    return pack.vowels.rules.find((r: any) =>
      r.phone === s.p &&
      (!r.stress || (r.stress === 'none' ? s.stress === 0 : s.stress > 0)) &&
      (!r.letters || (s.letters !== undefined && test(r.letters, s.letters))) &&
      (!r.afterW || segs[k - 1]?.p === 'W') &&
      (!r.beforeRV || (segs[k + 1]?.p === 'R' && !!segs[k + 2]?.v)) &&
      (!r.beforeFinalL || (segs[k + 1]?.p === 'L' && isLastVowel(k))) &&
      (!r.syllabicL || (segs[k + 1]?.p === 'L' && closes(k + 1) && k > 0 && !segs[k - 1].v && test(pack.vowels.syllabicLWord, word)))) ?? { to: 'er', loss: 0.2 };
  };

  /** Reports the change when the character starts with a different sound from the English consonant. */
  const reportShift = (seg: Seg, py: string, k: number) => {
    const key = seg.p + '>' + initialOf(py);
    if (pack.shifts.same.includes(key)) return;
    const rule = pack.shifts.rules[key] ?? pack.shifts.rules[seg.p + '>*'] ?? pack.shifts.rules['*'];
    const loss = rule.loss ?? (rule.panphon ? input.distance(seg.p, rule.panphon) : 0.3);
    add('substitution', label(seg.p), rule.label || initialOf(py).toUpperCase() || py, whereOf(k), rule, rule.effort ?? pts.substitution, loss, [seg.i]);
  };

  /** A consonant with no vowel after it: its own syllable from the "consonant alone" row. */
  const alone = (k: number, col: string, phones: Seg[]) => {
    const seg = phones[0];
    const useAlt = k === 0 && pack.columns.wordInitialAlternate.columns.includes(col) && seg.p !== 'V';
    // A Z sound spelled with S is written with the S character (table note on following the spelling).
    if (seg.p === 'Z' && phones.length === 1 && /s/.test(seg.sp) && !/z/.test(seg.sp)) col = 's';
    const c = cell('alone', col, useAlt);
    if (!c) return;
    write(c);
    if (phones.length === 1) reportShift(seg, c.pinyin[0], k);
    const iv = pack.insertedVowel;
    add('epenthesis', phones.map((x) => label(x.p)).join(' + '), c.pinyin.join('-'), whereOf(k), iv.stated.includes(seg.p) ? iv.rule : iv.ruleOther, pts.epenthesis, iv.loss, phones.map((x) => x.i));
  };

  /** Writes consonant column + the vowel at vk (+ a following N or NG). Returns the index of the last sound used. */
  const syllable = (col: string, vk: number, onset: Seg[], onsetK: number, forceRow?: string): number => {
    const v = segs[vk];
    const rule = vowelRule(vk);
    let row: string = forceRow ?? rule.to;
    let last = vk;
    vowelLoss += rule.loss ?? 0;
    // Word-final "ia": the "a" is written 亚.
    if (!col && vk === segs.length - 1 && test(pack.vowels.finalIa.word, word) && segs[vk - 1]?.v) col = pack.vowels.finalIa.column;

    // ----- a following N, NG (or M before B, P) joins the syllable through a nasal row
    const n = segs[vk + 1];
    let nasal: Seg | null = null;
    if (n && !forceRow) {
      const after = segs[vk + 2];
      const joins = (n.p === 'N' && (closes(vk + 1) || n.dbl))
        || n.p === 'NG'
        || (n.p === 'M' && closes(vk + 1) && pack.nasals.mBefore.includes(after?.p ?? ''));
      const kind = n.p === 'NG' ? 'NG' : 'N';
      let nasalRow: string | undefined;
      if (v.stress === 0 && (v.p === 'AH' || v.p === 'ER')) {
        nasalRow = pack.nasals.weak.byLetter[v.letters?.[0] ?? ''] ?? pack.nasals.weak.default;
        if (kind === 'NG' && nasalRow === 'in') nasalRow = 'ing';
      } else if (!(v.stress > 0 && pack.nasals.noRowWhenStressed.includes(v.p))) {
        nasalRow = pack.nasals.rows[v.p]?.[kind];
        if (row === 'o' && (v.p === 'AA') && nasalRow) nasalRow = pack.nasals.rows.AO[kind];
      }
      if (joins && nasalRow) {
        row = nasalRow;
        nasal = n;
        const stays = n.p === 'N' && !closes(vk + 1); // the N also starts the next syllable
        if (!stays) last = vk + 1;
      }
    }

    // ----- look the pair up; an empty cell is written as consonant alone + vowel
    const alt = pack.vowels.alternateFor;
    let c = cell(row, col, row === alt.row && alt.phones.includes(v.p) && alt.columns.includes(col));
    if (!c && col) {
      const a = cell('alone', col);
      const b = cell(row, '');
      if (a && b) c = { chars: a.chars + b.chars, pinyin: [...a.pinyin, ...b.pinyin] };
    }
    if (!c) c = cell(row, '') ?? { chars: '', pinyin: [] };
    write(c);
    if (onset.length === 1 && c.pinyin.length) reportShift(onset[0], c.pinyin[0], onsetK);
    if (rule.then) write(cell(rule.then, '')!);
    if (nasal) {
      const end = c.pinyin[c.pinyin.length - 1] ?? '';
      const got = end.endsWith('ng') ? 'NG' : 'N';
      if (nasal.p === 'M') add('substitution', 'M', got, whereOf(vk + 1), pack.nasals.mToN, pack.nasals.mToN.effort, pack.nasals.mToN.loss, [nasal.i]);
      else if (got !== nasal.p) add('substitution', nasal.p, got, whereOf(vk + 1), pack.nasals.placeChanged, pack.nasals.placeChanged.effort, pack.nasals.placeChanged.loss, [nasal.i]);
    }

    // ----- an R that ends the syllable
    const r = segs[last + 1];
    if (r?.p === 'R' && closes(last + 1) && !nasal) {
      const lq = pack.liquids;
      const final = last + 1 === segs.length - 1;
      const where = whereOf(last + 1);
      if (lq.rSilentAfter.includes(v.p) && !final) add('rDropped', 'R', '', where, lq.rSilentMedial, pts.rDropped, lq.rSilentMedial.loss, [r.i]);
      else if (brand) add('rDropped', 'R', '', where, lq.rDroppedBrand, pts.rDropped, lq.rDroppedBrand.loss, [r.i]);
      else {
        write(cell('alone', 'r')!);
        add('finalChanged', 'R', 'er', where, lq.rToEr, pts.finalChanged, lq.rToEr.loss, [r.i]);
      }
      last++;
    }
    return last;
  };

  // ---------- walk through the sounds
  for (let k = 0; k < segs.length; k++) {
    const seg = segs[k];
    const next = segs[k + 1];
    const next2 = segs[k + 2];
    if (seg.v) {
      if (vowelRule(k).to === '') continue; // the weak vowel of a final "-le" is not written
      k = syllable('', k, [], k);
      continue;
    }
    // two consonants that share one table column (T + S, K + W ...)
    const pair = pack.columns.pairs.find((p: any) => p.first === seg.p && p.second === next?.p && (!p.beforeVowel || !!next2?.v) && k + 1 < segs.length);
    if (pair) {
      if (next2?.v && vowelRule(k + 2).to !== '') k = syllable(pair.column, k + 2, [seg, next!], k);
      else { alone(k, pair.column, [seg, next!]); k++; }
      continue;
    }
    let col: string = pack.columns[seg.p] ?? '';
    const syllabicNext = next?.v && vowelRule(k + 1).to === '';
    if (next?.v && !syllabicNext) {
      k = syllable(col, k + 1, [seg], k);
      continue;
    }
    // consonant + Y + vowel
    if (next?.p === 'Y' && next2?.v && seg.p !== 'Y') {
      if (pack.vowels.yuRowPhones.includes(next2.p)) { k = syllable(col, k + 2, [seg], k, cell('yu', col) ? 'yu' : undefined); continue; }
      const c = cell('i', col);
      if (c) { write(c); reportShift(seg, c.pinyin[0], k); }
      continue; // the Y starts the next syllable
    }
    // ----- a consonant with no vowel after it
    if (seg.p === 'L') {
      write(cell('alone', 'l')!);
      add('finalChanged', 'L', 'er', whereOf(k), pack.liquids.lToEr, pts.finalChanged, pack.liquids.lToEr.loss, [seg.i]);
      continue;
    }
    if (seg.p === 'R') { // an R that follows another consonant with no vowel after it (rare)
      write(cell('alone', 'r')!);
      add('finalChanged', 'R', 'er', whereOf(k), pack.liquids.rToEr, pts.finalChanged, pack.liquids.rToEr.loss, [seg.i]);
      continue;
    }
    if (brand && seg.p === 'D' && k === segs.length - 1 && segs[k - 1]?.p === 'N' && k >= 2 && segs[k - 2].v) {
      const b = pack.brandStyle.finalDAfterN;
      add('finalDropped', 'D', '', 'end', b, pts.finalDropped, b.loss, [seg.i]);
      continue;
    }
    alone(k, col, [seg]);
  }

  if (vowelLoss > 0) add('vowels', 'vowels', 'nearest vowels', 'middle', pack.vowels.summaryRule, 0, Math.round(vowelLoss * 100) / 100, []);
  return { respelling: pinyin.join('-'), script: chars.join(''), changes };
}
