#!/usr/bin/env python3
"""End-to-end + negative-control tests for the pipeline. Run through tests/run.sh (it sets PIPELINE_ROOT)."""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
PIPE = HERE.parent
sys.path.insert(0, str(PIPE))
TMP = Path(sys.argv[1])
ROOT = Path(os.environ["PIPELINE_ROOT"])
assert str(ROOT).startswith(str(TMP)), "tests must only write under the temp dir"

import analyze as A          # noqa: E402
import captions as CAP       # noqa: E402
import compiler as C         # noqa: E402
import hlg                   # noqa: E402
import qa as QA              # noqa: E402
import render as R           # noqa: E402
from common import *         # noqa: E402,F403

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print("%s  %s%s" % ("PASS" if ok else "FAIL", name, ("   [" + str(detail)[:230] + "]") if (detail and not ok) else ""), flush=True)
    return bool(ok)


def cli(*args):
    p = subprocess.run([sys.executable, str(PIPE / "pipeline.py")] + [str(a) for a in args], capture_output=True, text=True,
                       env=dict(os.environ, PIPELINE_REEXEC="1"))
    return p.returncode, p.stdout, p.stderr


def sh(cmd):
    p = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError("fixture command failed: %s\n%s" % (cmd[:4], p.stderr[-600:]))


# ------------------------------------------------------------------ fixtures
def groups_to_words(groups, t0=0.4, spacing=2.5, step=0.5, wdur=0.3):
    words = []
    for g, texts in enumerate(groups):
        for k, t in enumerate(texts):
            s = t0 + g * spacing + k * step
            words.append({"text": t, "start": round(s, 3), "end": round(s + wdur, 3)})
    return words


def make_clip(path, dur, words, phase, extra_beeps=(), hdr=False):
    terms = ["between(t,%.3f,%.3f)" % (w["start"], w["end"]) for w in words] + ["between(t,%.3f,%.3f)" % b for b in extra_beeps]
    expr = "0.35*sin(2*PI*440*t)*(%s)" % ("+".join(terms) if terms else "0")
    vsrc = ("color=c=gray:s=135x240:r=30:d=%s,format=yuv420p,"
            "geq=lum='128+100*sin(X/5+N*0.9+%s)*sin(Y/7+N*0.5)':cb=128:cr=128,scale=1080:1920:flags=bicubic,format=%s"
            % (dur, phase, "yuv420p10le" if hdr else "yuv420p"))
    if hdr:
        venc = ["-c:v", "libx265", "-crf", "20", "-pix_fmt", "yuv420p10le", "-tag:v", "hvc1",
                "-x265-params", "colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:log-level=error",
                "-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc"]
    else:
        venc = ["-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p"]
    sh([FFMPEG, "-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", vsrc, "-f", "lavfi", "-i",
        "aevalsrc='%s':s=44100:d=%s" % (expr, dur)] + venc + ["-c:a", "aac", "-b:a", "128k", "-ac", "1", "-shortest", str(path)])


A_GROUPS = [["I", "love", "this", "blender."], ["It", "crushes", "ice", "fast."],
            ["Cleanup", "takes", "one", "minute."], ["Tap", "the", "cart", "below."]]
B_GROUPS = [["Honestly", "this", "changed", "mornings."], ["Mine", "arrived", "super", "fast."],
            ["Mine", "arrived", "super", "fast", "too."]]
B_GROUPS[2] = ["Mine", "arrived", "super", "fast."]  # same sentence again: a retake candidate
D_WORDS = [{"text": t, "start": s, "end": round(s + 0.32, 3)} for t, s in zip(["Quick", "tight", "words", "here"], [0.3, 0.7, 1.1, 1.5])]


def seg(clip, a, b, beat, quote, **kw):
    d = {"clip": clip, "first_word": a, "last_word": b, "beat": beat, "quote": quote, "reason": "test"}
    d.update(kw)
    return d


def cutlist(variant, segments, rng=(3, 60), **kw):
    d = {"schema": "cutlist/1", "variant_id": variant, "target": {"duration_s": list(rng), "aspect": "9:16"},
         "segments": segments, "captions": {"style": "default-v1", "emphasis_words": ["c001:6"]}}
    d.update(kw)
    return d


