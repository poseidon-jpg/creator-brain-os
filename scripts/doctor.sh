#!/bin/bash
# Tool doctor: checks everything the video pipeline needs and prints the fix for anything missing.
# Read-only. Installs nothing. Run from the repo root:  bash scripts/doctor.sh
ok=0; miss=0
row(){ printf "%-14s %-8s %s\n" "$1" "$2" "$3"; }
check(){ # name, test-command, version-command, fix
  if eval "$2" >/dev/null 2>&1; then row "$1" "OK" "$(eval "$3" 2>/dev/null | head -1 | cut -c1-60)"; ok=$((ok+1))
  else row "$1" "MISSING" "fix: $4"; miss=$((miss+1)); fi
}
echo "Creator Brain OS: tool check"; echo
check "Homebrew" "command -v brew" "brew --version" '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
check "ffmpeg" "command -v ffmpeg" "ffmpeg -version" "brew install ffmpeg"
check "ffprobe" "command -v ffprobe" "ffprobe -version" "comes with ffmpeg"
check "Node.js" "command -v node" "node -v" "brew install node"
check "Python 3" "command -v python3" "python3 -V" "brew install python"
check "jq" "command -v jq" "jq --version" "brew install jq   (the drift-bot hooks need it)"
check "uv" "command -v uv" "uv --version" "brew install uv"
check "osxphotos" "command -v osxphotos" "osxphotos --version" "uv tool install osxphotos   (pulls clips out of iCloud Photos)"
check "transcriber" "command -v whisper-cli || command -v mlx_whisper || command -v whisper || command -v parakeet-mlx" "command -v whisper-cli mlx_whisper whisper parakeet-mlx | head -1" "uv tool install parakeet-mlx   (fast local word timestamps on Apple Silicon; or: brew install whisper-cpp)"
echo
# ffmpeg features the pipeline cares about
if command -v ffmpeg >/dev/null; then
  f=$(ffmpeg -hide_banner -filters 2>/dev/null)
  for flt in loudnorm zscale libplacebo tonemap subtitles drawtext; do
    if echo "$f" | grep -qw "$flt"; then row "  ffmpeg:$flt" "OK" ""; else row "  ffmpeg:$flt" "absent" "$( [ "$flt" = zscale ] || [ "$flt" = libplacebo ] && echo 'HDR tone-mapping unavailable: keep iPhone HDR Video OFF' || { [ "$flt" = subtitles ] || [ "$flt" = drawtext ]; } && echo 'fine: captions render through HyperFrames, not ffmpeg' || echo 'needed: brew reinstall ffmpeg')"; fi
  done
fi
echo
free=$(df -g . | awk 'NR==2{print $4}')
row "Disk free" "${free}G" "$( [ "${free:-0}" -lt 30 ] && echo 'under 30GB: raw clips fill up fast' )"
echo; echo "$ok OK, $miss missing."
[ "$miss" -eq 0 ]
