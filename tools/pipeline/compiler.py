"""compile: cutlist/1 -> edl.json, cut.fc, words.out.json (spec 4.3 + 4.4).

Seven compiler rules are enforced as errors (see validate()). Rule 7 (three repair rounds) is the
attempts counter in build/<variant>/attempts.json.
"""
from common import *

MAX_ATTEMPTS = 3


class CompileError(Exception):
    def __init__(self, errors):
        super().__init__("; ".join(errors))
        self.errors = errors


def _load_logs(proj, clips):
    logs = {}
    for c in sorted(clips):
        p = proj / "log" / ("%s.clip.json" % c)
        if not p.is_file():
            raise CompileError(["clip %s has no log/%s.clip.json (run ingest + analyze)" % (c, c)])
        logs[c] = read_json(p)
    return logs


def _words(log):
    t = log.get("transcript")
    return t["words"] if t else None


def validate(cl, variant, logs_by_clip_loader):
    """Collect rule violations. Returns (errors, speech_clips)."""
    errs = []
    if cl.get("schema") != "cutlist/1":
        errs.append("schema must be 'cutlist/1'")
    if cl.get("variant_id") != variant:
        errs.append("variant_id %r does not match variant %r" % (cl.get("variant_id"), variant))
    segs = cl.get("segments")
    if not isinstance(segs, list) or not segs:
        errs.append("segments must be a non-empty list")
        return errs
    for k, s in enumerate(segs):
        tag = "seg[%d]" % k
        if not isinstance(s, dict):
            errs.append("%s is not an object" % tag)
            continue
        clip = s.get("clip")
        if not clip:
            errs.append("%s: missing clip" % tag)
            continue
        try:
            log = logs_by_clip_loader(clip)
        except CompileError as e:
            errs += ["%s: %s" % (tag, x) for x in e.errors]
            continue
        beat = s.get("beat")
        if beat not in BEATS:                                              # RULE 6
            errs.append("%s: beat %r not in %s (RULE 6)" % (tag, beat, "/".join(BEATS)))
        D = log["master"]["usable_duration_s"]
        if "first_word" in s or "last_word" in s:
            for bad in ("t_in", "t_out"):
                if bad in s:                                               # RULE 1
                    errs.append("%s: speech segments are addressed by word index only; remove %s (RULE 1)" % (tag, bad))
            words = _words(log)
            fw, lw = s.get("first_word"), s.get("last_word")
            if words is None:
                errs.append("%s: clip %s has no transcript" % (tag, clip))
                continue
            if not (isinstance(fw, int) and isinstance(lw, int) and not isinstance(fw, bool) and not isinstance(lw, bool)):
                errs.append("%s: first_word/last_word must be integers (RULE 1)" % tag)
                continue
            if fw > lw or fw < 0 or lw >= len(words):
                errs.append("%s: word range %d..%d invalid for clip %s with %d words (RULE 1)" % (tag, fw, lw, clip, len(words)))
                continue
            got = [w["norm"] for w in words[fw:lw + 1] if w["norm"]]
            want = norm_tokens(s.get("quote", ""))
            if got != want:                                                # RULE 2
                errs.append("%s: quote mismatch (RULE 2). words %d..%d say %r, quote says %r" % (
                    tag, fw, lw, " ".join(got), " ".join(want)))
            for rm in s.get("removed_words", []) or []:                    # RULE 3
                try:
                    a, b = int(rm[0]), int(rm[1])
                except Exception:
                    errs.append("%s: removed_words entries must be [a,b] pairs" % tag)
                    continue
                if a <= lw and b >= fw:
                    errs.append("%s: segment spans removed words %d..%d; split it into two segments (RULE 3 non-contiguous)" % (tag, a, b))
            for key in ("words", "skip_words", "word_list"):
                if key in s:
                    errs.append("%s: non-contiguous word lists are not allowed (%s); use two segments (RULE 3)" % (tag, key))
            cw = s.get("cutaway")
            if cw is not None:                                             # RULE 4
                try:
                    cwlog = logs_by_clip_loader(cw.get("clip"))
                except CompileError as e:
                    errs += ["%s cutaway: %s" % (tag, x) for x in e.errors]
                    continue
                fwd, twd = cw.get("from_word"), cw.get("to_word")
                if not (isinstance(fwd, int) and isinstance(twd, int) and fw <= fwd <= twd <= lw):
                    errs.append("%s: cutaway from_word/to_word must be ints inside %d..%d (RULE 4)" % (tag, fw, lw))
                ti, to = cw.get("t_in"), cw.get("t_out")
                if not (isinstance(ti, (int, float)) and isinstance(to, (int, float)) and 0 <= ti < to <= cwlog["master"]["usable_duration_s"] + 1e-6):
                    errs.append("%s: cutaway t_in/t_out must be seconds on its own master within 0..%.2f (RULE 4)" % (
                        tag, cwlog["master"]["usable_duration_s"]))
        else:                                                              # RULE 5
            ti, to = s.get("t_in"), s.get("t_out")
            if not (isinstance(ti, (int, float)) and isinstance(to, (int, float)) and 0 <= ti < to <= D + 1e-6):
                errs.append("%s: non-speech segments need clip,t_in,t_out seconds within 0..%.2f (RULE 5)" % (tag, D))
            if s.get("audio", "mute") not in ("mute", "keep"):
                errs.append("%s: audio must be mute or keep (RULE 5)" % tag)
            if "cutaway" in s:
                errs.append("%s: cutaway only belongs on speech segments (RULE 4)" % tag)
    return errs