V01 = lambda name: cutlist(name, [  # noqa: E731
    seg("c001", 0, 3, "HOOK", "I love this blender."),
    seg("c001", 4, 7, "SOLUTION", "It crushes ice fast.",
        cutaway={"clip": "c002", "t_in": 1.0, "t_out": 2.5, "from_word": 5, "to_word": 6}),
    seg("c001", 8, 11, "PROOF", "Cleanup takes one minute."),
    seg("c001", 12, 15, "CTA", "Tap the cart below.")])
V02 = cutlist("v02", [
    seg("c002", 0, 3, "HOOK", "Honestly this changed mornings."),
    seg("c002", 4, 7, "PROOF", "Mine arrived super fast."),
    seg("c001", 12, 15, "CTA", "Tap the cart below.")])


def main():
    t_start = time.time()
    (ROOT / "studio" / "inbox").mkdir(parents=True)
    (ROOT / "studio" / "projects").mkdir(parents=True)
    (ROOT / "studio" / "ready").mkdir(parents=True)
    brief = ROOT / "shop" / "products" / "blender"
    brief.mkdir(parents=True)
    (brief / "brief.md").write_text("# Mini Blender\n\n## Selling points (3-5, in plain words)\n1. Crushes ice\n2. Rinses clean in a minute\n3. Quiet motor\n\n"
                                    "## Claims to avoid\n- miracle\n(Anything medical)\n", encoding="utf-8")
    inbox = ROOT / "studio" / "inbox"
    print("== building fixtures ==", flush=True)
    a_w, b_w = groups_to_words(A_GROUPS), groups_to_words(B_GROUPS)
    make_clip(inbox / "a_main.mov", 10.5, a_w, 0.0)
    make_clip(inbox / "b_cut.mov", 9.0, b_w, 2.0, extra_beeps=[(2.45, 2.65)])
    make_clip(inbox / "c_hlg.mov", 2.0, [], 1.0, hdr=True)
    make_clip(inbox / "d_tight.mov", 3.0, D_WORDS, 3.0)
    src_hash = {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in inbox.iterdir()}
    check("fixtures: 4 clips built in temp dir", len(src_hash) == 4)

    # ---------------------------------------------------------------- new
    print("== new ==")
    rc, out, err = cli("new", "t1", "--product", "blender")
    proj = ROOT / "studio" / "projects" / "t1"
    check("new: exit 0 and folders exist", rc == 0 and all((proj / d).is_dir() for d in ["raw", "master", "log", "plan", "cuts", "build", "qa"]), err)
    prod = read_json(proj / "plan" / "product.json")
    check("new: product.json prefilled (name, points, banned defaults + brief claims)",
          prod["name"] == "Mini Blender" and len(prod["selling_points"]) == 3 and "miracle" in prod["banned_claims"] and "guaranteed" in prod["banned_claims"], prod)
    prod["duration_range_s"] = [3, 60]
    write_json(proj / "plan" / "product.json", prod)

    # ---------------------------------------------------------------- ingest
    print("== ingest ==")
    rc, out, err = cli("ingest", "t1")
    check("ingest: exit 0", rc == 0, err[-300:])
    check("ingest: inbox emptied, 4 files in raw/, raw content unchanged",
          not [f for f in inbox.iterdir()] and {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in (proj / "raw").iterdir()} == src_hash)
    led = read_json(proj / "log" / "ingest.json")
    check("ingest: 4 clips c001..c004 status ok", sorted(led["clips"]) == ["c001", "c002", "c003", "c004"] and all(v["status"] == "ok" for v in led["clips"].values()), led)
    for cid in ("c001", "c003"):
        ok, problems, facts = __import__("ingest").master_gate(proj / "master" / ("%s.mov" % cid))
        check("ingest: %s master passes the spec 4.6 gate (1080x1920, 30/1, bt709 tv, 48k, frames=dur)" % cid, ok, problems)
    l3 = read_json(proj / "log" / "c003.clip.json")
    check("ingest: HLG clip detected and tone-mapped by the LUT chain", l3["master"]["hdr_detected"] is True and l3["master"]["tonemap"] == "lut-hlg"
          and l3["source"]["ffprobe"]["color_transfer"] == "arib-std-b67", l3["master"])
    p1 = ffprobe_json(proj / "master" / "c001.mov")
    check("ingest: mono 44.1k source became stereo 48k PCM", [s for s in p1["streams"] if s["codec_type"] == "audio"][0]["channels"] == 2)

    # ---------------------------------------------------------------- analyze
    print("== analyze ==")
    if A.find_parakeet() is None and not which("whisper-cli"):
        rc, out, err = cli("analyze", "t1")
        check("analyze: with no engine and no words.json, exits 3 with install instructions", rc == 3 and "No transcription engine" in err, (rc, err[-200:]))
    else:
        print("SKIP  analyze no-engine message (a transcriber is installed on this machine)")
    for cid, w in (("c001", a_w), ("c002", b_w), ("c003", []), ("c004", D_WORDS)):
        write_json(proj / "log" / ("%s.words.json" % cid), {"words": w})
    rc, out, err = cli("analyze", "t1")
    check("analyze: exit 0 using words.json transcripts", rc == 0, err[-400:])
    l1 = read_json(proj / "log" / "c001.clip.json")
    l2 = read_json(proj / "log" / "c002.clip.json")
    check("analyze: c001 has 16 words, 4 phrases, schema clip-log/1", l1["schema"] == "clip-log/1" and len([w for w in l1["transcript"]["words"] if w["type"] == "word"]) == 16 and len(l1["phrases"]) == 4, l1.get("phrases"))
    kinds = [s["kind"] for s in l1["silences"]]
    check("analyze: silences head=1 inter=3 tail=1", kinds.count("head") == 1 and kinds.count("inter") == 3 and kinds.count("tail") == 1, kinds)
    check("analyze: c002 beep with no word is caught as unaccounted_speech near 2.45s",
          any(abs(u["start"] - 2.45) < 0.15 for u in l2["unaccounted_speech"]), l2["unaccounted_speech"])
    check("analyze: c001 has no unaccounted speech", l1["unaccounted_speech"] == [], l1["unaccounted_speech"])
    check("analyze: c002 repeated sentence is a retake candidate", len(l2["retake_groups"]) >= 1, l2["retake_groups"])
    check("analyze: quality + audio + thumbs filled", l1["quality"]["yavg_mean"] and l1["audio"]["integrated_lufs"] and l1["thumbs"], (l1["quality"], l1["audio"]))
    l3 = read_json(proj / "log" / "c003.clip.json")
    check("analyze: HLG master exposure is sane (tone-map did not crush or blow out)", 30 < l3["quality"]["yavg_mean"] < 230, l3["quality"]["yavg_mean"])
    packed = (proj / "log" / "packed.md").read_text(encoding="utf-8")
    check("analyze: packed.md has index ranges, gaps, the unaccounted warning and the retake line",
          "[w000-w003 |" in packed and "gap 0.70" in packed and "unaccounted" in packed and "retake group" in packed, packed[:500])
    mt = (proj / "log" / "c001.clip.json").stat().st_mtime
    rc, out, err = cli("analyze", "t1")
    check("analyze: second run is cached (no re-transcription of unchanged masters)", rc == 0 and "cached" in out and (proj / "log" / "c001.clip.json").stat().st_mtime == mt)

    # ---------------------------------------------------------------- compile: good + rules
    print("== compile ==")
    for name, cl in (("v01", V01("v01")), ("v02", V02), ("v03", V01("v03"))):
        write_json(proj / "cuts" / ("%s.cutlist.json" % name), cl)
        rc, out, err = cli("compile", "t1", name)
        check("compile %s: exit 0" % name, rc == 0, err[-400:])
    edl = read_json(proj / "build" / "v01" / "edl.json")
    wo = read_json(proj / "build" / "v01" / "words.out.json")
    check("compile v01: 4 segments, whole frames, 1 cutaway, contiguous out timeline",
          len(edl["segments"]) == 4 and len(edl["cutaways"]) == 1 and edl["segments"][1]["out_in_frame"] == edl["segments"][0]["out_out_frame"]
          and edl["total_frames"] == edl["segments"][-1]["out_out_frame"], edl["segments"])
    s0 = edl["segments"][0]
    check("compile v01: first cut = 0.05s before word 0 (frame-snapped outward) and no mid-word cut",
          s0["src_in_frame"] == 10 and s0["src_out_frame"] == 69, (s0["src_in_frame"], s0["src_out_frame"]))
    check("compile v01: words.out has all 16 words, cutaway window lies on words 5-6",
          len(wo["words"]) == 16 and edl["cutaways"][0]["out_in_frame"] >= edl["segments"][1]["out_in_frame"], len(wo["words"]))
    fc = (proj / "build" / "v01" / "cut.fc").read_text()
    check("compile v01: cut.fc is one trim/atrim/concat graph with sample-integer cuts and an overlay for the cutaway",
          fc.count("trim=start_frame") == 5 and "atrim=start_sample=16000:" in fc and "concat=n=4:v=1:a=1" in fc and "overlay=enable=" in fc, fc[:400])
    check("compile v01: fades are 30ms and last word is protected", "afade=t=in:st=0:d=0.03" in fc and "afade=t=out" in fc)

    def bad(name, cl):
        write_json(proj / "cuts" / ("%s.cutlist.json" % name), cl)
        return cli("compile", "t1", name)

    cl = cutlist("n_quote", [seg("c001", 0, 3, "HOOK", "I love this mixer.")])
    rc, out, err = bad("n_quote", cl)
    check("NEG quote mismatch: compile fails (RULE 2)", rc == 1 and "quote mismatch" in err, err)
    rc, out, err = bad("n_range", cutlist("n_range", [seg("c001", 14, 40, "HOOK", "x")]))
    check("NEG word index out of range: compile fails (RULE 1)", rc == 1 and "RULE 1" in err, err)
    rc, out, err = bad("n_secs", cutlist("n_secs", [dict(seg("c001", 0, 3, "HOOK", "I love this blender."), t_in=0.5, t_out=2.0)]))
    check("NEG speech segment written in seconds: compile fails (RULE 1)", rc == 1 and "word index only" in err, err)
    rc, out, err = bad("n_noncontig", cutlist("n_noncontig", [seg("c001", 0, 7, "HOOK", "I love this blender it crushes ice fast", removed_words=[[4, 5]])]))
    check("NEG segment spanning a removed interval: compile fails (RULE 3)", rc == 1 and "RULE 3" in err, err)
    rc, out, err = bad("n_skip", cutlist("n_skip", [dict(seg("c001", 0, 3, "HOOK", "I love this blender."), words=[0, 1, 3])]))
    check("NEG non-contiguous word list: compile fails (RULE 3)", rc == 1 and "non-contiguous" in err, err)
    rc, out, err = bad("n_cw", cutlist("n_cw", [seg("c001", 4, 7, "HOOK", "It crushes ice fast.", cutaway={"clip": "c002", "t_in": 1.0, "t_out": 1.2, "from_word": 5, "to_word": 6})]))
    check("NEG cutaway source window too short: compile fails (RULE 4)", rc == 1 and "CUTAWAY_TOO_SHORT" in err, err)
    rc, out, err = bad("n_beat", cutlist("n_beat", [seg("c001", 0, 3, "INTRO", "I love this blender.")]))
    check("NEG unknown beat: compile fails (RULE 6)", rc == 1 and "RULE 6" in err, err)
    rc, out, err = bad("n_broll", cutlist("n_broll", [{"clip": "c003", "t_in": 0.0, "t_out": 1.5, "beat": "PROOF", "audio": "mute"}]))
    check("compile: non-speech b-roll segment (RULE 5) is accepted", rc == 0, err)
    tight_seg = seg("c004", 1, 2, "HOOK", "tight words")
    rc, out, err = bad("n_tight", cutlist("n_tight", [tight_seg]))
    check("NEG mid-word/tight index (0.08s gaps): compile fails TIGHT_HEAD/TIGHT_TAIL without allow_tight", rc == 1 and "TIGHT_HEAD" in err and "TIGHT_TAIL" in err, err)
    rc, out, err = bad("ok_tight", cutlist("ok_tight", [dict(tight_seg, allow_tight=True, reason="test: filler-free hard join")]))
    e2 = read_json(proj / "build" / "ok_tight" / "edl.json") if rc == 0 else {}
    check("compile: allow_tight with a reason passes and keeps the warnings", rc == 0 and any("TIGHT_HEAD" in w for w in e2.get("warnings", [])), err)
    g = cutlist("n_strike", [seg("c001", 0, 3, "HOOK", "wrong words here")])
    rcs = []
    for _ in range(3):
        rcs.append(bad("n_strike", g)[0])
    write_json(proj / "cuts" / "n_strike.cutlist.json", cutlist("n_strike", [seg("c001", 0, 3, "HOOK", "I love this blender.")]))
    rc4, out, err = cli("compile", "t1", "n_strike")
    check("NEG rule 7: three rejected rounds, then even a valid list is refused (exit 4, hand to human)", rcs == [1, 1, 1] and rc4 == 4 and "RULE 7" in err, (rcs, rc4, err))
    rc5, out, err = cli("compile", "t1", "n_strike", "--reset-attempts")
    check("rule 7: --reset-attempts (a human looked) allows the compile", rc5 == 0, err)

    # ---------------------------------------------------------------- render + qa
    print("== render v01 ==")
    rc, out, err = cli("render", "t1", "v01")
    check("render v01: exit 0", rc == 0, err[-500:])
    bd = proj / "build" / "v01"
    check("render v01: cut.mov, final.mp4, clean.mp4, caps/boxes.json, caps/cues.json exist",
          all((bd / f).is_file() for f in ("cut.mov", "final.mp4", "clean.mp4", "caps/boxes.json", "caps/cues.json", "render.json")))
    rj = read_json(bd / "render.json")
    check("render v01: encoded audio measured -14 LUFS +/-1 and TP <= -1.0", abs(rj["loudness"]["final"]["I"] + 14) <= 1.0 and rj["loudness"]["final"]["TP"] <= -1.0, rj["loudness"])
    boxes = read_json(bd / "caps" / "boxes.json")
    check("render v01: every caption box inside the safe rectangle x151-929 y200-1498",
          all(b["box"][0] >= 151 and b["box"][1] >= 200 and b["box"][2] <= 929 and b["box"][3] <= 1498 for b in boxes["cues"]), boxes["cues"][:2])
    cues = read_json(bd / "caps" / "cues.json")["cues"]
    check("render v01: cue chunks are 1-3 words and the emphasis word's cue is flagged",
          all(1 <= len(c["words"]) <= 3 for c in cues) and any(c["emphasis"] for c in cues), [c["text"] for c in cues][:8])

    for junk in [p for p in (proj / "build").iterdir() if p.name not in ("v01", "v02", "v03")]:
        shutil.rmtree(junk)   # keep the similarity run to the three real variants (junk builds from the compile-rule tests)
    print("== similarity ==")
    rc, out, err = cli("similarity", "t1")
    sim = read_json(proj / "qa" / "similarity.json")
    pairs = {(p["a"], p["b"]): p for p in sim["pairs"]}
    check("NEG near-duplicate pair (v01 vs v03, same footage and order): flagged, exit 1", rc == 1 and pairs[("v01", "v03")]["flag"] and pairs[("v01", "v03")]["blocked"] == ["v03"], pairs.get(("v01", "v03")))
    check("similarity: different footage (v01 vs v02) is not flagged", not pairs[("v01", "v02")]["flag"], pairs[("v01", "v02")])

    print("== qa v01 (good fixture) ==")
    rc, out, err = cli("qa", "t1", "v01")
    rep = read_json(proj / "qa" / "v01" / "report.json")
    check("qa v01: PASSES end to end (exit 0, no hard fails)", rc == 0 and rep["passed"], [(c["gate"], c["detail"]) for c in rep["hard_fails"] and rep["checks"] if c["status"] == "fail"] or err[-300:])
    gates = {c["gate"] for c in rep["checks"]}
    need = {"spec:final:res", "spec:final:fps", "spec:final:color", "duration:video", "frame-identity", "mid-word", "tight-cuts",
            "words-whole", "captions-match-words", "caption-safe-zone", "caption-pixel-timing", "caption-contrast", "loudness:final", "banned-claims", "near-duplicate"}
    check("qa v01: every runnable gate of spec 4.12 reported", need <= gates, need - gates)
    qd = proj / "qa" / "v01"
    check("qa v01: judge material written (sheet.png + sheet.json, strips/, first25.png, safe.png)",
          all((qd / f).is_file() for f in ("sheet.png", "sheet.json", "first25.png", "safe.png")) and len(list((qd / "strips").glob("cut_*.png"))) == 3, rep["artifacts"])
    fi = [c for c in rep["checks"] if c["gate"] == "frame-identity"][0]
    check("qa v01: frame identity compared segment edges and the cutaway edges", "frame pairs" in fi["detail"] and int(fi["detail"].split()[0]) >= 10, fi["detail"])

    # ---------------------------------------------------------------- negative controls on copies of the good build
    print("== negative controls (each must FAIL its gate) ==")

    def clone(name):
        d = proj / "build" / name
        if d.exists():
            shutil.rmtree(d)
        shutil.copytree(bd, d)
        return d

    def run_qa(name):
        rc, out, err = cli("qa", "t1", name)
        r = read_json(proj / "qa" / name / "report.json")
        return rc, {c["gate"]: c for c in r["checks"]}

    total = edl["total_frames"]
    cues_full = read_json(bd / "caps" / "cues.json")["cues"]

    # 1. caption shifted 0.3 s in the video (metadata still says the right times)
    d = clone("n_shift")
    shifted = [dict(c, start_f=c["start_f"] + 9, end_f=c["end_f"] + 9) for c in cues_full]
    CAP.build_caption_assets(shifted, d / "caps", total)
    R.composite_final(proj, Path("build/n_shift"), total, True, preset="veryfast")
    write_json(d / "caps" / "cues.json", {"schema": "cues/1", "fps": FPS, "cues": cues_full})
    rc, g = run_qa("n_shift")
    check("NEG caption shifted 0.3s: caption-pixel-timing FAILS (code caption-wrong), exit 1", rc == 1 and g["caption-pixel-timing"]["status"] == "fail" and g["caption-pixel-timing"]["code"] == "caption-wrong", g["caption-pixel-timing"])

    # 2. caption outside the safe box
    d = clone("n_box")
    CAP.build_caption_assets(cues_full, d / "caps", total, y_center=1700, clamp=False)
    R.composite_final(proj, Path("build/n_box"), total, True, preset="veryfast")
    rc, g = run_qa("n_box")
    check("NEG caption outside safe box (y~1700): caption-safe-zone FAILS (code safe-zone)", rc == 1 and g["caption-safe-zone"]["status"] == "fail" and g["caption-safe-zone"]["code"] == "safe-zone", g["caption-safe-zone"])

    # 3. cut one frame off
    d = clone("n_frame")
    e = read_json(d / "edl.json")
    e["segments"][1]["src_in_frame"] += 1
    write_json(d / "edl.json", e)
    rc, g = run_qa("n_frame")
    check("NEG cut one frame off: frame-identity FAILS", rc == 1 and g["frame-identity"]["status"] == "fail", g["frame-identity"])

    # 4. dropped word
    d = clone("n_drop")
    w = read_json(d / "words.out.json")
    w["words"] = [x for x in w["words"] if x["n"] != 5]
    write_json(d / "words.out.json", w)
    rc, g = run_qa("n_drop")
    check("NEG dropped word: words-whole FAILS (code caption-wrong)", rc == 1 and g["words-whole"]["status"] == "fail" and g["words-whole"]["code"] == "caption-wrong", g["words-whole"])

    # 5. cut lands inside a word
    d = clone("n_mid")
    e = read_json(d / "edl.json")
    e["segments"][0]["src_out_frame"] = 46          # 1.533 s is inside word 2 (1.40-1.70)
    write_json(d / "edl.json", e)
    rc, g = run_qa("n_mid")
    check("NEG mid-word cut: mid-word gate FAILS", rc == 1 and g["mid-word"]["status"] == "fail" and g["mid-word"]["code"] == "mid-word", g["mid-word"])

    # 5b. TIGHT warning without allow_tight smuggled into the edl
    d = clone("n_tightqa")
    e = read_json(d / "edl.json")
    e["segments"][2]["warnings"].append("TIGHT_HEAD")
    write_json(d / "edl.json", e)
    rc, g = run_qa("n_tightqa")
    check("NEG unexplained TIGHT_HEAD in the edl: tight-cuts FAILS", rc == 1 and g["tight-cuts"]["status"] == "fail", g["tight-cuts"])

    # 6. banned claims / disclaimer / links (lint unit + gate on a clone)
    hits, need_, present = QA.lint_claims([(i, t) for i, t in enumerate("this is guaranteed to cure acne".split())], prod)
    check("NEG banned-claim lint: 'guaranteed' and 'cure' are caught", {h["match"].lower() for h in hits} >= {"guaranteed", "cure"}, hits)
    hits, need_, present = QA.lint_claims([(i, t) for i, t in enumerate("a miracle at www.shop.com or @someone call 555-123-4567".split())], prod)
    check("NEG banned-claim lint: product term, link, handle, phone are caught", {h["term"] for h in hits} >= {"miracle", "link", "handle", "phone number"}, hits)
    hits, need_, present = QA.lint_claims([(i, t) for i, t in enumerate("see the difference in 7 days".split())], prod)
    check("NEG time-bound claim without 'results may vary' needs a disclaimer", bool(need_) and not present, need_)
    hits, need_, present = QA.lint_claims([(i, t) for i, t in enumerate("in 7 days results may vary".split())], prod)
    check("time-bound claim with 'results may vary' is satisfied", bool(need_) and present)
    hits, need_, present = QA.lint_claims([(i, t) for i, t in enumerate("I love this blender it crushes ice".split())], prod)
    check("clean sentence: no hits, no disclaimer needed", not hits and not need_)
    d = clone("n_claim")
    w = read_json(d / "words.out.json")
    w["words"][2]["text"] = "guaranteed"
    write_json(d / "words.out.json", w)
    rc, g = run_qa("n_claim")
    check("NEG 'guaranteed' in the transcript of a build: banned-claims FAILS (code banned-claim)", rc == 1 and g["banned-claims"]["status"] == "fail" and g["banned-claims"]["code"] == "banned-claim", g["banned-claims"])

    # ---------------------------------------------------------------- unit checks
    print("== unit checks ==")
    pk = {"sentences": [{"tokens": [{"text": " Hel", "start": 0.0, "end": 0.2}, {"text": "lo,", "start": 0.2, "end": 0.4}, {"text": " world", "start": 0.5, "end": 0.9}]}]}
    pw = A.parse_parakeet(pk)
    check("parser: parakeet tokens merge into words with punctuation attached", [w["text"] for w in pw] == ["Hello,", "world"] and pw[0]["end"] == 0.4, pw)
    wc = {"transcription": [{"text": " Hello", "offsets": {"from": 100, "to": 400}}, {"text": ",", "offsets": {"from": 400, "to": 450}}, {"text": " [BLANK_AUDIO]", "offsets": {"from": 500, "to": 900}}]}
    ww = A.parse_whisper_cpp(wc)
    check("parser: whisper.cpp offsets (ms) become seconds, events kept", ww[0]["text"] == "Hello," and ww[0]["end"] == 0.45 and ww[1]["text"] == "[BLANK_AUDIO]", ww)
    check("loudness planner: no headroom -> limiter path (spec finding 8: -16.65 LUFS / -3.17 dBTP)", R.plan_gain({"input_i": -16.65, "input_tp": -3.17})["mode"] == "limiter")
    check("loudness planner: headroom -> linear; near-silence -> skipped",
          R.plan_gain({"input_i": -20, "input_tp": -12})["mode"] == "linear" and R.plan_gain({"input_i": -45, "input_tp": -30})["mode"] == "skip")
    import qa as Q, captions as CP, compiler as CMP
    from PIL import Image as _I, ImageDraw as _D
    tmpc = ROOT / "contrast"; tmpc.mkdir(exist_ok=True)
    def _frame(bg, text_fill, stroke):
        im = _I.new("RGB", (400, 200), bg); d = _D.Draw(im)
        if text_fill:
            d.text((40, 60), "HELLO", fill=text_fill, font=CP.load_font(72), stroke_width=stroke, stroke_fill=(0, 0, 0))
        return im
    _frame((240, 240, 240), None, 0).save(tmpc / "clean.png")
    _frame((240, 240, 240), (255, 255, 255), 0).save(tmpc / "white_on_white.png")
    _frame((240, 240, 240), (255, 255, 255), 4).save(tmpc / "native.png")
    _frame((128, 128, 128), None, 0).save(tmpc / "clean_mid.png")
    _frame((128, 128, 128), (255, 255, 255), 0).save(tmpc / "nostroke_mid.png")
    bx = [0, 0, 400, 200]
    check("NEG contrast: white text, no stroke, on a light background FAILS (measured, < 3.0)", Q.caption_contrast(tmpc / "white_on_white.png", tmpc / "clean.png", bx) < Q.CONTRAST_MIN)
    check("NEG contrast: white text, no stroke, on mid-grey FAILS (uniform caption pixels)", Q.caption_contrast(tmpc / "nostroke_mid.png", tmpc / "clean_mid.png", bx) < Q.CONTRAST_MIN)
    check("contrast: native white + 4px black stroke on a light background PASSES", Q.caption_contrast(tmpc / "native.png", tmpc / "clean.png", bx) >= Q.CONTRAST_MIN)
    try:
        CMP._headline({"text": "x", "t_out": 9}, 900); hl_ok = False
    except CMP.CompileError:
        hl_ok = True
    check("NEG headline: t_out over 6 s is a compile error (hook payload rule)", hl_ok)
    hd = ROOT / "hlcaps"
    hb = CP.build_caption_assets([], hd, 120, headline=CMP._headline({"text": "$12 and it replaced my $80 one", "t_out": 2.5}, 120))
    bj = json.loads((hd / "boxes.json").read_text())
    lt = (hd / "list.txt").read_text()
    check("headline: rendered into the first 2.5 s only, box inside the safe zone",
          bj["headline"] and "hl_blank.png" in lt and "duration 2.500000" in lt and bj["headline"]["box"][1] >= 200, lt[:200])
    vf = hlg.hlg_to_sdr_vf()
    check("hlg: LUT chain generator has no zscale/comments and ends tagged bt709", "zscale" not in vf and vf.count("lutrgb") == 2 and vf.endswith("range=tv"))

    # ---------------------------------------------------------------- deliver
    print("== deliver ==")
    ready = ROOT / "studio" / "ready" / "t1"
    write_json(proj / "qa" / "v01" / "judge.json", {"verdict": "fail", "judge": "test-judge"})
    rc, out, err = cli("deliver", "t1")
    check("deliver: judge verdict fail -> v01 held, nothing copied", not (ready / "v01.mp4").exists() and "judge verdict" in out, out)
    write_json(proj / "qa" / "v01" / "judge.json", {"verdict": "pass", "judge": "test-judge"})
    rc, out, err = cli("deliver", "t1")
    check("NEG deliver: judge pass WITHOUT report_sha256 is held (the maker can't hand-write a pass)", not (ready / "v01.mp4").exists() and "report_sha256" in out, out)
    rsha = hashlib.sha256((proj / "qa" / "v01" / "report.json").read_bytes()).hexdigest()
    write_json(proj / "qa" / "v01" / "judge.json", {"verdict": "pass", "judge": "test-judge", "report_sha256": rsha})
    ep = bd / "edl.json"; e0 = ep.read_text()
    e = json.loads(e0); e["caption_text"] = "This Game-Changer Will Elevate Your Routine!! link in bio"; ep.write_text(json.dumps(e))
    rc, out, err = cli("deliver", "t1")
    check("NEG deliver: a slop caption is held (slop_lint)", not (ready / "v01.mp4").exists() and "slop" in out, out)
    e["caption_text"] = "ok this thing actually fits in my cup holder"; ep.write_text(json.dumps(e))
    rc, out, err = cli("deliver", "t1")
    check("deliver: v01 (qa pass + judge pass) delivered with clean master, caption.txt and POSTING-CHECKLIST.md",
          all((ready / f).is_file() for f in ("v01.mp4", "v01.clean.mp4", "v01.caption.txt", "POSTING-CHECKLIST.md")), out)
    check("deliver: checklist says disclose, product link at post time, Commercial Sounds, Video Pre-Check",
          all(s in (ready / "POSTING-CHECKLIST.md").read_text() for s in ("disclosure", "Attach the product at post time", "Commercial Sounds", "Video Pre-Check")))
    check("deliver: v02 (no qa), v03 (near-duplicate), and the failed negative-control builds were NOT delivered",
          not (ready / "v02.mp4").exists() and not (ready / "v03.mp4").exists() and not any(ready.glob("n_*")))
    (bd / "final.mp4").write_bytes((bd / "final.mp4").read_bytes() + b"\0")
    shutil.rmtree(ready)
    rc, out, err = cli("deliver", "t1")
    check("deliver: a final.mp4 changed after QA is refused as stale", not (ready / "v01.mp4").exists() and "stale" in out, out)

    rc, out, err = cli("status", "t1")
    check("status: prints the batch summary", rc == 0 and "v01" in out and "variant" in out, out[:200])

    # ---------------------------------------------------------------- summary
    n_fail = sum(1 for r in RESULTS if not r[1])
    print("\n%d checks, %d passed, %d failed (%.0fs)" % (len(RESULTS), len(RESULTS) - n_fail, n_fail, time.time() - t_start))
    for n, ok, d in RESULTS:
        if not ok:
            print("  FAILED: %s -> %s" % (n, str(d)[:300]))
    return 1 if n_fail else 0


if __name__ == "__main__":
    try:
        rc = main()
    except Exception:
        traceback.print_exc()
        print("\nTEST HARNESS ERROR (counts as failure)")
        rc = 1
    sys.exit(rc)
