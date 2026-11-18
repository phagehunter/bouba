// Step 2 of the engine: take English sounds and apply a language pack's rules to predict
// how speakers of that language will say the name. Nothing here is specific to one language;
// the rules come from packs/<language>/pack.json.
import { alignLetters, analyzeEnglish, parseDict, type Dict, type Syllable } from './english';
import type { AdaptOutput, Change, ChangeKind, CheckResult, OutSyllable, PackBundle, ProfileResult, WordResult } from './types';

export interface Features { segments: Record<string, string> }
interface Ph { p: string; i: number } // a sound and its position in the word

// English sounds: a plain-language label and the matching row in the sound-feature table.
const EN: Record<string, { label: string; panphon: string }> = {
  P: { label: 'P', panphon: 'p' }, B: { label: 'B', panphon: 'b' }, T: { label: 'T', panphon: 't' },
  D: { label: 'D', panphon: 'd' }, K: { label: 'K', panphon: 'k' }, G: { label: 'G', panphon: 'ɡ' },
  CH: { label: 'CH', panphon: 't͡ʃ' }, JH: { label: 'J', panphon: 'd͡ʒ' }, F: { label: 'F', panphon: 'f' },
  V: { label: 'V', panphon: 'v' }, TH: { label: 'TH', panphon: 'θ' }, DH: { label: 'TH', panphon: 'ð' },
  S: { label: 'S', panphon: 's' }, Z: { label: 'Z', panphon: 'z' }, SH: { label: 'SH', panphon: 'ʃ' },
  ZH: { label: 'ZH', panphon: 'ʒ' }, HH: { label: 'H', panphon: 'h' }, M: { label: 'M', panphon: 'm' },
  N: { label: 'N', panphon: 'n' }, NG: { label: 'NG', panphon: 'ŋ' }, L: { label: 'L', panphon: 'l' },
  R: { label: 'R', panphon: 'ɹ' }, W: { label: 'W', panphon: 'w' }, Y: { label: 'Y', panphon: 'j' },
};
const label = (p: string) => EN[p]?.label ?? p;

/** 0 = same sound, 1 = very different. Based on the share of sound features that differ. */
export function soundDistance(a: string, b: string, features: Features): number {
  const fa = features.segments[a];
  const fb = features.segments[b];
  if (!fa || !fb) return 0.5;
  let diff = 0;
  for (let i = 0; i < fa.length; i++) {
    if (fa[i] === fb[i]) continue;
    diff += fa[i] === '0' || fb[i] === '0' ? 0.5 : 1;
  }
  return Math.min(1, (diff / fa.length) * 4);
}

export interface CheckOptions {
  /** "Say it like": for a word (lower case), a respelling to read instead of the word itself. */
  sayAs?: Record<string, string>;
}

export class Engine {
  dict: Dict;
  constructor(dictText: string, private features: Features, private packs: Record<string, PackBundle>) {
    this.dict = parseDict(dictText);
  }

  languages(): { id: string; name: string }[] {
    return Object.values(this.packs).map((b) => ({ id: b.pack.id, name: b.pack.name }));
  }

  check(input: string, languageId: string, options: CheckOptions = {}): CheckResult {
    const bundle = this.packs[languageId];
    if (!bundle) throw new Error('Unknown language: ' + languageId);
    const notes: string[] = [];
    const rawWords = input.split(/[\s\-–—/&+.,!?:;()]+/).filter((w) => /[A-Za-z]/.test(w));
    if (/\d/.test(input)) notes.push('Numbers are skipped: type them as words (for example "seven") to include them.');
    if (/[^\x00-\x7F]/.test(input)) notes.push('Only the letters A-Z are read; accents and other scripts are ignored.');
    const words = rawWords.map((w) => this.checkWord(w, bundle, options));
    if (words.some((w) => w.soundsFrom === 'guessed')) {
      notes.push('At least one word is not in the English dictionary, so its English pronunciation was guessed from the spelling. Check that the guess matches how the name is meant to be said.');
    }
    const overall: CheckResult['overall'] = {};
    for (const profile of Object.keys(bundle.pack.profiles)) {
      const rs = words.map((w) => w.profiles[profile]);
      const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
      overall[profile] = {
        respelling: rs.map((r) => r.respelling).join(' '),
        script: rs.map((r) => r.script).join(''),
        ease: mean(rs.map((r) => r.ease)),
        survival: mean(rs.map((r) => r.survival)),
      };
    }
    return { input, language: bundle.pack.name, words, overall, notes };
  }