def speech_bounds(words, a, b, D, pads, allow_tight):
    pad_in, pad_out = pads
    has_prev, has_next = a > 0, b + 1 < len(words)
    prev_end = words[a - 1]["end"] if has_prev else 0.0
    next_start = words[b + 1]["start"] if has_next else D
    head_gap = words[a]["start"] - prev_end
    tail_gap = next_start - words[b]["end"]
    t_in = max(words[a]["start"] - pad_in, prev_end + GUARD if has_prev else 0.0)
    t_out = min(words[b]["end"] + pad_out, next_start - GUARD if has_next else D)
    f_in = math.floor(t_in * FPS + 1e-6)
    f_out = math.ceil(t_out * FPS - 1e-6)
    warns, errs = [], []
    if has_prev and f_in / FPS < prev_end + 0.005:
        f_in = math.ceil((prev_end + 0.005) * FPS - 1e-6)
        warns.append("HEAD_CLAMPED_TO_PREV_WORD")
    if has_next and f_out / FPS > next_start - 0.005:
        f_out = math.floor((next_start - 0.005) * FPS + 1e-6)
        warns.append("TAIL_CLAMPED_TO_NEXT_WORD")
    f_out = min(f_out, math.floor(D * FPS + 1e-6))
    if f_in / FPS > words[a]["start"] + 1e-6:
        errs.append("HEAD_INSIDE_WORD: no room before word %d (gap %.3fs); the cut would land inside it" % (a, head_gap))
    if f_out / FPS < words[b]["end"] - 1e-6:
        errs.append("TAIL_INSIDE_WORD: no room after word %d (gap %.3fs); the cut would land inside it" % (b, tail_gap))
    tight = []
    if has_prev and head_gap < GAP_TIGHT:
        tight.append("TIGHT_HEAD")
    if has_next and tail_gap < GAP_TIGHT:
        tight.append("TIGHT_TAIL")
    for t in tight:
        if allow_tight:
            warns.append(t)
        else:
            errs.append("%s: gap %.3fs is under %.2fs; set allow_tight:true with a reason or pick other words" % (
                t, head_gap if t == "TIGHT_HEAD" else tail_gap, GAP_TIGHT))
    return f_in, f_out, warns, errs, head_gap, tail_gap, prev_end, next_start


def _fmt(x):
    return ("%.6f" % x).rstrip("0").rstrip(".") if x else "0"


