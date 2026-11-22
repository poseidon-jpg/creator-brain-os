"""new / ingest: batch scaffolding, inbox -> raw move, probe, normalize to master, gate-check."""
import re
import shutil
from pathlib import Path

import hlg
from common import *

VIDEO_EXT = {".mov", ".mp4", ".m4v"}
SUBDIRS = ["raw", "master", "log", "plan", "cuts", "build", "qa"]


# ------------------------------------------------------------------ new
def parse_brief(text):
    """Pull name, selling points and claims-to-avoid out of shop/products/<slug>/brief.md."""
    name = None
    points, avoid = [], []
    section = None
    for line in text.splitlines():
        s = line.strip()
        m = re.match(r"^#\s+(.+)$", s)
        if m and name is None:
            cand = m.group(1).strip()
            if not cand.startswith("<"):
                name = cand
            continue
        m = re.match(r"^##\s+(.+)$", s)
        if m:
            h = m.group(1).lower()
            section = "points" if "selling" in h else "avoid" if "avoid" in h else None
            continue
        if not s or s.startswith("(") or s.startswith("<"):
            continue
        item = re.sub(r"^(\d+[.)]|[-*])\s*", "", s).strip()
        if not item:
            continue
        if section == "points":
            points.append(item)
        elif section == "avoid":
            avoid.append(item)
    return name, points, avoid


def cmd_new(batch, product):
    proj = project_dir(batch)
    if proj.exists() and any(proj.iterdir()):
        raise PipelineError("batch already exists: %s" % rel(proj))
    for d in SUBDIRS:
        (proj / d).mkdir(parents=True, exist_ok=True)
    brief = repo_root() / "shop" / "products" / product / "brief.md"
    name, points, avoid = (None, [], [])
    src = None
    if brief.is_file():
        name, points, avoid = parse_brief(brief.read_text(encoding="utf-8"))
        src = rel(brief)
    else:
        warn("no brief at shop/products/%s/brief.md; product.json left mostly empty" % product)
    banned = list(DEFAULT_BANNED_LITERALS)
    for a in avoid:
        if a.lower() not in [b.lower() for b in banned]:
            banned.append(a)
    prod = {
        "schema": "product/1",
        "slug": product,
        "name": name or product.replace("-", " ").title(),
        "selling_points": points,
        "banned_claims": banned,
        "competitors": [],
        "duration_range_s": DEFAULT_DURATION_RANGE_S,
        "caption": "",
        "hashtags": [],
        "ai_generated": False,
        "ai_disclosed": False,
        "source_brief": src,
        "approved_by_human": False,
        "_note": "banned_claims entries are literal phrases (prefix with re: for a regex). RUBRIC defaults are also linted in code.",
    }
    write_json(proj / "plan" / "product.json", prod)
    info("created %s" % rel(proj))
    info("plan/product.json prefilled from %s" % (src or "defaults"))
    return 0


# ------------------------------------------------------------------ ingest
def _ledger_path(proj):
    return proj / "log" / "ingest.json"


def _load_ledger(proj):
    p = _ledger_path(proj)
    return read_json(p) if p.is_file() else {"schema": "ingest/1", "clips": {}}


def _video_files(d):
    out = []
    if d.is_dir():
        for f in sorted(d.iterdir(), key=lambda x: x.name.lower()):
            if f.is_file() and not f.name.startswith(".") and f.suffix.lower() in VIDEO_EXT:
                out.append(f)
    return out


def _move_inbox(proj, inbox):
    moved = []
    raw = proj / "raw"
    for f in _video_files(inbox):
        dest = raw / f.name
        if dest.exists():
            if sha256_head_tail(dest) == sha256_head_tail(f):
                warn("%s already in raw/ (same content); leaving the inbox copy alone" % f.name)
                continue
            stem, suf = f.stem, f.suffix
            k = 2
            while dest.exists():
                dest = raw / ("%s_%d%s" % (stem, k, suf))
                k += 1
        shutil.move(str(f), str(dest))
        moved.append(dest)
    return moved


def _stream(probe, kind):
    for s in probe.get("streams", []):
        if s.get("codec_type") == kind:
            return s
    return None


def _rotation(vs):
    for sd in vs.get("side_data_list", []) or []:
        if "rotation" in sd:
            return int(round(float(sd["rotation"])))
    r = (vs.get("tags") or {}).get("rotate")
    return int(r) if r else 0


