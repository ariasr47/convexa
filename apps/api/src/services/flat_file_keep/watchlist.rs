//! Closed flat-files watchlist. Sibling of ENSURE/TAPE — not an alias.

/// Locked keep / list / load set for this slice.
pub const FLAT_FILES_WATCHLIST: &[&str] = &["SPY", "QQQ", "IWM"];

pub fn normalize_symbol(raw: &str) -> String {
    raw.trim().to_ascii_uppercase()
}

pub fn in_flat_files_watchlist(symbol: &str) -> bool {
    let u = normalize_symbol(symbol);
    FLAT_FILES_WATCHLIST.iter().any(|s| *s == u.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flat_files_watchlist_is_exactly_spy_qqq_iwm_not_ensure_alias() {
        assert_eq!(FLAT_FILES_WATCHLIST, &["SPY", "QQQ", "IWM"]);
        assert!(in_flat_files_watchlist("spy"));
        assert!(in_flat_files_watchlist(" QQQ "));
        assert!(in_flat_files_watchlist("iwm"));
        assert!(!in_flat_files_watchlist("NVDA"));
        assert!(!in_flat_files_watchlist("AAPL"));
        let src = include_str!("watchlist.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let ensure_tok = format!("ENSURE_{}", "SYMBOLS");
        let tape_tok = format!("TAPE_{}", "WATCHLIST");
        assert!(
            !prod.contains(&ensure_tok),
            "watchlist must not reference {ensure_tok}"
        );
        assert!(
            !prod.contains(&tape_tok),
            "watchlist must not alias {tape_tok}"
        );
    }

    #[test]
    fn nvda_is_not_in_watchlist_before_not_storing() {
        assert!(!in_flat_files_watchlist("NVDA"));
        assert!(!in_flat_files_watchlist("nvda"));
    }
}
