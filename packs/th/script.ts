// Writes one adapted syllable in Thai script, following the Royal Institute's 1989 rules
// for transcribing English (no tone marks). This is the only Thai-specific code; all the
// sound rules live in pack.json.
import type { OutSyllable } from '../../src/types';

const NASAL_LETTERS = ['น', 'ม', 'ง'];

export function composeSyllable(s: OutSyllable): string {
  const O = s.onsetScript || 'อ'; // a syllable that starts with a vowel is written with อ
  const F = s.codaScript;
  const hasFinal = s.coda !== '';
  if (s.inserted) return s.onsetScript; // inserted short "a" is not written (สต-, สป-)
  switch (s.vowel) {
    case 'a': return hasFinal ? O + 'ั' + F : O + 'ะ' + F;
    case 'aa': return O + 'า' + F;
    case 'i': return O + 'ิ' + F;
    case 'ii': return O + 'ี' + F;
    case 'u': return O + 'ุ' + F;
    case 'uu': return O + 'ู' + F;
    case 'e': return hasFinal ? 'เ' + O + '็' + F : 'เ' + O + F;
    case 'ee': return 'เ' + O + F;
    case 'ae': return 'แ' + O + F;
    case 'oo': return 'โ' + O + F;
    case 'aw': return O + 'อ' + F;
    case 'er': return hasFinal ? 'เ' + O + 'ิ' + F : 'เ' + O + 'อ' + F;
    case 'ia': return 'เ' + O + 'ีย' + F;
    case 'ua': return hasFinal ? O + 'ว' + F : O + 'ัว' + F;
    case 'ai': return 'ไ' + O + F;
    case 'aai': return O + 'าย' + F;
    case 'ao': return NASAL_LETTERS.includes(F[0]) ? O + 'าว' + F : 'เ' + O + 'า' + F;
    case 'oi': return O + 'อย' + F;
    case 'iu': return O + 'ิว' + F;
    default: return O + F;
  }
}
