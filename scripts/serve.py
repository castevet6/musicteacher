"""Static dev server that disables browser caching, so edits show on reload."""
import http.server
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print(f"Serving on http://localhost:{port}")
http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
