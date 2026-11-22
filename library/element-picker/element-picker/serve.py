"""Element Picker server. Python 3 only, standard library only.

    python serve.py                      serve the kit's own examples/ folder
    python serve.py my-video             serve your own video folder
    python serve.py my-video 9000        ... on port 9000 (the default is 8765)
    python serve.py 9000                 the examples, on port 9000

What it does
  - Serves your video folder at /, so the page you want to pick from loads from the same origin as the picker.
  - Serves the picker itself at /__picker/ (the picker/ folder next to this file).
  - Saves your picks to picks.json next to this file (never inside your video folder).
  - Listens on 127.0.0.1 only, so nobody else on your network can reach it.
  - Refuses any path outside the folders it serves, hidden files (.git, .env) and any request whose Host
    header is not localhost.

Open the picker at  http://localhost:8765/__picker/index.html?page=<path of your page inside the folder>
"""
import http.server
import json
import mimetypes
import os
import re
import socket
import socketserver
import sys
import tempfile
import threading
import urllib.parse
from html import escape

KIT = os.path.dirname(os.path.abspath(__file__))
PICKER_DIR = os.path.join(KIT, "picker")
STATE_FILE = os.path.join(KIT, "picks.json")
DEFAULT_PORT = 8765
MAX_POST = 60 * 1024 * 1024  # picks plus thumbnails stay far below this
LOCK = threading.Lock()

# Windows can map .js to text/plain through its registry; set the types we need by hand.
TYPES = {
    ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
    ".wasm": "application/wasm", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
    ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".map": "application/json",
}


def parse_args(argv):
    folder, port = None, DEFAULT_PORT
    args = list(argv)
    if args and args[0].isdigit() and not os.path.isdir(args[0]):
        port = int(args.pop(0))
    elif args:
        folder = args.pop(0)
    if args:
        if not args[0].isdigit():
            sys.exit("The port must be a number, for example: python serve.py my-video 9000")
        port = int(args[0])
    return folder, port


def safe_join(root, rel):
    """Map a URL path to a file inside root. Returns None for anything that could leave root."""
    parts = []
    for seg in rel.split("/"):
        if seg in ("", "."):
            continue
        if seg == ".." or seg.startswith(".") or "\\" in seg or "\x00" in seg or ":" in seg:
            return None
        parts.append(seg)
    real_root = os.path.realpath(root)
    full = os.path.realpath(os.path.join(real_root, *parts)) if parts else real_root
    a, b = os.path.normcase(full), os.path.normcase(real_root)
    if a != b and not a.startswith(b.rstrip(os.sep) + os.sep):
        return None
    return full


def find_pages(root, limit=300, depth=5):
    """Every .html page under root (skips hidden folders and node_modules)."""
    out = []
    base = os.path.realpath(root)
    for dirpath, dirnames, filenames in os.walk(base):
        rel_dir = os.path.relpath(dirpath, base)
        level = 0 if rel_dir == "." else rel_dir.count(os.sep) + 1
        dirnames[:] = sorted(d for d in dirnames if not d.startswith(".") and d != "node_modules" and level < depth)
        for f in sorted(filenames):
            if f.lower().endswith((".html", ".htm")) and not f.startswith("."):
                rel = f if rel_dir == "." else rel_dir.replace(os.sep, "/") + "/" + f
                out.append(rel)
                if len(out) >= limit:
                    return out
    return out


def page_titles(root, pages):
    """The <title> of each page (first 4 KB only), so the chooser can say what each page is."""
    out = {}
    for rel in pages:
        path = safe_join(root, rel)
        if not path:
            continue
        try:
            with open(path, "rb") as f:
                head = f.read(4096).decode("utf-8", "ignore")
        except OSError:
            continue
        m = re.search(r"<title[^>]*>(.*?)</title>", head, re.I | re.S)
        if m and m.group(1).strip():
            out[rel] = " ".join(m.group(1).split())[:90]
    return out


def load_state():
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("keys"), dict):
            return data
    except (OSError, ValueError):
        pass
    return {"keys": {}}


