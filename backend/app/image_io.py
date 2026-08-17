"""Image loading helpers."""
from __future__ import annotations

import io
import logging
from typing import Iterable

import cv2
import numpy as np
import requests

log = logging.getLogger("image_io")


def load_image_bytes(data: bytes) -> np.ndarray:
    """Decode raw image bytes into an RGB uint8 HxWx3 numpy array."""
    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("cannot decode image bytes (unsupported/corrupt)")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return rgb


def load_image_from_url(url: str, timeout: float = 30.0) -> np.ndarray:
    """Download an image URL and return RGB array. No aggressive resizing —
    we keep the original resolution so small distant faces stay detectable."""
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return load_image_bytes(resp.content)


def crop_face_image(image_rgb: np.ndarray, bbox: dict) -> np.ndarray:
    """Crop a face region (with a small margin) from the source image."""
    h, w = image_rgb.shape[:2]
    x = max(0, int(bbox["x"]))
    y = max(0, int(bbox["y"]))
    x2 = min(w, int(bbox["x"] + bbox["width"]))
    y2 = min(h, int(bbox["y"] + bbox["height"]))
    return image_rgb[y:y2, x:x2]


def make_thumbnail_jpeg(image_rgb: np.ndarray, max_dim: int = 600, quality: int = 80) -> bytes:
    """Downscale an RGB image (keeping aspect) and encode as a JPEG thumbnail.

    Returns encoded bytes. Raises ValueError if encoding fails.
    """
    h, w = image_rgb.shape[:2]
    scale = max_dim / max(h, w) if max(h, w) > max_dim else 1.0
    if scale < 1.0:
        nh, nw = max(1, round(h * scale)), max(1, round(w * scale))
        bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        resized = cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_AREA)
    else:
        resized = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".jpg", resized, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("failed to encode thumbnail JPEG")
    return buf.tobytes()
