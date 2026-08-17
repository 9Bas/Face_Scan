"""Image loading helpers."""
from __future__ import annotations

import io
import logging
from typing import Iterable

import cv2
import numpy as np
import requests

log = logging.getLogger("image_io")


_MAX_SEARCH_DIM = 1024


def load_image_bytes(data: bytes, *, max_dim: int | None = None) -> np.ndarray:
    """Decode raw image bytes into an RGB uint8 HxWx3 numpy array.

    If *max_dim* is set, downscale the longer edge to that size (preserving
    aspect ratio).  This dramatically speeds up face detection for very large
    photos without meaningfully degrading quality.
    """
    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("cannot decode image bytes (unsupported/corrupt)")
    if max_dim is not None:
        h, w = bgr.shape[:2]
        long_edge = max(h, w)
        if long_edge > max_dim:
            scale = max_dim / long_edge
            new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
            bgr = cv2.resize(bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return rgb


def load_image_from_url(url: str, timeout: float = 30.0, *, max_dim: int | None = None) -> np.ndarray:
    """Download an image URL and return RGB array.

    If *max_dim* is set, downscale the longer edge to that size (preserving
    aspect ratio) to speed up face detection for very large photos.
    """
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return load_image_bytes(resp.content, max_dim=max_dim)


def crop_face_image(image_rgb: np.ndarray, bbox: dict) -> np.ndarray:
    """Crop a face region (with a small margin) from the source image."""
    h, w = image_rgb.shape[:2]
    x = max(0, int(bbox["x"]))
    y = max(0, int(bbox["y"]))
    x2 = min(w, int(bbox["x"] + bbox["width"]))
    y2 = min(h, int(bbox["y"] + bbox["height"]))
    return image_rgb[y:y2, x:x2]


def resize_for_detection(image_rgb: np.ndarray, max_dim: int = _MAX_SEARCH_DIM) -> np.ndarray:
    """Downscale an RGB image for faster face detection if needed."""
    h, w = image_rgb.shape[:2]
    long_edge = max(h, w)
    if long_edge <= max_dim:
        return image_rgb
    scale = max_dim / long_edge
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    resized_bgr = cv2.resize(bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(resized_bgr, cv2.COLOR_BGR2RGB)


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
