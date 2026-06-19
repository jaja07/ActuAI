"""
database/connection.py — Connection to the local PostgreSQL datalake.

This keeps the team's synchronous SQLModel approach (psycopg2 driver) and the
``init_db()`` contract, but adds the ``get_session()`` FastAPI dependency the
API layer needs. The engine is built from ``DATABASE_URL_BACKEND`` (see config).
"""

from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from config import settings

# SQLite (used in tests) needs check_same_thread=False to share a connection
# across FastAPI's threadpool; PostgreSQL ignores connect_args here.
_connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL_BACKEND.startswith("sqlite")
    else {}
)

# echo=True logs every SQL statement; we keep it on only in dev.
engine = create_engine(
    settings.DATABASE_URL_BACKEND,
    echo=(settings.ENV == "dev"),
    pool_pre_ping=True,
    connect_args=_connect_args,
)


def init_db() -> None:
    """
    Create every SQLModel table if it does not exist yet. Called once on
    startup. In a bigger project you'd use Alembic migrations instead, but for
    this system ``create_all`` keeps things simple and readable.
    """
    # Import the models module so SQLModel.metadata knows about every table.
    import database.models  # noqa: F401

    print("⚙️  Initialisation des tables PostgreSQL...")
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """
    FastAPI dependency. Usage in a route:

        def route(session: Session = Depends(get_session)):
            ...

    The session is committed if the request succeeds and rolled back on error,
    then always closed.
    """
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
