"""Backfill thumbnails for photos whose thumbnail_path is NULL.

Preferred: the background sweeper (backend/app/indexer.py) does this
automatically every index_sweep_interval_seconds. This script is a manual
fallback that indexes everything in one pass:
    python -m scripts.backfill_thumbs
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import indexer, supabase_client as sbc  # noqa: E402


def main() -> None:
    rows = sbc.fetch_photo_rows()
    missing = [r for r in rows if not r["thumbnail_path"]]
    print(f"photos={len(rows)} missing_thumb={len(missing)}")

    ok = fail = 0
    for r in missing:
        pid = r["id"]
        t0 = time.time()
        try:
            indexer.index_photo_by_id(pid)
            ok += 1
            status = "ok"
        except Exception as e:  # noqa: BLE001
            fail += 1
            status = f"ERR {e}"
        print(f"{status:>10} {pid} {time.time() - t0:5.1f}s", flush=True)

    print(f"done ok={ok} fail={fail}")


if __name__ == "__main__":
    main()
