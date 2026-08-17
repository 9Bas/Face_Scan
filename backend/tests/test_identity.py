"""End-to-end identity tests for the face-search pipeline.

These tests hit the live backend at BACKEND_URL (default http://localhost:8000)
and require the backend to be running with Supabase credentials configured.

Run:
    python -m tests.test_identity
    python -m tests.test_identity --url http://localhost:8000

Set IMAGE_A, IMAGE_A_COPY, IMAGE_B (paths) via env to use your own photos;
otherwise the tests are skipped (the pack is real-world-dependent).
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import requests

BACKEND = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
PRINT = print


def _post(path: str, files: dict, params: dict | None = None):
    return requests.post(f"{BACKEND}{path}", files=files, params=params or {}, timeout=120)


def _index(photo_path: Path) -> dict:
    with photo_path.open("rb") as f:
        files = {"file": (photo_path.name, f, "image/jpeg")}
        r = _post("/api/faces/index?photo_id=test-self", files)
    # photo_id=test-self won't exist — backend will attempt to fetch it from DB
    # and 404. For True identity tests we use the search-against-self test below.
    return r.json() if r.ok else {"status_code": r.status_code, "body": r.text}


def _detect(photo_path: Path) -> dict:
    """Use the debug detect endpoint (no DB)."""
    with photo_path.open("rb") as f:
        files = {"file": (photo_path.name, f, "image/jpeg")}
        r = _post("/api/faces/debug/detect", files)
    r.raise_for_status()
    return r.json()


def _search(photo_path: Path, max_distance: float = 0.6) -> dict:
    with photo_path.open("rb") as f:
        files = {"file": (photo_path.name, f, "image/jpeg")}
        r = _post("/api/faces/search", files, {"max_distance": max_distance, "top_k": 30})
    r.raise_for_status()
    return r.json()


def _embedding_of(photo_path: Path) -> list[float] | None:
    data = _detect(photo_path)
    faces = data.get("faces", [])
    if not faces:
        return None
    # pick largest face
    biggest = max(faces, key=lambda f: f["bbox"]["width"] * f["bbox"]["height"])
    return biggest["embedding"]


def cosine(a: list[float], b: list[float]) -> float:
    import math

    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 1.0
    return 1.0 - (dot / (na * nb))


def _env_path(name: str) -> Path | None:
    val = os.environ.get(name, "").strip()
    if not val:
        return None
    p = Path(val).expanduser()
    return p if p.exists() else None


def test_exact_same_embedding():
    """Embedding an image twice must yield ~identical (distance ~0)."""
    p = _env_path("IMAGE_A")
    if p is None:
        PRINT("[SKIP] test_exact_same_embedding (set IMAGE_A to a face photo)")
        return "skip"
    e1 = _embedding_of(p)
    e2 = _embedding_of(p)
    if e1 is None or e2 is None:
        PRINT("[FAIL] test_exact_same_embedding: no face detected")
        return "fail"
    d = cosine(e1, e2)
    ok = d < 0.02
    PRINT(f"[{'PASS' if ok else 'FAIL'}] same image embed distance={d:.5f}")
    return "pass" if ok else "fail"


def test_multi_face_detect():
    """A photo with multiple people must yield multiple embeddings."""
    p = _env_path("IMAGE_MULTIFACE")
    if p is None:
        PRINT("[SKIP] test_multi_face_detect (set IMAGE_MULTIFACE to a group photo)")
        return "skip"
    data = _detect(p)
    n = data.get("faces_detected", 0)
    ok = n >= 2
    PRINT(f"[{'PASS' if ok else 'FAIL'}] multi-face detect n={n}")
    if not ok:
        return "fail"
    dims = {len(f["embedding"]) for f in data["faces"]}
    ok2 = dims == {512}
    PRINT(f"[{'PASS' if ok2 else 'FAIL'}] all embeddings dim=512 ({dims})")
    return "pass" if ok and ok2 else "fail"


def test_different_people_far():
    """Two different faces must have a high cosine distance (>0.4 typically)."""
    a = _env_path("IMAGE_A")
    b = _env_path("IMAGE_B")
    if a is None or b is None:
        PRINT("[SKIP] test_different_people_far (need both IMAGE_A and IMAGE_B)")
        return "skip"
    ea = _embedding_of(a)
    eb = _embedding_of(b)
    if ea is None or eb is None:
        PRINT("[FAIL] test_different_people_far: no face detected in one image")
        return "fail"
    d = cosine(ea, eb)
    ok = d > 0.4
    PRINT(f"[{'PASS' if ok else 'FAIL'}] different-people distance={d:.4f} (expect >0.4)")
    return "pass" if ok else "fail"


def test_search_health():
    """Backend health endpoint must report ok with pack=buffalo_l and 512-dim."""
    r = requests.get(f"{BACKEND}/api/faces/health", timeout=10)
    r.raise_for_status()
    d = r.json()
    ok = d["embedding_dim"] == 512 and d["pack"] == "buffalo_l"
    PRINT(f"[{'PASS' if ok else 'FAIL'}] health {d}")
    return "pass" if ok else "fail"


def main():
    PRINT(f"== identity tests against {BACKEND} ==")
    results = []
    results.append(("search_health", test_search_health()))
    results.append(("same_image_embedding", test_exact_same_embedding()))
    results.append(("different_people", test_different_people_far()))
    results.append(("multi_face_detect", test_multi_face_detect()))
    PRINT("\nSummary:")
    fails = 0
    for name, r in results:
        PRINT(f"  {name}: {r}")
        if r == "fail":
            fails += 1
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())