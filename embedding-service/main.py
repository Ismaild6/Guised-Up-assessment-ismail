"""
Minimal embedding HTTP service — stdlib only so it runs anywhere.
Optional: pip install sentence-transformers for real vectors.
"""
import hashlib
import json
import math
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8001"))
USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"
_model = None


def load_model():
    global _model
    if _model is not None:
        return _model
    try:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("all-MiniLM-L6-v2")
        return _model
    except Exception:
        return None


def mock_embed(text: str, dim: int = 384) -> list:
    digest = hashlib.sha256(text.strip().lower().encode()).hexdigest()
    vec = []
    for i in range(dim):
        start = (i * 2) % len(digest)
        chunk = digest[start : start + 8]
        val = int(chunk, 16) / 0xFFFFFFFF
        vec.append(val * 2 - 1)
    mag = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / mag for v in vec]


def embed_text(text: str) -> tuple[list, str]:
    text = text.strip()
    if not text:
        return [0.0] * 384, "empty"

    if not USE_MOCK:
        model = load_model()
        if model is not None:
            return model.encode(text).tolist(), "all-MiniLM-L6-v2"

    return mock_embed(text), "mock-hash-v1"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # keep logs quiet

    def _json(self, code: int, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlparse(self.path).path == "/health":
            self._json(200, {"ok": True, "mock": USE_MOCK or load_model() is None})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if urlparse(self.path).path != "/embed":
            self._json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
            text = data.get("text", "")
        except json.JSONDecodeError:
            self._json(400, {"error": "invalid json"})
            return

        vector, model = embed_text(text)
        self._json(200, {"embedding": vector, "model": model})


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), Handler)
    print(f"embedding service on http://{HOST}:{PORT}")
    server.serve_forever()
