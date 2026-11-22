"""render: single-pass cut, captions, loudness, final.mp4 + clean.mp4 (spec 4.8).

Video is encoded three times in a variant's life: master (ingest), cut.mov (crf 12), and the final
(final.mp4 and clean.mp4 come out of ONE ffmpeg run that decodes cut.mov once).
Audio is encoded to AAC once (audio.m4a, loudness verified on the ENCODED file) and stream-copied into both.
"""
import captions as cap
from common import *

COLOR_TAGS = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"]


def final_preset():
    return os.environ.get("PIPELINE_FINAL_PRESET", "slow")


# ------------------------------------------------------------------ loudness
def plan_gain(m):
    """m: loudnorm pass-1 dict (input_i, input_tp, input_lra, input_thresh, target_offset).
    Returns dict(mode='skip'|'linear'|'limiter', gain_db, limiter_gain_warn)."""
    I, tp = m["input_i"], m["input_tp"]
    if I < NEAR_SILENCE_LUFS:
        return {"mode": "skip", "gain_db": 0.0, "note": "near-silence (%.1f LUFS): not normalised" % I}
    g = LUFS_TARGET - I
    if tp + g <= TP_AIM:
        return {"mode": "linear", "gain_db": g}
    return {"mode": "limiter", "gain_db": g, "limiter_db": TP_AIM, "limiter_warn": g > 3.0}


def audio_filter(plan, m, gain_adj=0.0, limit_db=TP_AIM):
    if plan["mode"] == "skip":
        return "aresample=%d" % SR
    if plan["mode"] == "linear":
        return ("loudnorm=I=%g:TP=%g:LRA=11:measured_I=%.2f:measured_TP=%.2f:measured_LRA=%.2f:measured_thresh=%.2f:offset=%.2f:linear=true,aresample=%d"
                % (LUFS_TARGET, TP_AIM, m["input_i"], m["input_tp"], m["input_lra"], m["input_thresh"], m["target_offset"], SR))
    lim = 10 ** (limit_db / 20.0)
    return "volume=%.2fdB,alimiter=limit=%.4f:level=false,aresample=%d" % (plan["gain_db"] + gain_adj, lim, SR)


def measure_loudnorm(path, cwd):
    p = run([FFMPEG, "-hide_banner", "-nostats", "-nostdin", "-i", str(path), "-vn", "-af",
             "loudnorm=I=%g:TP=%g:LRA=11:print_format=json" % (LUFS_TARGET, TP_AIM), "-f", "null", "-"], cwd=cwd)
    return parse_loudnorm_json(p.stderr)


def encode_audio(cut, out, af, cwd):
    ffmpeg(["-i", str(cut), "-vn", "-af", af, "-c:a", "aac", "-b:a", "192k", "-ar", str(SR), "-ac", "2", str(out)], cwd=cwd)


def loudness_pass(cut, out_m4a, cwd):
    """Measure, choose linear vs limiter, encode, verify the encoded file, repair up to 2 times."""
    m = measure_loudnorm(cut, cwd)
    plan = plan_gain(m)
    log = {"input": {k: m[k] for k in ("input_i", "input_tp", "input_lra")}, "plan": plan, "attempts": []}
    gain_adj, limit = 0.0, TP_AIM
    for attempt in range(3):
        af = audio_filter(plan, m, gain_adj, limit)
        encode_audio(cut, out_m4a, af, cwd)
        r = measure_ebur128(Path(cwd) / out_m4a)
        log["attempts"].append({"mode": plan["mode"], "gain_adj_db": round(gain_adj, 2), "limit_db": round(limit, 2),
                                "I": r["I"], "TP": r["TP"]})
        if plan["mode"] == "skip":
            break
        ok = abs(r["I"] - LUFS_TARGET) <= LUFS_TOL_WARN and r["TP"] <= TP_MAX
        if ok:
            break
        if plan["mode"] == "linear":
            plan = dict(plan, mode="limiter", limiter_db=TP_AIM, limiter_warn=plan["gain_db"] > 3.0)
            continue
        gain_adj += LUFS_TARGET - r["I"]
        if r["TP"] > TP_MAX - 0.2:
            limit -= (r["TP"] - (TP_MAX - 0.2)) + 0.2
    log["final"] = log["attempts"][-1]
    if plan.get("limiter_warn"):
        log["warning"] = "limiter applied %.1f dB of gain (> 3 dB)" % plan["gain_db"]
    return log


