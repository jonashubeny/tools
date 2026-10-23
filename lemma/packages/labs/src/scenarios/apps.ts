/**
 * Small Python services the scenarios install on their machines. Each is a stand-in for a
 * real application: it listens on a port, answers /health, and fails the way real ones do.
 * Only the standard library is used, so they run on the plain lab image.
 */

/**
 * ledger: keeps records in DATA_DIR and logs to LOG_FILE through a handle it holds open —
 * so deleting the log while it runs frees nothing. With LOG_LEVEL=debug it chatters.
 * /health writes a 64 KiB probe file, and so fails when the disk is full.
 */
export const LEDGER_APP = String.raw`#!/usr/bin/env python3
import http.server, json, logging, os, threading, time

DATA = os.environ.get("DATA_DIR", "/srv/data/ledger")
LOG = os.environ.get("LOG_FILE", "/srv/data/log/ledger.log")
LEVEL = os.environ.get("LOG_LEVEL", "info").lower()
PORT = int(os.environ.get("PORT", "8080"))

handler = logging.FileHandler(LOG)
handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
log = logging.getLogger("ledger")
log.addHandler(handler)
log.setLevel(logging.DEBUG if LEVEL == "debug" else logging.INFO)

def chatter():
    while True:
        log.debug("cache probe key=%s payload=%s", time.time(), "x" * 400)
        time.sleep(0.02)

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path != "/health":
            return self.reply(404, {"error": "not found"})
        probe = os.path.join(DATA, ".probe")
        try:
            with open(probe, "wb") as f:
                f.write(b"x" * 65536)
                f.flush()
                os.fsync(f.fileno())
            os.remove(probe)
        except OSError as error:
            log.error("health probe failed: %s", error)
            return self.reply(503, {"status": "error", "detail": str(error)})
        with open(os.path.join(DATA, "records.txt")) as f:
            records = sum(1 for _ in f)
        self.reply(200, {"status": "ok", "records": records})

if __name__ == "__main__":
    log.info("ledger starting on port %d, log level %s", PORT, LEVEL)
    if LEVEL == "debug":
        threading.Thread(target=chatter, daemon=True).start()
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
`;

/** A JSON-configured inventory API: reads CONFIG at start and exits loudly if it cannot. */
export const INVENTORY_APP = String.raw`#!/usr/bin/env python3
import http.server, json, os, sys

CONFIG = os.environ.get("CONFIG", "/etc/inventory/config.json")
try:
    with open(CONFIG) as f:
        config = json.load(f)
except (OSError, ValueError) as error:
    print(f"inventory: cannot load {CONFIG}: {error}", file=sys.stderr)
    sys.exit(78)

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/health":
            body = {"status": "ok", "items": len(config.get("items", []))}
        elif self.path == "/items":
            body = config.get("items", [])
        else:
            self.send_response(404)
            self.end_headers()
            return
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(data)

print(f"inventory: serving {len(config.get('items', []))} items on port {config['port']}", flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", int(config["port"])), Handler).serve_forever()
`;

/** A generic small web app: PORT and TITLE from the environment, /health and /. */
export const WEB_APP = String.raw`#!/usr/bin/env python3
import http.server, json, os

PORT = int(os.environ.get("PORT", "8000"))
TITLE = os.environ.get("TITLE", "app")
BIND = os.environ.get("BIND", "127.0.0.1")

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/health":
            data = json.dumps({"status": "ok", "app": TITLE}).encode()
            kind = "application/json"
        else:
            data = f"<!doctype html><title>{TITLE}</title><h1>{TITLE}</h1>\n".encode()
            kind = "text/html"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

print(f"{TITLE}: listening on {BIND}:{PORT}", flush=True)
http.server.ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()
`;

/** Write a file from a heredoc in a provisioning script; the delimiter never occurs in the apps. */
export const writeFile = (path: string, content: string, mode = '0644'): string =>
  `install -d "$(dirname ${path})"\ncat > ${path} <<'LEMMA_EOF'\n${content}\nLEMMA_EOF\nchmod ${mode} ${path}\n`;
