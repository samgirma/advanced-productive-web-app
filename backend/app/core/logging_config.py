import logging
import sys


def setup_logging():
    """
    Configures Python's built-in logging module.
    Outputs structured format: [timestamp] [level] [logger_name]: message
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    # Silence overly verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("apscheduler").setLevel(logging.INFO)


logger = logging.getLogger("productive")
