"""qa: every gate of spec 4.12 that can run without a vision model, plus judge material.

This file is the GATE. The agent that writes cut-lists or the pipeline code must not edit it in the
same change as the thing it judges (see DRIFT_GUARD.md / global rule: gate edits are flagged and audited).
Reject codes are the ones in studio/RUBRIC.md. Gate names are ours; the code column maps to RUBRIC.
"""
import re
import shutil
import tempfile
from pathlib import Path

from common import *

SSIM_MIN = 0.95
PIXEL_ON_MIN = 6.0     # mean abs luma diff final-vs-clean inside a caption box when the cue is ON
PIXEL_OFF_MAX = 3.0    # ... when it is OFF
CONTRAST_MIN = 3.0

# --------------------------------------------------------------------------- claim lint
RUBRIC_PATTERNS = [
    ("100%", r"100\s?%|\bhundred percent\b"),
    ("guaranteed", r"\bguarantee[sd]?\b"),
    ("instant results", r"\binstant(ly)?\s+results?\b"),
    ("no side effects", r"\bno\s+side[- ]effects?\b"),
    ("cure", r"\bcur(e|es|ed|ing)\b"),
    ("treat", r"\btreat(s|ed|ing|ment|ments)?\b"),
    ("prevent", r"\bprevent(s|ed|ing|ion)?\b"),
    ("weight loss", r"\bweight[- ]?loss\b|\blos(e|ing|t)\s+(\d+\s+)?(weight|pounds|lbs|kilos?)\b|\bfat[- ]?burn"),
    ("GLP-1", r"\bglp[- ]?1\b"),
    ("lowest/cheapest price", r"\b(lowest|cheapest)\s+price\b|\bcheapest\b"),
    ("link", r"https?://|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|co|shop|store)\b"),
    ("handle", r"(?<![\w])@\w+"),
    ("qr code", r"\bqr\b"),
    ("phone number", r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b"),
]
TIMEBOUND = (r"\bbefore\s*(and|&|/)\s*after\b|\bin\s+(just\s+)?(\d+|one|two|three|four|five|six|seven|ten|a few|a couple of?)\s+"
             r"(day|days|week|weeks|hour|hours|minute|minutes|month|months)\b|\bovernight\b|\bwithin\s+\d+\s+(days|weeks|hours)\b|"
             r"\bafter\s+\d+\s+(days|weeks|months)\b")


def lint_claims(texts, product):
    """texts: list of (n, raw_text). Returns (banned_hits, needs_disclaimer_hits, disclaimer_present)."""
    joined, spans, pos = "", [], 0
    for n, t in texts:
        if joined:
            joined += " "
            pos += 1
        spans.append((pos, pos + len(t), n))
        joined += t
        pos += len(t)

    def words_for(a, b):
        return [n for s, e, n in spans if s < b and e > a]

    hits = []
    pats = [(name, rx, "rubric-default") for name, rx in RUBRIC_PATTERNS]
    for c in (product or {}).get("competitors", []) or []:
        pats.append(("competitor:%s" % c, r"(?<!\w)%s(?!\w)" % re.escape(c), "product"))
    for term in (product or {}).get("banned_claims", []) or []:
        if not str(term).strip():
            continue
        if str(term).startswith("re:"):
            pats.append((str(term), str(term)[3:], "product"))
        else:
            pats.append((str(term), r"(?<!\w)%s(?!\w)" % re.escape(str(term)), "product"))
    seen = set()
    for name, rx, src in pats:
        for m in re.finditer(rx, joined, re.I):
            key = (m.start(), m.end())
            if key in seen:
                continue
            seen.add(key)
            hits.append({"term": name, "match": m.group(0), "source": src, "words": words_for(m.start(), m.end())})
    need = [{"match": m.group(0), "words": words_for(m.start(), m.end())} for m in re.finditer(TIMEBOUND, joined, re.I)]
    present = DISCLAIMER_TEXT in re.sub(r"[^a-z ]", "", joined.lower()).replace("  ", " ")
    return hits, need, present


# --------------------------------------------------------------------------- helpers
def mp4_atoms(path):
    out = []
    size_total = os.path.getsize(path)
    with open(path, "rb") as f:
        pos = 0
        while pos + 8 <= size_total and len(out) < 40:
            f.seek(pos)
            h = f.read(8)
            sz, typ = int.from_bytes(h[:4], "big"), h[4:8].decode("latin1")
            if sz == 1:
                sz = int.from_bytes(f.read(8), "big")
            elif sz == 0:
                sz = size_total - pos
            out.append(typ)
            if sz < 8:
                break
            pos += sz
    return out


def faststart(path):
    a = mp4_atoms(path)
    return "moov" in a and "mdat" in a and a.index("moov") < a.index("mdat")


def extract_frames(video, frames, outdir, tag):
    """Extract the given frame indices (n) as PNGs. Returns {n: path}."""
    frames = sorted(set(frames))
    if not frames:
        return {}
    outdir.mkdir(parents=True, exist_ok=True)
    sel = "+".join("eq(n\\,%d)" % n for n in frames)
    ffmpeg(["-i", str(video), "-vf", "select='%s'" % sel, "-fps_mode", "passthrough", "-an",
            str(outdir / ("%s_%%05d.png" % tag))], check=False)
    files = sorted(outdir.glob("%s_*.png" % tag))
    return {n: f for n, f in zip(frames, files)} if len(files) == len(frames) else {n: f for n, f in zip(frames, files)}


def ssim_png(a, b):
    p = run([FFMPEG, "-hide_banner", "-nostdin", "-i", str(a), "-i", str(b), "-lavfi", "ssim", "-f", "null", "-"], check=False)
    m = re.search(r"All:([\d.]+)", p.stderr)
    return float(m.group(1)) if m else 0.0


def luma_stats(png, box):
    from PIL import Image, ImageStat
    im = Image.open(png).convert("L").crop(tuple(box))
    return ImageStat.Stat(im).mean[0]


def luma_diff(png_a, png_b, box):
    from PIL import Image, ImageChops, ImageStat
    a = Image.open(png_a).convert("L").crop(tuple(box))
    b = Image.open(png_b).convert("L").crop(tuple(box))
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]


