"""similarity / deliver / status."""
from common import *

THRESHOLD = 0.60

CHECKLIST = """# Posting checklist (every video in this folder)

Written by the pipeline. Rules R19 and friends are in studio/RUBRIC.md; wording of TikTok's menu items is
UNVERIFIED here, so read what your app actually calls them.

1. Post from your phone, in the TikTok app. The pipeline never posts for you.
2. Turn on the commercial-content disclosure for the post (disclose that it is promotional / affiliate).
3. Add the product link in the app (Add link, then your product). **Attach the product at post time.**
   A link can be added after posting only within 30 days, and only if the sound is from the Commercial Music
   Library (RUBRIC, VERIFIED on the Seller University page). Do not count on adding it later.
4. Sound: no music is baked into these files. If you add music, pick it from Commercial Sounds only.
5. Run Video Pre-Check before you tap Post and fix anything it flags.
6. Use the matching `<variant>.caption.txt` for the caption and hashtags.
7. `<variant>.clean.mp4` has no captions: keep it for GMV Max authorization. Do not post it as a second video.
8. Post variants of one shoot on different days. They are meant to be different videos, not re-uploads.
"""


def _segments_of(edl):
    segs = [(s["clip"], s["src_in_frame"], s["src_out_frame"], s["out_in_frame"]) for s in edl["segments"]]
    segs += [(c["clip"], c["src_in_frame"], c["src_out_frame"], c["out_in_frame"]) for c in edl.get("cutaways", [])]
    segs.sort(key=lambda x: x[3])
    return [(c, a, b) for c, a, b, _ in segs]


def overlap_ratio(ea, eb):
    """Footage overlap in the same order: weighted chain over (i,j) segment pairs, divided by the shorter video."""
    A, B = _segments_of(ea), _segments_of(eb)
    pairs = []
    for i, (ca, a0, a1) in enumerate(A):
        for j, (cb, b0, b1) in enumerate(B):
            if ca == cb:
                ov = min(a1, b1) - max(a0, b0)
                if ov > 0:
                    pairs.append((i, j, ov))
    pairs.sort()
    best = []
    for k, (i, j, ov) in enumerate(pairs):
        top = 0
        for m in range(k):
            pi, pj, _ = pairs[m]
            if pi <= i and pj <= j and (pi, pj) != (i, j):
                top = max(top, best[m])
        best.append(top + ov)
    total = max(best) if best else 0
    la = sum(b - a for _, a, b in A)
    lb = sum(b - a for _, a, b in B)
    denom = min(la, lb) or 1
    return min(1.0, total / denom)


def cmd_similarity(batch):
    proj = require_project(batch)
    edls = {}
    for d in sorted((proj / "build").glob("*/edl.json")):
        edls[d.parent.name] = read_json(d)
    names = sorted(edls)
    pairs, flagged = [], 0
    for x in range(len(names)):
        for y in range(x + 1, len(names)):
            r = overlap_ratio(edls[names[x]], edls[names[y]])
            flag = r > THRESHOLD
            pairs.append({"a": names[x], "b": names[y], "overlap": round(r, 3), "flag": flag,
                          "code": "near-duplicate" if flag else None, "blocked": [names[y]] if flag else []})
            flagged += flag
            info("  %s vs %s: footage overlap %.0f%%%s" % (names[x], names[y], r * 100, "  -> near-duplicate" if flag else ""))
    write_json(proj / "qa" / "similarity.json", {"schema": "similarity/1", "threshold": THRESHOLD, "variants": names, "pairs": pairs,
                                                 "note": "Footage overlap only. RUBRIC also needs different hook text, spoken hook and angle: the judge checks those."})
    if not names:
        info("no compiled variants")
    if flagged:
        print("near-duplicate: %d pair(s) over %.0f%% (the later variant of each pair is blocked from delivery)" % (flagged, THRESHOLD * 100), file=sys.stderr)
        return 1
    return 0


