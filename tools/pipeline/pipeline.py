#!/usr/bin/env python3
"""Creator Brain OS video pipeline CLI. Run from the repo root:

    python3 tools/pipeline/pipeline.py <cmd> ...

Commands: new, ingest, analyze, compile, render, qa, similarity, deliver, status.
Why each step exists: research/deep-hop-pipeline-spec.md. Reference: tools/pipeline/SPEC.md.
"""
import argparse
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ.setdefault("HYPERFRAMES_NO_TELEMETRY", "1")


def _maybe_reexec_in_venv():
    try:
        import PIL  # noqa: F401
        return
    except ImportError:
        pass
    vpy = HERE / ".venv" / "bin" / "python"
    if vpy.exists() and not os.environ.get("PIPELINE_REEXEC"):
        os.environ["PIPELINE_REEXEC"] = "1"
        os.execv(str(vpy), [str(vpy), str(Path(__file__).resolve())] + sys.argv[1:])


def main(argv=None):
    _maybe_reexec_in_venv()
    from common import PipelineError, DEFAULT_DURATION_RANGE_S  # noqa: F401
    ap = argparse.ArgumentParser(prog="pipeline.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("new", help="create studio/projects/<batch>/ and plan/product.json")
    p.add_argument("batch")
    p.add_argument("--product", required=True, help="slug of shop/products/<slug>/")
    p = sub.add_parser("ingest", help="move inbox clips to raw/, normalize to master/, gate-check")
    p.add_argument("batch")
    p.add_argument("--from", dest="from_dir", default="studio/inbox")
    p = sub.add_parser("analyze", help="transcript, silences, retakes, quality -> log/*.clip.json + packed.md")
    p.add_argument("batch")
    p.add_argument("--force", action="store_true", help="ignore the cache")
    p = sub.add_parser("compile", help="cuts/<variant>.cutlist.json -> build/<variant>/{edl,cut.fc,words.out}")
    p.add_argument("batch")
    p.add_argument("variant")
    p.add_argument("--reset-attempts", action="store_true", help="a human reviewed the failures; allow 3 more repair rounds")
    p = sub.add_parser("render", help="cut, captions, loudness, final.mp4 + clean.mp4")
    p.add_argument("batch")
    p.add_argument("variant")
    p.add_argument("--caption-y", type=int, default=None, help="caption box centre y (default 1380; clamped into the safe box)")
    p = sub.add_parser("qa", help="gates + judge material -> qa/<variant>/report.json")
    p.add_argument("batch")
    p.add_argument("variant")
    p = sub.add_parser("similarity", help="footage overlap between variants (> 0.60 = near-duplicate)")
    p.add_argument("batch")
    p = sub.add_parser("deliver", help="copy passed + judged variants to studio/ready/<batch>/")
    p.add_argument("batch")
    p = sub.add_parser("status", help="one-screen summary")
    p.add_argument("batch")
    a = ap.parse_args(argv)
    try:
        if a.cmd == "new":
            import ingest
            return ingest.cmd_new(a.batch, a.product)
        if a.cmd == "ingest":
            import ingest
            return ingest.cmd_ingest(a.batch, a.from_dir)
        if a.cmd == "analyze":
            import analyze
            return analyze.cmd_analyze(a.batch, a.force)
        if a.cmd == "compile":
            import compiler
            return compiler.cmd_compile(a.batch, a.variant, a.reset_attempts)
        if a.cmd == "render":
            import render
            from common import CAPTION_CENTER_Y
            return render.cmd_render(a.batch, a.variant, a.caption_y or CAPTION_CENTER_Y)
        if a.cmd == "qa":
            import qa
            return qa.cmd_qa(a.batch, a.variant)
        import ops
        return {"similarity": ops.cmd_similarity, "deliver": ops.cmd_deliver, "status": ops.cmd_status}[a.cmd](a.batch)
    except PipelineError as e:
        print("ERROR: %s" % e, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
