#!/usr/bin/env python3
"""Anti-slop lint for on-screen headlines and post captions.

Deterministic: no model involved, so a cheap model can't talk its way past it.
Usage:
  python3 tools/text-lint/slop_lint.py "<text>"            # lint one string
  python3 tools/text-lint/slop_lint.py --file caption.txt   # lint a file
Exit 1 if any HARD tell is found. SOFT tells are printed as warnings.

The phrase list is a starting point (INFERRED from common AI-writing tells plus the
humanizer skill's creator-era patterns). Grow it with /note when the owner flags a phrase.
"""
import re, sys, json

HARD = [  # reads as AI or ad-speak instantly in a creator video
    r"\bgame[- ]?changer\b", r"\bmust[- ]have\b", r"\belevate (your|my)\b", r"\bseamless(ly)?\b",
    r"\bunlock (the|your)\b", r"\bdelve\b", r"\brevolutioni[sz]e\b", r"\btake (it|your \w+) to the next level\b",
    r"\bin today'?s fast[- ]paced\b", r"\bsay goodbye to\b", r"\bsay hello to\b", r"\blook no further\b",
    r"\bit'?s not just (a|an)\b.*\bit'?s\b", r"\bthe secret to\b", r"\bdon'?t miss out\b", r"\bindulge\b",
    r"\bboasts?\b", r"\bnestled\b", r"\bembark\b", r"\btestament to\b", r"\bunleash\b", r"\bbrace yourself\b",
    r"\bhere'?s the (kicker|thing)\b", r"\bnot just (a|an) \w+[.!,]? it'?s\b", r"\bunlock \w+", r"\btransform(s|ed)? your\b",
    r"\beffortless(ly)?\b", r"\binnovative\b", r"\bdm me\b", r"\btoday only\b", r"\blink in (my )?bio\b", r"\bperfect for anyone (who|looking)\b", r"\bwhether you'?re a\b",
]
SOFT = [  # fine once, slop when stacked
    r"\bobsessed\b", r"\bliterally\b", r"\bhonestly\b", r"\bviral\b", r"\btiktok made me buy it\b",
    r"\byou need this\b", r"\btrust me\b", r"\bnot gonna lie\b",
]
# compliance: ONE banned list, owned by the QA gate (tools/pipeline/qa.py RUBRIC_PATTERNS), so speech and text agree
import os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "pipeline"))
try:
    from qa import RUBRIC_PATTERNS as _RP
    BANNED = [p for _, p in _RP]
except Exception:  # qa.py not importable (e.g. copied alone): fall back to a minimal list
    BANNED = [r"\b100 ?%", r"\bguarantee[sd]?\b", r"\bcur(e|es|ed|ing)\b", r"https?://", r"\bwww\.", r"@\w{3,}"]

def lint(text):
    t = text.lower()
    out = {"hard": [], "soft": [], "banned": [], "style": []}
    for k, pats in (("hard", HARD), ("soft", SOFT), ("banned", BANNED)):
        for p in pats:
            for m in re.finditer(p, t):
                out[k].append(m.group(0))
    if text.count("—") >= 1:
        out["style"].append("em dash (reads as AI in captions; use a comma or a period)")
    emojis = re.findall(r"[\U0001F300-\U0001FAFF☀-➿]", text)
    if len(emojis) > 3:
        out["style"].append(f"{len(emojis)} emojis (max 3)")
    tags = re.findall(r"#\w+", text)
    if len(tags) > 5:
        out["style"].append(f"{len(tags)} hashtags (max 5)")
    words = re.findall(r"[A-Za-z']+", text)
    caps = [w for w in words if len(w) > 2 and w[0].isupper()]
    if len(words) >= 5 and len(caps) / len(words) > 0.6 and not text.isupper():
        out["style"].append("Title Case Headline (creators don't write like this)")
    if re.search(r"!{2,}", text) or text.count("!") > 2:
        out["style"].append("too many exclamation marks")
    if len(out["soft"]) >= 2:
        out["style"].append("stacked hype words: " + ", ".join(out["soft"]))
    out["pass"] = not (out["hard"] or out["banned"] or out["style"])
    return out

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    text = open(a[1]).read() if a[0] == "--file" else " ".join(a)
    r = lint(text)
    print(json.dumps(r, indent=2))
    sys.exit(0 if r["pass"] else 1)