# ------------------------------------------------------------------ cut + final
def run_cut(proj, edl, rel_dir):
    inputs = []
    for i in edl["inputs"]:
        inputs += ["-i", str(repo_root() / i["path"])]
    cut = rel_dir / "cut.mov"
    ffmpeg(inputs + ["-filter_complex_script", str(rel_dir / "cut.fc"), "-map", "[v]", "-map", "[a]",
                     "-c:v", "libx264", "-preset", "fast", "-crf", "12", "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", "30"]
           + COLOR_TAGS + ["-c:a", "pcm_s16le", "-ar", str(SR), str(cut)], cwd=proj)
    p = ffprobe_json(proj / cut)
    vs = [s for s in p["streams"] if s["codec_type"] == "video"][0]
    nb = int(vs.get("nb_frames") or 0)
    if nb != edl["total_frames"]:
        raise PipelineError("cut.mov has %d frames, edl says %d" % (nb, edl["total_frames"]))
    return cut


def composite_final(proj, rel_dir, total_frames, with_caps, preset=None):
    """final.mp4 + clean.mp4 from cut.mov (+ caption concat track) + audio.m4a in one ffmpeg run."""
    preset = preset or final_preset()
    cut, aud = rel_dir / "cut.mov", rel_dir / "audio.m4a"
    venc = ["-c:v", "libx264", "-preset", preset, "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-frames:v", str(total_frames)] + COLOR_TAGS + ["-c:a", "copy", "-movflags", "+faststart"]
    if with_caps:
        fg = ("[0:v]split=2[base][b2];"
              "[1:v]fps=%d,format=rgba,scale=out_color_matrix=bt709:out_range=tv,format=yuva420p[cap];"
              "[base][cap]overlay=0:0:eof_action=pass:format=yuv420[vf];[b2]null[vc]" % FPS)
        args = ["-i", str(cut), "-f", "concat", "-safe", "0", "-i", str(rel_dir / "caps" / "list.txt"), "-i", str(aud),
                "-filter_complex", fg,
                "-map", "[vf]", "-map", "2:a"] + venc + [str(rel_dir / "final.mp4"),
                "-map", "[vc]", "-map", "2:a"] + venc + [str(rel_dir / "clean.mp4")]
        ffmpeg(args, cwd=proj)
    else:
        args = ["-i", str(cut), "-i", str(aud), "-map", "0:v", "-map", "1:a"] + venc + [str(rel_dir / "clean.mp4")]
        ffmpeg(args, cwd=proj)
        shutil.copyfile(proj / rel_dir / "clean.mp4", proj / rel_dir / "final.mp4")


def cmd_render(batch, variant, y_center=CAPTION_CENTER_Y):
    proj = require_project(batch)
    check_variant(variant)
    rel_dir = Path("build") / variant
    bdir = proj / rel_dir
    for f in ("edl.json", "cut.fc", "words.out.json"):
        if not (bdir / f).is_file():
            raise PipelineError("missing build/%s/%s (run compile first)" % (variant, f))
    edl = read_json(bdir / "edl.json")
    wo = read_json(bdir / "words.out.json")
    t0 = now_iso()
    info("[1/4] single-pass cut (%d segment(s)) ..." % len(edl["segments"]))
    run_cut(proj, edl, rel_dir)

    info("[2/4] captions ...")
    cues = cap.make_cues(wo["words"], edl.get("emphasis_out", []), edl["total_frames"])
    with_caps = bool(cues)
    if with_caps:
        cap.build_caption_assets(cues, bdir / "caps", edl["total_frames"], y_center=y_center)
        write_json(bdir / "caps" / "cues.json", {"schema": "cues/1", "fps": FPS, "cues": cues})
    else:
        warn("no spoken words in this variant: no captions")

    info("[3/4] loudness (two-pass, verified on the encoded audio) ...")
    ll = loudness_pass(bdir / "cut.mov", Path("audio.m4a"), bdir)
    if not (bdir / "audio.m4a").exists():
        raise PipelineError("audio.m4a missing")

    info("[4/4] final encode (final.mp4 + clean.mp4) ...")
    composite_final(proj, rel_dir, edl["total_frames"], with_caps)
    meta = {"schema": "render/1", "variant": variant, "started": t0, "finished": now_iso(), "frames": edl["total_frames"],
            "captions": with_caps, "cues": len(cues), "loudness": ll, "preset": final_preset(),
            "video_encodes": {"master": "ingest crf12", "cut": "crf12", "final": "crf18 (final+clean share one run)"},
            "final_sha256": sha256_file(bdir / "final.mp4"), "clean_sha256": sha256_file(bdir / "clean.mp4")}
    write_json(bdir / "render.json", meta)
    f = ll["final"]
    info("rendered %s: final.mp4 + clean.mp4  %.2fs  loudness I=%.1f LUFS TP=%.1f dBTP" % (variant, edl["total_s"], f["I"], f["TP"]))
    return 0