def rel_lum(v):
    return (max(0.0, min(255.0, v)) / 255.0) ** 2.2


class Report:
    def __init__(self):
        self.checks = []

    def add(self, gate, code, status, detail, **extra):
        c = {"gate": gate, "code": code, "status": status, "detail": detail}
        c.update(extra)
        self.checks.append(c)
        return status != "fail"

    @property
    def fails(self):
        return [c for c in self.checks if c["status"] == "fail"]


# --------------------------------------------------------------------------- gates
def gate_spec(rep, path, label):
    if not path.is_file():
        rep.add("spec:" + label, "no-master" if label == "clean" else "spec-res", "fail", "%s missing" % path.name)
        return None
    p = ffprobe_json(path)
    vs = next((s for s in p["streams"] if s["codec_type"] == "video"), None)
    au = next((s for s in p["streams"] if s["codec_type"] == "audio"), None)
    g = "spec:" + label
    if not vs:
        rep.add(g, "spec-res", "fail", "no video stream")
        return p
    ok = (vs.get("width"), vs.get("height")) == (W, H)
    rep.add(g + ":res", "spec-res", "pass" if ok else "fail", "%sx%s" % (vs.get("width"), vs.get("height")))
    ok = vs.get("r_frame_rate") == "30/1" and vs.get("avg_frame_rate") == "30/1"
    rep.add(g + ":fps", "spec-fps", "pass" if ok else "fail", "r=%s avg=%s" % (vs.get("r_frame_rate"), vs.get("avg_frame_rate")))
    ok = (vs.get("pix_fmt") == "yuv420p" and all(vs.get(k) == "bt709" for k in ("color_space", "color_transfer", "color_primaries"))
          and vs.get("color_range") == "tv")
    rep.add(g + ":color", "spec-color", "pass" if ok else "fail",
            "%s %s/%s/%s %s" % (vs.get("pix_fmt"), vs.get("color_space"), vs.get("color_transfer"), vs.get("color_primaries"), vs.get("color_range")))
    ok = vs.get("codec_name") == "h264" and faststart(path)
    rep.add(g + ":container", "spec-res", "pass" if ok else "fail",
            "codec=%s faststart=%s (container failures map to spec-res)" % (vs.get("codec_name"), faststart(path)))
    ok = bool(au) and au.get("codec_name") == "aac" and int(au.get("sample_rate", 0)) == SR and int(au.get("channels", 0)) == 2
    rep.add(g + ":audio", "spec-audio", "pass" if ok else "fail",
            "none" if not au else "%s %sHz %sch" % (au.get("codec_name"), au.get("sample_rate"), au.get("channels")))
    return p


