//! Closed tape watchlist. Sibling of ENSURE/WARM — not an alias.

/// Locked Path-A / Path-B capture set for this slice.
pub const TAPE_WATCHLIST: &[&str] = &["SPY", "QQQ", "IWM"];

pub fn normalize_symbol(raw: &str) -> String {
    raw.trim().to_ascii_uppercase()
}

pub fn in_tape_watchlist(symbol: &str) -> bool {
    let u = normalize_symbol(symbol);
    TAPE_WATCHLIST.iter().any(|s| *s == u.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tape_watchlist_is_exactly_spy_qqq_iwm_not_ensure_alias() {
        assert_eq!(TAPE_WATCHLIST, &["SPY", "QQQ", "IWM"]);
        assert!(in_tape_watchlist("spy"));
        assert!(in_tape_watchlist(" QQQ "));
        assert!(in_tape_watchlist("iwm"));
        assert!(!in_tape_watchlist("NVDA"));
        assert!(!in_tape_watchlist("AAPL"));
        // Leaf must not alias the ensure symbol table by import/use.
        let src = include_str!("watchlist.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let ensure_tok = format!("ENSURE_{}", "SYMBOLS");
        let archive_tok = format!("session_chain_{}", "archive");
        assert!(
            !prod.contains(&ensure_tok),
            "watchlist must not reference {ensure_tok}"
        );
        assert!(
            !prod.contains(&archive_tok),
            "watchlist must stay a local constant"
        );
    }

    #[test]
    fn nvda_is_not_in_watchlist_before_not_storing() {
        assert!(!in_tape_watchlist("NVDA"));
        assert!(!in_tape_watchlist("nvda"));
    }
}
