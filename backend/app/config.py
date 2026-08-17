"""Configuration loaded from environment / .env file."""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Server ---
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: Literal["debug", "info", "warning", "error"] = "info"

    # --- Supabase ---
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""
    storage_bucket: str = "photos"
    # R2 Worker URL (when using Cloudflare R2 instead of Supabase Storage).
    # Empty = use Supabase Storage for image fetching.
    r2_worker_url: str = ""
    # API key used to write thumbnails back to R2 via the worker's
    # POST /upload-thumb endpoint. Must match worker secret THUMB_API_KEY.
    r2_thumb_api_key: str = ""

    # --- InsightFace ---
    # Model pack: buffalo_l (ArcFace R100, 512-dim), buffalo_m, buffalo_s.
    face_pack: str = "buffalo_l"
    face_ctx_id: int = -1  # -1 = CPU
    # Detection size as CSV "W,H".
    face_det_size_csv: str = "640,640"
    face_min_detection_confidence: float = 0.5
    face_min_size: int = 32  # px — skip faces smaller than this on the long side
    # Search
    face_top_k: int = 30
    face_match_max_distance: float = 0.6  # cosine distance; lower = stricter
    # Indexing
    index_batch_size: int = 8
    index_max_retries: int = 2
    # Background sweeper: re-index photos missing a thumbnail every N seconds.
    # Set to 0 to disable the background sweeper.
    index_sweep_interval_seconds: int = 60

    @property
    def face_det_size(self) -> tuple[int, int]:
        parts = [int(x) for x in self.face_det_size_csv.split(",") if x.strip()]
        return (parts[0], parts[1]) if len(parts) == 2 else (640, 640)

    # --- Security ---
    # Shared secret for /api/faces/index (photographer-only). Empty = open (dev only).
    index_api_key: str = ""

    # --- CORS ---
    cors_origins_csv: str = "*"

    @property
    def cors_origins(self) -> list[str]:
        if self.cors_origins_csv.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins_csv.split(",") if o.strip()]


settings = Settings()
