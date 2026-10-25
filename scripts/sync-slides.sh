#!/usr/bin/env bash
# Ambil teks terbaru draft proposal dari Google Slides (harus "anyone with the link").
# Setelah jalan, cek perubahan dengan: git diff docs/proposal/
set -euo pipefail
DECK_ID="1-FwqJ1xbs7RWiiPIFSkjOLW2qbRKds4v8AfvUP3QUUI"
OUT="$(dirname "$0")/../docs/proposal/slides-snapshot.txt"
curl -fsSL "https://docs.google.com/presentation/d/${DECK_ID}/export/txt" -o "$OUT"
echo "Snapshot ditulis ke $OUT"
