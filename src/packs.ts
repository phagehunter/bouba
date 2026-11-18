// The list of language packs the app knows about. To add a language: create
// packs/<id>/pack.json (plus script.ts or adapt.ts if the language needs one), then add one line here.
import thPack from '../packs/th/pack.json';
import { composeSyllable as thCompose } from '../packs/th/script';
import myPack from '../packs/my/pack.json';
import jaPack from '../packs/ja/pack.json';
import { adapt as jaAdapt } from '../packs/ja/adapt';
import hiPack from '../packs/hi/pack.json';
import { adapt as hiAdapt } from '../packs/hi/adapt';
import arPack from '../packs/ar/pack.json';
import { adapt as arAdapt } from '../packs/ar/adapt';
import zhPack from '../packs/zh/pack.json';
import { adapt as zhAdapt } from '../packs/zh/adapt';
import type { PackBundle } from './types';

export const PACKS: Record<string, PackBundle> = {
  th: { pack: thPack, composeSyllable: thCompose },
  my: { pack: myPack },
  ja: { pack: jaPack, adapt: jaAdapt },
  zh: { pack: zhPack, adapt: zhAdapt },
  ar: { pack: arPack, adapt: arAdapt },
  hi: { pack: hiPack, adapt: hiAdapt },
};
