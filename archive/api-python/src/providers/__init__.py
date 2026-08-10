"""
Provider factory. Selects the market-data adapter by name (env `DATA_PROVIDER`, default
"massive"). To add a vendor: write an adapter subclassing MarketDataProvider in this
package and register its class in `_PROVIDERS` below -- nothing else changes.
"""
import os
import logging

from .base import MarketDataProvider
from .massive import MassiveProvider

logger = logging.getLogger("Convexa")

# name -> adapter class. Lazy-instantiated by get_provider().
_PROVIDERS: dict[str, type[MarketDataProvider]] = {
    "massive": MassiveProvider,
}


def available_providers() -> list[str]:
    return sorted(_PROVIDERS)


def get_provider(name: str | None = None) -> MarketDataProvider:
    """Instantiate the configured provider. Raises ValueError on an unknown name."""
    name = (name or os.getenv("DATA_PROVIDER", "massive")).lower()
    cls = _PROVIDERS.get(name)
    if cls is None:
        raise ValueError(
            f"Unknown DATA_PROVIDER '{name}'. Available: {', '.join(available_providers())}")
    logger.info(f"Market-data provider: {name}")
    return cls()


__all__ = ["MarketDataProvider", "get_provider", "available_providers"]