def gate_duration(rep, edl, probe, plan, label="final"):
    if not probe:
        return
    vs = next(s for s in probe["streams"] if s["codec_type"] == "video")
    au = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)
    exp = edl["total_frames"] / FPS
    vd = float(vs.get("duration") or 0)
    nb = int(vs.get("nb_frames") or 0)
    ok = abs(vd - exp) <= 1.0 / FPS + 1e-3 and nb == edl["total_frames"]
    rep.add("duration:video", "spec-length", "pass" if ok else "fail", "video %.3fs/%d frames vs edl %.3fs/%d" % (vd, nb, exp, edl["total_frames"]))
    if au:
        ad = float(au.get("duration") or 0)
        ok = abs(ad - exp) <= 1.0 / FPS + 1e-3
        rep.add("duration:audio", "spec-length", "pass" if ok else "fail", "audio %.3fs vs edl %.3fs" % (ad, exp))
    lo, hi = None, None
    tgt = edl.get("target") or {}
    rng = tgt.get("duration_s") or (plan or {}).get("duration_range_s") or DEFAULT_DURATION_RANGE_S
    lo, hi = rng
    ok = lo - 1e-6 <= exp <= hi + 1e-6
    rep.add("duration:range", "spec-length", "pass" if ok else "fail", "%.2fs inside [%s, %s]: %s" % (exp, lo, hi, ok))


def gate_frame_identity(rep, proj, edl, clean, work):
    pairs = []  # (out_frame, clip, src_frame, label)
    cw = edl.get("cutaways", [])

    def in_cutaway(f):
        return any(c["out_in_frame"] <= f < c["out_out_frame"] for c in cw)

    for s in edl["segments"]:
        for of, sf in ((s["out_in_frame"], s["src_in_frame"]), (s["out_out_frame"] - 1, s["src_out_frame"] - 1)):
            if not in_cutaway(of):
                pairs.append((of, s["clip"], sf, "seg%d" % s["idx"]))
    for c in cw:
        pairs.append((c["out_in_frame"], c["clip"], c["src_in_frame"], "cutaway@seg%d" % c["seg"]))
        pairs.append((c["out_out_frame"] - 1, c["clip"], c["src_out_frame"] - 1, "cutaway@seg%d-end" % c["seg"]))
    out_frames = extract_frames(clean, [p[0] for p in pairs], work / "id_out", "o")
    by_clip = {}
    for p in pairs:
        by_clip.setdefault(p[1], []).append(p[2])
    master_frames = {}
    for clip, fl in by_clip.items():
        mp = repo_root() / next(i["path"] for i in edl["inputs"] if i["clip"] == clip)
        master_frames[clip] = extract_frames(mp, fl, work / ("id_m_" + clip), "m")
    bad, worst = [], 1.0
    for of, clip, sf, label in pairs:
        a, b = out_frames.get(of), master_frames[clip].get(sf)
        if not a or not b:
            bad.append("%s: frame missing (out %d / %s %d)" % (label, of, clip, sf))
            continue
        v = ssim_png(a, b)
        worst = min(worst, v)
        if v < SSIM_MIN:
            bad.append("%s: out frame %d vs %s frame %d SSIM %.3f" % (label, of, clip, sf, v))
    rep.add("frame-identity", "mid-word", "fail" if bad else "pass",
            ("; ".join(bad[:6])) if bad else "%d frame pairs, worst SSIM %.3f (>= %.2f)" % (len(pairs), worst, SSIM_MIN),
            note="SSIM is a regression gate on segment edges, not proof of lip sync (spec 4.9)")


def load_clip_words(proj, clip):
    return read_json(proj / "log" / ("%s.clip.json" % clip))["transcript"]["words"]


