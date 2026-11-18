// Step 1 of the engine: turn a typed name (English / Latin spelling) into English sounds.
// Sounds are written in ARPAbet, the notation used by the CMU Pronouncing Dictionary
// (e.g. "shell" = SH EH1 L; the digit on a vowel is its stress).

export type Dict = Map<string, string[]>;
export type PhoneSource = 'dictionary' | 'split' | 'guessed' | 'override';

export interface Syllable {
  onset: string[]; // consonants before the vowel
  onsetIdx: number[]; // where each of those sounds sits in the word's list of sounds
  vowelIdx: number;
  codaIdx: number[];
  vowel: string; // vowel without the stress digit, e.g. "EH"
  stress: number; // 0 = unstressed, 1 = main stress, 2 = secondary
  coda: string[]; // consonants after the vowel
  letters?: string; // the vowel letters in the spelling that this vowel came from, when known
  doubled?: boolean; // coda was copied from the next syllable because the spelling doubles the letter
  merged?: string; // set when a language pack merges this vowel with the next one (e.g. i + a -> ia)
  mergedSilentR?: boolean;
}

export function parseDict(text: string): Dict {
  const d: Dict = new Map();
  for (const line of text.split('\n')) {
    const sp = line.indexOf(' ');
    if (sp > 0) d.set(line.slice(0, sp), line.slice(sp + 1).split(' '));
  }
  return d;
}

const isVowel = (p: string) => /\d$/.test(p);

