"""analyze: transcript, silences, unaccounted speech, retake candidates, scene cuts, quality, thumbs, packed.md."""
import array
import re
import tempfile
from pathlib import Path

from common import *

PHRASE_GAP_S = 0.5
RETAKE_JACCARD = 0.6


# ------------------------------------------------------------------ transcript engines
def _merge_tokens(tokens):
    """tokens: [{text,start,end}] where a token starting with a space (or the first) starts a word."""
    words = []
    for t in tokens:
        txt = t["text"]
        if not txt.strip():
            continue
        if words and not txt.startswith(" ") and not _is_event(txt):
            words[-1]["text"] += txt
            words[-1]["end"] = t["end"]
        else:
            words.append({"text": txt.strip(), "start": float(t["start"]), "end": float(t["end"])})
    return words


def _is_event(txt):
    s = txt.strip()
    return len(s) > 2 and ((s[0] == "(" and s[-1] == ")") or (s[0] == "[" and s[-1] == "]"))


def parse_parakeet(d):
    toks = []
    for sent in d.get("sentences", []):
        for t in sent.get("tokens", []):
            toks.append({"text": t["text"], "start": t["start"], "end": t["end"]})
    return _merge_tokens(toks)


def parse_whisper_cpp(d):
    toks = []
    for seg in d.get("transcription", []):
        off = seg.get("offsets") or {}
        toks.append({"text": seg.get("text", ""), "start": off.get("from", 0) / 1000.0, "end": off.get("to", 0) / 1000.0})
    return _merge_tokens(toks)


def parse_words_json(d):
    """Accept {'words':[{text|word,start,end}]} or a bare list. Used for manual transcripts and tests."""
    arr = d.get("words") if isinstance(d, dict) else d
    if arr is None:
        raise PipelineError("words json needs a 'words' array")
    out = []
    for w in arr:
        txt = w.get("text", w.get("word"))
        if txt is None or "start" not in w or "end" not in w:
            raise PipelineError("each word needs text/word, start, end: %r" % (w,))
        out.append({"text": str(txt), "start": float(w["start"]), "end": float(w["end"]),
                    "type": w.get("type"), "conf": w.get("conf")})
    return out


def finalize_words(raw):
    words = []
    for k, w in enumerate(raw):
        text = w["text"]
        typ = w.get("type") or ("audio_event" if _is_event(text) else "word")
        nrm = "" if typ == "audio_event" else norm_word(text)
        words.append({"i": k, "text": text, "norm": nrm, "start": r3(w["start"]), "end": r3(w["end"]),
                      "type": typ, "conf": w.get("conf")})
    return words


def find_whisper_model():
    env = os.environ.get("WHISPER_MODEL")
    if env and Path(env).is_file():
        return Path(env)
    for d in (pipeline_dir() / "models", Path.home() / ".cache" / "whisper"):
        if d.is_dir():
            c = sorted(d.glob("ggml-*.bin"))
            if c:
                return c[0]
    return None


def find_parakeet():
    env = os.environ.get("PARAKEET_MLX")
    if env and Path(env).is_file():
        return env
    w = which("parakeet-mlx")
    if w:
        return w
    p = Path.home() / ".venvs" / "parakeet" / "bin" / "parakeet-mlx"
    return str(p) if p.is_file() else None


NO_ENGINE_MSG = """No transcription engine found, and no log/<clip>.words.json to use instead.
Install one (see tools/pipeline/setup.sh output):
  Apple Silicon:  uv tool install parakeet-mlx
  or:             brew install whisper-cpp   (then download a ggml model into tools/pipeline/models/ or set WHISPER_MODEL)
Or put a manual transcript at log/<clip>.words.json:  {"words":[{"text":"Hello","start":0.5,"end":0.8}, ...]}"""


