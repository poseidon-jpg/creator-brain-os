"""Record a template (or your own video page) to MP4, frame by frame, in a hidden browser.

A page is recordable when it follows the page contract:
  window.DURATION        length in seconds (default 5)
  window.ready           optional Promise: resolves when fonts and images are loaded
  window.renderAt(t)     draws the exact frame for time t (a function of t only, no real-time clock)

Needs: Python 3, `pip install playwright`, `playwright install chromium`, and ffmpeg on your PATH.
Set CHROME_PATH to use an installed Chrome or Edge instead of the downloaded Chromium.

  python record.py <folder>                        render <folder>/index.html to <folder>/render.mp4 (1920x1080, 30 fps)
  python record.py <folder> --stills 0.3,1.2,2.4   PNG checks into <folder>/_stills/ (look at these before a full render)
  python record.py <folder> --frames 0,45,90       the same, by frame number
  python record.py <folder> --out my-clip.mp4 --fps 30 --size 1920x1080
"""
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


def arg(name, default=None):
    a = sys.argv[1:]
    return a[a.index(name) + 1] if name in a else default


if len(sys.argv) < 2 or sys.argv[1].startswith("--"):
    sys.exit(__doc__)
FOLDER = Path(sys.argv[1]).resolve()
if not (FOLDER / "index.html").exists():
    sys.exit(f"no index.html in {FOLDER}")
FPS = int(arg("--fps", 30))
W, H = (int(v) for v in arg("--size", "1920x1080").lower().split("x"))
OUT = Path(arg("--out", str(FOLDER / "render.mp4")))
CHROME = os.environ.get("CHROME_PATH")
NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0
ARGS = ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"]
ARGS += ["--use-angle=d3d11"] if sys.platform == "win32" else ["--use-gl=angle", "--use-angle=swiftshader"]
WAIT_FRAME = "() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"


def open_page(browser):
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto((FOLDER / "index.html").as_uri() + "?capture=1", wait_until="load", timeout=120000)
    page.wait_for_function("typeof window.renderAt === 'function'", timeout=60000)
    page.evaluate("async () => { await document.fonts.ready; if (window.ready) await window.ready; }")
    return page, errors, float(page.evaluate("window.DURATION || 5"))


def seek(page, t):
    page.evaluate("async t => { await window.renderAt(t); }", t)
    page.evaluate(WAIT_FRAME)


def report(errors):
    if errors:
        print("page errors:")
        for e in errors[:10]:
            print("  ", e)


def stills(browser, times, by_frame=False):
    out = FOLDER / "_stills"
    out.mkdir(exist_ok=True)
    page, errors, _ = open_page(browser)
    for t in times:
        seek(page, t)
        path = out / (f"f{round(t * FPS):04d}.png" if by_frame else f"t{t:07.3f}.png")
        page.screenshot(path=str(path))
        print("still", path)
    page.close()
    report(errors)


def render(browser):
    page, errors, duration = open_page(browser)
    frames = round(duration * FPS)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", str(FPS), str(OUT)]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE, creationflags=NO_WINDOW)
    start = time.time()
    for i in range(frames):
        seek(page, i / FPS)
        enc.stdin.write(page.screenshot(type="png"))
    enc.stdin.close()
    enc.wait()
    page.close()
    print(f"rendered {OUT} ({frames} frames, {time.time() - start:.0f}s, exit {enc.returncode})")
    report(errors)
    return enc.returncode == 0


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True, args=ARGS) if CHROME else p.chromium.launch(headless=True, args=ARGS)
        ok = True
        if arg("--stills"):
            stills(browser, [float(x) for x in arg("--stills").split(",")])
        elif arg("--frames"):
            stills(browser, [int(x) / FPS for x in arg("--frames").split(",")], by_frame=True)
        else:
            ok = render(browser)
        browser.close()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