export function wordToPhones(word: string, dict: Dict): { phones: string[]; source: PhoneSource } {
  const w = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return { phones: [], source: 'guessed' };
  const hit = dict.get(w) ?? dict.get(w.replace(/'/g, ''));
  if (hit) return { phones: hit, source: 'dictionary' };
  // Two dictionary words joined together (e.g. "facebook" = face + book).
  for (let i = w.length - 3; i >= 3; i--) {
    const a = dict.get(w.slice(0, i));
    const b = dict.get(w.slice(i));
    if (a && b) return { phones: [...a, ...b.map((p) => p.replace('1', '2'))], source: 'split' };
  }
  // A dictionary word followed by an invented ending (e.g. "shopee" = shop + ee).
  for (let i = w.length - 2; i >= 4; i--) {
    const a = dict.get(w.slice(0, i));
    if (a && /[aeiouy]/.test(w.slice(i))) return { phones: [...a, ...guessPhones(w.slice(i), false, true)], source: 'split' };
  }
  return { phones: guessPhones(w, true), source: 'guessed' };
}

// Fallback spelling-to-sound rules for invented names. Deliberately simple; the result is
// always labeled "guessed" so the user knows to check it.
export function guessPhones(w: string, stressFirst: boolean, isEnding = false): string[] {
  const out: string[] = [];
  const V = 'aeiouy';
  const isV = (c: string | undefined) => !!c && V.includes(c);
  let i = 0;
  const n = w.length;
  const at = (s: string) => w.startsWith(s, i);
  const pushV = (p: string) => out.push(p + '0');
  while (i < n) {
    const c = w[i];
    const next = w[i + 1];
    const prev = w[i - 1];
    // ---- multi-letter patterns
    if (at('tion')) { out.push('SH'); pushV('AH'); out.push('N'); i += 4; continue; }
    if (at('sion')) { out.push('ZH'); pushV('AH'); out.push('N'); i += 4; continue; }
    if (at('tch')) { out.push('CH'); i += 3; continue; }
    if (at('sch')) { out.push('SH'); i += 3; continue; }
    if (at('igh')) { pushV('AY'); i += 3; continue; }
    if (at('air')) { pushV('EH'); out.push('R'); i += 3; continue; }
    if (at('eer') || at('ear')) { pushV('IH'); out.push('R'); i += 3; continue; }
    if (at('ch')) { out.push('CH'); i += 2; continue; }
    if (at('sh')) { out.push('SH'); i += 2; continue; }
    if (at('th')) { out.push('TH'); i += 2; continue; }
    if (at('ph')) { out.push('F'); i += 2; continue; }
    if (at('ck')) { out.push('K'); i += 2; continue; }
    if (at('qu')) { out.push('K', 'W'); i += 2; continue; }
    if (at('wh')) { out.push('W'); i += 2; continue; }
    if (at('dg')) { out.push('JH'); i += 2; continue; }
    if (at('gh')) { if (i === 0) out.push('G'); i += 2; continue; }
    if (at('ng') && !isV(w[i + 2])) { out.push('NG'); i += 2; continue; }
    if (i === 0 && (at('kn') || at('gn'))) { out.push('N'); i += 2; continue; }
    if (i === 0 && at('wr')) { out.push('R'); i += 2; continue; }
    if (i === 0 && at('ps')) { out.push('S'); i += 2; continue; }
    // ---- vowels
    if (isV(c) && !(c === 'y' && (i === 0 || isV(prev)) && isV(next))) {
      const two = w.slice(i, i + 2);
      const afterTwo = w[i + 2];
      const digraph: Record<string, string> = {
        ee: 'IY', ea: 'IY', oo: 'UW', ou: 'AW', ai: 'EY', ay: 'EY', oa: 'OW', oi: 'OY', oy: 'OY',
        au: 'AO', aw: 'AO', ei: 'EY', ui: 'UW', ie: 'IY', ey: 'IY', ue: 'UW',
      };
      if ((two === 'eu' || two === 'ew') ) { if (out.length && !isVowel(out[out.length - 1])) out.push('Y'); pushV('UW'); i += 2; continue; }
      if (two === 'ow') { pushV(afterTwo === undefined ? 'OW' : 'AW'); i += 2; continue; }
      if (digraph[two]) { pushV(digraph[two]); i += 2; continue; }
      if (next === 'r' && !isV(w[i + 2])) {
        // vowel + r before a consonant or at the end
        if (c === 'a') { pushV('AA'); out.push('R'); } else if (c === 'o') { pushV('AO'); out.push('R'); } else pushV('ER');
        i += 2; continue;
      }
      const last = i === n - 1;
      // "magic e": vowel + one consonant + final e
      const magic = !isV(next) && next !== undefined && w[i + 2] === 'e' && i + 3 === n;
      if (magic) { pushV(({ a: 'EY', e: 'IY', i: 'AY', o: 'OW', u: 'UW', y: 'AY' } as any)[c]); i += 1; continue; }
      if (last) {
        const hasOther = isEnding || out.some(isVowel);
        if (c === 'e') { if (!hasOther) pushV('IY'); i += 1; continue; } // final e is silent
        if (c === 'a') pushV(hasOther ? 'AH' : 'AA');
        else if (c === 'i') pushV('IY');
        else if (c === 'o') pushV('OW');
        else if (c === 'u') pushV('UW');
        else pushV(hasOther ? 'IY' : 'AY');
        i += 1; continue;
      }
      const open = !isV(next) && isV(w[i + 2]) && !(w[i + 2] === 'e' && i + 3 === n);
      if (open) pushV(({ a: 'AA', e: 'EH', i: 'IH', o: 'OW', u: 'UW', y: 'IH' } as any)[c]);
      else pushV(({ a: 'AE', e: 'EH', i: 'IH', o: 'AA', u: 'AH', y: 'IH' } as any)[c]);
      i += 1; continue;
    }
    // ---- single consonants
    if (next === c && c !== 'c') { i += 1; continue; } // doubled letter: one sound
    switch (c) {
      case 'b': out.push('B'); break;
      case 'c':
        if (next === 'c' && 'eiy'.includes(w[i + 2] ?? '')) { out.push('K', 'S'); i += 1; }
        else if (next === 'c') { out.push('K'); i += 1; }
        else out.push('eiy'.includes(next ?? '') ? 'S' : 'K');
        break;
      case 'd': out.push('D'); break;
      case 'f': out.push('F'); break;
      case 'g': out.push('eiy'.includes(next ?? '') && i > 0 ? 'JH' : 'G'); break;
      case 'h': if (isV(next)) out.push('HH'); break;
      case 'j': out.push('JH'); break;
      case 'k': out.push('K'); break;
      case 'l': out.push('L'); break;
      case 'm': out.push('M'); break;
      case 'n': out.push('N'); break;
      case 'p': out.push('P'); break;
      case 'q': out.push('K'); break;
      case 'r': out.push('R'); break;
      case 's': out.push('S'); break;
      case 't': out.push('T'); break;
      case 'v': out.push('V'); break;
      case 'w': out.push('W'); break;
      case 'x': if (i === 0) out.push('Z'); else out.push('K', 'S'); break;
      case 'y': out.push('Y'); break;
      case 'z': out.push('Z'); break;
    }
    i += 1;
  }
  if (stressFirst) {
    const k = out.findIndex(isVowel);
    if (k >= 0 && !(out[k].startsWith('AH') && out.filter(isVowel).length > 1)) out[k] = out[k].replace('0', '1');
  }
  return out;
}

// Consonant groups English allows at the start of a syllable.
const LEGAL_ONSETS = new Set([
  'P L', 'P R', 'B L', 'B R', 'T R', 'D R', 'K L', 'K R', 'G L', 'G R', 'F L', 'F R', 'TH R', 'SH R',
  'S P', 'S T', 'S K', 'S M', 'S N', 'S L', 'S W', 'S F', 'T W', 'D W', 'K W', 'G W', 'TH W',
  'S P L', 'S P R', 'S T R', 'S K R', 'S K W',
]);
// Short ("lax") vowels: in English these pull a following consonant into their own syllable.
const LAX = new Set(['AE', 'EH', 'IH', 'AH', 'UH', 'AA', 'AO']);

function legalOnset(cons: string[], nextVowel: string): boolean {
  if (cons.length <= 1) return cons[0] !== 'NG';
  if (cons[cons.length - 1] === 'Y') {
    // consonant + Y is only a start-of-syllable group before "oo" (cute, music)
    return nextVowel.startsWith('UW') && legalOnset(cons.slice(0, -1), nextVowel);
  }
  return LEGAL_ONSETS.has(cons.join(' '));
}

export function syllabify(phones: string[]): Syllable[] {
  const syls: Syllable[] = [];
  let pending: number[] = []; // positions of consonants waiting to be placed
  const at = (idx: number[]) => idx.map((k) => phones[k]);
  for (let i = 0; i < phones.length; i++) {
    const p = phones[i];
    if (!isVowel(p)) { pending.push(i); continue; }
    const vowel = p.slice(0, -1);
    const stress = Number(p.slice(-1));
    if (syls.length === 0) {
      syls.push({ onset: at(pending), onsetIdx: pending, vowel, vowelIdx: i, stress, coda: [], codaIdx: [] });
    } else {
      const prev = syls[syls.length - 1];
      const cons = at(pending);
      // Longest group that can legally start the syllable; the rest closes the previous one.
      let cut = 0;
      while (cut < cons.length && !legalOnset(cons.slice(cut), p)) cut++;
      // After a short vowel, the first consonant of a group stays with that vowel (Tes-la, Bos-ton).
      // This needs the vowel to be stressed, except for S, which closes the syllable either way (Wis-consin).
      if (cut === 0 && cons.length >= 2 && LAX.has(prev.vowel) && (prev.stress > 0 || cons[0] === 'S')
        && !(cons.length === 2 && cons[1] === 'Y')) cut = 1;
      prev.coda = cons.slice(0, cut);
      prev.codaIdx = pending.slice(0, cut);
      syls.push({ onset: cons.slice(cut), onsetIdx: pending.slice(cut), vowel, vowelIdx: i, stress, coda: [], codaIdx: [] });
    }
    pending = [];
  }
  if (syls.length) { const last = syls[syls.length - 1]; last.coda = at(pending); last.codaIdx = pending; }
  else if (pending.length) syls.push({ onset: at(pending), onsetIdx: pending, vowel: '', vowelIdx: -1, stress: 0, coda: [], codaIdx: [] });
  // An unstressed "er" straight before another vowel (gen-er-al): the R starts the next syllable.
  for (let k = 0; k < syls.length - 1; k++) {
    const a = syls[k];
    const b = syls[k + 1];
    if (a.vowel === 'ER' && a.stress === 0 && !a.coda.length && !b.onset.length) {
      a.vowel = 'AH';
      b.onset = ['R'];
      b.onsetIdx = [a.vowelIdx];
    }
  }
  return syls;
}

// Match each vowel sound to the vowel letters that spell it, when the counts line up.
// Used because Thai (like many languages) often follows the spelling for weak vowels.
export function attachVowelLetters(word: string, syls: Syllable[]): void {
  let w = word.toLowerCase().replace(/[^a-z]/g, '').replace(/qu/g, 'q');
  w = w.replace(/^y(?=[aeiou])/, 'j');
  const groups: { text: string; index: number }[] = [];
  for (const m of w.matchAll(/[aeiouy]+/g)) groups.push({ text: m[0], index: m.index! });
  const n = syls.filter((s) => s.vowel).length;
  // Drop silent single e's from the right until the counts match.
  for (let k = groups.length - 1; k >= 0 && groups.length > n; k--) {
    if (groups[k].text === 'e' && groups[k].index > 0) groups.splice(k, 1);
  }
  if (groups.length !== n) return;
  let g = 0;
  for (const s of syls) if (s.vowel) s.letters = groups[g++].text;
}

const DOUBLE: Record<string, RegExp> = {
  P: /pp/, B: /bb/, T: /tt/, D: /dd/, K: /ck|kk|cc/, G: /gg/, F: /ff/, S: /ss/, Z: /zz/, M: /mm/, N: /nn/, L: /ll/,
};

// Where the spelling doubles a consonant after a short vowel (apple, coffee, twitter), many
// languages say it in both syllables. Copy it to the end of the previous syllable and flag it.
export function markDoubled(word: string, syls: Syllable[]): void {
  const w = word.toLowerCase();
  for (let i = 1; i < syls.length; i++) {
    const cur = syls[i];
    const prev = syls[i - 1];
    if (cur.onset.length !== 1 || prev.coda.length) continue;
    const re = DOUBLE[cur.onset[0]];
    if (re && re.test(w) && LAX.has(prev.vowel)) { prev.coda = [cur.onset[0]]; prev.codaIdx = [-1]; prev.doubled = true; }
  }
}

export interface EnglishWord { word: string; phones: string[]; source: PhoneSource; syllables: Syllable[] }

/** sayAs: an optional respelling typed by the user ("say it like ..."), used instead of the word's own spelling. */
export function analyzeEnglish(word: string, dict: Dict, sayAs?: string): EnglishWord {
  let phones: string[];
  let source: PhoneSource;
  let spelling = word;
  if (sayAs && /[A-Za-z]/.test(sayAs)) {
    const parts = sayAs.split(/[^A-Za-z']+/).filter(Boolean);
    phones = parts.flatMap((p, k) => wordToPhones(p, dict).phones.map((x) => (k > 0 ? x.replace('1', '2') : x)));
    source = 'override';
    spelling = parts.join('');
  } else ({ phones, source } = wordToPhones(word, dict));
  const syllables = syllabify(phones);
  attachVowelLetters(spelling, syllables);
  markDoubled(spelling, syllables);
  return { word, phones, source, syllables };
}

// Letters that can spell each consonant sound, longest first. Used only to find which
// letters of the typed name to highlight; a missing match just means "no highlight".
const SPELLINGS: Record<string, string[]> = {
  P: ['pp', 'p'], B: ['bb', 'b'], T: ['tt', 'th', 't', 'ed'], D: ['dd', 'd', 'ed'], K: ['ck', 'cc', 'ch', 'k', 'c', 'q', 'x'],
  G: ['gg', 'gh', 'g', 'x'], CH: ['tch', 'ch', 't', 'c'], JH: ['dg', 'j', 'g', 'd'], F: ['ff', 'ph', 'gh', 'f'], V: ['v', 'f', 'w'],
  TH: ['th'], DH: ['th'], S: ['ss', 'sc', 's', 'c', 'x', 'z'], Z: ['zz', 'z', 'ss', 's', 'x'], SH: ['sch', 'sh', 'ch', 'ti', 'ci', 'ss', 's'],
  ZH: ['si', 's', 'g', 'z', 'j'], HH: ['wh', 'h', 'j'], M: ['mm', 'm'], N: ['nn', 'kn', 'gn', 'n'], NG: ['ng', 'n'],
  L: ['ll', 'l'], R: ['rr', 'wr', 'r'], W: ['wh', 'w', 'u', 'o'], Y: ['y', 'i', 'j'],
};

/** For each sound, the [start, end) letters of the word that spell it, or null when unsure. */
export function alignLetters(word: string, phones: string[]): ([number, number] | null)[] {
  const w = word.toLowerCase();
  const isV = (c: string | undefined) => !!c && 'aeiouy'.includes(c);
  const matchAt = (base: string, from: number): [number, number] | null => {
    for (let off = 0; off <= 2; off++) {
      for (const c of SPELLINGS[base] ?? []) if (w.startsWith(c, from + off)) return [from + off, from + off + c.length];
    }
    return null;
  };
  const spans: ([number, number] | null)[] = [];
  let i = 0;
  phones.forEach((ph, k) => {
    const base = ph.replace(/\d/, '');
    if (isVowel(ph)) {
      const next = phones[k + 1]?.replace(/\d/, '');
      // Vowel letter written after the consonant (app-le): leave the vowel unmatched.
      if (!isV(w[i]) && next && !isVowel(phones[k + 1]) && matchAt(next, i)?.[0] === i) { spans.push(null); return; }
      let j = i;
      while (j < w.length && !isV(w[j]) && j - i < 2) j++;
      if (!isV(w[j])) { spans.push(null); return; }
      let e = j;
      while (isV(w[e]) && e - j < 3) e++;
      if (base === 'ER' && w[e] === 'r') e++;
      spans.push([j, e]);
      i = e;
    } else {
      const m = matchAt(base, i);
      spans.push(m);
      if (!m) return;
      const nextBase = phones[k + 1]?.replace(/\d/, '');
      const sharedX = w.slice(m[0], m[1]) === 'x' && (base === 'K' || base === 'G') && (nextBase === 'S' || nextBase === 'Z');
      i = sharedX ? m[0] : m[1];
    }
  });
  return spans;
}
