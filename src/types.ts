import type { Syllable } from './english';

export type Confidence = 'high' | 'medium' | 'low';
export type ChangeKind =
  | 'substitution' | 'epenthesis' | 'finalChanged' | 'finalDropped' | 'clusterKept'
  | 'rDropped' | 'codaAfterDiphthong' | 'nonNativeFinalKept' | 'vowels';

/** One thing that happens to the name when speakers of the language say it. */
export interface Change {
  kind: ChangeKind;
  from: string; // plain-language name of the original sound(s)
  to: string; // what it becomes ("" = silent)
  where: 'start' | 'middle' | 'end';
  why: string;
  tip?: string; // plain-language suggestion for avoiding the change
  effort: number; // points taken off the Ease score
  loss: number; // 0..1+, share of a sound lost; feeds the Survival score
  confidence: Confidence;
  ruleId: string;
  source: string;
  phoneIdx: number[]; // which of the word's English sounds are involved
  span?: [number, number]; // letters of the typed word to highlight: [start, end)
}

/** One syllable as the target language says it. */
export interface OutSyllable {
  onset: string[]; // sound keys from the pack
  onsetScript: string;
  vowel: string; // vowel key from the pack
  coda: string; // sound key, or ''
  codaScript: string; // final letter plus any silent letters, in the target script
  inserted?: boolean; // a syllable that exists only because a vowel was inserted
}

export interface ProfileResult {
  profile: string;
  respelling: string; // easy-to-read version, e.g. "sa-tah-bak"
  script: string; // target-language spelling
  changes: Change[];
  ease: number;
  survival: number;
  /** A second pronunciation some speakers use (for Thai: final L as a W sound). */
  alternative?: { respelling: string; note: string };
  /** Phonetic transcription, when the pack provides one. Used for testing against published forms. */
  ipa?: string;
}

export interface WordResult {
  word: string;
  englishSounds: string[];
  soundsFrom: 'dictionary' | 'split' | 'guessed' | 'letters' | 'override';
  sayAs?: string;
  profiles: Record<string, ProfileResult>;
}

export interface CheckResult {
  input: string;
  language: string;
  words: WordResult[];
  overall: Record<string, { respelling: string; script: string; ease: number; survival: number }>;
  notes: string[];
}

/** What a language's own adapter receives for one word and one speaker group. */
export interface AdaptInput {
  word: string; // as typed, letters only
  phones: string[]; // English sounds in ARPAbet, with stress digits on vowels
  syllables: Syllable[]; // the same sounds grouped into syllables, with their positions in `phones`
  profile: string; // speaker group id, e.g. "traditional" or "younger"
  /** 0..1 distance between an English sound (ARPAbet consonant) and a sound given as a PanPhon symbol. */
  distance: (englishPhone: string, panphonSymbol: string) => number;
}

/** What an adapter returns. The engine works out the two scores from `changes`. */
export interface AdaptOutput {
  respelling: string;
  script: string; // '' when the pack does not write the local script
  changes: Change[];
  alternative?: { respelling: string; note: string };
  ipa?: string;
}

export interface PackBundle {
  pack: any;
  /** Writes one syllable in the language's own script (used by the table-driven engine). */
  composeSyllable?: (s: OutSyllable) => string;
  /** A language whose sound pattern does not fit the table-driven engine supplies its own adapter. */
  adapt?: (input: AdaptInput) => AdaptOutput;
}
