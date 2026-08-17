"""FastAPI entrypoint."""
from __future__ import annotations

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .indexer import sweep_loop
from .routes_faces import router as faces_router

# Windows: use the selector event loop instead of the default Proactor loop,
# which can die with "WinError 64: The specified network name is no longer
# available" on accept() under load.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Background task: re-index photos missing a thumbnail (catch-up when the
    # frontend's auto-index failed during an upload).
    sweeper_task = None
    if settings.index_sweep_interval_seconds > 0:
        sweeper_task = asyncio.create_task(sweep_loop())
    try:
        yield
    finally:
        if sweeper_task is not None:
            sweeper_task.cancel()


app = FastAPI(title="Face Scan AI Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(faces_router)


@app.get("/")
async def root():
    return {"service": "face-scan-ai", "status": "ok"}
