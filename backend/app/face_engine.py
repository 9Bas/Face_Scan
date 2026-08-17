from __future__ import annotations

import logging
import os
from threading import Lock
from typing import Any

os.environ.setdefault("OMP_NUM_THREADS", "1")

import numpy as np
from insightface.app import FaceAnalysis

from .config import settings

log = logging.getLogger("face_engine")

_app: FaceAnalysis | None = None
_lock = Lock()
_ready = False

def get_face_app() -> FaceAnalysis:
    """Return a singleton FaceAnalysis instance (loads models on first call)."""
    global _app, _ready
    if _app is not None and _ready:
        return _app
    with _lock:
        if _app is not None and _ready:
            return _app
        log.info("loading insightface pack=%s ctx=%s", settings.face_pack, settings.face_ctx_id)
        app = FaceAnalysis(
            name=settings.face_pack,
            ctx_id=settings.face_ctx_id,
            det_size=settings.face_det_size,
        )
        app.prepare(ctx_id=settings.face_ctx_id, det_size=settings.face_det_size)
        _app = app
        _ready = True
        log.info("insightface ready (pack=%s)", settings.face_pack)
    return _app


EMBEDDING_DIM = 512 


class FaceResult:
    """One detected face with bbox + embedding + quality info."""

    __slots__ = (
        "face_index",
        "bbox",
        "embedding",
        "det_score",
        "size",
        "quality_score",
    )

    def __init__(self, face_index: int, face: Any):
        # face.bbox = [x1, y1, x2, y2]
        x1, y1, x2, y2 = [float(v) for v in face.bbox]
        w = x2 - x1
        h = y2 - y1
        self.face_index = face_index
        self.bbox = {"x": x1, "y": y1, "width": w, "height": h}
        # face.embedding is a numpy float32 array of length 512
        emb = np.asarray(face.embedding, dtype=np.float32)
        # L2-normalize so cosine distance via pgvector <=> is well-behaved.
        norm = np.linalg.norm(emb)
        if norm > 1e-12:
            emb = emb / norm
        self.embedding = emb
        self.det_score = float(face.det_score)
        self.size = float(max(w, h))

        size_factor = min(1.0, self.size / 112.0)
        self.quality_score = float(self.det_score * size_factor)

    def to_dict(self) -> dict:
        return {
            "face_index": self.face_index,
            "bbox": self.bbox,
            "det_score": self.det_score,
            "size": self.size,
            "quality_score": self.quality_score,
            "embedding_dim": int(self.embedding.shape[0]),
        }

def detect_faces(image_rgb: np.ndarray) -> list[FaceResult]:
    """Detect ALL faces in an RGB image and return FaceResults (filtered)."""
    app = get_face_app()
    raw = app.get(image_rgb)
    out: list[FaceResult] = []
    for i, f in enumerate(raw):
        x1, y1, x2, y2 = [float(v) for v in f.bbox]
        size = max(x2 - x1, y2 - y1)
        if size < settings.face_min_size:
            continue
        if float(f.det_score) < settings.face_min_detection_confidence:
            continue
        out.append(FaceResult(i, f))
    return out
def embedding_to_pgvector(emb: np.ndarray) -> str:
    """Serialize a 1D float array as a pgvector literal '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{float(x):.6f}" for x in emb) + "]"