def build_filter_script(edl):
    idx = {c["clip"]: i for i, c in enumerate(edl["inputs"])}
    L = []
    for i, s in enumerate(edl["segments"]):
        n = idx[s["clip"]]
        vchain = "[%d:v]trim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS" % (n, s["src_in_frame"], s["src_out_frame"])
        z = s.get("zoom", 1.0)
        if z and abs(z - 1.0) > 1e-6:
            vchain += ",scale=%d:%d:flags=lanczos,crop=%d:%d" % (round(W * z), round(H * z), W, H)
        L.append(vchain + "[v%d];" % i)
        dur = (s["src_out_frame"] - s["src_in_frame"]) / FPS
        a = "[%d:a]atrim=start_sample=%d:end_sample=%d,asetpts=PTS-STARTPTS" % (n, s["src_in_frame"] * SPF, s["src_out_frame"] * SPF)
        if s.get("audio") == "mute":
            a += ",volume=0"
        else:
            if s["fade_in_s"] >= 0.002:
                a += ",afade=t=in:st=0:d=%s" % _fmt(s["fade_in_s"])
            if s["fade_out_s"] >= 0.002:
                a += ",afade=t=out:st=%s:d=%s" % (_fmt(dur - s["fade_out_s"]), _fmt(s["fade_out_s"]))
        L.append(a + "[a%d];" % i)
    k = len(edl["segments"])
    ncw = len(edl["cutaways"])
    L.append("".join("[v%d][a%d]" % (i, i) for i in range(k)) + "concat=n=%d:v=1:a=1[%s][a];" % (k, "vc0" if ncw else "vc"))
    if ncw:
        # fps=30 on both overlay inputs normalizes timestamps/timebases; without it overlay never
        # sees the cutaway frames after a concat (MEASURED here: frame 75 stayed the main shot).
        L.append("[vc0]fps=%d[vc];" % FPS)
    cur = "vc"
    for j, cw in enumerate(edl["cutaways"]):
        n = idx[cw["clip"]]
        t0, t1 = cw["out_in_frame"] / FPS, cw["out_out_frame"] / FPS
        L.append("[%d:v]trim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS+%.6f/TB,fps=%d[cw%d];" % (
            n, cw["src_in_frame"], cw["src_out_frame"], t0, FPS, j))
        L.append("[%s][cw%d]overlay=enable='gte(t,%.6f)*lt(t,%.6f)':eof_action=pass[vo%d];" % (cur, j, t0, t1, j))
        cur = "vo%d" % j
    L.append("[%s]null[v]" % cur)
    return "\n".join(L) + "\n"


