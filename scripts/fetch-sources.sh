#!/usr/bin/env bash
# Download and prepare the raw geo/timezone sources into .tmp/.
# Run once before `npm run build:data`.
set -euo pipefail

TZ_RELEASE="2026c"
TZDB_VERSION="6.198.0"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$ROOT/.tmp"
mkdir -p "$TMP"
cd "$TMP"

# Land-clipped zones on purpose: the with-oceans variant pads zones out to sea,
# which erases the continent silhouette on the map.
echo "==> timezone boundaries ($TZ_RELEASE, land-clipped)"
if [ ! -f combined.json ]; then
  curl -fsSL -o tzland.zip \
    "https://github.com/evansiroky/timezone-boundary-builder/releases/download/${TZ_RELEASE}/timezones.geojson.zip"
  unzip -oq tzland.zip
fi

echo "==> simplify timezone polygons (2.5%, keep every zone)"
if [ ! -f tz_land.json ]; then
  npx --yes mapshaper combined.json \
    -simplify visvalingam percentage=2.5% keep-shapes \
    -o precision=0.02 format=geojson tz_land.json
fi

echo "==> country borders (Natural Earth 50m via world-atlas)"
if [ ! -f countries50.json ]; then
  npm pack world-atlas@2.0.2 >/dev/null
  tar xzf world-atlas-2.0.2.tgz
  npx --yes mapshaper -i package/countries-50m.json -target countries \
    -o format=geojson precision=0.01 countries50.json
fi

echo "==> IANA metadata (@vvo/tzdb $TZDB_VERSION)"
if [ ! -f vvo/package/raw-time-zones.json ]; then
  npm pack "@vvo/tzdb@${TZDB_VERSION}" >/dev/null
  mkdir -p vvo
  tar xzf "vvo-tzdb-${TZDB_VERSION}.tgz" -C vvo
fi

echo "==> ISO numeric -> alpha-2 (world-countries)"
if [ ! -f wc/package/countries.json ]; then
  npm pack world-countries >/dev/null
  mkdir -p wc
  tar xzf world-countries-*.tgz -C wc
fi

echo "==> city geography (GeoNames cities15000)"
if [ ! -f cities15000.txt ]; then
  curl -fsSL -o cities15000.zip "https://download.geonames.org/export/dump/cities15000.zip"
  unzip -oq cities15000.zip
fi

echo
echo "Sources ready in .tmp/. Now run: npm run build:data"
