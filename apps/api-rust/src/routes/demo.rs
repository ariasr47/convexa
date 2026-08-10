//! Progressive dual-path demo UI (static HTML).

use axum::response::Html;

/// Minimal browser client for Path A price → Path B GEX.
pub async fn progressive_demo() -> Html<&'static str> {
    Html(include_str!("../../static/progressive.html"))
}
