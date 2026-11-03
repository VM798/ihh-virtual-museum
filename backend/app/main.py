"""FastAPI application for the IHH Virtual Museum."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .repository import Repository
from .routers import collections, docent, inductees


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.repo = Repository(settings.data_dir)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description="Verified, source-cited profiles of Immigrant Hall of Honor inductees, "
                    "with open-access media and export formats ready for the IHH website.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"],
    )
    app.include_router(inductees.router)
    app.include_router(collections.router)
    app.include_router(docent.router)

    @app.get("/api/health", tags=["meta"])
    def health():
        return {"status": "ok", "inductees": len(app.state.repo.all()), "version": settings.version}

    dist = settings.frontend_dist
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str):
            candidate = dist / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return app


app = create_app()
