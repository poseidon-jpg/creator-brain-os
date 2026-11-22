"""Shared constants and helpers for the video pipeline (stdlib only).

Constants come from research/deep-hop-pipeline-spec.md (section 4.4, 4.8, 4.11).
"""
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

# ---- master grid -----------------------------------------------------------
FPS = 30
SR = 48000
SPF = SR // FPS  # 1600 samples per frame
W, H = 1080, 1920

# ---- compiler constants (spec 4.4) ----------------------------------------
PAD_IN = 0.050
PAD_OUT = 0.100
GUARD = 0.020
GAP_CLEAN = 0.40
GAP_TIGHT = 0.15
MIN_SEG = 0.20
FADE = 0.030
PROFILES = {"fast": (0.03, 0.08), "default": (PAD_IN, PAD_OUT), "calm": (0.08, 0.15)}
BEATS = ("HOOK", "PROBLEM", "SOLUTION", "PROOF", "CTA")
HOOK_MAX_END_S = 3.5
CTA_MIN_S = 3.0

# ---- captions (spec 4.10 / 4.11) -------------------------------------------
SAFE_BOX = (151, 200, 929, 1498)  # x0, y0, x1, y1 on 1080x1920
CAPTION_CENTER_Y = 1380
CAPTION_FONT_PX = 72
CAPTION_MIN_FONT_PX = 44
CHUNK_WORDS = 2
CHUNK_MAX_WORDS = 3
CHUNK_MIN_S = 0.35
CHUNK_PAUSE_S = 0.30
CAPTION_LEAD_FRAMES = 2
CAPTION_HOLD_S = 0.12

# ---- loudness (spec 4.8) ----------------------------------------------------
LUFS_TARGET = -14.0
TP_AIM = -1.5
TP_MAX = -1.0
LUFS_TOL_WARN = 1.0   # spec 4.12
LUFS_TOL_FAIL = 1.5   # studio/RUBRIC.md spec-audio
NEAR_SILENCE_LUFS = -40.0

# ---- compliance defaults (studio/RUBRIC.md) ---------------------------------
DEFAULT_BANNED_LITERALS = [
    "100%", "guaranteed", "instant results", "no side effects", "cure", "treat",
    "prevent", "weight loss", "GLP-1", "lowest price", "cheapest price",
]
DEFAULT_DURATION_RANGE_S = [15, 45]
DISCLAIMER_TEXT = "results may vary"

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE", "ffprobe")


class PipelineError(Exception):
    pass


def repo_root():
    env = os.environ.get("PIPELINE_ROOT")
    if env:
        return Path(env).resolve()
    return Path(__file__).resolve().parents[2]


def pipeline_dir():
    return Path(__file__).resolve().parent


def project_dir(batch):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", batch or ""):
        raise PipelineError("batch name must match [A-Za-z0-9._-]+ (got %r)" % batch)
    return repo_root() / "studio" / "projects" / batch


def require_project(batch):
    p = project_dir(batch)
    if not p.is_dir():
        raise PipelineError("no such batch: %s (run: python3 tools/pipeline/pipeline.py new %s --product <slug>)" % (p, batch))
    return p


def check_variant(variant):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", variant or ""):
        raise PipelineError("variant name must match [A-Za-z0-9_-]+ (got %r)" % variant)
    return variant


def rel(path):
    """Path relative to the repo root when possible (keeps logs free of absolute paths)."""
    try:
        return str(Path(path).resolve().relative_to(repo_root()))
    except ValueError:
        return Path(path).name


# ---- json / files -------------------------------------------------------------
def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)


def sha256_file(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def sha256_head_tail(path, n=1 << 20):
    size = os.path.getsize(path)
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read(n))
        if size > 2 * n:
            f.seek(size - n)
            h.update(f.read(n))
    h.update(str(size).encode())
    return h.hexdigest()


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