def transcribe(master, proj, cid):
    """Return (engine, model, raw_words). Prefers an existing words.json."""
    wj = proj / "log" / ("%s.words.json" % cid)
    if wj.is_file():
        return "words.json", None, parse_words_json(read_json(wj))
    pk, wh = find_parakeet(), which("whisper-cli")
    if not pk and not (wh and find_whisper_model()):
        if wh:
            raise PipelineError("whisper-cli found but no ggml model. Set WHISPER_MODEL or put ggml-*.bin in tools/pipeline/models/.\n" + NO_ENGINE_MSG)
        raise PipelineError(NO_ENGINE_MSG)
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "asr.wav"
        ffmpeg(["-i", str(master), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)])
        if pk:
            model = "mlx-community/parakeet-tdt-0.6b-v3"
            run([pk, str(wav), "--model", model, "--output-format", "json", "--output-dir", td])
            return "parakeet-mlx", model, parse_parakeet(read_json(Path(td) / "asr.json"))
        mp = find_whisper_model()
        run([wh, "-m", str(mp), "-f", str(wav), "-oj", "-ml", "1", "-sow", "-of", str(Path(td) / "w")])
        return "whisper-cpp", mp.name, parse_whisper_cpp(read_json(Path(td) / "w.json"))


# ------------------------------------------------------------------ audio / video measurements
def parse_silences(stderr, dur):
    out, start = [], None
    for line in stderr.splitlines():
        m = re.search(r"silence_start:\s*(-?[\d.]+)", line)
        if m:
            start = max(0.0, float(m.group(1)))
            continue
        m = re.search(r"silence_end:\s*(-?[\d.]+)", line)
        if m and start is not None:
            out.append((start, min(dur, float(m.group(1)))))
            start = None
    if start is not None:
        out.append((start, dur))
    return out


def silence_intervals(master, dur, d):
    p = run([FFMPEG, "-hide_banner", "-nostats", "-nostdin", "-i", str(master), "-vn",
             "-af", "silencedetect=noise=-35dB:d=%s" % d, "-f", "null", "-"], check=False)
    return parse_silences(p.stderr, dur)


