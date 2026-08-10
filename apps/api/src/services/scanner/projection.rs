//! Project analytics into a ScanRow — consume score/regime, never re-derive.

use crate::services::scanner::store::{ScanRow, ScanScoreDrivers};
use crate::state::AnalyticsSnapshot;
use quant_engine::compute_opportunity_tier;

#[derive(Debug, Clone, Copy)]
pub struct TierBands {
    pub watch: i32,
    pub actionable: i32,
    pub prime: i32,
}

impl Default for TierBands {
    fn default() -> Self {
        // Match Python defaults for opportunity tiers.
        Self {
            watch: 40,
            actionable: 60,
            prime: 80,
        }
    }
}

fn signed_dist_pct(price: Option<f64>, level: Option<f64>) -> Option<f64> {
    let price = price.filter(|p| *p > 0.0)?;
    let level = level?;
    Some((((price - level) / price) * 100.0 * 100.0).round() / 100.0)
}

fn nearer_wall_dist(
    price: Option<f64>,
    call_wall: Option<f64>,
    put_wall: Option<f64>,
) -> Option<f64> {
    let price = price.filter(|p| *p > 0.0)?;
    let walls: Vec<f64> = [call_wall, put_wall].into_iter().flatten().collect();
    if walls.is_empty() {
        return None;
    }
    let nearer = walls
        .into_iter()
        .min_by(|a, b| (price - *a).abs().partial_cmp(&(price - *b).abs()).unwrap())?;
    Some((((price - nearer) / price) * 100.0 * 100.0).round() / 100.0)
}

fn status_for(as_of: f64, now: f64, stale_after: f64, base: &str) -> String {
    if as_of > 0.0 && (now - as_of) > stale_after {
        "stale".into()
    } else {
        base.into()
    }
}

pub fn project_building(symbol: &str) -> ScanRow {
    ScanRow {
        symbol: symbol.to_ascii_uppercase(),
        price: None,
        chg_pct: None,
        score: None,
        tier: None,
        regime: None,
        vol_regime: None,
        flip: None,
        dist_to_flip_pct: None,
        call_wall: None,
        put_wall: None,
        dist_to_wall_pct: None,
        as_of: 0.0,
        status: "building".into(),
        score_drivers: None,
    }
}

pub fn project_error(symbol: &str, prev: Option<&ScanRow>) -> ScanRow {
    match prev {
        Some(p) => {
            let mut r = p.clone();
            r.status = "error".into();
            r
        }
        None => {
            let mut r = project_building(symbol);
            r.status = "error".into();
            r
        }
    }
}

pub fn project_from_analytics(
    symbol: &str,
    snap: &AnalyticsSnapshot,
    now: f64,
    bands: TierBands,
    price: Option<f64>,
    chg_pct: Option<f64>,
    ai_ready: bool,
) -> ScanRow {
    let sig = snap.signals.as_ref();
    let score = sig.map(|s| s.opportunity_score as f64);
    let tier = score.map(|s| {
        compute_opportunity_tier(s as i32, ai_ready, bands.watch, bands.actionable, bands.prime)
    });

    let display_price = price.or(if snap.display_spot > 0.0 {
        Some(snap.display_spot)
    } else {
        None
    });
    let flip = if snap.gex.gamma_flip != 0.0 {
        Some(snap.gex.gamma_flip)
    } else {
        None
    };
    let call_wall = if snap.gex.call_wall != 0.0 {
        Some(snap.gex.call_wall)
    } else {
        None
    };
    let put_wall = if snap.gex.put_wall != 0.0 {
        Some(snap.gex.put_wall)
    } else {
        None
    };

    let score_drivers = sig.and_then(|s| {
        s.score_drivers.as_ref().map(|d| ScanScoreDrivers {
            proximity: d.proximity,
            vol: d.vol,
            setups: d.setups,
            transition: d.transition,
            dark_pool: d.dark_pool,
            total: d.total,
        })
    });

    ScanRow {
        symbol: symbol.to_ascii_uppercase(),
        price: display_price,
        chg_pct,
        score,
        tier,
        regime: sig.and_then(|s| s.regime.clone()),
        vol_regime: sig.map(|s| s.vol_regime.clone()),
        flip,
        dist_to_flip_pct: signed_dist_pct(display_price, flip),
        call_wall,
        put_wall,
        dist_to_wall_pct: nearer_wall_dist(display_price, call_wall, put_wall),
        as_of: now,
        status: "ok".into(),
        score_drivers,
    }
}

pub fn project_price_only(
    symbol: &str,
    prev: Option<&ScanRow>,
    price: Option<f64>,
    chg_pct: Option<f64>,
    now: f64,
    stale_after: f64,
) -> ScanRow {
    let prev = prev.cloned().unwrap_or_else(|| project_building(symbol));
    let dist_flip = signed_dist_pct(price, prev.flip);
    let dist_wall = nearer_wall_dist(price, prev.call_wall, prev.put_wall);
    let status = if prev.status == "building" {
        "building".into()
    } else {
        status_for(prev.as_of, now, stale_after, "ok")
    };
    ScanRow {
        price,
        chg_pct,
        dist_to_flip_pct: dist_flip,
        dist_to_wall_pct: dist_wall,
        status,
        ..prev
    }
}

pub fn refresh_status(row: ScanRow, now: f64, stale_after: f64) -> ScanRow {
    if row.status == "building" {
        return row;
    }
    let base = if row.status == "ok" {
        "ok"
    } else {
        row.status.as_str()
    };
    ScanRow {
        status: status_for(row.as_of, now, stale_after, base),
        ..row
    }
}