# ---- subprocess ----------------------------------------------------------------
def run(cmd, cwd=None, check=True, timeout=None):
    """Run a command, return CompletedProcess with text stdout/stderr."""
    p = subprocess.run([str(c) for c in cmd], cwd=cwd, capture_output=True, text=True,
                       errors="replace", timeout=timeout)
    if check and p.returncode != 0:
        tail = "\n".join(p.stderr.strip().splitlines()[-12:])
        raise PipelineError("command failed (%d): %s\n%s" % (p.returncode, " ".join(str(c) for c in cmd[:6]) + " ...", tail))
    return p


def ffmpeg(args, cwd=None, check=True):
    return run([FFMPEG, "-hide_banner", "-nostdin", "-y"] + list(args), cwd=cwd, check=check)


def ffprobe_json(path):
    p = run([FFPROBE, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)])
    return json.loads(p.stdout)


def ffmpeg_has_filter(name):
    p = run([FFMPEG, "-hide_banner", "-filters"], check=False)
    return re.search(r"\s%s\s" % re.escape(name), p.stdout) is not None


def which(name):
    return shutil.which(name)


# ---- numbers --------------------------------------------------------------------
def fr(t):
    """seconds -> nearest frame index"""
    return int(round(t * FPS))


def r3(x):
    return None if x is None else round(float(x), 3)


def parse_rate(s):
    """'30/1' -> 30.0 ; '54025/1801' -> 29.997"""
    try:
        a, b = str(s).split("/")
        return float(a) / float(b) if float(b) else 0.0
    except Exception:
        try:
            return float(s)
        except Exception:
            return 0.0


# ---- words ------------------------------------------------------------------------
_PUNCT_EDGE = re.compile(r"^[^\w%$@#]+|[^\w%$@#]+$", re.UNICODE)


def norm_word(text):
    """lowercase, strip leading/trailing punctuation (media-use bareToken rule)."""
    return _PUNCT_EDGE.sub("", (text or "").strip().lower())


def norm_tokens(text):
    out = []
    for tok in re.split(r"\s+", (text or "").strip()):
        n = norm_word(tok)
        if n:
            out.append(n)
    return out


# ---- loudness -------------------------------------------------------------------
def parse_ebur128_summary(stderr):
    """Return dict(I, LRA, TP) from an ebur128 Summary block (peak=true)."""
    s = stderr[stderr.rfind("Summary:"):] if "Summary:" in stderr else stderr
    out = {}
    m = re.search(r"\bI:\s+(-?inf|-?[\d.]+)\s+LUFS", s)
    if m:
        out["I"] = float("-inf") if "inf" in m.group(1) else float(m.group(1))
    m = re.search(r"LRA:\s+(-?[\d.]+)\s+LU", s)
    if m:
        out["LRA"] = float(m.group(1))
    m = re.search(r"True peak:\s*\n\s*Peak:\s+(-?inf|-?[\d.]+)\s+dBFS", s)
    if m:
        out["TP"] = float("-inf") if "inf" in m.group(1) else float(m.group(1))
    return out


def measure_ebur128(path, cwd=None):
    p = run([FFMPEG, "-hide_banner", "-nostats", "-nostdin", "-i", str(path), "-vn",
             "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], cwd=cwd, check=False)
    if p.returncode != 0:
        raise PipelineError("ebur128 failed on %s:\n%s" % (path, p.stderr[-400:]))
    r = parse_ebur128_summary(p.stderr)
    if "I" not in r:
        raise PipelineError("could not parse ebur128 output for %s" % path)
    return r


def parse_loudnorm_json(stderr):
    i = stderr.rfind("{")
    j = stderr.rfind("}")
    if i < 0 or j < i:
        raise PipelineError("loudnorm printed no JSON")
    d = json.loads(stderr[i:j + 1])
    return {k: float(v) for k, v in d.items() if k != "normalization_type"} | {
        "normalization_type": d.get("normalization_type")}


def now_iso():
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def info(msg):
    print(msg, flush=True)


def warn(msg):
    print("WARN: " + msg, file=sys.stderr, flush=True)
