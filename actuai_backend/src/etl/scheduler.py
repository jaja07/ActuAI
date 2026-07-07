"""
etl/scheduler.py — The background ETL loop (thread-based, synchronous).

The report's Integration Layer says the backend "periodically polls the mock SAP
API (HTTP GET)". This module runs that poll on a timer, in a daemon thread, for
as long as the app is alive.

It is started from main.py's startup hook (only when ``ETL_AUTO_START`` is true)
and stopped cleanly on shutdown via a ``threading.Event`` so we never leave a
dangling thread.
"""

import logging
import threading

from sqlmodel import Session

from config import settings
from database.connection import engine
from etl.aog_scanner import scan_schedule_discrepancies
from etl.sap_connector import SAPConnector

log = logging.getLogger("actuai.etl")


def poll_loop(stop_event: threading.Event) -> None:
    """
    Every BAPI_POLL_SECONDS, pull fresh SAP metadata into the datalake. Runs
    until ``stop_event`` is set (on app shutdown). One failed poll is logged and
    retried next tick — a transient SAP outage never kills the loop.
    """
    connector = SAPConnector()
    while not stop_event.is_set():
        try:
            with Session(engine) as session:
                result = connector.full_sync(session)
                # Mission 2 proactive sweep, right after the mirror refresh so
                # it always sees the freshest SAP dates.
                if settings.AOG_SCAN_ENABLED:
                    result["aog_alerts"] = scan_schedule_discrepancies(session)
                session.commit()
                log.info("ETL sync ok: %s", result)
        except Exception as exc:  # noqa: BLE001 — the loop must survive anything
            log.warning("ETL sync failed (will retry): %s", exc)

        # Sleep, but wake immediately if shutdown is requested.
        stop_event.wait(timeout=settings.BAPI_POLL_SECONDS)


def start_background_etl() -> threading.Event:
    """Spawn the poll loop in a daemon thread and return its stop Event."""
    stop_event = threading.Event()
    thread = threading.Thread(target=poll_loop, args=(stop_event,), daemon=True)
    thread.start()
    log.info("Background ETL poller started (every %ss)", settings.BAPI_POLL_SECONDS)
    return stop_event