def save_state(state):
    fd, tmp = tempfile.mkstemp(prefix=".picks-", suffix=".tmp", dir=KIT)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=1)
        os.replace(tmp, STATE_FILE)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def chooser_page(root, folder):
    """A plain list of the .html pages under `folder`, each linking to the picker (links are relative to the video root)."""
    real_root = os.path.realpath(root)
    prefix = os.path.relpath(os.path.realpath(folder), real_root).replace(os.sep, "/")
    rows = []
    pages = find_pages(folder)
    titles = page_titles(folder, pages)
    for p in pages:
        rel = p if prefix == "." else prefix + "/" + p
        href = "/__picker/index.html?page=" + urllib.parse.quote(rel)
        rows.append('<li><a href="%s">%s</a> <span>%s</span></li>' % (escape(href, True), escape(rel), escape(titles.get(p, ""))))
    body = "<ul>" + "".join(rows) + "</ul>" if rows else "<p>No .html pages found in this folder.</p>"
    return (
        "<!doctype html><meta charset=utf-8><title>Element Picker</title>"
        "<meta name=viewport content='width=device-width,initial-scale=1'>"
        "<style>body{font:16px/1.5 system-ui,sans-serif;background:#131311;color:#e8e2d2;max-width:680px;margin:48px auto;padding:0 20px}"
        "a{color:#ff6b1a}li{margin:6px 0}li span{color:#8d8775;font-size:14px}h1{font-weight:500}code{color:#8d8775}</style>"
        "<h1>Element Picker</h1><p>Pick a page to open in the picker.</p>" + body +
        "<p><code>" + escape(os.path.basename(real_root)) + "/" + ("" if prefix == "." else escape(prefix) + "/") + "</code></p>"
    ).encode("utf-8")


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "ElementPicker"
    protocol_version = "HTTP/1.1"
    video_root = None
    allowed_hosts = set()

    # ---- helpers -------------------------------------------------------------------------------------
    def log_message(self, *args):
        pass

    def _send(self, code, body=b"", ctype="text/plain; charset=utf-8", extra=None, head=False):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if not head:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _json(self, obj, code=200, head=False):
        self._send(code, json.dumps(obj).encode("utf-8"), "application/json", head=head)

    def _host_ok(self):
        host = (self.headers.get("Host") or "").lower()
        return not host or host in self.allowed_hosts

    def _origin_ok(self):
        origin = self.headers.get("Origin")
        if not origin or origin == "null":
            return origin is None
        host = urllib.parse.urlsplit(origin).netloc.lower()
        return host in self.allowed_hosts

    def _file(self, path, head=False):
        try:
            size = os.path.getsize(path)
            f = open(path, "rb")
        except OSError:
            return self._send(404, b"Not found", head=head)
        with f:
            ext = os.path.splitext(path)[1].lower()
            ctype = TYPES.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"
            start, end, code = 0, size - 1, 200
            rng = self.headers.get("Range")
            extra = {"Accept-Ranges": "bytes"}
            if rng and size:
                m = re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
                if m and (m.group(1) or m.group(2)):
                    if m.group(1):
                        start = int(m.group(1))
                        end = int(m.group(2)) if m.group(2) else size - 1
                    else:
                        start = max(0, size - int(m.group(2)))
                    end = min(end, size - 1)
                    if start > end or start >= size:
                        return self._send(416, b"", extra={"Content-Range": "bytes */%d" % size}, head=head)
                    code = 206
                    extra["Content-Range"] = "bytes %d-%d/%d" % (start, end, size)
            length = end - start + 1 if size else 0
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(length))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            for k, v in extra.items():
                self.send_header(k, v)
            self.end_headers()
            if head or not length:
                return
            try:
                f.seek(start)
                left = length
                while left > 0:
                    chunk = f.read(min(65536, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _static(self, root, rel, head=False, chooser_root=None):
        path = safe_join(root, rel)
        if path is None:
            return self._send(403, b"Forbidden", head=head)
        if os.path.isdir(path):
            index = os.path.join(path, "index.html")
            if os.path.isfile(index):
                return self._file(index, head)
            if chooser_root is not None:
                return self._send(200, chooser_page(chooser_root, path), "text/html; charset=utf-8", head=head)
            return self._send(404, b"Not found", head=head)
        if not os.path.isfile(path):
            return self._send(404, b"Not found", head=head)
        return self._file(path, head)

    # ---- routes --------------------------------------------------------------------------------------
    def _route(self, head=False):
        if not self._host_ok():
            return self._send(403, b"Forbidden host", head=head)
        url = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(url.path)
        if path.startswith("/api/state/") or path == "/api/state":
            with LOCK:
                return self._json(load_state(), head=head)
        if path == "/__picker/api/pages":
            pages = find_pages(self.video_root)
            return self._json({"pages": pages, "titles": page_titles(self.video_root, pages), "root": os.path.basename(os.path.realpath(self.video_root))}, head=head)
        if path == "/__picker/api/exists":
            rel = urllib.parse.parse_qs(url.query).get("path", [""])[0]
            real = safe_join(self.video_root, rel.lstrip("/"))
            return self._json({"ok": bool(real and os.path.isfile(real)), "path": rel}, head=head)
        if path == "/__picker":
            return self._send(302, b"", extra={"Location": "/__picker/"}, head=head)
        if path.startswith("/__picker/"):
            rel = path[len("/__picker/"):] or "index.html"
            return self._static(PICKER_DIR, rel, head)
        return self._static(self.video_root, path.lstrip("/"), head, chooser_root=self.video_root)

    def do_GET(self):
        self._route()

    def do_HEAD(self):
        self._route(head=True)

    def do_POST(self):
        if not self._host_ok() or not self._origin_ok():
            return self._send(403, b"Forbidden", head=False)
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if not (path.startswith("/api/state/") or path == "/api/state"):
            return self._send(404, b"Not found")
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n < 0 or n > MAX_POST:
                self.close_connection = True  # the body is not read, so this connection can not be reused
                return self._json({"ok": False, "error": "too big"}, 413)
            body = json.loads(self.rfile.read(n) or b"{}")
            update = body.get("set") or {}
            if not isinstance(update, dict):
                raise ValueError("set must be an object")
        except (ValueError, OSError, AttributeError):
            return self._json({"ok": False}, 400)
        with LOCK:
            state = load_state()
            state["keys"].update({str(k): v for k, v in update.items() if isinstance(v, str)})
            try:
                save_state(state)
            except OSError as e:
                return self._json({"ok": False, "error": str(e)}, 500)
        return self._json({"ok": True})

    def do_PUT(self):
        self._send(405, b"Method not allowed")

    do_DELETE = do_PATCH = do_PUT


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    # On Windows, "reuse address" lets a second server take a port that is already in use. Ask for the opposite there.
    allow_reuse_address = os.name != "nt"

    def server_bind(self):
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    folder, port = parse_args(sys.argv[1:])
    root = os.path.abspath(folder) if folder else os.path.join(KIT, "examples")
    if not os.path.isdir(root):
        sys.exit("That folder does not exist: " + root)
    if not os.path.isdir(PICKER_DIR):
        sys.exit("The picker/ folder is missing next to serve.py")
    Handler.video_root = root
    Handler.allowed_hosts = {"localhost:%d" % port, "127.0.0.1:%d" % port}
    try:
        server = Server(("127.0.0.1", port), Handler)
    except OSError as e:
        sys.exit("Could not use port %d (%s). Try another one: python serve.py %s %d" % (port, e.strerror or e, folder or "", port + 1))
    base = "http://localhost:%d" % port
    pages = find_pages(root)
    say = lambda text: print(text, flush=True)  # noqa: E731  (flush: the lines show at once even when output is piped)
    say("Element Picker is running.")
    say("  Video folder : " + root)
    say("  Picks file   : " + STATE_FILE)
    if len(pages) == 1 or "index.html" in pages:
        first = "index.html" if "index.html" in pages else pages[0]
        say("  Open         : %s/__picker/index.html?page=%s" % (base, urllib.parse.quote(first)))
    else:
        say("  Open         : %s/__picker/index.html   (lists the pages it found)" % base)
        for p in pages[:8]:
            say("                 %s/__picker/index.html?page=%s" % (base, urllib.parse.quote(p)))
    say("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
