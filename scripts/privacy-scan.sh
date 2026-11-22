#!/bin/bash
# Privacy gate: fails if any personal string from the source system leaks into this repo.
# Run from the repo root:  bash scripts/privacy-scan.sh
# The pattern list lives in scripts/.privacy-patterns (one regex per line), so you can add your own.
cd "$(dirname "$0")/.." || exit 2
PAT_FILE="scripts/.privacy-patterns"
[ -f "$PAT_FILE" ] || { echo "missing $PAT_FILE"; exit 2; }
# scan exactly what git would push: tracked + untracked-but-not-ignored files
FILES=$(mktemp); git ls-files -co --exclude-standard | grep -vE '(^|/)(privacy-scan\.sh|\.privacy-patterns|\.privacy-allow)$' > "$FILES"
hits=$(tr '\n' '\0' < "$FILES" | xargs -0 grep -IniHE -f "$PAT_FILE" 2>/dev/null)
# drop known false positives (fixed strings, one per line, in scripts/.privacy-allow)
[ -f scripts/.privacy-allow ] && [ -n "$hits" ] && hits=$(printf '%s\n' "$hits" | grep -vF -f scripts/.privacy-allow)
# secrets: API keys and tokens never belong in the repo
secrets=$(tr '\n' '\0' < "$FILES" | xargs -0 grep -IHEn "(sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[bap]-[0-9A-Za-z-]{10,})" 2>/dev/null | cut -c1-120)
envs=$(grep -E '(^|/)\.env(\.|$)' "$FILES" | grep -v '\.example$'); rm -f "$FILES"
[ -n "$secrets$envs" ] && hits=$(printf '%s\n%s\n%s' "$hits" "$secrets" "$envs" | sed '/^$/d')
if [ -n "$hits" ]; then
  echo "$hits" | cut -c1-220
  echo
  echo "PRIVACY SCAN: FAIL ($(echo "$hits" | wc -l | tr -d ' ') lines)"
  exit 1
fi
echo "PRIVACY SCAN: PASS"
