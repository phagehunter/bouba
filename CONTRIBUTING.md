# Contributing

The project mostly needs people who know a language well. Correcting or adding a rule takes no programming.

## The most useful things to do

1. Say a prediction is wrong. Open an issue with the name typed, what the tool predicted, how people really say it, which language and roughly which speakers (age, region), and how the information is known (native speaker, published source, guess).
2. Correct a rule. Edit the language's `pack.json` (see below) and open a pull request.
3. Add evidence. A rule marked `"source": "unverified"` or `"confidence": "low"` needs a published source or a native speaker's confirmation.
4. Add names to the benchmark. Add rows to `benchmark/th-brand-list.csv` (name, English Wikipedia article title, origin).
5. Add a language. See the last section.

## How a language pack works

Each language lives in `packs/<language code>/`:

- `pack.json`: all sound rules, as data.
- `script.ts`: a small function that writes one syllable in the language's script.

The parts of `pack.json`:

| Part | What it holds |
|---|---|
| `profiles` | The speaker groups the pack predicts for (Thai: `traditional`, `younger`). |
| `sources` | Short names for published sources, used by the rules. |
| `sounds` | The language's consonants: how each is shown in the easy respelling, and its row in the sound-similarity table. |
| `onsets` | What each English consonant becomes at the start of a syllable. |
| `clusters` | Which consonant pairs are allowed at the start of a syllable; any other pair gets an inserted vowel. |
| `codas` | What each English consonant becomes at the end of a syllable, per speaker group. |
| `codaClusters` | What happens when two or more consonants end a syllable. |
| `vowels` | English vowel to target vowel, as an ordered list; the first matching rule wins. |
| `effortPoints` | How many points each kind of change takes off the Ease score. |
| `limits` | Plain statements of what the pack cannot do. These are shown to users. |

English sounds are written in ARPAbet (the CMU Pronouncing Dictionary notation): `SH EH1 L` is "shell". The digit on a vowel is its stress.

## What every rule needs

Every rule that changes a sound must have:

- `why`: one plain sentence a marketing person can understand. No linguistics terms.
- `source`: a key from `sources`, or `"unverified"`.
- `confidence`: `high` (a published source read directly), `medium` (a secondary source, or a source that is a spelling standard rather than a pronunciation study), or `low` (unverified).
- `ruleId`: a short unique name, for example `th-co-l`.

Optional: `tip`: one plain sentence on how a name could avoid the change. It is shown under "To keep more of the name in Thai".

If a rule has not been checked against a source, mark it `"unverified"`. An unchecked rule marked `"high"` misleads users.

## Writing style

Text in the app and in these guides should read as if one careful person wrote it for marketing and product people. These rules come from an audit of the first version, which found the habits listed here.

1. Say what the thing does. Leave out "it is not X" unless a reader would really assume X.
2. Write headings as noun phrases or short statements. Do not use questions.
3. Write interface text as a statement or an instruction. An error message says what happened and what to do next.
4. Use bold for a term that is being defined and for nothing else. Do not open each bullet with a bold phrase.
5. Write definitions with a colon or in a table. Do not use dashes as separators.
6. Name the thing that is measured ("how much of the name is left") instead of using a metaphor ("travels well").
7. A sentence that says something about speakers must come from a rule or a source. If it is an inference, say so, for example with "probably".
8. End a paragraph when the information ends. Do not add a line that sums it up.
9. Where every user reads the same text, such as the verdict, vary the sentence shape. One-line rule reasons may share a shape, because that helps scanning.
10. Use sentence case for headings, and no emoji.
11. Use American English spelling (color, recognize, license).

## Checking a change

```bash
npm test
```

```bash
npm run benchmark
```

The tests include an accuracy floor. If a change lowers benchmark accuracy, a test fails and the pull request should explain why the change is still right (the benchmark measures spelling, and spelling is not always pronunciation).

The newest untouched list (currently `benchmark/th-holdout2-list.csv`) exists to give an honest figure. Please do not tune rules against it. Once a list has been looked at to fix a bug, it no longer counts as untouched: add a fresh list and report its first-run figure.

## Adding a language

1. Copy `packs/th/` to `packs/<code>/` and replace the contents.
2. Add one line to `src/packs.ts`.
3. Add a benchmark list of real local spellings if the language has one.
4. Add tests for the best-documented behaviors.
5. State in `limits` what has not been checked by native speakers.

The table-driven engine suits languages that adapt names syllable by syllable (start consonants, vowel, end consonants). Thai and Burmese use it. A language with a different shape supplies its own adapter: a function in `packs/<code>/adapt.ts` that takes the English sounds and returns the respelling, the local spelling and the list of changes (see `AdaptInput` and `AdaptOutput` in `src/types.ts`, and `packs/ja/adapt.ts` for an example). Keep the tables in `pack.json` even when the logic is in an adapter.

Use the same `effortPoints` values as the other packs, so that Ease means the same thing in every language.

## Data that must stay out

Do not add data whose license forbids commercial use or redistribution (for example myG2P, Ethnologue, LAPSyD), or code under the GPL (for example eSpeak NG). See `CREDITS.md`.
