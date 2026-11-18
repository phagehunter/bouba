# Bouba

Version 0.0.0-s7 · pilot in development · Thai, Burmese, Japanese, Mandarin Chinese, Standard Arabic and Hindi so far

Type a company name, product name or tagline in English spelling and see **how native speakers of another language are likely to say it**. It predicts pronunciation and does not translate. The result lists each sound that changes, gives the reason, and scores how much of the name is left.

It is written for marketing and product people and assumes no linguistics.

## What it does today

- For six languages (Thai, Burmese, Japanese, Mandarin Chinese, Standard Arabic, Hindi): predicts the likely pronunciation and gives two scores. The result is for the main speaker group, with a note when a second group would say the name differently. All except Burmese also show the likely local spelling.
- Ranks the covered markets (Thailand, Myanmar, Japan, China, the Arab countries, India) for a name.
- Ease (0-100): how little the name has to be repaired to fit the language's sound patterns.
- Survival (0-100): how much of the original sound is left afterwards.
- Every change is explained in plain language, with a confidence level and a source.
- Highlights the letters that change, suggests changes that would keep more of the name, and ranks several candidate names side by side.
- Works on phrases as well as single names. Runs entirely on the device; nothing is sent anywhere.

## What it cannot do

- It does not check meanings, rude sound-alikes, trademarks or cultural associations.
- It does not predict Thai, Burmese or Mandarin tones, or Japanese pitch accent.
- Chinese brand names are often chosen for meaning. The app gives the sound-based form only.
- Arabic covers the standard language. Everyday speech differs by country.
- Results are predictions. Individual speakers differ, and the scores have not yet been checked with native speakers.
- Names that are not English-style (IKEA, Huawei, Nestlé) are read as an English speaker would read them, which is often not how the brand is said locally.
- Six languages are covered. Scores for different languages come from different rule sets and have not been calibrated against each other, so the country ranking is a rough guide.
- No language has been checked by native speakers yet. A check is planned for Thai only.

## Try it

Once the first pre-release is published, the downloads will be on the repository's Releases page:

| For | File | Note |
|---|---|---|
| Mac | `.dmg` | The app is unsigned. On first open, macOS will warn that it cannot check the app; open it from System Settings, Privacy and Security |
| Windows | `.exe` installer | Unsigned. Windows will show an "unknown publisher" warning; choose "More info", then "Run anyway" |
| Android | `.apk` | Installed by hand. Android will ask for permission to install from this source |
| iPhone and iPad | The web address | Open it in Safari, then Share, "Add to Home Screen". It works offline after the first visit |
| Any computer | `name-check-single-file.html` | One file that opens in a browser with a double-click |

The guidebook is in `GUIDE.md`.

**For development** (needs Node.js 20 or newer):

```bash
npm install
```

```bash
npm run dev
```

**From the command line:**

```bash
npm run check -- "Starbucks"
```

**To rebuild the double-click file:**

```bash
npm run build:app-file
```

## For contributors

```bash
npm test
```

```bash
npm run benchmark
```

- `packs/th/pack.json`: the Thai rules, as plain data. This is where language knowledge goes.
- `packs/th/script.ts`: writes a syllable in Thai script.
- `packs/my/pack.json`: the Burmese rules. Burmese uses the same table-driven engine as Thai.
- `packs/zh/`, `packs/ar/`, `packs/hi/`: the Mandarin, Standard Arabic and Hindi rules, each with its own adapter.
- `packs/ja/pack.json` and `packs/ja/adapt.ts`: the Japanese rules and the Japanese adapter. Japanese builds words from beats, which the table-driven engine does not handle, so it has its own adapter.
- `src/english.ts`: turns the typed name into English sounds.
- `src/engine.ts`: applies a language pack; contains nothing language-specific.
- `src/app/`: the app screen (Svelte): check a name, compare names, guide.
- `benchmark/`: real Thai spellings of well-known names, used to measure accuracy.
- `tests/`: automatic checks, including "accuracy must not drop".

See `CONTRIBUTING.md` for how to correct a rule or add a language, and `CREDITS.md` for data sources.

## Accuracy so far

Thai: the predicted Thai spelling is compared with the real Thai spelling (Thai Wikipedia titles), ignoring tone marks.

| List | Names | Average similarity | Exact matches |
|---|---|---|---|
| Main brand list (rules were tuned on it) | 94 | 87.5% | 45 |
| Second list of brands and cities (84.9% when first run untouched; seen since) | 58 | 86.0% | 25 |
| Third list, US state names (never used for tuning) | 39 | 86.8% | 23 |

This measures spelling agreement, which is a stand-in for pronunciation. It is not a test with native speakers.

Burmese: the predicted pronunciation is compared with 76 loanwords whose Burmese pronunciation is published in Chang (2003, 2009), ignoring tone. The rules were written with all 76 in view, and all 76 come from one bilingual speaker.

| List | Words | Average similarity | Exact matches |
|---|---|---|---|
| Half used for adjustments | 38 | 86.5% | 19 |
| Half set aside | 38 | 87.9% | 25 |

Japanese: the predicted katakana is compared with the first spelling in the JMdict dictionary. The lists were drawn automatically and contain some mismatched pairs.

| List | Words | Established spelling | Newer spelling |
|---|---|---|---|
| Used for tuning | 1,500 | 88.5% (936 exact) | 90.8% (1,013 exact) |
| Not used for tuning | 1,500 | 88.1% (933 exact) | 89.9% (985 exact) |

Mandarin: the predicted pinyin (without tones) is compared with Chinese Wikipedia titles. Most titles could not be compared, because they use characters outside the standard transcription table or are translations by meaning. The names that could be compared are mostly place names.

| List | Names compared | Average similarity | Exact matches |
|---|---|---|---|
| Used for tuning | 71 of 249 | 83.2% | 36 |
| Not used for tuning, run once | 77 of 222 | 83.4% | 33 |
| Brand and company names printed in Miao (2006), not used for tuning | 40 | 60.1% | 6 |

Standard Arabic: the predicted Arabic spelling is compared with Arabic Wikipedia titles, ignoring vowel marks and letter variants.

| List | Names | Average similarity | Exact matches |
|---|---|---|---|
| Used for tuning | 181 | 94.7% | 125 |
| Not used for tuning, run once | 104 | 91.6% | 53 |

The predicted pronunciation was also compared with 43 examples printed in Al-Athwary (2017), which were used for tuning: 87.1%, 16 exact.

Hindi: the predicted Devanagari spelling is compared with Hindi Wikipedia titles.

| List | Names | Average similarity | Exact matches |
|---|---|---|---|
| Used for tuning | 156 | 91.6% | 90 |
| Not used for tuning, run once (mostly US states and cities) | 92 | 83.5% | 31 |

## License

The code is under the Apache License 2.0 (`LICENSE`). The language packs in `packs/` are under Creative Commons Attribution-ShareAlike 4.0 (`packs/LICENSE`). Licenses for the bundled data and fonts are in `third-party-licenses/`, and `CREDITS.md` lists every source.
