"""Renders the sample pitch's key frames from frames.html into frames/01.jpg to frames/04.jpg (1280x720).

This is how the stills in projects/sample-pitch were made. Use it as a pattern for your own pitch: draw each shot
as a simple HTML mock-up, screenshot it, then list the images in a spec for make-pitch.mjs.

Needs Python 3.9+ with Playwright:  pip install playwright   then:  python -m playwright install chromium

    python render.py
    node ../../make-pitch.mjs pitch.json
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
SHOTS = 4
out = HERE / "frames"
out.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--hide-scrollbars"])
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errors = []
    page.on("pageerror", lambda ex: errors.append(str(ex)[:200]))
    page.goto((HERE / "frames.html").as_uri(), wait_until="load")
    page.wait_for_function("window.__ready === true", timeout=30000)
    if not page.evaluate("document.fonts ? document.fonts.check('600 40px Outfit') : false"):
        print("note: the Outfit font did not load (offline?), so the frames use a fallback font")
    for n in range(1, SHOTS + 1):
        page.evaluate("n => { show(n); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))); }", n)
        page.screenshot(path=str(out / f"{n:02d}.jpg"), type="jpeg", quality=90)
        print(f"frames/{n:02d}.jpg")
    browser.close()

if errors:
    print("page errors:", errors)
