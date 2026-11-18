# Bouba guidebook

This guide explains what Bouba does, how to read a result, and where its limits are. The same text is in the app under "Guide".

## What Bouba does

It predicts how native speakers of another language are likely to say a name or phrase written in English spelling. It does not translate.

Each language has a fixed set of sounds and rules about which of them can sit side by side. When a name breaks those rules, speakers repair it in regular ways: they swap a sound, add a vowel, or leave a sound out. The app predicts the repairs.

## Using it

1. Choose the language at the top.
2. Type a company name, product name or tagline.
3. Read the verdict, then the marked-up name. Select a marked letter to see why it changes.
4. Each language has two speaker groups. The result is for the first one. When the second group would say the name differently, a note under the result shows their version.
5. Use "Compare names" to rank a shortlist, and the "Markets" table to see the same name in every covered country.

If the name is invented, Bouba guesses how it is said in English and says so. Type a correction in the field under "How Bouba read it in English" if the guess is wrong.

## Reading a result

| Part | Meaning |
|---|---|
| Likely said as | An easy respelling, syllable by syllable. Each language has its own key in the in-app Guide |
| Likely spelling | The predicted spelling in the local script, for Thai and Japanese |
| Ease (0 to 100) | How little the name has to be repaired to fit the language. Each repair takes points off: an added vowel 12, a changed ending 10, a dropped ending sound 8, a sound the language does not have 6 |
| Survival (0 to 100) | How much of the original sound is left. A dropped sound counts as fully lost, a swapped sound as partly lost, an added vowel as half a sound |
| Colors | 85 and above green, 70 to 84 amber, below 70 red. These cutoffs are provisional |
| Confidence | High: stated in a published study. Medium: from a summary of a study, from spelling rules, or from recorded loanwords. Low: an estimate with no published source |

## Languages

| Language | Country | Speaker groups | Rules come from | Checked by native speakers |
|---|---|---|---|---|
| Thai | Thailand | Most speakers; Younger speakers | Published descriptions of Thai, the Royal Institute's 1989 spelling rules, one community study | No |
| Burmese | Myanmar | Established pattern; Newer pattern | Three published studies of English loanwords in Burmese | No |
| Japanese | Japan | Established spelling; Newer spelling | English loanwords recorded in the JMdict dictionary | No |
| Mandarin Chinese | China | Standard transcription; Brand-style shortening | Miao (2006), a study of 1,177 English loans, and the Xinhua transcription table for names | No |
| Arabic (standard) | Arab countries | Standard pronunciation; English-exposed speakers | Al-Athwary (2017), a study of English loans in Standard Arabic, and Arabic Wikipedia spellings | No |
| Hindi | India | Most speakers; English-exposed speakers | Three studies of Indian speakers of English, and Hindi Wikipedia spellings | No |

## What it can do

- Predict the likely everyday pronunciation of an English-spelled name or phrase in each covered language.
- Show the letters that change or go silent, and explain each change in plain words.
- Suggest the kind of change that would keep more of the name.
- Rank several candidate names on the same two scores.
- Rank the covered countries for one name.

## What it cannot do

- It does not check meanings, rude sound-alikes, trademarks or cultural associations.
- It does not predict whether a name will sell. Line, for example, is pronounced "lai" in Thailand, and the scores would mark that as a large change.
- It does not predict Thai or Burmese tone, or Japanese pitch accent.
- It cannot say how any one person will pronounce a name. It describes the usual pattern.
- Names that are not English-style (IKEA, Huawei, Nestlé) are read the way an English speaker would read them.
- Numbers are skipped. Type them as words.
- Scores for different languages come from different rule sets and have not been calibrated against each other. Treat the country ranking as a rough guide.
- No language has been checked by native speakers yet.
- It does not replace a final check with native speakers before a launch.

## Accuracy so far

See the tables in `README.md`. In short: on words that were not used to tune the rules, the predictions agree with real Thai spellings, published Burmese pronunciations and dictionary Japanese spellings at an average similarity of 86 to 90 percent. Those are tests against records, and none of them is a test with speakers.

## Privacy

Everything runs on the device. Nothing typed into the app is sent anywhere.

## Correcting it

If a prediction is wrong for a language you know, please open an issue on GitHub using the "A prediction is wrong" form. `CONTRIBUTING.md` explains how to change a rule yourself.
