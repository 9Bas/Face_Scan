"""Face indexing + search API routes."""
from __future__ import annotations

import logging
import time
from typing import Any

import numpy as np
import requests
from fastapi import APIRouter, File, Header, HTTPException, Query, UploadFile

from . import face_engine, image_io, indexer, supabase_client as sbc
from .config import settings

log = logging.getLogger("faces")
router = APIRouter(prefix="/api/faces", tags=["faces"])

# Avatar / selfie uploads are downscaled client-side; this is a hard cap.
MAX_UPLOAD_BYTES = 12 * 1024 * 1024


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_index_auth(x_api_key: str | None) -> None:
    if settings.index_api_key:
        if not x_api_key or x_api_key != settings.index_api_key:
            raise HTTPException(status_code=401, detail="invalid index api key")


def _require_user(authorization: str | None) -> dict[str, Any]:
    """Validate a Supabase access token and return the auth user payload.

    We verify against Supabase Auth (network call) instead of trusting any
    user_id sent by the client, so a member can only ever act on their own
    profile.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "ต้องเข้าสู่ระบบก่อน")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "ต้องเข้าสู่ระบบก่อน")
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(500, "ยังไม่ได้ตั้งค่า Supabase Auth ฝั่งเซิร์ฟเวอร์")

    try:
        resp = requests.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_anon_key,
            },
            timeout=10,
        )
    except requests.RequestException as e:
        raise HTTPException(502, f"ตรวจสอบเซสชันไม่สำเร็จ: {e}") from e

    if resp.status_code != 200:
        raise HTTPException(401, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
    payload = resp.json()
    if not payload.get("id"):
        raise HTTPException(401, "เซสชันไม่ถูกต้อง")
    return payload


DB_NOT_MIGRATED = (
    "ฐานข้อมูลยังไม่อัปเดต: กรุณารัน migration 0009_profile_faces.sql"
)


def _db_data(res, message: str) -> Any:
    """Return `.data` from a Supabase response, raising on a PostgREST error.

    Depending on the supabase-py version the error is either returned in the
    response object or raised as ``APIError``; both are treated as failures so
    a missing table/column can never look like a silent success.
    """
    err = getattr(res, "error", None)
    if err:
        log.error("supabase error: %s", err)
        raise HTTPException(500, message)
    return getattr(res, "data", None)


def _run(query, message: str) -> Any:
    """Execute a PostgREST query builder and return its data."""
    try:
        res = query.execute()
    except Exception as e:  # noqa: BLE001 - supabase raises APIError in some versions
        log.error("supabase query failed: %s", e)
        raise HTTPException(500, message) from e
    return _db_data(res, message)


def _choose_face(faces: list[face_engine.FaceResult]) -> face_engine.FaceResult:
    """Pick the largest face in the image."""
    return max(faces, key=lambda f: f.bbox["width"] * f.bbox["height"])


def _profile_face_distance(user_id: str, query_vec: str) -> float | None:
    """Cosine distance between a candidate embedding and the stored profile face."""
    sb = sbc.get_supabase()
    try:
        res = sb.rpc(
            "profile_face_distance",
            {"p_user_id": user_id, "q": query_vec},
        ).execute()
    except Exception as e:  # noqa: BLE001
        log.exception("profile_face_distance rpc failed")
        raise HTTPException(
            500,
            "ฐานข้อมูลยังไม่อัปเดต: กรุณารัน migration 0009_profile_faces.sql",
        ) from e
    data = _db_data(
        res, "ฐานข้อมูลยังไม่อัปเดต: กรุณารัน migration 0009_profile_faces.sql"
    )
    if data is None:
        return None
    # PostgREST returns a bare number for a scalar function, but be defensive.
    if isinstance(data, list):
        if not data:
            return None
        data = data[0]
    if isinstance(data, dict):
        data = next(iter(data.values()), None)
    return None if data is None else float(data)


def _search_by_profile(
    user_id: str,
    match_count: int,
    max_distance: float,
    album_id: str | None,
) -> list[dict[str, Any]]:
    sb = sbc.get_supabase()
    try:
        res = sb.rpc(
            "search_faces_by_profile",
            {
                "p_user_id": user_id,
                "match_count": match_count,
                "max_distance": max_distance,
                "album_filter": album_id or "",
            },
        ).execute()
    except Exception as e:  # noqa: BLE001
        log.exception("search_faces_by_profile rpc failed")
        raise HTTPException(
            500,
            "ฐานข้อมูลยังไม่อัปเดต: กรุณารัน migration 0009_profile_faces.sql",
        ) from e
    rows = list(
        _db_data(
            res, "ฐานข้อมูลยังไม่อัปเดต: กรุณารัน migration 0009_profile_faces.sql"
        )
        or []
    )
    for r in rows:
        if "similarity" not in r:
            r["similarity"] = round(1.0 - float(r["distance"]), 4)
    return rows


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
# POST /api/faces/profile/enroll — set/replace the signed-in member's profile
# photo. Exactly one clear face is required. When a profile face already
# exists, the new photo must match it (PDPA: prevent swapping identities).
# ---------------------------------------------------------------------------


@router.post("/profile/enroll")
async def enroll_profile_face(
    file: UploadFile = File(...),
    authorization: str | None = Header(None),
):
    """Set or replace the signed-in member's profile photo.

    Exactly one clear face is required. If a profile face already exists the
    new photo MUST match it — this is enforced here (never trusted from the
    client) so nobody can swap identities and inherit someone else's photos.
    """
    user = _require_user(authorization)
    user_id = str(user["id"])
    t0 = time.time()

    data = await file.read()
    if not data:
        raise HTTPException(400, "ไฟล์ว่าง กรุณาเลือกรูปใหม่")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "ไฟล์ใหญ่เกินไป (สูงสุด 12 MB)")
    try:
        image_rgb = image_io.load_image_bytes(data)
    except ValueError as e:
        raise HTTPException(400, str(e))

    faces = face_engine.detect_faces(image_rgb)
    if not faces:
        raise HTTPException(422, "ไม่พบใบหน้าในภาพ กรุณาใช้ภาพที่เห็นใบหน้าชัดเจน")
    if len(faces) > 1:
        raise HTTPException(
            422,
            "พบใบหน้ามากกว่า 1 คนในภาพ กรุณาใช้ภาพที่มีเฉพาะใบหน้าของคุณ",
        )

    chosen = faces[0]
    if chosen.det_score < 0.75 or chosen.size < 120:
        raise HTTPException(422, "ใบหน้าเล็กหรือไม่ชัดเจน กรุณาใช้ภาพถ่ายจริงของตัวเองที่ชัดเจน")
    # Additional heuristics to reject obvious non-photo faces (cartoons/AI drawings)
    try:
        app = face_engine.get_face_app()
        raw = app.get(image_rgb)
        # Find matching raw face by closest bbox
        if raw:
            rf = raw[0]
            # Require frontal-ish pose if available
            if hasattr(rf, "pose") and rf.pose is not None:
                try:
                    pose = rf.pose
                    # pose can be array [pitch,yaw,roll] or object
                    if isinstance(pose, (list, np.ndarray)) and len(pose) >= 3:
                        yaw = abs(float(pose[1]))
                        pitch = abs(float(pose[0]))
                        if yaw > 30 or pitch > 25:
                            raise HTTPException(422, "กรุณาใช้ภาพหน้าตรงของตัวเอง")
                except HTTPException:
                    raise
                except Exception:
                    pass
            # If gender/age model available, just ensure it's a plausible face
    except HTTPException:
        raise
    except Exception:
        pass

    query_vec = face_engine.embedding_to_pgvector(chosen.embedding)
    sb = sbc.get_supabase()

    existing = (
        sb.table("profile_faces")
        .select("user_id")
        .eq("user_id", user_id)
        .limit(1)
    )
    has_existing = bool(_run(existing, DB_NOT_MIGRATED))

    distance: float | None = None
    if has_existing:
        distance = _profile_face_distance(user_id, query_vec)
        if distance is None:
            raise HTTPException(500, "อ่านใบหน้าโปรไฟล์เดิมไม่สำเร็จ")
        if distance > settings.profile_verify_max_distance:
            raise HTTPException(
                422,
                "ใบหน้านี้ไม่ตรงกับภาพโปรไฟล์เดิม กรุณาใช้ภาพของเจ้าของบัญชีเท่านั้น",
            )

    ext = "png" if (file.content_type or "").endswith("png") else "jpg"
    storage_path = f"avatars/{user_id}/{int(time.time() * 1000)}.{ext}"
    try:
        sbc.upload_object(storage_path, data, file.content_type or "image/jpeg")
    except Exception as e:  # noqa: BLE001 - surface a readable message
        log.exception("avatar upload failed user=%s", user_id)
        raise HTTPException(502, f"อัปโหลดภาพโปรไฟล์ไม่สำเร็จ: {e}") from e

    _run(
        sb.table("profile_faces").upsert(
            {"user_id": user_id, "embedding": query_vec},
            on_conflict="user_id",
        ),
        "บันทึกใบหน้าโปรไฟล์ไม่สำเร็จ (ตรวจสอบว่าได้รัน migration 0009 แล้ว)",
    )
    _run(
        sb.table("profiles").update({"avatar_path": storage_path}).eq("id", user_id),
        "บันทึกภาพโปรไฟล์ไม่สำเร็จ (ตรวจสอบว่าได้รัน migration 0009 แล้ว)",
    )

    log.info(
        "profile enrolled user=%s replaced=%s distance=%s time=%.2fs",
        user_id,
        has_existing,
        f"{distance:.4f}" if distance is not None else "n/a",
        time.time() - t0,
    )
    return {
        "avatar_path": storage_path,
        "face_enrolled": True,
        "replaced": has_existing,
        "distance_from_previous": (
            round(distance, 4) if distance is not None else None
        ),
        "face": chosen.to_dict(),
        "processing_time": round(time.time() - t0, 3),
    }


# ---------------------------------------------------------------------------
# POST /api/faces/profile/search — search photos using the member's OWN
# profile face. A selfie may be supplied, but it is only accepted if it
# matches the enrolled profile face; the search itself always uses the stored
# profile embedding so results can never be for someone else.
# ---------------------------------------------------------------------------


@router.post("/profile/search")
async def search_faces_by_profile(
    file: UploadFile | None = File(
        None, description="Optional selfie — must match the enrolled profile face."
    ),
    max_distance: float | None = Query(None),
    top_k: int | None = Query(None),
    album_id: str | None = Query(
        None, description="Restrict search to a specific album (null = all albums)."
    ),
    authorization: str | None = Header(None),
):
    user = _require_user(authorization)
    user_id = str(user["id"])
    t0 = time.time()

    if file is not None:
        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "ไฟล์ใหญ่เกินไป (สูงสุด 12 MB)")
        try:
            image_rgb = image_io.load_image_bytes(data)
        except ValueError as e:
            raise HTTPException(400, str(e))
        faces = face_engine.detect_faces(image_rgb)
        if not faces:
            raise HTTPException(422, "ไม่พบใบหน้าในภาพ กรุณาใช้ภาพที่ชัดขึ้น")
        chosen = _choose_face(faces)
        query_vec = face_engine.embedding_to_pgvector(chosen.embedding)
        distance = _profile_face_distance(user_id, query_vec)
        if distance is None:
            raise HTTPException(409, "ยังไม่ได้ตั้งภาพโปรไฟล์ กรุณาตั้งภาพโปรไฟล์ก่อน")
        if distance > settings.profile_verify_max_distance:
            raise HTTPException(403, "ใบหน้านี้ไม่ตรงกับโปรไฟล์ของคุณ")

    sb = sbc.get_supabase()
    enrolled = (
        sb.table("profile_faces")
        .select("user_id")
        .eq("user_id", user_id)
        .limit(1)
    )
    if not _run(enrolled, DB_NOT_MIGRATED):
        raise HTTPException(409, "ยังไม่ได้ตั้งภาพโปรไฟล์ กรุณาตั้งภาพโปรไฟล์ก่อน")

    md = max_distance if max_distance is not None else settings.face_match_max_distance
    k = top_k if top_k is not None else settings.face_top_k
    results = _search_by_profile(user_id, k, md, album_id)

    log.info(
        "profile search user=%s album=%s results=%d time=%.2fs",
        user_id,
        album_id or "-",
        len(results),
        time.time() - t0,
    )
    return {
        "mode": "profile",
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
