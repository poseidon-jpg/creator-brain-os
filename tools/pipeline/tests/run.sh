#!/usr/bin/env bash
# Pipeline self-test. Builds synthetic fixtures (ffmpeg lavfi), runs ingest > analyze > compile > render > qa
# end to end, then the negative controls from spec 4.12. Writes ONLY under a temp dir (removed on exit;
# set PIPELINE_TEST_KEEP=1 to keep it for inspection). No transcription model is used: transcripts are fake.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PIPE="$(cd "$HERE/.." && pwd)"
if [ -x "$PIPE/.venv/bin/python" ]; then PY="$PIPE/.venv/bin/python"; else PY="python3"; fi
if ! "$PY" -c "import PIL" 2>/dev/null; then
  echo "Pillow is missing. Run: bash tools/pipeline/setup.sh" >&2
  exit 2
fi
command -v ffmpeg >/dev/null || { echo "ffmpeg not found" >&2; exit 2; }
TMP="$(mktemp -d "${TMPDIR:-/tmp}/pipeline-test.XXXXXX")"
cleanup() { if [ -z "${PIPELINE_TEST_KEEP:-}" ]; then rm -rf "$TMP"; else echo "kept: $TMP"; fi; }
trap cleanup EXIT
mkdir -p "$TMP/tmp"
export TMPDIR="$TMP/tmp"
export PIPELINE_ROOT="$TMP/repo"
export PIPELINE_FINAL_PRESET="${PIPELINE_FINAL_PRESET:-veryfast}"
export HYPERFRAMES_NO_TELEMETRY=1
"$PY" "$HERE/test_pipeline.py" "$TMP"