def cmd_deliver(batch):
    proj = require_project(batch)
    ready = repo_root() / "studio" / "ready" / batch
    prod = read_json(proj / "plan" / "product.json") if (proj / "plan" / "product.json").is_file() else {}
    variants = sorted(p.parent.name for p in (proj / "build").glob("*/edl.json"))
    done, held = [], []
    for v in variants:
        qd, bd = proj / "qa" / v, proj / "build" / v
        why = None
        rp, jp = qd / "report.json", qd / "judge.json"
        if not rp.is_file():
            why = "no qa report"
        else:
            rep = read_json(rp)
            if not rep.get("passed"):
                why = "qa did not pass (%s)" % ", ".join(sorted({h["code"] for h in rep.get("hard_fails", [])}))
            elif rep["hashes"]["final_sha256"] != sha256_file(bd / "final.mp4") or rep["hashes"]["clean_sha256"] != sha256_file(bd / "clean.mp4"):
                why = "qa report is stale (files changed after QA)"
            elif not jp.is_file():
                why = "no judge verdict (qa/%s/judge.json)" % v
            else:
                j = read_json(jp)
                if j.get("verdict") != "pass":
                    why = "judge verdict is %r" % j.get("verdict")
                elif j.get("report_sha256") and j["report_sha256"] != sha256_file(rp):
                    why = "judge verdict was for an older QA report"
        if not why:
            sp = proj / "qa" / "similarity.json"
            if sp.is_file():
                for p in read_json(sp).get("pairs", []):
                    if v in (p.get("blocked") or []):
                        why = "near-duplicate of %s (%.0f%% footage overlap)" % (p["a"], p["overlap"] * 100)
            else:
                why = "run similarity first (qa/similarity.json missing)"
        if why:
            held.append((v, why))
            continue
        ready.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(bd / "final.mp4", ready / ("%s.mp4" % v))
        shutil.copyfile(bd / "clean.mp4", ready / ("%s.clean.mp4" % v))
        edl = read_json(bd / "edl.json")
        c = edl.get("caption_text") or {}
        text = (c.get("text") if isinstance(c, dict) else c) or prod.get("caption") or "[caption: write it before posting]"
        tags = (c.get("hashtags") if isinstance(c, dict) else None) or prod.get("hashtags") or []
        tagline = " ".join(t if t.startswith("#") else "#" + t for t in tags) if tags else "[hashtags: add 3-5 before posting]"
        (ready / ("%s.caption.txt" % v)).write_text(text.strip() + "\n\n" + tagline + "\n", encoding="utf-8")
        done.append(v)
    if done:
        (ready / "POSTING-CHECKLIST.md").write_text(CHECKLIST, encoding="utf-8")
    for v in done:
        info("delivered %s -> %s" % (v, rel(ready / ("%s.mp4" % v))))
    for v, why in held:
        info("held     %s: %s" % (v, why))
    if not variants:
        info("no variants to deliver")
    return 0 if done or not held else 1


def cmd_status(batch):
    proj = require_project(batch)
    led = read_json(proj / "log" / "ingest.json") if (proj / "log" / "ingest.json").is_file() else {"clips": {}}
    pj = proj / "plan" / "product.json"
    prod = read_json(pj) if pj.is_file() else {}
    print("batch %s   product: %s   raw: %d file(s)" % (batch, prod.get("name", "?"), len(list((proj / "raw").glob("*")))))
    ok = [c for c, v in led["clips"].items() if v.get("status") == "ok"]
    analyzed = [c for c in ok if (proj / "log" / ("%s.clip.json" % c)).is_file() and "transcript" in read_json(proj / "log" / ("%s.clip.json" % c))]
    print("clips: %d ingested ok, %d analyzed, %d need attention" % (len(ok), len(analyzed), len(led["clips"]) - len(ok)))
    for c, v in led["clips"].items():
        if v.get("status") != "ok":
            print("   %s %s: %s" % (c, v.get("status"), v.get("reason", "")[:100]))
    names = sorted({p.name.replace(".cutlist.json", "") for p in (proj / "cuts").glob("*.cutlist.json")})
    if not names:
        print("variants: none (write cuts/<variant>.cutlist.json)")
    ready = repo_root() / "studio" / "ready" / batch
    print("%-10s %-9s %-9s %-14s %-9s %s" % ("variant", "compiled", "rendered", "qa", "judge", "delivered"))
    for v in names:
        b, q = proj / "build" / v, proj / "qa" / v
        comp = (b / "edl.json").is_file()
        rend = (b / "final.mp4").is_file()
        qa = "-"
        if (q / "report.json").is_file():
            r = read_json(q / "report.json")
            qa = "pass" if r["passed"] else "FAIL " + ",".join(sorted({h["code"] for h in r["hard_fails"]}))[:9]
        jd = "-"
        if (q / "judge.json").is_file():
            jd = read_json(q / "judge.json").get("verdict", "?")
        att = ""
        if (b / "attempts.json").is_file() and read_json(b / "attempts.json").get("failures"):
            att = "  (compile failures: %d/3)" % read_json(b / "attempts.json")["failures"]
        print("%-10s %-9s %-9s %-14s %-9s %s%s" % (v, "yes" if comp else "no", "yes" if rend else "no", qa, jd,
                                                    "yes" if (ready / ("%s.mp4" % v)).is_file() else "no", att))
    sp = proj / "qa" / "similarity.json"
    if sp.is_file():
        fl = [p for p in read_json(sp)["pairs"] if p["flag"]]
        print("similarity: %d flagged pair(s)" % len(fl))
    return 0
