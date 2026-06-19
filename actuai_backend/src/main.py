"""
main.py — The FastAPI application entrypoint. This is what uvicorn runs.

Run it from the ``src`` directory (so the package imports resolve):

    cd actuai_backend/src
    uv run uvicorn main:app --reload --port 8000
"""

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, make_asgi_app
from sqlmodel import Session
from starlette.middleware.base import BaseHTTPMiddleware

from api.routers import auth, health, hitl, triggers
from config import settings
from database.connection import engine, init_db
from etl.sap_connector import SAPConnector
from etl.scheduler import start_background_etl
from security.auth import seed_demo_users

# ---- Logging --------------------------------------------------------------
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='{"level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
log = logging.getLogger("actuai")

# ---- Prometheus metrics ---------------------------------------------------
REQUESTS = Counter("actuai_requests_total", "HTTP requests", ["method", "path", "status"])
LATENCY = Histogram("actuai_request_seconds", "Request latency", ["method", "path"])


app = FastAPI(
    title="ActuAI Backend",
    version="1.0.0",
    description="API de l'orchestrateur LangGraph et Datalake",
)


@app.on_event("startup")
def on_startup():
    """Runs once when the application boots."""
    if settings.ENV == "prod" and settings.JWT_SECRET == "CHANGE_ME_IN_PROD":
        # Refuse to boot insecurely in production. Fail fast, fail loud.
        raise RuntimeError("JWT_SECRET must be set in production!")

    print("Démarrage du backend ActuAI...")
    log.info("Starting ActuAI backend (env=%s)", settings.ENV)
    init_db()
    seed_demo_users()

    app.state.etl_stop = None
    if settings.ETL_AUTO_START:
        # Best-effort initial SAP sync so the datalake isn't empty on first boot.
        try:
            with Session(engine) as session:
                SAPConnector().full_sync(session)
                session.commit()
        except Exception as exc:  # noqa: BLE001
            log.warning("Initial SAP sync skipped: %s", exc)
        # Launch the recurring background ETL poller.
        app.state.etl_stop = start_background_etl()


@app.on_event("shutdown")
def on_shutdown():
    """Stop the background ETL poller cleanly, if it was started."""
    stop_event = getattr(app.state, "etl_stop", None)
    if stop_event is not None:
        log.info("Shutting down — stopping ETL loop")
        stop_event.set()


# ---- Security headers + request id + metrics middleware -------------------
class HardeningMiddleware(BaseHTTPMiddleware):
    """Adds a request id, records metrics, and sets safe response headers."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        start = time.perf_counter()

        response = await call_next(request)

        elapsed = time.perf_counter() - start
        path = request.url.path
        REQUESTS.labels(request.method, path, response.status_code).inc()
        LATENCY.labels(request.method, path).observe(elapsed)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response


app.add_middleware(HardeningMiddleware)

# ---- CORS: only the configured frontends may call the API -----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# ---- Routers --------------------------------------------------------------
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(triggers.router)
app.include_router(hitl.router)

# ---- /metrics for Prometheus ----------------------------------------------
app.mount("/metrics", make_asgi_app())


@app.get("/health")
def health_check():
    """Simple health probe (kept from the team's original shell)."""
    return {"status": "ok", "system": "ActuAI Backend Online"}