def gate_cuts(rep, proj, edl):
    bad, tight = [], []
    for s in edl["segments"]:
        if s["kind"] != "speech":
            continue
        words = [w for w in load_clip_words(proj, s["clip"]) if w["type"] == "word"]
        for label, f in (("in", s["src_in_frame"]), ("out", s["src_out_frame"])):
            t = f / FPS
            for w in words:
                if w["start"] + 0.002 < t < w["end"] - 0.002:
                    bad.append("seg%d cut-%s at %.3fs is inside word %d %r (%.3f-%.3f)" % (s["idx"], label, t, w["i"], w["text"], w["start"], w["end"]))
        for w_ in s.get("warnings", []):
            if w_.startswith("TIGHT_") and not s.get("allow_tight"):
                tight.append("seg%d %s without allow_tight" % (s["idx"], w_))
    rep.add("mid-word", "mid-word", "fail" if bad else "pass", "; ".join(bad[:5]) if bad else "no cut lands inside a word")
    rep.add("tight-cuts", "mid-word", "fail" if tight else "pass", "; ".join(tight) if tight else "no unexplained TIGHT_* warnings")


def expected_words(proj, edl):
    out = []
    for s in edl["segments"]:
        if s["kind"] != "speech":
            continue
        lo, hi = s["src_in_frame"] / FPS - 1e-6, s["src_out_frame"] / FPS + 1e-6
        for w in load_clip_words(proj, s["clip"]):
            if w["type"] == "word" and w["start"] >= lo and w["end"] <= hi:
                os_ = (w["start"] - s["src_in_frame"] / FPS) + s["out_in_frame"] / FPS
                out.append((s["clip"], w["i"], os_))
    return out


def gate_words(rep, proj, edl, wo, cues):
    exp = expected_words(proj, edl)
    got = [(w["clip"], w["i"], w["out_start"]) for w in wo["words"]]
    missing = [e for e in exp if (e[0], e[1]) not in {(g[0], g[1]) for g in got}]
    extra = [g for g in got if (g[0], g[1]) not in {(e[0], e[1]) for e in exp}]
    drift = [g for g in got for e in exp if g[:2] == e[:2] and abs(g[2] - e[2]) > 1.0 / FPS]
    ok = not (missing or extra or drift)
    d = "%d words, all present" % len(exp)
    if not ok:
        d = "missing %s; extra %s; timing drift %s" % (["%s:w%d" % m[:2] for m in missing[:6]], ["%s:w%d" % m[:2] for m in extra[:6]], len(drift))
    rep.add("words-whole", "caption-wrong", "pass" if ok else "fail", d,
            note="ASR on final.mp4 not run (needs a transcriber); this compares words.out.json to edl + clip log")
    if cues is None:
        return
    toks = []
    for c in cues:
        toks += norm_tokens(c["text"])
    want = [w["norm"] for w in wo["words"] if w["norm"]]
    covered = sorted(n for c in cues for n in c["words"])
    ok = toks == want and covered == sorted(w["n"] for w in wo["words"])
    rep.add("captions-match-words", "caption-wrong", "pass" if ok else "fail",
            "caption text equals transcript (%d tokens)" % len(want) if ok else
            "caption tokens differ from words.out: %d vs %d" % (len(toks), len(want)))
    bad = []
    bywn = {w["n"]: w for w in wo["words"]}
    for c in cues:
        w0 = bywn.get(c["words"][0]) if c["words"] else None
        if not w0:
            bad.append("%s has no words" % c["id"])
            continue
        f0 = int(round(w0["out_start"] * FPS))
        if abs(c["start_f"] - max(0, f0 - CAPTION_LEAD_FRAMES)) > 1 or not (c["start_f"] <= f0 < c["end_f"]):
            bad.append("%s starts at frame %d but its first word is at %d" % (c["id"], c["start_f"], f0))
    rep.add("caption-timing-meta", "caption-wrong", "fail" if bad else "pass", "; ".join(bad[:5]) if bad else "every cue starts 2 frames before its first word")


def gate_safe(rep, boxes):
    sx0, sy0, sx1, sy1 = SAFE_BOX  # the gate's own constants win over whatever the renderer wrote
    bad = [b for b in boxes["cues"] if not (b["box"][0] >= sx0 and b["box"][1] >= sy0 and b["box"][2] <= sx1 and b["box"][3] <= sy1)]
    rep.add("caption-safe-zone", "safe-zone", "fail" if bad else "pass",
            ("%d cue(s) outside x%d-%d y%d-%d: %s" % (len(bad), sx0, sx1, sy0, sy1, ", ".join("%s%s" % (b["id"], b["box"]) for b in bad[:4])))
            if bad else "%d boxes inside x%d-%d y%d-%d" % (len(boxes["cues"]), sx0, sx1, sy0, sy1))


