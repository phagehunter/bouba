// Loads the data files from disk (used by the command line, the benchmark and the tests).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Engine } from './engine';
import { PACKS } from './packs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEngine(): Engine {
  const dictText = readFileSync(join(root, 'data/cmudict.txt'), 'utf8');
  const features = JSON.parse(readFileSync(join(root, 'data/features.json'), 'utf8'));
  return new Engine(dictText, features, PACKS);
}
