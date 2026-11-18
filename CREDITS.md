# Credits and data sources

## Data inside this project

| File | Source | License | Use |
|---|---|---|---|
| `data/raw/cmudict.dict`, `data/cmudict.txt` | CMU Pronouncing Dictionary, https://github.com/cmusphinx/cmudict | Its README states that use "for any research or commercial purpose is completely unrestricted"; see the license file in that repository | English spelling to sounds |
| `data/raw/ipa_all.csv`, `data/features.json` | PanPhon (Mortensen et al. 2016), https://github.com/dmort27/panphon | MIT | Sound-similarity features |
| `data/raw/territoryInfo.json`, `data/markets.json` | Unicode CLDR, https://github.com/unicode-org/cldr-json | Unicode License V3 | Country population and the share who speak each language |
| `data/raw/JMdict_e.gz` and the `benchmark/ja-*.csv` lists drawn from it | JMdict, Electronic Dictionary Research and Development Group, https://www.edrdg.org/ | CC BY-SA 4.0 | Recorded Japanese spellings of English loanwords, for testing only; the dictionary is not part of the app |
| `benchmark/my-loanwords.csv` | Loanword pronunciations published in Chang (2003, 2009) | Quoted from the published studies for testing | Recorded Burmese pronunciations |
| `benchmark/*.csv` (Thai titles) | Wikipedia article titles, via the public Wikipedia API | CC BY-SA 4.0 | Real Thai spellings for the accuracy benchmark |

License terms as published by each project in November 2026. The license texts for the CMU dictionary, PanPhon and Unicode CLDR are in `third-party-licenses/`. The raw downloads are not kept in the repository; `scripts/fetch-raw-data.sh` fetches them.

## Fonts inside the app

| File | Font | Copyright | License | Use |
|---|---|---|---|---|
| `public/fonts/Fredoka-variable.ttf` | Fredoka | Copyright 2016 The Fredoka Project Authors (https://github.com/hafontia/Fredoka-One) | SIL Open Font License 1.1 | The name "bouba" and headings |
| `public/fonts/AtkinsonHyperlegibleNext-variable.ttf` | Atkinson Hyperlegible Next | Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors (https://github.com/googlefonts/atkinson-hyperlegible-next) | SIL Open Font License 1.1 | All other text in Latin letters |

Both license texts are in `third-party-licenses/`. Thai, Burmese, Japanese, Chinese, Arabic and Devanagari text uses the fonts on the device.

## Published sources for the Thai rules

- Tingsabadh, K. & Abramson, A. (1993). Thai. Journal of the International Phonetic Association 23(1): 24-28. (Used through the Wikipedia page "Thai phonology".)
- Kenstowicz, M. & Suchato, A. (2006). Issues in loanword adaptation: a case study from Thai. Lingua 116(7): 921-949. (As summarized on the Wikipedia page "Tinglish".)
- Nusartlert, A. (2013). Community study of final [s] and [l] in English loanwords. Khon Kaen University graduate journal 2(1): 15-32.
- Royal Institute (1989). Rules for transcribing English words into Thai. Royal Gazette vol. 106, part 153, 14 September 1989.

## Developer tools

TypeScript, tsx and Vitest (and esbuild, which is installed with them and is used to build the test page). None of these ship inside the app.

## Published sources for the Burmese rules

- Chang, C. B. (2009). English loanword adaptation in Burmese. Journal of the Southeast Asian Linguistics Society 1: 77-94.
- Chang, C. B. (2003). "High-Interest Loans": The Phonology of English Loanword Adaptation in Burmese. BA thesis, Harvard University.
- Jenny, M. (2015). Foreign influence in the Burmese language.

The Burmese pronunciations in the benchmark come from the two Chang studies. The thesis prints its phonetic symbols as images, so a few entries may contain transcription errors.

## Sources for the Japanese rules

The Japanese rules follow the spellings of English loanwords recorded in JMdict. No pronunciation study is cited for them.

## Sources for the Mandarin rules

- Miao, R. (2006). Loanword Adaptation in Mandarin Chinese: Perceptual, Phonological and Sociolinguistic Factors. PhD dissertation, Stony Brook University (Rutgers Optimality Archive 814).
- Xinhua News Agency transcription table for English names, as reproduced on the Wikipedia page "Transcription into Chinese characters".
- Chinese Wikipedia article titles (test lists).

## Sources for the Standard Arabic rules

- Al-Athwary, A. A. H. (2017). The Phonotactic Adaptation of English Loanwords in Arabic. Arab World English Journal 8(3): 392-406.
- Mubarak, H., Al Sharqawy, M. & Al Masry, E. (2009). Diacritization and Transliteration of Proper Nouns from Arabic to English. MEDAR 2009. (Covers the reverse direction; used as supporting detail.)
- Arabic Wikipedia article titles (test lists and the fit of the spelling rules).

## Sources for the Hindi rules

- Pal, P., Jain, S., Yarra, C., Vuppala, A. & Ghosh, P. K. (2022). Study of Indian English Pronunciation Variabilities relative to Received Pronunciation. arXiv 2204.06502.
- Narkar, J. & Staroverov, P. An acoustic study of voiceless stops in Indian English. Journal of South Asian Linguistics.
- Fuchs, R. (2019). Almost [w]anishing: the elusive /v/-/w/ contrast in educated Indian English. Proceedings of ICPhS 2019: 1382-1386.
- The Wikipedia pages "Hindustani phonology" and "Hindustani orthography".
- Hindi Wikipedia article titles (test lists and the fit of the spelling rules).
