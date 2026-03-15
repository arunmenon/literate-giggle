"""ExamIQ - Main FastAPI application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .core.config import settings, DANGEROUS_SECRET_DEFAULTS
from .core.database import init_db
from .core.rate_limit import limiter
from .api.routes import auth, questions, papers, exams, evaluations, learning, dashboard, ai, curriculum, workspace, classes

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    # JWT secret validation -- block startup in production if using a default key
    if settings.SECRET_KEY in DANGEROUS_SECRET_DEFAULTS:
        if not settings.DEBUG:
            raise RuntimeError(
                "FATAL: SECRET_KEY is set to a default value. "
                "Generate a secure key: openssl rand -hex 32"
            )
        logger.warning("WARNING: Using default SECRET_KEY -- NOT SAFE FOR PRODUCTION")

    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Comprehensive exam evaluation platform for ICSE/CBSE students. "
        "Supports exam lifecycle management: Curation → Simulation → Assessment → Learning Plans."
    ),
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(papers.router, prefix="/api")
app.include_router(exams.router, prefix="/api")
app.include_router(evaluations.router, prefix="/api")
app.include_router(learning.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(curriculum.router, prefix="/api")
app.include_router(workspace.router, prefix="/api")
app.include_router(classes.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "supported_boards": settings.SUPPORTED_BOARDS,
        "supported_classes": settings.SUPPORTED_CLASSES,
    }