def source_summary(path, probe):
    vs, au = _stream(probe, "video"), _stream(probe, "audio")
    rot = _rotation(vs)
    return {
        "path": rel(path), "size_bytes": os.path.getsize(path), "sha256_head_tail": sha256_head_tail(path),
        "ffprobe": {
            "codec": vs.get("codec_name"), "profile": vs.get("profile"), "w": vs.get("width"), "h": vs.get("height"),
            "rotation": rot, "pix_fmt": vs.get("pix_fmt"), "color_transfer": vs.get("color_transfer"),
            "color_primaries": vs.get("color_primaries"), "color_space": vs.get("color_space"),
            "r_frame_rate": vs.get("r_frame_rate"), "avg_frame_rate": vs.get("avg_frame_rate"),
            "audio": ({"codec": au.get("codec_name"), "channels": au.get("channels"),
                       "sample_rate": int(au.get("sample_rate", 0))} if au else None),
            "data_streams": sum(1 for s in probe["streams"] if s.get("codec_type") == "data"),
        }}


def master_gate(path):
    """Spec 4.6 normalized-file checks. Returns (ok, details, facts)."""
    p = ffprobe_json(path)
    vs, au = _stream(p, "video"), _stream(p, "audio")
    problems = []
    if not vs:
        return False, ["no video stream"], {}
    if (vs.get("width"), vs.get("height")) != (W, H):
        problems.append("size %sx%s != 1080x1920" % (vs.get("width"), vs.get("height")))
    if vs.get("r_frame_rate") != "30/1" or vs.get("avg_frame_rate") != "30/1":
        problems.append("frame rate r=%s avg=%s (need 30/1)" % (vs.get("r_frame_rate"), vs.get("avg_frame_rate")))
    if vs.get("pix_fmt") != "yuv420p":
        problems.append("pix_fmt %s" % vs.get("pix_fmt"))
    for k in ("color_space", "color_transfer", "color_primaries"):
        if vs.get(k) != "bt709":
            problems.append("%s=%s (need bt709)" % (k, vs.get(k)))
    if vs.get("color_range") != "tv":
        problems.append("color_range=%s (need tv)" % vs.get("color_range"))
    if not au:
        problems.append("no audio stream")
    elif int(au.get("sample_rate", 0)) != SR:
        problems.append("sample_rate %s" % au.get("sample_rate"))
    nb = int(vs.get("nb_frames") or 0)
    vdur = float(vs.get("duration") or p["format"].get("duration") or 0)
    if not nb:
        problems.append("nb_frames missing")
    elif abs(vdur - nb / FPS) > 0.002:
        problems.append("video_duration %.3f != nb_frames/30 %.3f" % (vdur, nb / FPS))
    adur = float(au.get("duration") or 0) if au else 0.0
    asamples = int(round(adur * SR))
    facts = {"frames": nb, "video_duration_s": r3(vdur), "audio_duration_s": r3(adur),
             "audio_samples": asamples, "usable_duration_s": r3(min(vdur, adur) if au else vdur),
             "channels": int(au.get("channels", 0)) if au else 0}
    return not problems, problems, facts


def normalize(src, dst, probe, hdr_mode_info):
    """Build the master. hdr_mode_info: dict(tonemap=..., vf=...). Returns nothing, raises on failure."""
    has_audio = _stream(probe, "audio") is not None
    args = ["-i", str(src)]
    if not has_audio:
        args += ["-f", "lavfi", "-i", "anullsrc=r=%d:cl=stereo" % SR]
    args += ["-map", "0:v:0", "-map", ("0:a:0" if has_audio else "1:a:0"),
             "-vf", hdr_mode_info["vf"],
             "-af", "aresample=%d:async=1:first_pts=0" % SR, "-ac", "2",
             "-c:v", "libx264", "-preset", "fast", "-crf", "12", "-g", "30", "-pix_fmt", "yuv420p",
             "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
             "-c:a", "pcm_s16le", "-ar", str(SR)]
    if not has_audio:
        args += ["-shortest"]
    args += ["-movflags", "+faststart", str(dst)]
    ffmpeg(args)


