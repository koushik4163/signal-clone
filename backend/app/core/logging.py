import logging

from app.core.config import LOG_LEVEL


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, str(LOG_LEVEL).upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
