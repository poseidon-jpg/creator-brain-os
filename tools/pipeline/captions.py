"""Our own caption renderer (spec 4.10 A): cue chunking, Pillow PNG per cue, boxes.json, ffconcat list.

No fonts are bundled. A macOS system font is used, with fallbacks; set PIPELINE_CAPTION_FONT to override.
Two looks (PIPELINE_CAPTION_STYLE): "native" (default) = white bold text with a black stroke and no box, the
look of TikTok's own in-app text (operator teardown, research/lane-c-underground.md S8; chosen as the anti-slop
default because a box reads as "made in an editing tool"); "box" = dark rounded box with a thin light edge.
Uppercase bold sans either way, accent colour on emphasis cues.
"""
import os
import re
from pathlib import Path

from common import *

FONT_CANDIDATES = [
    ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 0),
    ("/System/Library/Fonts/Helvetica.ttc", None),   # pick the Bold face by name
    ("/System/Library/Fonts/HelveticaNeue.ttc", None),
    ("/Library/Fonts/Arial Bold.ttf", 0),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 0),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 0),
]
BOX_FILL = (0, 0, 0, 175)
BOX_EDGE = (255, 255, 255, 90)
TEXT_WHITE = (255, 255, 255, 255)
TEXT_ACCENT = (255, 214, 64, 255)
PAD_X, PAD_Y, RADIUS = 38, 24, 30
STYLE = os.environ.get("PIPELINE_CAPTION_STYLE", "native").strip().lower()
if STYLE not in ("native", "box"):
    STYLE = "native"


def _pil():
    try:
        from PIL import Image, ImageDraw, ImageFont
        return Image, ImageDraw, ImageFont
    except ImportError:
        raise PipelineError("Pillow is not installed. Run tools/pipeline/setup.sh (creates tools/pipeline/.venv).")


_font_cache = {}


def load_font(px):
    Image, ImageDraw, ImageFont = _pil()
    if px in _font_cache:
        return _font_cache[px]
    cands = []
    env = os.environ.get("PIPELINE_CAPTION_FONT")
    if env:
        cands.append((env, 0))
    cands += FONT_CANDIDATES
    font = None
    for path, idx in cands:
        if not Path(path).is_file():
            continue
        try:
            if idx is None:
                for k in range(0, 8):
                    try:
                        f = ImageFont.truetype(path, px, index=k)
                    except Exception:
                        break
                    if "bold" in " ".join(f.getname()).lower():
                        font = f
                        break
                if font is None:
                    font = ImageFont.truetype(path, px, index=0)
            else:
                font = ImageFont.truetype(path, px, index=idx)
            break
        except Exception:
            continue
    if font is None:
        try:
            font = ImageFont.load_default(size=px)
        except TypeError:
            font = ImageFont.load_default()
        warn("no system caption font found; using Pillow's default (set PIPELINE_CAPTION_FONT)")
    _font_cache[px] = font
    return font


# ------------------------------------------------------------------ chunking
def make_cues(words, emphasis=(), total_frames=None):
    """words: words.out.json entries. Returns cue dicts with frame timings (hard swap, 2-frame lead)."""
    emphasis = set(emphasis)
    groups, cur = [], []
    n = len(words)
    for k, w in enumerate(words):
        cur.append(w)
        nxt = words[k + 1] if k + 1 < n else None
        dur = cur[-1]["out_end"] - cur[0]["out_start"]
        trailing = bool(re.search(r"[.!?,;:]$", w["text"]))
        end_here = (trailing or nxt is None or nxt["seg"] != w["seg"] or nxt["out_start"] - w["out_end"] >= CHUNK_PAUSE_S
                    or len(cur) >= CHUNK_MAX_WORDS)
        if len(cur) >= CHUNK_WORDS and dur >= CHUNK_MIN_S:
            end_here = True
        if end_here:
            groups.append(cur)
            cur = []
    cues = []
    for gi, g in enumerate(groups):
        text = " ".join(w["text"] for w in g).upper()
        text = re.sub(r"[.,;:]+$", "", text)
        start_f = max(0, int(round(g[0]["out_start"] * FPS)) - CAPTION_LEAD_FRAMES)
        end_f = int(round((g[-1]["out_end"] + CAPTION_HOLD_S) * FPS))
        cues.append({"id": "k%03d" % gi, "text": text, "words": [w["n"] for w in g], "start_f": start_f, "end_f": end_f,
                     "emphasis": any(w["n"] in emphasis for w in g)})
    for a, b in zip(cues, cues[1:]):
        a["end_f"] = min(a["end_f"], b["start_f"])
        if a["end_f"] <= a["start_f"]:
            a["end_f"] = a["start_f"] + 1
    if total_frames is not None:
        for c in cues:
            c["end_f"] = min(c["end_f"], total_frames)
    return cues