def choose_vf(probe):
    vs = _stream(probe, "video")
    ct = vs.get("color_transfer")
    mode = hlg.detect_hdr(ct)
    rot = _rotation(vs)
    w, h = vs["width"], vs["height"]
    if abs(rot) in (90, 270):
        w, h = h, w
    aspect_fix = "none" if abs(w / h - 9 / 16) < 0.01 else "crop-center"
    r, a = parse_rate(vs.get("r_frame_rate")), parse_rate(vs.get("avg_frame_rate"))
    vfr = vs.get("r_frame_rate") != vs.get("avg_frame_rate") or (r and abs(r - FPS) > 0.01)
    info_ = {"hdr_detected": bool(mode), "aspect_fix": aspect_fix, "vfr_source": bool(vfr),
             "conform": "fps=30 (nearest frame)", "tonemap": "none-sdr", "vf": hlg.sdr_vf(), "blocked": None}
    if mode == "hlg":
        info_["tonemap"] = "lut-hlg"
        info_["vf"] = hlg.hlg_to_sdr_vf()
        if ffmpeg_has_filter("zscale"):
            pass  # LUT chain is still the tested one; keep it for identical look on every machine
    elif mode == "pq":
        if ffmpeg_has_filter("zscale"):
            info_["tonemap"] = "zscale"
            info_["vf"] = hlg.zscale_tonemap_vf()
        else:
            info_["tonemap"] = "blocked-pq"
            info_["blocked"] = ("PQ HDR source and this ffmpeg has no zscale. Install ffmpeg-full "
                                "(brew install ffmpeg-full) or re-export the clip as SDR "
                                "(iPhone: Settings > Camera > Record Video > HDR Video OFF).")
    if aspect_fix != "none":
        warn("source is %dx%d after rotation: centre-cropping to 9:16 (loses width, check the subject)" % (w, h))
    return info_


def cmd_ingest(batch, from_dir):
    proj = require_project(batch)
    inbox = Path(from_dir)
    if not inbox.is_absolute():
        inbox = repo_root() / inbox
    moved = _move_inbox(proj, inbox)
    info("moved %d file(s) from inbox to raw/" % len(moved))
    ledger = _load_ledger(proj)
    known = {c["raw"] for c in ledger["clips"].values()}
    todo = [f for f in _video_files(proj / "raw") if f.name not in known]
    n = len(ledger["clips"])
    failed = 0
    for f in todo:
        n += 1
        cid = "c%03d" % n
        probe = ffprobe_json(f)
        write_json(proj / "log" / ("%s.probe.json" % cid), probe)
        vs = _stream(probe, "video")
        if not vs:
            warn("%s has no video stream; skipped" % f.name)
            failed += 1
            continue
        plan = choose_vf(probe)
        entry = {"raw": f.name, "status": "pending"}
        ledger["clips"][cid] = entry
        if plan["blocked"]:
            warn("%s (%s): %s" % (cid, f.name, plan["blocked"]))
            entry.update(status="blocked", reason=plan["blocked"])
            failed += 1
            write_json(_ledger_path(proj), ledger)
            continue
        dst = proj / "master" / ("%s.mov" % cid)
        info("%s: normalizing %s (%s) ..." % (cid, f.name, plan["tonemap"]))
        try:
            normalize(f, dst, probe, plan)
        except PipelineError as e:
            warn("%s normalize failed: %s" % (cid, e))
            entry.update(status="failed", reason=str(e)[:300])
            failed += 1
            write_json(_ledger_path(proj), ledger)
            continue
        ok, problems, facts = master_gate(dst)
        if not ok:
            warn("%s master gate FAILED: %s" % (cid, "; ".join(problems)))
            entry.update(status="gate-failed", reason="; ".join(problems))
            failed += 1
            write_json(_ledger_path(proj), ledger)
            continue
        entry.update(status="ok")
        clip_log = {
            "schema": "clip-log/1", "clip_id": cid,
            "source": source_summary(f, probe),
            "master": dict({"path": rel(dst), "w": W, "h": H, "fps": FPS, "sample_rate": SR,
                            "sha256": sha256_file(dst),
                            "hdr_detected": plan["hdr_detected"], "tonemap": plan["tonemap"],
                            "vfr_source": plan["vfr_source"], "conform": plan["conform"],
                            "aspect_fix": plan["aspect_fix"]}, **facts),
        }
        write_json(proj / "log" / ("%s.clip.json" % cid), clip_log)
        info("%s: master ok  %d frames  %.2fs  hdr=%s" % (cid, facts["frames"], facts["usable_duration_s"], plan["hdr_detected"]))
        write_json(_ledger_path(proj), ledger)
    write_json(_ledger_path(proj), ledger)
    if failed:
        warn("%d clip(s) need attention (see log/ingest.json)" % failed)
        return 1
    info("ingest done: %d new clip(s)" % len(todo))
    return 0
