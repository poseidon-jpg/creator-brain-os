"""RUBRIC Storyboards (beta) · exports a final video to MP4. The app runs it from the Export MP4 button.

The final page exposes window.__reel = { duration, fps, width, height, seek(t), audio(sampleRate) } (the contract
in prompts.mjs). This seeks every frame, screenshots it at the page's own size, pipes the frames into ffmpeg,
then renders the soundtrack offline through audio() and muxes it in.

Needs Python 3.9+ with Playwright (pip install playwright, then: python -m playwright install chromium) and ffmpeg.

    python export.py <page url> <out.mp4> [--fps 60]
"""
import argparse
import base64
import os
import shutil
import struct
import subprocess
import sys

if not shutil.which("ffmpeg"):
    sys.exit("ffmpeg was not found. Install it (https://ffmpeg.org/download.html) and make sure the ffmpeg command works in a terminal.")
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("Playwright for Python is missing. Run: pip install playwright   then: python -m playwright install chromium")

ap = argparse.ArgumentParser()
ap.add_argument("url")
ap.add_argument("out")
ap.add_argument("--fps", type=int, default=60)
a = ap.parse_args()

AUDIO_JS = """async () => {
  if (!window.__reel.audio) return null;
  const s = await window.__reel.audio(48000);
  if (!s || !s.left) return null;
  const L = s.left, R = s.right || s.left, n = L.length, pcm = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767;
    pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}"""


def wav(path, pcm, rate=48000, ch=2):
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt ")
        f.write(struct.pack("<IHHIIHH", 16, 1, ch, rate, rate * ch * 2, ch * 2, 16))
        f.write(b"data" + struct.pack("<I", len(pcm)) + pcm)


video_tmp = a.out + ".video.mp4"
wav_tmp = a.out + ".audio.wav"
with sync_playwright() as p:
    browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"])
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    errors = []
    page.on("pageerror", lambda ex: errors.append(str(ex)[:200]))
    page.goto(a.url, wait_until="load", timeout=90000)
    page.wait_for_function("window.__reel && window.__reel.duration > 0", timeout=60000)
    info = page.evaluate("({ d: __reel.duration, w: __reel.width || 1920, h: __reel.height || 1080 })")
    page.set_viewport_size({"width": int(info["w"]), "height": int(info["h"])})
    page.evaluate("document.fonts ? document.fonts.ready.then(() => true) : true")
    page.wait_for_timeout(1200)
    n = int(round(info["d"] * a.fps))
    print(f"exporting {n} frames at {int(info['w'])}x{int(info['h'])}", flush=True)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(a.fps), "-c:v", "png", "-i", "-",
                           "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video_tmp],
                          stdin=subprocess.PIPE)
    for i in range(n):
        page.evaluate("t => { window.__reel.seek(t); return new Promise(r => requestAnimationFrame(() => r(true))); }", i / a.fps)
        ff.stdin.write(page.screenshot(type="png"))
        if i % 30 == 0:
            print(f"frame {i} of {n}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("rendering the soundtrack", flush=True)
    b64 = None
    try:
        b64 = page.evaluate(AUDIO_JS)
    except Exception as e:  # a page without working audio still exports its picture
        print(f"no soundtrack: {str(e)[:160]}", flush=True)
    browser.close()

if ff.returncode != 0 or not os.path.exists(video_tmp):
    sys.exit("ffmpeg failed while encoding the frames")
if b64:
    wav(wav_tmp, base64.b64decode(b64))
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video_tmp, "-i", wav_tmp, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                        "-shortest", "-movflags", "+faststart", a.out])
    os.remove(wav_tmp)
    os.remove(video_tmp)
    if r.returncode != 0:
        sys.exit("ffmpeg failed while adding the soundtrack")
else:
    os.replace(video_tmp, a.out)
if errors:
    print("page errors: " + " | ".join(errors[:3]), flush=True)
print(f"done {a.out}", flush=True)
