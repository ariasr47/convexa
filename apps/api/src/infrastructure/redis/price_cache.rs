//! `price:{SYMBOL}` store — overwrite on every update (no TTL on live ticks).
//!
//! Dual backend:
//! - **InMemory** — always available (dev / no Redis)
//! - **Redis** — when `REDIS_URL` is set

use crate::domain::LivePrice;
use crate::error::{AppError, AppResult};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info};

/// Process-wide price cache (Path A).
#[derive(Clone)]
pub enum PriceCache {
    Memory(InMemoryPriceCache),
    Redis(RedisPriceCache),
}

impl PriceCache {
    /// Prefer Redis when `redis_url` is Some; otherwise in-memory.
    pub async fn connect(redis_url: Option<&str>) -> AppResult<Self> {
        match redis_url {
            Some(url) => match RedisPriceCache::connect(url).await {
                Ok(r) => {
                    info!(backend = "redis", "price cache ready");
                    Ok(Self::Redis(r))
                }
                Err(e) => {
                    tracing::warn!(
                        error = %e,
                        "redis unavailable; falling back to in-memory price cache"
                    );
                    Ok(Self::Memory(InMemoryPriceCache::new()))
                }
            },
            None => {
                info!(backend = "memory", "price cache ready (no REDIS_URL)");
                Ok(Self::Memory(InMemoryPriceCache::new()))
            }
        }
    }

    pub fn backend_name(&self) -> &'static str {
        match self {
            Self::Memory(_) => "memory",
            Self::Redis(_) => "redis",
        }
    }

    pub async fn set_price(&self, price: &LivePrice) -> AppResult<()> {
        match self {
            Self::Memory(m) => m.set_price(price).await,
            Self::Redis(r) => r.set_price(price).await,
        }
    }

    pub async fn get_price(&self, symbol: &str) -> AppResult<Option<LivePrice>> {
        match self {
            Self::Memory(m) => m.get_price(symbol).await,
            Self::Redis(r) => r.get_price(symbol).await,
        }
    }

    /// Clear the memory-backed harness cache. Production Redis state is never
    /// touched by the fixture-only stabilization path.
    pub(crate) async fn clear_harness(&self) -> AppResult<()> {
        match self {
            Self::Memory(m) => {
                m.inner.write().await.clear();
                Ok(())
            }
            Self::Redis(_) => Err(AppError::Config(
                "capacity harness cannot clear a Redis price cache".into(),
            )),
        }
    }
}

// ---------------------------------------------------------------------------
// In-memory
// ---------------------------------------------------------------------------

#[derive(Clone, Default)]
pub struct InMemoryPriceCache {
    inner: Arc<RwLock<HashMap<String, LivePrice>>>,
}

impl InMemoryPriceCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn set_price(&self, price: &LivePrice) -> AppResult<()> {
        let key = price.symbol.to_ascii_uppercase();
        debug!(%key, price = price.price, "memory set price");
        let mut row = price.clone();
        row.symbol = key.clone();
        self.inner.write().await.insert(key, row);
        Ok(())
    }

    pub async fn get_price(&self, symbol: &str) -> AppResult<Option<LivePrice>> {
        let key = symbol.to_ascii_uppercase();
        Ok(self.inner.read().await.get(&key).cloned())
    }
}

// ---------------------------------------------------------------------------
// Redis
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct RedisPriceCache {
    client: redis::Client,
}

impl RedisPriceCache {
    pub async fn connect(url: &str) -> AppResult<Self> {
        let client = redis::Client::open(url).map_err(|e| AppError::Redis(format!("open: {e}")))?;
        // Probe connectivity
        let mut con = client
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| AppError::Redis(format!("connect: {e}")))?;
        let pong: String = redis::cmd("PING")
            .query_async(&mut con)
            .await
            .map_err(|e| AppError::Redis(format!("ping: {e}")))?;
        if pong.to_ascii_uppercase() != "PONG" {
            return Err(AppError::Redis(format!("unexpected PING reply: {pong}")));
        }
        Ok(Self { client })
    }

    async fn conn(&self) -> AppResult<redis::aio::MultiplexedConnection> {
        self.client
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| AppError::Redis(format!("conn: {e}")))
    }

    pub async fn set_price(&self, price: &LivePrice) -> AppResult<()> {
        let key = LivePrice::redis_key(&price.symbol);
        let mut row = price.clone();
        row.symbol = price.symbol.to_ascii_uppercase();
        let payload = serde_json::to_string(&row)?;
        let mut con = self.conn().await?;
        redis::cmd("SET")
            .arg(&key)
            .arg(payload)
            .query_async::<()>(&mut con)
            .await
            .map_err(|e| AppError::Redis(format!("SET {key}: {e}")))?;
        debug!(%key, price = price.price, "redis SET");
        Ok(())
    }

    pub async fn get_price(&self, symbol: &str) -> AppResult<Option<LivePrice>> {
        let key = LivePrice::redis_key(symbol);
        let mut con = self.conn().await?;
        let raw: Option<String> = redis::cmd("GET")
            .arg(&key)
            .query_async(&mut con)
            .await
            .map_err(|e| AppError::Redis(format!("GET {key}: {e}")))?;
        match raw {
            None => Ok(None),
            Some(s) => Ok(Some(serde_json::from_str(&s)?)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn memory_roundtrip() {
        let cache = InMemoryPriceCache::new();
        let p = LivePrice {
            symbol: "spy".into(),
            price: 500.0,
            bid: Some(499.9),
            ask: Some(500.1),
            ts_ns: 1,
            received_at: 2,
        };
        cache.set_price(&p).await.unwrap();
        let got = cache.get_price("SPY").await.unwrap().unwrap();
        assert!((got.price - 500.0).abs() < 1e-9);
        assert_eq!(got.symbol, "SPY");
    }
}
