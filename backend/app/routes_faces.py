"""Face indexing + search API routes."""
from __future__ import annotations

import logging
import time
from typing import Any

import numpy as np
from fastapi import APIRouter, File, Header, HTTPException, Query, UploadFile

from . import face_engine, image_io, indexer, supabase_client as sbc
from .config import settings

log = logging.getLogger("faces")
router = APIRouter(prefix="/api/faces", tags=["faces"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_index_auth(x_api_key: str | None) -> None:
    if settings.index_api_key:
        if not x_api_key or x_api_key != settings.index_api_key:
            raise HTTPException(status_code=401, detail="invalid index api key")


# ---------------------------------------------------------------------------
# POST /api/faces/index  — index one photo (by photo_id) or a raw upload.
# ---------------------------------------------------------------------------


@router.post("/index")
async def index_photo(
    photo_id: str | None = Query(None, description="Existing photo id to (re)index"),
    file: UploadFile | None = File(None, description="Or upload a raw image to index"),
    x_api_key: str | None = Header(None),
):
    """Detect ALL faces in a photo and store one embedding per face."""
    _check_index_auth(x_api_key)
    t0 = time.time()

    if not photo_id and file is None:
        raise HTTPException(400, "provide either photo_id or file")

    # Resolve image bytes
    if file is not None:
        data = await file.read()
        image_rgb = image_io.load_image_bytes(data)
        # If photo_id not supplied, we cannot store by reference — return preview only.
        if not photo_id:
            faces = face_engine.detect_faces(image_rgb)
            return {
                "mode": "preview",
                "faces_detected": len(faces),
                "faces": [f.to_dict() for f in faces],
                "processing_time": round(time.time() - t0, 3),
            }
    else:
        try:
            return indexer.index_photo_by_id(photo_id)
        except LookupError:
            raise HTTPException(404, f"photo {photo_id} not found") from None
        except Exception as e:
            raise HTTPException(502, f"failed to index photo: {e}") from e


# ---------------------------------------------------------------------------
# POST /api/faces/search  — search by an uploaded query image.
# ---------------------------------------------------------------------------


@router.post("/search")
async def search_faces(
    file: UploadFile = File(...),
    max_distance: float | None = Query(None),
    top_k: int | None = Query(None),
    face_index: int | None = Query(
        None, description="If multiple faces detected, choose which to use (0-based)."
    ),
    album_id: str | None = Query(
        None, description="Restrict search to a specific album (null = all albums)."
    ),
):
    """Detect face(s) in query image, embed the chosen face, run pgvector search,
    group by photo_id and return unique matching photos."""
    t0 = time.time()
    md = max_distance if max_distance is not None else settings.face_match_max_distance
    k = top_k if top_k is not None else settings.face_top_k

    data = await file.read()
    try:
        image_rgb = image_io.load_image_bytes(data)
    except ValueError as e:
        raise HTTPException(400, str(e))

    faces = face_engine.detect_faces(image_rgb)
    if not faces:
        raise HTTPException(422, "no face detected in query image")

    # Choose face: explicit index, else the largest by area.
    if face_index is not None:
        if face_index < 0 or face_index >= len(faces):
            raise HTTPException(400, f"face_index out of range (0..{len(faces)-1})")
        chosen = faces[face_index]
    else:
        chosen = max(
            faces,
            key=lambda f: f.bbox["width"] * f.bbox["height"],
        )

    q_vec = face_engine.embedding_to_pgvector(chosen.embedding)
    sb = sbc.get_supabase()
    # PostgREST can't distinguish "param omitted" from "param is null", so a
    # 3-param overload would still be picked when album_id is None. To be safe
    # we call the RPC with positional args via the `call` style that always
    # sends the 4th param explicitly.
    rpc_params: dict[str, Any] = {
        "q": q_vec,
        "match_count": k,
        "max_distance": md,
        "album_filter": album_id or "",
    }
    res = sb.rpc("search_faces", rpc_params).execute()

    rows = list(res.data or [])
    # Don't group by photo_id here — let the frontend de-duplicate if needed.
    # Returning every matching face means a photo with 5 people will appear
    # up to 5 times in results if multiple faces match. The RPC already
    # returns only the best face per photo (rn = 1), so each photo appears
    # at most once in `rows`.
    results = []
    for r in rows:
        r.setdefault("similarity", round(1.0 - float(r["distance"]), 4))
        results.append(r)
    log.info(
        "search faces_in_query=%d chosen_face=%d results=%d top_distance=%s time=%.2fs",
        len(faces),
        chosen.face_index,
        len(results),
        f"{results[0]['distance']:.4f}" if results else "n/a",
        time.time() - t0,
    )
    return {
        "query_faces_detected": len(faces),
        "chosen_face_index": chosen.face_index,
        "embedding_dim": face_engine.EMBEDDING_DIM,
        "results": results,
        "processing_time": round(time.time() - t0, 3),
    }


# ---------------------------------------------------------------------------
# GET /api/faces/health
# ---------------------------------------------------------------------------


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "pack": settings.face_pack,
        "embedding_dim": face_engine.EMBEDDING_DIM,
        "supabase": bool(settings.supabase_url),
    }


# ---------------------------------------------------------------------------
# GET /api/faces/debug/detect  — detect only, no DB (used by identity test).
# ---------------------------------------------------------------------------


@router.post("/debug/detect")
async def debug_detect(file: UploadFile = File(...)):
    """Return detected faces + raw embeddings (for debugging/tests only)."""
    data = await file.read()
    image_rgb = image_io.load_image_bytes(data)
    faces = face_engine.detect_faces(image_rgb)
    return {
        "faces_detected": len(faces),
        "embedding_dim": face_engine.EMBEDDING_DIM,
        "faces": [
            {
                **f.to_dict(),
                "embedding": [float(x) for x in f.embedding.tolist()],
            }
            for f in faces
        ],
    }
