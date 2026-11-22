"""Make icon16.png, icon48.png and icon128.png for a Chrome extension.

Uses only Python's standard library, for agents with no image tool.
Draws a dark rounded square with a lighter dot in the middle, so the
icon is easy to spot in the toolbar.

Usage:
    python make_icons.py <extension-folder> [square-hex] [dot-hex]
Example:
    python make_icons.py extensions/my-tool 131311 f2a33a
"""
import os
import struct
import sys
import zlib


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def pixel(x, y, size, square, dot):
    radius = size * 0.2
    # Transparent outside the rounded corners.
    cx = min(max(x + 0.5, radius), size - radius)
    cy = min(max(y + 0.5, radius), size - radius)
    if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > radius ** 2:
        return (0, 0, 0, 0)
    mid = size / 2
    if (x + 0.5 - mid) ** 2 + (y + 0.5 - mid) ** 2 <= (size * 0.22) ** 2:
        return dot + (255,)
    return square + (255,)


def png(size, square, dot):
    rows = b""
    for y in range(size):
        rows += b"\x00" + b"".join(bytes(pixel(x, y, size, square, dot)) for x in range(size))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    folder = sys.argv[1]
    square = hex_rgb(sys.argv[2]) if len(sys.argv) > 2 else (0x13, 0x13, 0x11)
    dot = hex_rgb(sys.argv[3]) if len(sys.argv) > 3 else (0xF2, 0xA3, 0x3A)
    os.makedirs(folder, exist_ok=True)
    for size in (16, 48, 128):
        path = os.path.join(folder, "icon%d.png" % size)
        with open(path, "wb") as f:
            f.write(png(size, square, dot))
        print("wrote", path)


if __name__ == "__main__":
    main()