def compile_core(proj, variant, cl):
    clips = set()
    for s in cl.get("segments", []) if isinstance(cl.get("segments"), list) else []:
        if isinstance(s, dict):
            if s.get("clip"):
                clips.add(s["clip"])
            if isinstance(s.get("cutaway"), dict) and s["cutaway"].get("clip"):
                clips.add(s["cutaway"]["clip"])
    cache = {}

    def loader(c):
        if c not in cache:
            cache[c] = _load_logs(proj, [c])[c]
        return cache[c]

    errs = validate(cl, variant, loader)
    if errs:
        raise CompileError(errs)
    pads = PROFILES.get(cl.get("profile", "default"))
    if pads is None:
        raise CompileError(["profile must be one of %s" % ", ".join(PROFILES)])

    raw = []  # pre-merge segment records
    errs = []
    for k, s in enumerate(cl["segments"]):
        log = loader(s["clip"])
        D = log["master"]["usable_duration_s"]
        rec = {"cl_idx": k, "clip": s["clip"], "beat": s["beat"], "warnings": [], "allow_tight": bool(s.get("allow_tight")),
               "zoom": float(s.get("zoom", 1.0)), "reason": s.get("reason"), "cutaway_spec": s.get("cutaway")}
        if "first_word" in s:
            words = _words(log)
            a, b = s["first_word"], s["last_word"]
            if rec["allow_tight"] and not s.get("reason"):
                errs.append("seg[%d]: allow_tight needs a reason" % k)
            fi, fo, warns, e, hg, tg, pe, ns = speech_bounds(words, a, b, D, pads, rec["allow_tight"])
            errs += ["seg[%d]: %s" % (k, x) for x in e]
            gaps = [words[i + 1]["start"] - words[i]["end"] for i in range(a, b)]
            if gaps and max(gaps) > 1.0:
                warns.append("LONG_INNER_GAP(%.2fs)" % max(gaps))
            rec.update(kind="speech", first_word=a, last_word=b, src_in_frame=fi, src_out_frame=fo, audio="keep",
                       head_pad_s=words[a]["start"] - fi / FPS, tail_pad_s=fo / FPS - words[b]["end"])
            rec["warnings"] += warns
        else:
            fi, fo = round(s["t_in"] * FPS), min(round(s["t_out"] * FPS), math.floor(D * FPS + 1e-6))
            rec.update(kind="broll", src_in_frame=fi, src_out_frame=fo, audio=s.get("audio", "mute"),
                       head_pad_s=None, tail_pad_s=None)
        raw.append(rec)
    if errs:
        raise CompileError(errs)

    kept, warnings = [], []
    for r in raw:
        if r["src_out_frame"] - r["src_in_frame"] < MIN_SEG * FPS:
            warnings.append("seg[%d] dropped: shorter than %.2fs" % (r["cl_idx"], MIN_SEG))
            r["dropped"] = True
            continue
        if (kept and kept[-1]["clip"] == r["clip"] and kept[-1]["kind"] == r["kind"] == "speech"
                and r["src_in_frame"] >= kept[-1]["src_in_frame"] and r["src_in_frame"] - kept[-1]["src_out_frame"] < 2):
            m = kept[-1]
            m["src_out_frame"] = max(m["src_out_frame"], r["src_out_frame"])
            m["last_word"] = r["last_word"]
            m["tail_pad_s"] = r["tail_pad_s"]
            m["warnings"] += [w for w in r["warnings"] if w not in m["warnings"]]
            m["merged_from"] = m.get("merged_from", [m["cl_idx"]]) + [r["cl_idx"]]
            m["absorbed"] = m.get("absorbed", []) + [r]
            continue
        kept.append(r)
    if not kept:
        raise CompileError(["no segments left after dropping short ones"])

    segments, out_f = [], 0
    for i, r in enumerate(kept):
        n = r["src_out_frame"] - r["src_in_frame"]
        dur = n / FPS
        fade_in = fade_out = 0.0 if r["audio"] == "mute" else min(FADE, dur / 4)
        if r["kind"] == "speech" and r["audio"] != "mute":
            fade_in = max(0.0, min(fade_in, r["head_pad_s"]))
            fade_out = max(0.0, min(fade_out, r["tail_pad_s"]))
        seg = {"idx": i, "kind": r["kind"], "clip": r["clip"], "beat": r["beat"], "src_in_frame": r["src_in_frame"],
               "src_out_frame": r["src_out_frame"], "out_in_frame": out_f, "out_out_frame": out_f + n,
               "audio": r["audio"], "fade_in_s": round(fade_in, 4), "fade_out_s": round(fade_out, 4),
               "zoom": r["zoom"], "allow_tight": r["allow_tight"], "warnings": r["warnings"], "reason": r["reason"]}
        if r["kind"] == "speech":
            seg["first_word"], seg["last_word"] = r["first_word"], r["last_word"]
        seg["_srcs"] = [r["cl_idx"]] + [x["cl_idx"] for x in r.get("absorbed", [])]
        segments.append(seg)
        out_f += n
    total = out_f

    # words.out: every word fully inside a kept range
    out_words, dropped_words = [], []
    for seg in segments:
        if seg["kind"] != "speech":
            continue
        log = loader(seg["clip"])
        base = seg["src_in_frame"] / FPS
        for w in _words(log):
            if w["type"] != "word":
                continue
            lo, hi = seg["src_in_frame"] / FPS - 1e-6, seg["src_out_frame"] / FPS + 1e-6
            if w["end"] > lo and w["start"] < hi:
                if w["start"] >= lo and w["end"] <= hi:
                    os_ = (w["start"] - base) + seg["out_in_frame"] / FPS
                    out_words.append({"n": len(out_words), "clip": seg["clip"], "i": w["i"], "text": w["text"], "norm": w["norm"],
                                      "out_start": round(os_, 3), "out_end": round(os_ + (w["end"] - w["start"]), 3),
                                      "source_start": w["start"], "source_end": w["end"], "seg": seg["idx"]})
                else:
                    dropped_words.append({"clip": seg["clip"], "i": w["i"], "text": w["text"], "seg": seg["idx"]})
    if dropped_words:
        warnings.append("%d word(s) clipped by a segment boundary were dropped: %s" % (
            len(dropped_words), ", ".join("%s:w%d" % (d["clip"], d["i"]) for d in dropped_words)))

    # cutaways
    cutaways = []
    for seg in segments:
        for cl_idx in seg["_srcs"]:
            spec = cl["segments"][cl_idx].get("cutaway")
            if not spec:
                continue
            ow = [w for w in out_words if w["seg"] == seg["idx"] and spec["from_word"] <= w["i"] <= spec["to_word"] and w["clip"] == seg["clip"]]
            if not ow:
                raise CompileError(["seg[%d] cutaway words %d..%d not present in the output (dropped or clipped)" % (cl_idx, spec["from_word"], spec["to_word"])])
            a = max(seg["out_in_frame"], int(math.floor(ow[0]["out_start"] * FPS + 1e-6)))
            b = min(seg["out_out_frame"], int(math.ceil(ow[-1]["out_end"] * FPS - 1e-6)))
            cflog = loader(spec["clip"])
            cf_in = round(spec["t_in"] * FPS)
            cf_out = cf_in + (b - a)
            if cf_out > math.floor(cflog["master"]["usable_duration_s"] * FPS + 1e-6) or spec["t_out"] - spec["t_in"] < (b - a) / FPS - 1.0 / FPS:
                raise CompileError(["seg[%d] CUTAWAY_TOO_SHORT: window needs %.2fs of %s but t_in..t_out gives %.2fs" % (
                    cl_idx, (b - a) / FPS, spec["clip"], spec["t_out"] - spec["t_in"])])
            cutaways.append({"seg": seg["idx"], "clip": spec["clip"], "src_in_frame": cf_in, "src_out_frame": cf_out,
                             "out_in_frame": a, "out_out_frame": b})
    for seg in segments:
        seg.pop("_srcs")

    # emphasis: "c001:31" strings or plain ints (output word index n)
    emph = []
    for e in (cl.get("captions") or {}).get("emphasis_words", []) or []:
        if isinstance(e, int):
            emph.append(e)
        elif isinstance(e, str) and ":" in e:
            c, i = e.split(":", 1)
            for w in out_words:
                if w["clip"] == c and str(w["i"]) == i:
                    emph.append(w["n"])

    # beat timeline + warnings
    timeline = []
    for seg in segments:
        if timeline and timeline[-1]["beat"] == seg["beat"]:
            timeline[-1]["end_s"] = seg["out_out_frame"] / FPS
        else:
            timeline.append({"beat": seg["beat"], "start_s": seg["out_in_frame"] / FPS, "end_s": seg["out_out_frame"] / FPS})
    for t in timeline:
        t["start_s"], t["end_s"] = round(t["start_s"], 3), round(t["end_s"], 3)
    if timeline[0]["beat"] not in ("HOOK",):
        warnings.append("first beat is %s, not HOOK" % timeline[0]["beat"])
    for t in timeline:
        if t["beat"] == "HOOK" and t["end_s"] > HOOK_MAX_END_S:
            warnings.append("HOOK ends at %.2fs (> %.1fs; SAID by the ecommerce repo, not measured by us)" % (t["end_s"], HOOK_MAX_END_S))
        if t["beat"] == "CTA" and t["end_s"] - t["start_s"] < CTA_MIN_S:
            warnings.append("CTA lasts %.2fs (< %.1fs)" % (t["end_s"] - t["start_s"], CTA_MIN_S))
    tgt = (cl.get("target") or {}).get("duration_s")
    if tgt and not (tgt[0] <= total / FPS <= tgt[1]):
        warnings.append("duration %.2fs outside target %s" % (total / FPS, tgt))
    for seg in segments:
        for w in seg["warnings"]:
            warnings.append("seg[%d] %s" % (seg["idx"], w))

    order = []
    for s in segments:
        if s["clip"] not in order:
            order.append(s["clip"])
    for c in cutaways:
        if c["clip"] not in order:
            order.append(c["clip"])
    edl = {"schema": "edl/1", "variant": variant, "fps": FPS, "sr": SR, "profile": cl.get("profile", "default"),
           "inputs": [{"clip": c, "path": loader(c)["master"]["path"]} for c in order],
           "segments": segments, "cutaways": cutaways, "total_frames": total, "total_s": round(total / FPS, 3),
           "target": cl.get("target"), "beats": timeline, "emphasis_out": emph, "warnings": warnings,
           "caption_style": (cl.get("captions") or {}).get("style", "default-v1"),
           "caption_text": cl.get("caption")}
    return edl, out_words, dropped_words


