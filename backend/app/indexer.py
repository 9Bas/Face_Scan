"""Shared face-indexing logic + a background catch-up sweeper.

Both the /api/faces/index route and the periodic sweeper call
`index_photo_by_id()`, so new photos that the frontend failed to auto-index
(e.g. backend briefly down during upload) still get their faces + thumbnail
generated automatically in the background.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import numpy as np

from . import face_engine, image_io, supabase_client as sbc
from .config import settings

log = logging.getLogger("indexer")


def thumb_path_for(storage_path: str) -> str:
    """Derive a thumbnail object path from the original storage path."""
    return storage_path.replace("/original/", "/thumbs/")


def index_thumbnail(photo: dict[str, Any], image_rgb: np.ndarray) -> None:
    """Generate + upload a thumbnail for a photo and persist its thumbnail_path.

    Best-effort: any failure is logged but does not fail the index request.
    """
    try:
        thumb_bytes = image_io.make_thumbnail_jpeg(image_rgb)
        thumb_path = thumb_path_for(photo["storage_path"])
        sbc.upload_thumbnail(thumb_path, thumb_bytes)
        sbc.get_supabase().table("photos").update({"thumbnail_path": thumb_path}).eq(
            "id", photo["id"]
        ).execute()
    except Exception as e:  # noqa: BLE001
        log.warning("thumbnail skipped photo_id=%s err=%s", photo["id"], e)


def delete_existing_faces(photo_id: str) -> None:
    sb = sbc.get_supabase()
    sb.table("photo_faces").delete().eq("photo_id", photo_id).execute()


def insert_faces(photo_id: str, faces: list[face_engine.FaceResult]) -> int:
    """Insert all detected faces for a photo. Returns count inserted."""
    if not faces:
        return 0
    sb = sbc.get_supabase()
    rows = [
        {
            "photo_id": photo_id,
            "face_index": f.face_index,
            "embedding": face_engine.embedding_to_pgvector(f.embedding),
            "bbox_x": f.bbox["x"],
            "bbox_y": f.bbox["y"],
            "bbox_width": f.bbox["width"],
            "bbox_height": f.bbox["height"],
            "det_score": f.det_score,
            "quality_score": f.quality_score,
        }
        for f in faces
    ]
    res = sb.table("photo_faces").insert(rows).execute()
    return len(res.data or [])


def index_photo_by_id(photo_id: str, skip_thumbnail: bool = False) -> dict[str, Any]:
    """Detect faces + (optionally) generate a thumbnail for one stored photo.

    Raises LookupError if the photo does not exist.
    """
    t0 = time.time()
    rows = sbc.fetch_photo_rows(photo_id=photo_id)
    if not rows:
        raise LookupError(f"photo {photo_id} not found")
    photo = rows[0]

    url = sbc.storage_public_url(photo["storage_path"])
    image_rgb = image_io.load_image_from_url(url)

    if not skip_thumbnail:
        index_thumbnail(photo, image_rgb)

    faces = face_engine.detect_faces(image_io.resize_for_detection(image_rgb))
    if not faces:
        return {
            "photo_id": photo_id,
            "faces_detected": 0,
            "inserted": 0,
            "processing_time": round(time.time() - t0, 3),
            "message": "no faces detected",
        }

    delete_existing_faces(photo_id)
    inserted = insert_faces(photo_id, faces)
    log.info(
        "index photo_id=%s faces=%d inserted=%d time=%.2fs",
        photo_id,
        len(faces),
        inserted,
        time.time() - t0,
    )
    return {
        "photo_id": photo_id,
        "faces_detected": len(faces),
        "inserted": inserted,
        "embedding_dim": face_engine.EMBEDDING_DIM,
        "processing_time": round(time.time() - t0, 3),
        "faces": [f.to_dict() for f in faces],
    }


# ---------------------------------------------------------------------------
# Background catch-up sweeper
# ---------------------------------------------------------------------------


def find_missing_thumbnails() -> list[dict[str, Any]]:
    """Photos without a thumbnail_path (never successfully indexed)."""
    return [r for r in sbc.fetch_photo_rows() if not r["thumbnail_path"]]


async def sweep_loop() -> None:
    """Periodically index photos missing a thumbnail. Runs for the app lifetime."""
    interval = settings.index_sweep_interval_seconds
    log.info("thumbnail sweeper started (interval=%ss)", interval)
    while True:
        try:
            missing = await asyncio.to_thread(find_missing_thumbnails)
            if missing:
                log.info("sweeper found %d photo(s) missing thumbnails", len(missing))
                for photo in missing:
                    pid = photo["id"]
                    try:
                        await asyncio.to_thread(index_photo_by_id, pid)
                    except Exception as e:  # noqa: BLE001
                        log.warning("sweeper index failed photo_id=%s err=%s", pid, e)
                    # Yield between photos so the API stays responsive.
                    await asyncio.sleep(0.2)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            log.warning("sweeper error: %s", e)
        await asyncio.sleep(interval)