def load_pcm(master):
    """mono 16 kHz s16 samples -> array('h')"""
    p = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-i", str(master), "-vn", "-ac", "1", "-ar", "16000",
                        "-f", "s16le", "-"], capture_output=True)
    a = array.array("h")
    a.frombytes(p.stdout[: len(p.stdout) // 2 * 2])
    return a


def peak_db(pcm, t0, t1, rate=16000):
    seg = pcm[int(t0 * rate): int(t1 * rate)]
    if not seg:
        return None
    pk = max(max(seg), -min(seg)) / 32768.0
    return round(20 * math.log10(pk), 1) if pk > 0 else -120.0


def noise_floor_db(pcm, rate=16000):
    win = int(rate * 0.02)
    vals = []
    for i in range(0, len(pcm) - win, win):
        seg = pcm[i:i + win]
        ms = sum(s * s for s in seg) / len(seg)
        vals.append(10 * math.log10(ms / (32768.0 ** 2)) if ms > 0 else -120.0)
    if not vals:
        return None
    vals.sort()
    return round(vals[max(0, int(len(vals) * 0.1) - 1)], 1)


def unaccounted_speech(sound, words):
    """sound intervals minus words widened by 50 ms; keep >= 0.15 s remainders."""
    wl = [(w["start"] - 0.05, w["end"] + 0.05) for w in words if w["type"] == "word"]
    out = []
    for s, e in sound:
        pieces = [(s, e)]
        for a, b in wl:
            nxt = []
            for ps, pe in pieces:
                if b <= ps or a >= pe:
                    nxt.append((ps, pe))
                else:
                    if a > ps:
                        nxt.append((ps, a))
                    if b < pe:
                        nxt.append((b, pe))
            pieces = nxt
        for ps, pe in pieces:
            if pe - ps >= 0.15:
                out.append((ps, pe))
    return out


def complement(intervals, dur):
    out, t = [], 0.0
    for s, e in sorted(intervals):
        if s > t:
            out.append((t, s))
        t = max(t, e)
    if t < dur:
        out.append((t, dur))
    return out


def scene_cuts(master):
    p = run([FFMPEG, "-hide_banner", "-nostdin", "-i", str(master), "-vf", "scdet=threshold=10:sc_pass=0",
             "-an", "-f", "null", "-"], check=False)
    cuts = []
    for m in re.finditer(r"lavfi\.scd\.score:\s*([\d.]+),\s*lavfi\.scd\.time:\s*([\d.]+)", p.stderr):
        cuts.append({"t": r3(m.group(2)), "score": round(float(m.group(1)), 1)})
    n = len(cuts)
    if n > 100:
        cuts = sorted(sorted(cuts, key=lambda c: -c["score"])[:100], key=lambda c: c["t"])
    return cuts, n


def quality(master):
    q = {"yavg_mean": None, "yavg_min": None, "yavg_max": None, "blur_mean": None, "freeze": [], "black": [],
         "flags": [], "notes": []}
    p = run([FFMPEG, "-hide_banner", "-nostdin", "-i", str(master), "-vf",
             "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-an", "-f", "null", "-"], check=False)
    ys = [float(x) for x in re.findall(r"lavfi\.signalstats\.YAVG=([\d.]+)", p.stdout)]
    if ys:
        q["yavg_mean"], q["yavg_min"], q["yavg_max"] = round(sum(ys) / len(ys), 1), min(ys), max(ys)
    p = run([FFMPEG, "-hide_banner", "-nostdin", "-i", str(master), "-vf",
             "blurdetect=block_pct=80,metadata=print:key=lavfi.blur:file=-", "-an", "-f", "null", "-"], check=False)
    bs = [float(x) for x in re.findall(r"lavfi\.blur=([\d.]+)", p.stdout)]
    if bs:
        q["blur_mean"] = round(sum(bs) / len(bs), 2)
    p = run([FFMPEG, "-hide_banner", "-nostdin", "-i", str(master), "-vf",
             "freezedetect=n=-60dB:d=0.5,blackdetect=d=0.2:pix_th=0.1", "-an", "-f", "null", "-"], check=False)
    fs = [float(x) for x in re.findall(r"freeze_start:\s*([\d.]+)", p.stderr)]
    fe = [float(x) for x in re.findall(r"freeze_end:\s*([\d.]+)", p.stderr)]
    q["freeze"] = [{"start": r3(a), "end": r3(b) if k < len(fe) else None} for k, (a, b) in enumerate(zip(fs, fe + [None] * len(fs)))]
    bst = [float(x) for x in re.findall(r"black_start:([\d.]+)", p.stderr)]
    bend = [float(x) for x in re.findall(r"black_end:([\d.]+)", p.stderr)]
    q["black"] = [{"start": r3(a), "end": r3(b)} for a, b in zip(bst, bend + [None] * len(bst))]
    if q["yavg_mean"] is not None:
        if q["yavg_mean"] < 60:
            q["flags"].append("underexposed")
        elif q["yavg_mean"] > 200:
            q["flags"].append("overexposed")
    if q["freeze"]:
        q["flags"].append("frozen")
    if q["black"]:
        q["flags"].append("black")
    q["notes"].append("blur_mean is recorded but no 'soft' threshold is calibrated yet (needs her phone's clips)")
    return q


def thumbs(master, proj, cid, dur):
    d = proj / "log" / "thumbs"
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("%s_*.jpg" % cid):
        old.unlink()
    step = max(1.0, math.ceil(dur / 20.0))
    ffmpeg(["-i", str(master), "-an", "-vf", "fps=1/%s,scale=270:-2" % step, "-q:v", "4", str(d / ("%s_%%03d.jpg" % cid))],
           check=False)
    files = sorted(d.glob("%s_*.jpg" % cid))
    return [{"t": r3(k * step), "path": rel(f)} for k, f in enumerate(files)]


def phrases_from(words):
    ph, cur = [], []
    ws = [w for w in words if w["type"] == "word"]
    for w in ws:
        if cur and w["start"] - cur[-1]["end"] >= PHRASE_GAP_S:
            ph.append(cur)
            cur = []
        cur.append(w)
    if cur:
        ph.append(cur)
    out, prev_end = [], 0.0
    for k, g in enumerate(ph):
        out.append({"id": "p%d" % k, "first": g[0]["i"], "last": g[-1]["i"], "start": g[0]["start"], "end": g[-1]["end"],
                    "text": " ".join(x["text"] for x in g), "gap_before_s": r3(g[0]["start"] - prev_end)})
        prev_end = g[-1]["end"]
    return out


def retake_groups(words, phrases):
    sets = []
    for p in phrases:
        toks = [w["norm"] for w in words if p["first"] <= w["i"] <= p["last"] and w["norm"]]
        sets.append(set(toks) if len(toks) >= 3 else None)
    out = []
    for a in range(len(phrases)):
        for b in range(a + 1, len(phrases)):
            if sets[a] and sets[b]:
                j = len(sets[a] & sets[b]) / len(sets[a] | sets[b])
                if j >= RETAKE_JACCARD:
                    out.append({"phrases": [phrases[a]["id"], phrases[b]["id"]], "similarity": round(j, 2),
                                "method": "token-jaccard", "note": "candidate only; model decides"})
    return out


# ------------------------------------------------------------------ driver
def analyze_clip(proj, cid, force=False):
    log_path = proj / "log" / ("%s.clip.json" % cid)
    log = read_json(log_path)
    master = repo_root() / log["master"]["path"]
    if not master.is_file():
        raise PipelineError("%s: master missing" % cid)
    mh = log["master"].get("sha256") or sha256_file(master)
    wj = proj / "log" / ("%s.words.json" % cid)
    key_extra = sha256_file(wj) if wj.is_file() else ""
    cache_key = mh + "|" + key_extra
    if not force and log.get("transcript") and log.get("_cache_key") == cache_key:
        info("%s: cached (master + transcript unchanged)" % cid)
        return log
    dur = log["master"]["usable_duration_s"]
    engine, model, raw = transcribe(master, proj, cid)
    words = finalize_words(raw)
    wl = [w for w in words if w["type"] == "word"]
    warnings = []
    for a, b in zip(wl, wl[1:]):
        if b["start"] < a["end"] - 1e-6:
            warnings.append("words %d/%d overlap by %.3fs (ASR timing); cuts there will be flagged tight" % (a["i"], b["i"], a["end"] - b["start"]))
    for w in wl:
        if w["end"] <= w["start"]:
            warnings.append("word %d has non-positive length" % w["i"])
    log["transcript"] = {"engine": engine, "model": model, "language": "en",
                         "text": " ".join(w["text"] for w in wl), "words": words}
    if warnings:
        log["transcript"]["warnings"] = warnings
    log["phrases"] = phrases_from(words)
    sil = silence_intervals(master, dur, 0.25)
    log["silences"] = []
    for s, e in sil:
        kind = "head" if s <= 0.01 else "tail" if e >= dur - 0.01 else "inter"
        log["silences"].append({"start": r3(s), "end": r3(e), "dur": r3(e - s), "kind": kind})
    fine = silence_intervals(master, dur, 0.12)
    sound = complement(fine, dur)
    pcm = load_pcm(master)
    un = []
    for s, e in unaccounted_speech(sound, words):
        before = [w["i"] for w in wl if w["end"] <= s + 0.05]
        after = [w["i"] for w in wl if w["start"] >= e - 0.05]
        un.append({"start": r3(s), "end": r3(e), "peak_db": peak_db(pcm, s, e),
                   "between_words": [before[-1] if before else None, after[0] if after else None],
                   "note": "energy with no word: filler, breath, laugh or ASR drop"})
    log["unaccounted_speech"] = un
    log["retake_groups"] = retake_groups(words, log["phrases"])
    cuts, ncuts = scene_cuts(master)
    log["scene_cuts"] = cuts
    if ncuts > len(cuts):
        log["scene_cuts_total"] = ncuts
    log["quality"] = quality(master)
    ld = measure_ebur128(master)
    p = run([FFMPEG, "-hide_banner", "-nostdin", "-i", str(master), "-vn", "-af", "volumedetect", "-f", "null", "-"], check=False)
    m = re.search(r"mean_volume:\s*(-?[\d.]+) dB", p.stderr)
    spoken = sum(w["end"] - w["start"] for w in wl)
    log["audio"] = {"integrated_lufs": ld.get("I"), "true_peak_db": ld.get("TP"),
                    "mean_volume_db": float(m.group(1)) if m else None, "noise_floor_db": noise_floor_db(pcm),
                    "speech_ratio": round(min(1.0, spoken / dur), 2) if dur else 0}
    log["thumbs"] = thumbs(master, proj, cid, dur)
    log.setdefault("labels", {"kind": None, "product_visible": None, "face_box": None})
    log["_cache_key"] = cache_key
    write_json(log_path, log)
    info("%s: %d words, %d phrases, %d silences, %d unaccounted, %d retake group(s) [%s]" % (
        cid, len(wl), len(log["phrases"]), len(sil), len(un), len(log["retake_groups"]), engine))
    return log


def write_packed(proj, logs):
    lines = ["# packed v1  (30 fps master; times are master seconds; w = word index)"]
    for log in logs:
        t = log.get("transcript")
        if not t:
            continue
        words = t["words"]
        flags = list(log["quality"]["flags"]) or ["none"]
        if t.get("warnings"):
            flags.append("asr-overlaps")
        wid = max(3, len(str(len(words))))
        a = log["audio"]
        lines.append("## %s  dur %.1fs  words %d  phrases %d  lufs %s  flags: %s" % (
            log["clip_id"], log["master"]["usable_duration_s"], len([w for w in words if w["type"] == "word"]),
            len(log["phrases"]), a["integrated_lufs"], ", ".join(flags)))
        for p in log["phrases"]:
            lines.append("  [w%0*d-w%0*d | %06.2f-%06.2f | gap %.2f] %s" % (wid, p["first"], wid, p["last"], p["start"], p["end"],
                                                                         p["gap_before_s"], p["text"]))
            for u in log["unaccounted_speech"]:
                bw = u["between_words"][0]
                if bw is not None and p["first"] <= bw <= p["last"]:
                    lines.append("  ⚠ unaccounted %.2fs @%06.2f (between w%0*d,w%s)" % (
                        u["end"] - u["start"], u["start"], wid, bw, ("%0*d" % (wid, u["between_words"][1])) if u["between_words"][1] is not None else "end"))
            for g in log["retake_groups"]:
                if g["phrases"][1] == p["id"]:
                    lines.append("  ↺ retake group: %s ~ %s (%.2f)" % (g["phrases"][0], g["phrases"][1], g["similarity"]))
        # unaccounted speech before the first word / with no preceding word
        for u in log["unaccounted_speech"]:
            if u["between_words"][0] is None:
                lines.append("  ⚠ unaccounted %.2fs @%06.2f (before w%s)" % (u["end"] - u["start"], u["start"], u["between_words"][1]))
        lines.append("")
    (proj / "log" / "packed.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def cmd_analyze(batch, force=False):
    proj = require_project(batch)
    ledger_p = proj / "log" / "ingest.json"
    if not ledger_p.is_file():
        raise PipelineError("nothing ingested yet (run ingest first)")
    ledger = read_json(ledger_p)
    logs, bad = [], 0
    for cid in sorted(ledger["clips"]):
        if ledger["clips"][cid].get("status") != "ok":
            continue
        try:
            logs.append(analyze_clip(proj, cid, force))
        except PipelineError as e:
            if "No transcription engine" in str(e) or "ggml model" in str(e):
                print("ERROR %s: %s" % (cid, e), file=sys.stderr)
                return 3
            raise
    write_packed(proj, logs)
    info("wrote log/packed.md (%d clip(s))" % len(logs))
    return bad