def cmd_compile(batch, variant, reset_attempts=False):
    proj = require_project(batch)
    check_variant(variant)
    cut = proj / "cuts" / ("%s.cutlist.json" % variant)
    if not cut.is_file():
        raise PipelineError("missing %s" % rel(cut))
    bdir = proj / "build" / variant
    bdir.mkdir(parents=True, exist_ok=True)
    att_p = bdir / "attempts.json"
    att = read_json(att_p) if att_p.is_file() else {"failures": 0}
    if reset_attempts:
        att = {"failures": 0}
    if att["failures"] >= MAX_ATTEMPTS:
        print("STOP: the compiler rejected this cut-list %d times (RULE 7). Hand it to the human; "
              "after a person has looked, re-run with --reset-attempts." % att["failures"], file=sys.stderr)
        return 4
    try:
        cl = read_json(cut)
    except Exception as e:
        att["failures"] += 1
        write_json(att_p, att)
        print("ERROR: cutlist is not valid JSON: %s (attempt %d/%d)" % (e, att["failures"], MAX_ATTEMPTS), file=sys.stderr)
        return 1
    try:
        edl, out_words, dropped = compile_core(proj, variant, cl)
    except CompileError as e:
        att["failures"] += 1
        write_json(att_p, att)
        print("COMPILE FAILED (attempt %d/%d):" % (att["failures"], MAX_ATTEMPTS), file=sys.stderr)
        for x in e.errors:
            print("  - " + x, file=sys.stderr)
        if att["failures"] >= MAX_ATTEMPTS:
            print("  That was the last allowed repair round. Stop and hand to the human (RULE 7).", file=sys.stderr)
        return 1
    edl["cutlist_sha256"] = sha256_file(cut)
    write_json(bdir / "edl.json", edl)
    (bdir / "cut.fc").write_text(build_filter_script(edl), encoding="utf-8")
    write_json(bdir / "words.out.json", {"schema": "words-out/1", "variant": variant, "fps": FPS,
                                          "words": out_words, "dropped": dropped})
    write_json(att_p, {"failures": 0})
    info("compiled %s: %d segment(s), %d frames = %.2fs, %d output words" % (variant, len(edl["segments"]), edl["total_frames"], edl["total_s"], len(out_words)))
    info("beat timeline: " + "  ".join("%s %.2f-%.2f" % (t["beat"], t["start_s"], t["end_s"]) for t in edl["beats"]))
    for w in edl["warnings"]:
        warn(w)
    return 0
