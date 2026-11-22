#!/usr/bin/env python3
"""Download a public YouTube video's thumbnail, plus its title and channel.

No API key and no extra packages, only the Python standard library.

Usage:
  python download_youtube_thumbnail.py "https://youtu.be/VIDEO_ID"
  python download_youtube_thumbnail.py "https://www.youtube.com/watch?v=VIDEO_ID" --out-dir path/to/library

It tries the largest size first (maxres, then sd, then hq), saves the image and a
.json file beside it with the title and channel, and prints the image path.
"""
from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_OUT_DIR = Path("thumbnails")
CANDIDATES = ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"]
ID_PATTERN = r"[A-Za-z0-9_-]{11}"


def extract_video_id(value: str) -> str:
    value = value.strip()
    if re.fullmatch(ID_PATTERN, value):
        return value
    parsed = urllib.parse.urlparse(value)
    host = parsed.netloc.lower()
    if "youtu.be" in host:
        candidate = parsed.path.strip("/").split("/")[0]
        if re.fullmatch(ID_PATTERN, candidate):
            return candidate
    query_id = urllib.parse.parse_qs(parsed.query).get("v", [None])[0]
    if query_id and re.fullmatch(ID_PATTERN, query_id):
        return query_id
    match = re.search(r"(?:embed|shorts|live)/(" + ID_PATTERN + ")", parsed.path)
    if match:
        return match.group(1)
    raise SystemExit(f"Could not find an 11-character YouTube video ID in: {value}")


def fetch_json(url: str, timeout: int = 20) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def download(url: str, destination: Path, timeout: int = 30) -> bool:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = response.read()
    except (urllib.error.HTTPError, urllib.error.URLError):
        return False
    # YouTube serves a tiny grey placeholder when a size does not exist.
    if len(data) < 10_000:
        return False
    destination.write_bytes(data)
    return True


def jpeg_dimensions(path: Path) -> tuple[int | None, int | None]:
    data = path.read_bytes()
    if not data.startswith(b"\xff\xd8"):
        return None, None
    sof_markers = set(range(0xC0, 0xC4)) | set(range(0xC5, 0xC8)) | set(range(0xC9, 0xCC)) | set(range(0xCD, 0xD0))
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        i += 2
        if marker in (0xD8, 0xD9):
            continue
        if i + 2 > len(data):
            break
        length = int.from_bytes(data[i:i + 2], "big")
        if marker in sof_markers:
            height = int.from_bytes(data[i + 3:i + 5], "big")
            width = int.from_bytes(data[i + 5:i + 7], "big")
            return width, height
        i += length
    return None, None


def main() -> int:
    parser = argparse.ArgumentParser(description="Download a public YouTube video's thumbnail.")
    parser.add_argument("url_or_id", help="YouTube URL, youtu.be URL, Shorts URL, or 11-character video ID")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Folder to save into (default: ./thumbnails)")
    parser.add_argument("--prefix", default="youtube", help="Filename prefix")
    args = parser.parse_args()

    video_id = extract_video_id(args.url_or_id)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    base = f"{args.prefix}_{video_id}_thumbnail"

    meta: dict = {
        "source_input": args.url_or_id,
        "video_id": video_id,
        "video_url": f"https://www.youtube.com/watch?v={video_id}",
        "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    try:
        oembed = "https://www.youtube.com/oembed?" + urllib.parse.urlencode({
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "format": "json",
        })
        meta.update(fetch_json(oembed))
    except Exception as exc:  # the thumbnail is still useful without the title
        meta["oembed_error"] = str(exc)

    chosen: tuple[str, Path, str] | None = None
    for candidate in CANDIDATES:
        cdn_url = f"https://img.youtube.com/vi/{video_id}/{candidate}"
        destination = out_dir / f"{base}_{candidate}"
        if download(cdn_url, destination):
            chosen = (candidate, destination, cdn_url)
            break
        if destination.exists():
            destination.unlink()

    if not chosen:
        raise SystemExit(f"Could not download a usable thumbnail for video ID: {video_id}")

    resolution, image_path, thumbnail_url = chosen
    width, height = jpeg_dimensions(image_path)
    meta.update({
        "thumbnail_url": thumbnail_url,
        "resolution_source": resolution,
        "local_path": str(image_path.resolve()),
        "bytes": image_path.stat().st_size,
        "width": width,
        "height": height,
    })
    metadata_path = image_path.with_suffix(".json")
    metadata_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps({
        "image": str(image_path.resolve()),
        "metadata": str(metadata_path.resolve()),
        "title": meta.get("title"),
        "channel": meta.get("author_name"),
        "video_id": video_id,
        "width": width,
        "height": height,
        "source": thumbnail_url,
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