def sample_cues(cues, k=8):
    if len(cues) <= k:
        return list(cues)
    idx = sorted(set([0, len(cues) - 1] + [round(i * (len(cues) - 1) / (k - 1)) for i in range(k)]))
    return [cues[i] for i in idx]


def gate_caption_pixels(rep, final, clean, cues, boxes, total, work):
    bymap = {b["id"]: b for b in boxes["cues"]}

    def active(f):
        return any(c["start_f"] <= f < c["end_f"] for c in cues)

    samp = sample_cues(cues)
    need = set()
    for c in samp:
        for f in (c["start_f"] - 1, c["start_f"], (c["start_f"] + c["end_f"]) // 2, c["end_f"] - 1, c["end_f"]):
            if 0 <= f < total:
                need.add(f)
    ff = extract_frames(final, need, work / "px_f", "f")
    cf = extract_frames(clean, need, work / "px_c", "c")
    bad, contrast_bad, n_on, n_off = [], [], 0, 0
    for c in samp:
        box = bymap.get(c["id"])
        if not box:
            bad.append("%s has no box" % c["id"])
            continue
        bx = box["box"]
        for f, want_on in ((c["start_f"], True), ((c["start_f"] + c["end_f"]) // 2, True), (c["end_f"] - 1, True),
                           (c["start_f"] - 1, False), (c["end_f"], False)):
            if not (0 <= f < total) or f not in ff or f not in cf:
                continue
            if not want_on and active(f):
                continue
            d = luma_diff(ff[f], cf[f], bx)
            if want_on:
                n_on += 1
                if d < PIXEL_ON_MIN:
                    bad.append("%s: expected caption ON at frame %d, found none (diff %.1f)" % (c["id"], f, d))
            else:
                n_off += 1
                if d > PIXEL_OFF_MAX:
                    bad.append("%s: expected caption OFF at frame %d, found one (diff %.1f)" % (c["id"], f, d))
        fm = (c["start_f"] + c["end_f"]) // 2
        if fm in cf:
            bg = luma_stats(cf[fm], bx)
            eff = bg * (1 - box["box_alpha"])
            if box.get("stroke_px", 0) >= 3:   # GATE-CHANGE (native captions): a solid black stroke is the
                eff = min(eff, 30.0)           # local background each glyph is read against; luma 30 is conservative
            tl = rel_lum(sum(box["text_color"]) / 3.0)
            ratio = (tl + 0.05) / (rel_lum(eff) + 0.05)
            if ratio < CONTRAST_MIN:
                contrast_bad.append("%s contrast %.1f" % (c["id"], ratio))
    rep.add("caption-pixel-timing", "caption-wrong", "fail" if bad else "pass",
            "; ".join(bad[:5]) if bad else "%d ON and %d OFF boundary checks on %d cues (final vs clean)" % (n_on, n_off, len(samp)))
    rep.add("caption-contrast", "caption-unreadable", "fail" if contrast_bad else "pass",
            "; ".join(contrast_bad[:4]) if contrast_bad else "text/background contrast >= %.1f on sampled cues" % CONTRAST_MIN)


def gate_loudness(rep, path, label):
    r = measure_ebur128(path)
    I, tp = r["I"], r["TP"]
    if I < NEAR_SILENCE_LUFS:
        rep.add("loudness:" + label, "spec-audio", "fail", "near silence %.1f LUFS" % I)
        return r
    d = abs(I - LUFS_TARGET)
    st = "fail" if (d > LUFS_TOL_FAIL or tp > TP_MAX) else "warn" if d > LUFS_TOL_WARN else "pass"
    rep.add("loudness:" + label, "spec-audio", st, "I %.1f LUFS (target -14, spec +/-1.0, RUBRIC reject +/-1.5), TP %.1f dBTP (max %.1f)" % (I, tp, TP_MAX))
    return r


def gate_claims(rep, wo, cues, product):
    texts = [(w["n"], w["text"]) for w in wo["words"]]
    hits, need, present = lint_claims(texts, product)
    rep.add("banned-claims", "banned-claim", "fail" if hits else "pass",
            "; ".join("%r (%s) at words %s" % (h["match"], h["term"], h["words"]) for h in hits[:6]) if hits else "no banned phrase in speech or captions",
            hits=hits, note="captions equal the transcript (checked above), so this lints both")
    if need and not present:
        rep.add("disclaimer", "no-disclaimer", "fail", "time-bound or before/after claim %s without 'results may vary'" % [n["match"] for n in need][:4], hits=need)
    else:
        rep.add("disclaimer", "no-disclaimer", "pass", "no time-bound claim" if not need else "claim present with 'results may vary'")
    if (product or {}).get("ai_generated") and not product.get("ai_disclosed"):
        rep.add("ai-disclosure", "ai-undisclosed", "fail", "plan/product.json says ai_generated=true but ai_disclosed is not true")
    m = (product or {}).get("music") or {}
    if m.get("baked_in") and m.get("source") != "commercial-music-library":
        rep.add("music", "music-license", "fail", "music baked in from %r, not the Commercial Music Library" % m.get("source"))


def gate_dead_air(rep, wo):
    ws = wo["words"]
    long_ = []
    for a, b in zip(ws, ws[1:]):
        if a["seg"] == b["seg"] and b["out_start"] - a["out_end"] > 0.4 + 1e-6:
            long_.append("%.2fs after word %d" % (b["out_start"] - a["out_end"], a["n"]))
    rep.add("dead-air", "dead-air", "warn" if long_ else "pass", "; ".join(long_[:5]) if long_ else "no pause over 0.4s inside a segment",
            note="warn only: RUBRIC says unintended; judge decides")


# --------------------------------------------------------------------------- judge material
def tile_png(src, out, vf, extra=None):
    ffmpeg(["-i", str(src)] + (extra or []) + ["-vf", vf, "-frames:v", "1", "-fps_mode", "passthrough", str(out)], check=False)


def judge_material(proj, variant, edl, final, qdir):
    art = {}
    nb = edl["total_frames"]
    K = max(1, nb // 12)
    tile_png(final, qdir / "sheet.png", "select='not(mod(n\\,%d))',scale=270:-2,tile=4x3:padding=4:margin=4:color=0x202020" % K)
    write_json(qdir / "sheet.json", {"tile_times_s": [round(i * K / FPS, 3) for i in range(12) if i * K < nb], "cols": 4, "rows": 3})
    art["sheet"] = "sheet.png"
    sdir = qdir / "strips"
    if sdir.exists():
        shutil.rmtree(sdir)
    sdir.mkdir(parents=True)
    strips = []
    for s in edl["segments"][1:]:
        F = s["out_in_frame"]
        name = "cut_%02d.png" % s["idx"]
        tile_png(final, sdir / name, "select='between(n\\,%d\\,%d)',scale=144:-2,tile=10x1:padding=2:margin=2:color=0x202020" % (max(0, F - 5), F + 4))
        strips.append({"file": "strips/" + name, "boundary_out_frame": F, "t_s": round(F / FPS, 3)})
    write_json(sdir / "strips.json", strips)
    art["strips"] = "strips/"
    tile_png(final, qdir / "first25.png", "select='not(mod(n\\,3))',scale=216:-2,tile=5x5:padding=2:margin=2:color=0x202020", ["-t", "2.5"])
    art["first25"] = "first25.png"
    t = min(1.0, edl["total_s"] / 2)
    sz = ("drawbox=x=0:y=0:w=iw:h=ih*0.10:color=red@0.35:t=fill,drawbox=x=0:y=ih*0.78:w=iw:h=ih*0.22:color=red@0.35:t=fill,"
          "drawbox=x=iw*0.86:y=0:w=iw*0.14:h=ih:color=red@0.35:t=fill,drawbox=x=0:y=0:w=iw*0.05:h=ih:color=red@0.35:t=fill,scale=360:-2")
    tile_png(final, qdir / "safe.png", sz, ["-ss", "%.2f" % t])
    art["safe"] = "safe.png"
    art["_missing"] = [k for k, v in art.items() if k != "_missing" and not (qdir / v).exists()]
    return art


# --------------------------------------------------------------------------- command
def cmd_qa(batch, variant):
    proj = require_project(batch)
    check_variant(variant)
    bdir = proj / "build" / variant
    qdir = proj / "qa" / variant
    qdir.mkdir(parents=True, exist_ok=True)
    rep = Report()
    final, clean = bdir / "final.mp4", bdir / "clean.mp4"
    need = ["edl.json", "words.out.json"]
    for f in need:
        if not (bdir / f).is_file():
            print("ERROR: missing build/%s/%s (compile and render first)" % (variant, f), file=sys.stderr)
            return 2
    edl, wo = read_json(bdir / "edl.json"), read_json(bdir / "words.out.json")
    pj = proj / "plan" / "product.json"
    product = read_json(pj) if pj.is_file() else {}
    if not pj.is_file():
        rep.add("plan", "banned-claim", "warn", "plan/product.json missing: only RUBRIC default claims linted")
    work = Path(tempfile.mkdtemp(prefix="qa_", dir=str(qdir)))
    try:
        pf = gate_spec(rep, final, "final")
        pc = gate_spec(rep, clean, "clean")
        if pf:
            gate_duration(rep, edl, pf, product)
        if pc and clean.is_file():
            gate_frame_identity(rep, proj, edl, clean, work)
        gate_cuts(rep, proj, edl)
        cues = boxes = None
        cp, bp = bdir / "caps" / "cues.json", bdir / "caps" / "boxes.json"
        if cp.is_file() and bp.is_file():
            cues, boxes = read_json(cp)["cues"], read_json(bp)
        elif wo["words"]:
            rep.add("captions-present", "caption-wrong", "fail", "words exist but caps/cues.json or boxes.json is missing")
        gate_words(rep, proj, edl, wo, cues)
        gate_dead_air(rep, wo)
        if boxes:
            gate_safe(rep, boxes)
            if final.is_file() and clean.is_file():
                gate_caption_pixels(rep, final, clean, cues, boxes, edl["total_frames"], work)
        if final.is_file():
            gate_loudness(rep, final, "final")
        if clean.is_file():
            gate_loudness(rep, clean, "clean")
        gate_claims(rep, wo, cues, product)
        sim = proj / "qa" / "similarity.json"
        if sim.is_file():
            s = read_json(sim)
            flagged = [p for p in s.get("pairs", []) if p.get("flag") and variant in (p.get("blocked") or [])]
            rep.add("near-duplicate", "near-duplicate", "fail" if flagged else "pass",
                    ("footage overlap with %s" % ", ".join("%s (%.2f)" % (p["a"] if p["b"] == variant else p["b"], p["overlap"]) for p in flagged))
                    if flagged else "no sibling over %.2f overlap (similarity.json)" % s.get("threshold", 0.6))
        else:
            rep.add("near-duplicate", "near-duplicate", "warn", "qa/similarity.json not found: run `pipeline.py similarity %s` before delivering" % batch)
        art = judge_material(proj, variant, edl, final, qdir) if final.is_file() else {}
    finally:
        shutil.rmtree(work, ignore_errors=True)
    fails = rep.fails
    report = {
        "schema": "qa-report/1", "batch": batch, "variant": variant, "generated_by": "qa.py", "generated_at": now_iso(),
        "passed": not fails,
        "hard_fails": [{"gate": c["gate"], "code": c["code"], "detail": c["detail"]} for c in fails],
        "warnings": [{"gate": c["gate"], "detail": c["detail"]} for c in rep.checks if c["status"] == "warn"],
        "checks": rep.checks, "artifacts": art,
        "hashes": {"final_sha256": sha256_file(final) if final.is_file() else None,
                   "clean_sha256": sha256_file(clean) if clean.is_file() else None,
                   "edl_sha256": sha256_file(bdir / "edl.json")},
        "not_run": ["ASR on final.mp4 (words-whole is checked against the clip log instead)",
                    "vision judge items: first 2.5 s, cut strips, hook/CTA structure, product visible, caption vs mouth overlap",
                    "real-phone check of caption legibility (once per new style)"],
    }
    write_json(qdir / "report.json", report)
    for c in rep.checks:
        info("  %-5s %-28s %s" % (c["status"].upper(), c["gate"], c["detail"][:150]))
    if fails:
        print("QA FAILED: %s" % ", ".join(sorted({c["code"] for c in fails})), file=sys.stderr)
        return 1
    info("QA PASSED %s/%s (report: %s)" % (batch, variant, rel(qdir / "report.json")))
    return 0
