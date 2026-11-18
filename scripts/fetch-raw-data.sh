#!/bin/sh
# Downloads the raw source files that are too large or too rarely needed to keep in the repository.
# They are only needed to rebuild data/ or the Japanese benchmark lists; the app and the tests run without them.
# Usage: sh scripts/fetch-raw-data.sh
set -e
mkdir -p data/raw
curl -L -o data/raw/cmudict.dict https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict
curl -L -o data/raw/ipa_all.csv https://raw.githubusercontent.com/dmort27/panphon/master/panphon/data/ipa_all.csv
curl -L -o data/raw/territoryInfo.json https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/territoryInfo.json
curl -L -o data/raw/JMdict_e.gz https://www.edrdg.org/pub/Nihongo/JMdict_e.gz
echo "Done. Run: npm run build:data"