# ------------------------------------------------------------------ drawing
def _layout(text, font_px, max_w):
    Image, ImageDraw, ImageFont = _pil()
    d = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    px = font_px
    while True:
        f = load_font(px)
        w = d.textlength(text, font=f)
        if w + 2 * PAD_X <= max_w or px <= CAPTION_MIN_FONT_PX:
            break
        px -= 4
    f = load_font(px)
    lines = [text]
    if d.textlength(text, font=f) + 2 * PAD_X > max_w and " " in text:
        toks = text.split(" ")
        best = None
        for k in range(1, len(toks)):
            l1, l2 = " ".join(toks[:k]), " ".join(toks[k:])
            m = max(d.textlength(l1, font=f), d.textlength(l2, font=f))
            if best is None or m < best[0]:
                best = (m, [l1, l2])
        lines = best[1]
    widths = [d.textlength(l, font=f) for l in lines]
    asc, desc = f.getmetrics()
    lh = asc + desc
    box_w = int(math.ceil(max(widths))) + 2 * PAD_X
    box_h = lh * len(lines) + 2 * PAD_Y + (len(lines) - 1) * 6
    return px, f, lines, box_w, box_h, lh


def render_cue(cue, out_png, y_center=CAPTION_CENTER_Y, clamp=True, font_px=CAPTION_FONT_PX):
    """Draw one cue on a transparent 1080x1920 RGBA PNG; return its bounding box dict."""
    Image, ImageDraw, ImageFont = _pil()
    max_w = SAFE_BOX[2] - SAFE_BOX[0]
    px, f, lines, bw, bh, lh = _layout(cue["text"], font_px, max_w)
    bw = min(bw, max_w) if clamp else bw
    cx = W // 2
    x0 = int(round(cx - bw / 2))
    y0 = int(round(y_center - bh / 2))
    if clamp:
        y0 = max(SAFE_BOX[1], min(y0, SAFE_BOX[3] - bh))
        x0 = max(SAFE_BOX[0], min(x0, SAFE_BOX[2] - bw))
    x1, y1 = x0 + bw, y0 + bh
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    stroke = 0
    if STYLE == "box":
        d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=RADIUS, fill=BOX_FILL, outline=BOX_EDGE, width=2)
    else:
        stroke = max(3, round(px / 14))   # ~4px at 56px, the native in-app look
    color = TEXT_ACCENT if cue.get("emphasis") else TEXT_WHITE
    ty = y0 + PAD_Y
    for line in lines:
        d.text((cx, ty), line, font=f, fill=color, anchor="mt", stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
        ty += lh + 6
    img.save(out_png, compress_level=3)
    return {"id": cue["id"], "start_f": cue["start_f"], "end_f": cue["end_f"], "text": cue["text"],
            "box": [x0, y0, x1, y1], "font_px": px, "lines": len(lines),
            "text_color": list(color[:3]), "box_alpha": (BOX_FILL[3] / 255.0) if STYLE == "box" else 0.0,
            "stroke_px": stroke, "style": STYLE}


def write_blank(path):
    Image, _, _ = _pil()
    Image.new("RGBA", (W, H), (0, 0, 0, 0)).save(path, compress_level=3)


def build_caption_assets(cues, caps_dir, total_frames, y_center=CAPTION_CENTER_Y, clamp=True, y_for=None):
    """Write cue PNGs, blank.png, list.txt (ffconcat) and boxes.json into caps_dir.

    y_for: optional {cue_id: y_center} overrides (the vision pass may move a cue up).
    """
    caps_dir = Path(caps_dir)
    caps_dir.mkdir(parents=True, exist_ok=True)
    for old in caps_dir.glob("cue_*.png"):
        old.unlink()
    write_blank(caps_dir / "blank.png")
    boxes, lines, t = [], ["ffconcat version 1.0"], 0
    last = None
    for c in cues:
        if c["start_f"] > t:
            lines += ["file 'blank.png'", "duration %.6f" % ((c["start_f"] - t) / FPS)]
            last = "blank.png"
        name = "cue_%s.png" % c["id"]
        box = render_cue(c, caps_dir / name, y_center=(y_for or {}).get(c["id"], y_center), clamp=clamp)
        boxes.append(box)
        lines += ["file '%s'" % name, "duration %.6f" % ((c["end_f"] - c["start_f"]) / FPS)]
        last = name
        t = c["end_f"]
    tail = max(0, total_frames + FPS - t)  # one spare second of blank; the output is cut with -frames:v
    lines += ["file 'blank.png'", "duration %.6f" % (tail / FPS), "file 'blank.png'"]
    (caps_dir / "list.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    write_json(caps_dir / "boxes.json", {"schema": "boxes/1", "canvas": [W, H], "safe_box": list(SAFE_BOX), "cues": boxes})
    return boxes
