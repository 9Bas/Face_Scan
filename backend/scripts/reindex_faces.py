"""Re-index every photo's faces using ArcFace.

Features:
  - batch processing (no full-RAM load)
  - resume / skip already-indexed photos (default) or --force to re-do all
  - retry per photo
  - progress + logging
  - optional --album-id to limit scope

Usage:
    python -m scripts.reindex_faces
    python -m scripts.reindex_faces --force
    python -m scripts.reindex_faces --album-id <uuid> --batch-size 4
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

# Make `app` importable when run from backend/ directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import face_engine, image_io, supabase_client as sbc  # noqa: E402
from app.config import settings  # noqa: E402

log = logging.getLogger("reindex")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


def already_indexed(photo_id: str) -> bool:
    sb = sbc.get_supabase()
    res = sb.table("photo_faces").select("id").eq("photo_id", photo_id).limit(1).execute()
    return bool(res.data)


def delete_faces(photo_id: str) -> None:
    sb = sbc.get_supabase()
    sb.table("photo_faces").delete().eq("photo_id", photo_id).execute()


def insert_faces(photo_id: str, faces: list[face_engine.FaceResult]) -> int:
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


def process_one(photo: dict, force: bool) -> tuple[str, int, str]:
    """Return (status, faces_inserted, message). status: ok|skip|fail."""
    pid = photo["id"]
    if not force and already_indexed(pid):
        return ("skip", 0, "already indexed")
    url = sbc.storage_public_url(photo["storage_path"])
    last_err = ""
    for attempt in range(1, settings.index_max_retries + 2):
        try:
            img = image_io.load_image_from_url(url)
            faces = face_engine.detect_faces(img)
            delete_faces(pid)
            n = insert_faces(pid, faces)
            return ("ok", n, f"{len(faces)} faces" if faces else "no faces")
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
            log.warning("photo %s attempt %d failed: %s", pid, attempt, last_err)
            time.sleep(1.0 * attempt)
    return ("fail", 0, last_err)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--album-id", default=None, help="limit to a single album")
    ap.add_argument("--batch-size", type=int, default=settings.index_batch_size)
    ap.add_argument("--force", action="store_true", help="re-index even if rows exist")
    ap.add_argument("--limit", type=int, default=None, help="stop after N photos")
    args = ap.parse_args()

    photos = sbc.fetch_photo_rows(album_id=args.album_id)
    if args.limit:
        photos = photos[: args.limit]
    total = len(photos)
    log.info("reindex: %d photos (force=%s, batch=%d)", total, args.force, args.batch_size)

    ok = skipped = failed = no_faces = 0
    total_faces = 0
    t0 = time.time()
    for i, photo in enumerate(photos, 1):
        status, n, msg = process_one(photo, args.force)
        if status == "ok":
            if n == 0:
                no_faces += 1
            else:
                ok += 1
                total_faces += n
        elif status == "skip":
            skipped += 1
        else:
            failed += 1
        if i % 5 == 0 or i == total:
            log.info(
                "progress %d/%d ok=%d skip=%d noface=%d fail=%d faces=%d eta=%ds",
                i,
                total,
                ok,
                skipped,
                no_faces,
                failed,
                total_faces,
                int((time.time() - t0) / i * (total - i)),
            )
    log.info(
        "done: ok=%d skipped=%d no_faces=%d failed=%d total_faces=%d time=%.1fs",
        ok,
        skipped,
        no_faces,
        failed,
        total_faces,
        time.time() - t0,
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
