"""Supabase client (service_role for backend — bypasses RLS)."""
from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote

import requests
from supabase import create_client, Client

from .config import settings

log = logging.getLogger("supabase_client")

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is not None:
        return _client
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in backend/.env"
        )
    _client = create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
    log.info("supabase client ready (url=%s)", settings.supabase_url)
    return _client


def storage_public_url(storage_path: str) -> str:
    """Build a public URL for a stored object.
    Uses R2 Worker URL when configured, else falls back to Supabase Storage.
    """
    worker_url = (settings.r2_worker_url or "").rstrip("/")
    if worker_url:
        return f"{worker_url}/view?path={quote(storage_path, safe='')}"
    base = settings.supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/{settings.storage_bucket}/{storage_path}"


def upload_thumbnail(storage_path: str, data: bytes, content_type: str = "image/jpeg") -> None:
    """Write a generated thumbnail back to R2 via the worker's /upload-thumb endpoint."""
    worker_url = (settings.r2_worker_url or "").rstrip("/")
    api_key = settings.r2_thumb_api_key
    if not worker_url or not api_key:
        raise RuntimeError("R2_WORKER_URL / R2_THUMB_API_KEY not configured for thumbnail upload")
    resp = requests.post(
        f"{worker_url}/upload-thumb",
        headers={"X-API-Key": api_key},
        files={"file": ("thumb.jpg", data, content_type), "storagePath": (None, storage_path)},
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"thumbnail upload failed ({resp.status_code}): {resp.text[:200]}")
    log.info("thumbnail uploaded path=%s bytes=%d", storage_path, len(data))


def upload_object(storage_path: str, data: bytes, content_type: str = "image/jpeg") -> None:
    """Store an arbitrary object (e.g. a member avatar).

    Uses the R2 Worker when configured (the /upload-thumb endpoint is a generic
    write that is authenticated by the shared THUMB_API_KEY), otherwise falls
    back to the Supabase Storage REST API with the service_role key.
    """
    worker_url = (settings.r2_worker_url or "").rstrip("/")
    api_key = settings.r2_thumb_api_key
    if worker_url and api_key:
        resp = requests.post(
            f"{worker_url}/upload-thumb",
            headers={"X-API-Key": api_key},
            files={"file": ("avatar.jpg", data, content_type), "storagePath": (None, storage_path)},
            timeout=30,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"R2 upload failed ({resp.status_code}): {resp.text[:200]}")
        log.info("object uploaded to R2 path=%s bytes=%d", storage_path, len(data))
        return

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("no storage backend configured (R2 or Supabase)")

    url = (
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
        f"{settings.storage_bucket}/{storage_path}"
    )
    resp = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=data,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"supabase storage upload failed ({resp.status_code}): {resp.text[:200]}")
    log.info("object uploaded to Supabase path=%s bytes=%d", storage_path, len(data))


def fetch_photo_rows(album_id: str | None = None, photo_id: str | None = None) -> list[dict[str, Any]]:
    """Return photo rows (id, album_id, filename, storage_path, thumbnail_path)."""
    sb = get_supabase()
    q = sb.table("photos").select("id,album_id,filename,storage_path,thumbnail_path")
    if photo_id:
        q = q.eq("id", photo_id)
    if album_id:
        q = q.eq("album_id", album_id)
    res = q.execute()
    return list(res.data or [])
