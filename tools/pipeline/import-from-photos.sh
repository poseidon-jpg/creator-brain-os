#!/usr/bin/env bash
# Copy new iPhone videos from the Photos library into studio/inbox/ (originals, not edits).
# Run from anywhere. Needs: osxphotos (brew install osxphotos, or: uv tool install osxphotos).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DAYS="${1:-2}"
if [ "$(uname)" != "Darwin" ]; then echo "This only works on a Mac (it reads the Photos app library)."; exit 1; fi
if ! command -v osxphotos >/dev/null; then
  echo "osxphotos is not installed."
  echo "Install it with:   brew install osxphotos     (or: uv tool install osxphotos)"
  exit 1
fi
mkdir -p "$ROOT/studio/inbox"
echo "Exporting videos added in the last $DAYS days from Photos to studio/inbox/ ..."
echo "If macOS asks, allow Terminal (or Claude) to access Photos. Photos > Settings > iCloud should be 'Download Originals'."
osxphotos export "$ROOT/studio/inbox" --only-movies --update --added-in-last "$DAYS days"
echo "Done. Next: python3 tools/pipeline/pipeline.py ingest <batch>"
