#!/usr/bin/env bash
# One-time setup for the video pipeline. Safe to re-run. Installs nothing globally.
set -euo pipefail
cd "$(dirname "$0")"
HERE="$(pwd)"

echo "== video pipeline setup =="
command -v python3 >/dev/null || { echo "python3 not found. Install it first (brew install python)."; exit 1; }
command -v ffmpeg  >/dev/null || { echo "ffmpeg not found. Install it first: brew install ffmpeg"; exit 1; }
command -v ffprobe >/dev/null || { echo "ffprobe not found (it ships with ffmpeg)."; exit 1; }

if [ ! -x "$HERE/.venv/bin/python" ]; then
  echo "Creating $HERE/.venv ..."
  python3 -m venv "$HERE/.venv"
fi
"$HERE/.venv/bin/python" -m pip install --quiet --disable-pip-version-check Pillow
"$HERE/.venv/bin/python" -c "import PIL; print('Pillow', PIL.__version__, 'OK')"

echo
echo "== ffmpeg capabilities (the pipeline picks paths from this) =="
for f in zscale libplacebo drawtext subtitles; do
  if ffmpeg -hide_banner -filters 2>/dev/null | grep -qE " $f "; then echo "  $f: yes"; else echo "  $f: no   (fine: the pipeline has a stock-filter path for it)"; fi
done

echo
echo "== transcription engine (needed once, for 'analyze') =="
if command -v parakeet-mlx >/dev/null || [ -x "$HOME/.venvs/parakeet/bin/parakeet-mlx" ]; then
  echo "  parakeet-mlx: found"
elif command -v whisper-cli >/dev/null; then
  echo "  whisper-cli: found. You also need a model file in $HERE/models/ (ggml-*.bin) or set WHISPER_MODEL."
else
  cat <<'MSG'
  None found. Pick one:
    Apple Silicon (recommended):   brew install uv && uv tool install parakeet-mlx
    Any Mac (fallback):            brew install whisper-cpp
                                   mkdir -p tools/pipeline/models
                                   then download a ggml model (for example ggml-base.en.bin from the whisper.cpp
                                   Hugging Face page) into tools/pipeline/models/   (not verified here)
  You can also skip this and put a hand-made transcript at studio/projects/<batch>/log/<clip>.words.json
MSG
fi

echo
echo "== telemetry =="
echo "  The HyperFrames/media-use skills send anonymous usage events unless you opt out."
echo "  Add this line to ~/.zshrc, then open a new terminal:   export HYPERFRAMES_NO_TELEMETRY=1"
echo "  (pipeline.py sets it for its own runs.)"

echo
echo "Done. Try:  python3 tools/pipeline/pipeline.py --help      Self-test:  bash tools/pipeline/tests/run.sh"