  private checkWord(word: string, bundle: PackBundle, options: CheckOptions): WordResult {
    const clean = word.replace(/[^A-Za-z']/g, '');
    const sayAs = options.sayAs?.[clean.toLowerCase()];
    let en = analyzeEnglish(clean, this.dict, sayAs);
    let soundsFrom: WordResult['soundsFrom'] = en.source;
    // Short all-capital words that are not dictionary words are read letter by letter (IBM, KFC).
    if (!sayAs && /^[A-Z]{2,5}$/.test(clean) && en.source !== 'dictionary') {
      const parts = clean.toLowerCase().split('').map((ch) => analyzeEnglish(ch, this.dict));
      let offset = 0;
      const syllables: Syllable[] = [];
      for (const part of parts) {
        for (const s of part.syllables) {
          syllables.push({ ...s, onsetIdx: s.onsetIdx.map((k) => k + offset), vowelIdx: s.vowelIdx + offset, codaIdx: s.codaIdx.map((k) => k + offset) });
        }
        offset += part.phones.length;
      }
      en = { word: clean, phones: parts.flatMap((p) => p.phones), source: 'dictionary', syllables };
      soundsFrom = 'letters';
    }
    // Which letters of the typed word spell each sound (for highlighting). Not possible when the
    // sounds came from a "say it like" respelling or from letter names.
    const spans = soundsFrom === 'override' || soundsFrom === 'letters' ? [] : alignLetters(clean, en.phones);
    const profiles: Record<string, ProfileResult> = {};
    for (const profile of Object.keys(bundle.pack.profiles)) {
      const a = bundle.adapt
        ? bundle.adapt({ word: clean, phones: en.phones, syllables: en.syllables, profile,
            distance: (p, sym) => soundDistance(EN[p]?.panphon ?? '', sym, this.features) })
        : this.adapt(clean, en.syllables, profile, bundle);
      // Scores are worked out the same way for every language.
      const effort = a.changes.reduce((sum, c) => sum + c.effort, 0);
      const loss = a.changes.reduce((sum, c) => sum + c.loss, 0);
      const n = en.phones.length;
      const r: ProfileResult = { profile, ...a, ease: Math.max(0, Math.round(100 - effort)), survival: n ? Math.max(0, Math.round(100 * (1 - loss / n))) : 0 };
      for (const c of r.changes) {
        const hit = c.phoneIdx.map((k) => spans[k]).filter((x): x is [number, number] => !!x);
        if (hit.length) c.span = [Math.min(...hit.map((h) => h[0])), Math.max(...hit.map((h) => h[1]))];
      }
      profiles[profile] = r;
    }
    // The spelling does not depend on who is speaking: use the first profile's spelling for all.
    // A pack whose spelling differs by speaker group (Japanese) sets scriptPerProfile.
    if (!bundle.pack.scriptPerProfile) {
      const firstScript = Object.values(profiles)[0]?.script ?? '';
      for (const p of Object.values(profiles)) p.script = firstScript;
    }
    return { word: clean, englishSounds: en.phones, soundsFrom, sayAs, profiles };
  }

  private adapt(word: string, sylsIn: Syllable[], profile: string, bundle: PackBundle): AdaptOutput {
    const pack = bundle.pack;
    const pts = pack.effortPoints;
    const changes: Change[] = [];
    const out: (OutSyllable & { altCoda?: string })[] = [];
    let vowelLoss = 0;
    let altNote = '';

    const add = (kind: ChangeKind, from: string, to: string, where: Change['where'], rule: any, effort: number, loss: number, phoneIdx: number[]) => {
      changes.push({
        kind, from, to, where, why: rule.why, tip: rule.tip, effort, loss, confidence: rule.confidence ?? 'medium',
        ruleId: rule.ruleId ?? kind, source: pack.sources[rule.source] ?? rule.source ?? '', phoneIdx: phoneIdx.filter((k) => k >= 0),
      });
    };
    const roman = (key: string, final = false) => (final ? pack.sounds[key].romanFinal ?? pack.sounds[key].roman : pack.sounds[key].roman);

    // Vowel pairs the language treats as one vowel (for Thai: "i" + "a" -> "ia", as in -ia names).
    const syls = sylsIn.map((x) => ({ ...x }));
    for (let k = 0; k < syls.length - 1; k++) {
      const a = syls[k];
      const b = syls[k + 1];
      const m = (pack.vowels.merges ?? []).find((r: any) => r.first.includes(a.vowel) && r.second === b.vowel && a.coda.length === 0 && b.onset.length === 0 && b.stress === 0);
      if (!m) continue;
      a.merged = m.to;
      a.mergedSilentR = !!m.silentR;
      a.coda = b.coda;
      a.codaIdx = b.codaIdx;
      syls.splice(k + 1, 1);
    }

    // Some languages do not close a syllable with certain consonants in the middle of a word;
    // the consonant starts the next syllable instead (Burmese: Bos-ton -> bo-s-ton).
    const toOnset: string[] = pack.codaClusters.medialToOnset ?? [];
    for (let k = 0; k < syls.length - 1; k++) {
      const a = syls[k];
      if (!a.coda.length || !toOnset.includes(a.coda[a.coda.length - 1])) continue;
      if (a.doubled) { a.coda = []; a.codaIdx = []; a.doubled = false; continue; }
      const b = syls[k + 1] = { ...syls[k + 1] };
      b.onset = [a.coda[a.coda.length - 1], ...b.onset];
      b.onsetIdx = [a.codaIdx[a.codaIdx.length - 1], ...b.onsetIdx];
      a.coda = a.coda.slice(0, -1);
      a.codaIdx = a.codaIdx.slice(0, -1);
    }
    // Where the spelling doubles a consonant (rubber, jacket), some languages close the first
    // syllable only for certain consonants.
    const doubledOnly: string[] | undefined = pack.codaClusters.doubledOnly;
    if (doubledOnly) for (const a of syls) if (a.doubled && !doubledOnly.includes(a.coda[0])) { a.coda = []; a.codaIdx = []; a.doubled = false; }
    const insertVowel: string = pack.clusters.insertVowel ?? 'a';
    const silentCodas: string[] = pack.rhymeClasses?.silent ?? [];
    const nasalCodas: string[] = pack.rhymeClasses?.nasal ?? [];

    syls.forEach((syl, i) => {
      if (!syl.vowel) return;
      const first = i === 0;
      const last = i === syls.length - 1;
      const where: Change['where'] = first ? 'start' : 'middle';
      const lower = word.toLowerCase();

      // ---------- consonants before the vowel
      let cons: Ph[] = syl.onset.map((p, k) => ({ p, i: syl.onsetIdx[k] ?? -1 }));
      let vowelKey: string | null = syl.merged ?? null;
      if (pack.vowels.yPlusOo && !syl.merged && cons.length >= 2 && cons[cons.length - 1].p === 'Y' && syl.vowel === 'UW') {
        cons.pop();
        vowelKey = pack.vowels.yPlusOo.to;
      }
      const mapOnset = (c: Ph, opts: { afterS?: boolean; alone?: boolean; inCluster?: boolean }) => {
        let entry = pack.onsetsByProfile?.[profile]?.[c.p] ?? pack.onsets[c.p];
        if (opts.afterS && pack.afterS?.[c.p]) entry = { ...entry, ...pack.afterS[c.p] };
        else if (opts.alone && !first && syl.stress === 0 && pack.onsetsUnstressed?.[c.p]) entry = { ...entry, ...pack.onsetsUnstressed[c.p] };
        if (entry.ruleId) {
          const loss = entry.loss ?? soundDistance(EN[c.p].panphon, pack.sounds[entry.to].panphon, this.features);
          const effort = entry.effort ?? (entry.missing ? pts.substitution : 0);
          add('substitution', label(c.p), roman(entry.to).toUpperCase(), where, entry, effort, loss, [c.i]);
        }
        return { key: entry.to as string, script: (opts.inCluster && entry.thaiInCluster) || entry.thai };
      };
      const insert = (c: Ph, group: Ph[], afterS: boolean) => {
        const m = mapOnset(c, { afterS, inCluster: true });
        out.push({ onset: [m.key], onsetScript: m.script, vowel: insertVowel, coda: '', codaScript: '', inserted: true });
        add('epenthesis', group.map((g) => label(g.p)).join(' + '), roman(m.key) + pack.vowelRoman[insertVowel] + '-', where, pack.clusters.epenthesisRule, pts.epenthesis, 0.5, group.map((g) => g.i));
      };
      let afterS = false;
      if (cons.length >= 2 && cons[0].p === 'S' && !(cons.length === 2 && pack.clusters.native.includes('S ' + cons[1].p))) {
        insert(cons[0], cons.slice(0, 2), false);
        cons = cons.slice(1);
        afterS = true;
      }
      while (cons.length >= 2) {
        const key = cons[0].p + ' ' + cons[1].p;
        if (cons.length === 2 && pack.clusters.native.includes(key)) break;
        if (cons.length === 2 && (pack.clusters.loan ?? []).includes(key)) {
          add('clusterKept', cons.map((c) => label(c.p)).join(' + '), cons.map((c) => label(c.p)).join(''), where, pack.clusters.loanRule, pts.clusterKept, 0, cons.map((c) => c.i));
          break;
        }
        insert(cons[0], cons.slice(0, 2), afterS);
        cons = cons.slice(1);
        afterS = false;
      }
      const mapped = cons.map((c, k) => mapOnset(c, { afterS: afterS && k === 0, alone: cons.length === 1, inCluster: cons.length > 1 }));

      // ---------- vowel
      const coda: Ph[] = syl.coda.map((p, k) => ({ p, i: syl.codaIdx[k] ?? -1 }));
      // The kind of ending the syllable will have, for languages whose vowels depend on it.
      const firstSaid = coda.find((c) => !silentCodas.includes(c.p));
      const rhyme = !firstSaid ? 'open' : nasalCodas.includes(firstSaid.p) ? 'nasal' : 'stop';
      let addCoda: string | undefined;
      if (!vowelKey) {
        const rule = pack.vowels.rules.find((r: any) =>
          r.phone === syl.vowel &&
          (!r.rhyme || r.rhyme === rhyme) &&
          (!r.beforeR || coda[0]?.p === 'R') &&
          (!r.unstressed || syl.stress === 0) &&
          (!r.wordEnd || (last && coda.length === 0)) &&
          (!r.lastSyllable || last) &&
          (!r.notFirst || !first) &&
          (!r.open || coda.length === 0) &&
          (!r.wordMatches || new RegExp(r.wordMatches).test(lower)) &&
          (!r.letters || (syl.letters !== undefined && new RegExp(r.letters).test(syl.letters))) &&
          (!r.wordEndsWith || new RegExp(r.wordEndsWith).test(lower)));
        vowelKey = rule?.to ?? 'a';
        vowelLoss += rule?.loss ?? 0;
        addCoda = rule?.addCoda;
      }

      // ---------- consonants after the vowel
      const cc = pack.codaClusters;
      const whereEnd: Change['where'] = last ? 'end' : 'middle';
      let codaKey = '';
      let codaScript = '';
      let altCoda: string | undefined;
      let rSilent = syl.vowel === 'ER' || !!syl.mergedSilentR;
      if (coda[0]?.p === 'R') {
        rSilent = true;
        const r = coda.shift()!;
        add('rDropped', 'R', '', whereEnd, cc.rSilent, pts.rDropped, 0.2, [r.i]);
      }
      // Which letter the official spelling uses for a final consonant. It follows the English
      // spelling: an S sound written with C or X takes ซ, a Z sound written with S takes ส.
      const letterOf = (p: string, prev?: string) => {
        if (p === 'S' && ((prev === 'K' && lower.includes('x')) || (lower.includes('c') && !lower.includes('s')))) return 'ซ';
        if (p === 'Z' && !lower.includes('z')) return 'ส';
        return pack.codas.traditional[p]?.thai ?? '';
      };
      const silent = (list: Ph[], prev?: string) => {
        if (!list.length) return '';
        let s = '';
        list.forEach((c, k) => { s += letterOf(c.p, k === 0 ? prev : list[k - 1].p); });
        return s + '์';
      };
      if (syl.doubled && coda.length) {
        const e = pack.codas.traditional[coda[0].p];
        codaKey = e.to;
        codaScript = e.thai ?? '';
      } else if (coda.length) {
        const keptAfterDiphthong = profile === 'younger' && (cc.afterDiphthongKeptByYounger ?? []).includes(coda[0].p);
        if ((pack.vowels.diphthongs ?? []).includes(vowelKey) && !keptAfterDiphthong) {
          add('codaAfterDiphthong', label(coda[0].p), '', whereEnd, cc.afterDiphthong, pts.codaAfterDiphthong, 1, [coda[0].i]);
          coda.slice(1).forEach((c) => add('finalDropped', label(c.p), '', whereEnd, cc.dropped, pts.finalDropped, 1, [c.i]));
          codaScript = silent(coda);
        } else {
          let idx = 0;
          if (coda[0].p === 'L' && coda.length > 1 && cc.lBeforeLabialVelar.includes(coda[1].p)) {
            if (pack.codas.traditional.L?.thai) codaScript += 'ล์';
            add('finalDropped', 'L', '', whereEnd, cc.lDropped, pts.finalDropped, 1, [coda[0].i]);
            idx = 1;
          }
          const fin = coda[idx];
          const e = pack.codas[profile]?.[fin.p] ?? pack.codas.traditional[fin.p];
          codaKey = e.to;
          codaScript += letterOf(fin.p, coda[idx - 1]?.p) || e.thai || '';
          if (e.alt) { altCoda = e.alt.to; altNote = e.alt.note; }
          if (e.deleted) {
            add('finalDropped', label(fin.p), '', whereEnd, e, e.effort ?? pts.finalDropped, 1, [fin.i]);
          } else if (e.ruleId) {
            const loss = e.loss ?? soundDistance(EN[fin.p].panphon, pack.sounds[e.to].panphon, this.features);
            const kind: ChangeKind = e.kept ? 'nonNativeFinalKept' : e.changed ? 'finalChanged' : 'substitution';
            const effort = e.effort ?? (e.kept ? pts.nonNativeFinalKept : e.changed ? pts.finalChanged : 0);
            add(kind, label(fin.p), roman(e.to, true).toUpperCase(), whereEnd, e, effort, loss, [fin.i]);
          }
          const rest = coda.slice(idx + 1);
          rest.forEach((c) => add('finalDropped', label(c.p), '', whereEnd, cc.dropped, pts.finalDropped, 1, [c.i]));
          codaScript += silent(rest, fin.p);
        }
      }
      // A final "ay" / "ey" keeps its Y in the spelling, marked silent (Subway, Disney).
      if (!coda.length && syl.letters && /[ae]y$/.test(syl.letters) && ['ee', 'ii'].includes(vowelKey!)) codaScript += 'ย์';
      // Names keep a doubled final letter in the spelling, the second one marked silent (Shell, Dell).
      if (last && coda.length === 1 && !syl.doubled && /(ll|ss|ff|tt|zz)$/i.test(word) && codaKey) {
        codaScript += letterOf(coda[0].p) + '์';
      }
      // Royal Institute rule 3.3: a silent R is not written when two or more consonants follow it.
      if (rSilent && coda.length < 2) codaScript = 'ร์' + codaScript;

      if (!codaKey && addCoda) codaKey = addCoda;
      out.push({ onset: mapped.map((m) => m.key), onsetScript: mapped.map((m) => m.script).join(''), vowel: vowelKey!, coda: codaKey, codaScript, altCoda });
    });

    if (vowelLoss > 0) add('vowels', 'vowels', 'nearest vowels', 'middle', pack.vowels.summaryRule, 0, vowelLoss, []);

    const spell = (useAlt: boolean) => out
      .map((s) => {
        const c = useAlt && s.altCoda ? s.altCoda : s.coda;
        return s.onset.map((k) => roman(k)).join('') + pack.vowelRoman[s.vowel] + (c ? roman(c, true) : '');
      })
      .join('-');
    const respelling = spell(false);
    const script = bundle.composeSyllable ? out.map((s) => bundle.composeSyllable!(s)).join('') : '';
    const result: AdaptOutput = { respelling, script, changes };
    if (out.some((s) => s.altCoda)) result.alternative = { respelling: spell(true), note: altNote };
    if (pack.vowelIpa) {
      result.ipa = out.map((s) => s.onset.map((k) => pack.sounds[k].ipa ?? k).join('')
        + (s.coda && pack.vowelIpaNasal && pack.rhymeCodas?.nasal === s.coda ? pack.vowelIpaNasal[s.vowel] ?? pack.vowelIpa[s.vowel] : pack.vowelIpa[s.vowel])
        + (s.coda && pack.rhymeCodas?.nasal !== s.coda ? pack.sounds[s.coda].ipa ?? '' : '')).join('.');
    }
    return result;
  }
}

/** Provisional score bands. To be re-set once native-speaker checks are in. */
export function band(score: number): 'green' | 'amber' | 'red' {
  return score >= 85 ? 'green' : score >= 70 ? 'amber' : 'red';
}
