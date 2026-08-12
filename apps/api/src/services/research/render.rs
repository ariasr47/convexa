//! `research::render` — the console assembly (SPEC §4). Every block below reuses the SAME
//! literal strings already computed onto `Cell.rendered` / `Retention.rendered` /
//! `DriverAttribution.rendered` (comparison.rs / artifact.rs) — render.rs never re-derives a
//! number or a literal, it only orders and labels blocks, so console and artifact can never
//! disagree (AC-21).

use crate::services::research::artifact::{Artifact, BAR_TEXT};
use crate::services::research::candidates::CANDIDATES;

const STALE_DIARY_SESSION_DAYS: f64 = 1.0;
const STALE_DIARY_THRESHOLD_DAYS: f64 = 7.0;

/// Block 1 — the evidence header. First block on EVERY run, including partial/degenerate/stale
/// ones (AC-43). Every number in the "Not evaluable here" line except the cap comes from
/// `retention[]` (derived per run, never a baked-in span — AC-78).
pub fn render_evidence_header(art: &Artifact) -> String {
    let symbols = art.requested_symbols.join(", ");
    let window = match (art.window_utc_first, art.window_utc_last) {
        (Some(a), Some(b)) => format!("{a}\u{2013}{b} UTC"),
        _ => "no window (zero paired rows)".to_string(),
    };

    let spy_retention = art
        .retention
        .iter()
        .find(|r| r.symbol == "SPY")
        .or_else(|| art.retention.first());
    let not_evaluable = match spy_retention {
        Some(r) if r.samples_loaded > 0 => format!(
            "the multi-week half needs more history than the raw diary holds. The diary is a \
             per-symbol ring capped at STRUCTURE_HISTORY_MAX = {} samples, oldest evicted first. \
             At this run's own observed rate — {} — derived from these rows; not a stored \
             constant, and it moves when the capture rate moves.",
            r.cap, r.rendered
        ),
        _ => format!(
            "the multi-week half needs more history than the raw diary holds; no requested \
             symbol carried enough loaded samples this run to derive an observed rate. Cap: \
             STRUCTURE_HISTORY_MAX = {}.",
            art.retention.first().map(|r| r.cap).unwrap_or(0)
        ),
    };

    let mut lines = vec![
        "RESEARCH READ \u{2014} NOT A PRODUCT RULING".to_string(),
        format!(
            "  Evidence:   {} \u{b7} symbols: {symbols}",
            art.evidence_class
        ),
        format!(
            "  This run:   {window} \u{b7} {} paired rows \u{b7} horizon {}",
            art.n_paired, art.horizon
        ),
        "  Bar (runbook text, printed beside the run's values; this run does not evaluate it):"
            .to_string(),
        format!("              {BAR_TEXT}"),
        format!("  Not evaluable here: {not_evaluable}"),
        format!("  Authorizes: {}", art.authorizes),
        "  Ranking a candidate signal here is not adopting it.".to_string(),
    ];

    // AC-64 — when the newest paired sample predates the run beyond one session, name both dates.
    if let Some(days_before) = stale_diary_days(art) {
        if days_before > STALE_DIARY_THRESHOLD_DAYS {
            let last_dt = art
                .window_utc_last
                .and_then(epoch_to_date_string)
                .unwrap_or_default();
            lines.push(format!(
                "  Newest sample {last_dt} ({days_before:.0} days before this run) \u{2014} this read \
                 describes an older diary, not today"
            ));
        }
    }

    lines.join("\n")
}

fn epoch_to_date_string(epoch_secs: f64) -> Option<String> {
    use chrono::{TimeZone, Utc};
    Utc.timestamp_opt(epoch_secs.floor() as i64, 0)
        .single()
        .map(|d| d.format("%Y-%m-%d").to_string())
}

/// Days between the newest paired sample and `generated_at_utc`, or `None` when either is
/// unavailable (zero paired rows) or the two fall within the same day-window (not stale).
fn stale_diary_days(art: &Artifact) -> Option<f64> {
    use chrono::DateTime;
    let last = art.window_utc_last?;
    let now: DateTime<chrono::Utc> = art.generated_at_utc.parse().ok()?;
    let days = (now.timestamp() as f64 - last) / 86_400.0;
    let _ = STALE_DIARY_SESSION_DAYS;
    Some(days)
}

/// Block 2 — provenance. Nothing may be reported that this line cannot source (SPEC §4).
pub fn render_provenance_line(art: &Artifact) -> String {
    format!(
        "version={} \u{b7} generated_at_utc={} \u{b7} outcomes_path={} \u{b7} sample_source={} \u{b7} horizon={}",
        art.version, art.generated_at_utc, art.outcomes_path, art.sample_source, art.horizon
    )
}

/// Block 3 — slice description: requested symbols, paired rows, window, sessions covered, both
/// floors, label definitions verbatim with their threshold values.
pub fn render_slice_description(art: &Artifact) -> String {
    let mut lines = vec![format!(
        "requested_symbols=[{}] \u{b7} n_paired={} \u{b7} sessions_covered={} \u{b7} \
             row_floor={} \u{b7} session_floor={}",
        art.requested_symbols.join(","),
        art.n_paired,
        art.session_dates.len(),
        art.row_floor_in_force,
        art.session_floor_in_force
    )];
    for l in &art.labels {
        let threshold = l
            .threshold
            .map(|t| format!("{t:.4}"))
            .unwrap_or_else(|| "no numeric threshold (rule-based label)".to_string());
        lines.push(format!(
            "  label {}: {} (threshold={threshold})",
            l.key, l.definition
        ));
    }
    lines.join("\n")
}

/// The candidate label block (row header + shared-derivation note), in declared order, printed
/// once ahead of that candidate's cells.
fn render_candidate_label(idx: usize, key: &str) -> String {
    let c = CANDIDATES.iter().find(|c| c.key == key).unwrap();
    let mut out = format!("{idx}  {}", c.display);
    if let Some(note) = crate::services::research::candidates::shared_derivation_note(c) {
        out.push_str(&format!("\n   {note}"));
    }
    out
}

/// Blocks 4-6 — candidates x primary label pooled, per symbol, and the secondary labels. Every
/// candidate reported on the same metric family; primary-KPI block first (AC-58); per-symbol
/// section headed distinctly and rendered even for a single requested symbol (AC-14).
pub fn render_candidate_blocks(art: &Artifact) -> String {
    let mut out = Vec::new();
    for (i, cand) in CANDIDATES.iter().enumerate() {
        out.push(render_candidate_label(i + 1, cand.key));
        for label in &art.labels {
            let primary_tag = if label.key
                == art
                    .labels
                    .iter()
                    .find(|l| true_is_primary(l.key))
                    .map(|l| l.key)
                    .unwrap_or("")
            {
                ""
            } else {
                " [secondary]"
            };
            let pooled = art
                .cells
                .iter()
                .find(|c| c.candidate == cand.key && c.label == label.key && c.group == "Pooled");
            if let Some(cell) = pooled {
                out.push(format!(
                    "  {} \u{b7} {}{primary_tag}\n{}",
                    cand.display, label.key, cell.rendered
                ));
            }
        }
        out.push("  Per symbol \u{2014} pooled above is not a summary of these".to_string());
        for sym in &art.requested_symbols {
            let group_key = format!("Symbol({})", sym.trim().to_ascii_uppercase());
            for label in &art.labels {
                if let Some(cell) = art.cells.iter().find(|c| {
                    c.candidate == cand.key && c.label == label.key && c.group == group_key
                }) {
                    out.push(format!("    {sym} \u{b7} {}\n{}", label.key, cell.rendered));
                }
            }
        }
    }
    out.join("\n")
}

fn true_is_primary(key: &str) -> bool {
    crate::services::research::labels::LABELS
        .iter()
        .any(|l| l.key == key && l.primary)
}

/// Block 7 — calibration, per candidate x pooled group, thin bins marked never withheld.
pub fn render_calibration_block(art: &Artifact) -> String {
    let mut out = vec!["Calibration (quintile bins, pooled)".to_string()];
    for cand in CANDIDATES {
        // Any pooled cell for this candidate carries the calibration series inline via its
        // `rendered` text (the "Calibration  ..." line already produced by comparison.rs).
        if let Some(cell) = art
            .cells
            .iter()
            .find(|c| c.candidate == cand.key && c.group == "Pooled")
        {
            let calib_line = cell
                .rendered
                .lines()
                .find(|l| l.trim_start().starts_with("Calibration"));
            if let Some(line) = calib_line {
                out.push(format!("  {} {}", cand.display, line.trim()));
            }
        }
    }
    out.join("\n")
}

/// Block 8 — driver attribution, in the same closed vocabulary (AC-39/40/41/42).
pub fn render_driver_attribution_block(art: &Artifact) -> String {
    let mut out = vec![format!(
        "Driver attribution: {}",
        art.driver_attribution.rendered
    )];
    for e in &art.driver_attribution.entries {
        out.push(format!(
            "  {} \u{b7} pearson_vs_abs_move={:?} \u{b7} pearson_vs_ret_simple={:?} \u{b7} n={}",
            e.driver, e.pearson_vs_abs_move, e.pearson_vs_ret_simple, e.n
        ));
    }
    out.join("\n")
}

/// Block 9 — the evidence one-liner, repeated (AC-43).
pub fn render_evidence_one_liner(art: &Artifact) -> String {
    format!(
        "Evidence: {} \u{b7} symbols: {} \u{b7} horizon {} \u{b7} authorizes: {}",
        art.evidence_class,
        art.requested_symbols.join(", "),
        art.horizon,
        art.authorizes
    )
}

/// The full console text, in the SPEC §4 fixed order.
pub fn render_console(art: &Artifact) -> String {
    [
        render_evidence_header(art),
        render_provenance_line(art),
        render_slice_description(art),
        render_candidate_blocks(art),
        render_calibration_block(art),
        render_driver_attribution_block(art),
        render_evidence_one_liner(art),
    ]
    .join("\n\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::research::artifact::{
        build_artifact, build_driver_attribution, build_retention,
    };
    use crate::services::research::comparison::{build_all_records, build_grid, groups_for};
    use crate::services::research::fixtures::{slice_0810_outcomes, slice_0810_samples};
    use crate::services::research::labels::build_label_set;
    use crate::services::research::pairing::pair_rows;

    fn art() -> Artifact {
        let samples = slice_0810_samples();
        let outcomes = slice_0810_outcomes();
        let pairing = pair_rows(&samples, &outcomes, "1d");
        let ls = build_label_set(&pairing.rows);
        let requested: Vec<String> = vec!["SPY".into(), "QQQ".into(), "IWM".into()];
        let groups = groups_for(&requested);
        let evidence = crate::services::research::artifact::evidence_class(&pairing.session_dates);
        let cells = build_grid(
            &pairing.rows,
            &ls,
            &groups,
            "1d",
            &evidence,
            &pairing.n_samples_by_symbol,
        );
        let records = build_all_records(&pairing.rows, &groups, "1d");
        let driver_attribution = build_driver_attribution(&pairing.rows, true);
        let retention = build_retention(&pairing.loaded_by_symbol, &requested);
        build_artifact(
            "2026-08-12T00:00:00Z".to_string(),
            "1d",
            &requested,
            "file",
            "tests/fixtures/research/slice_2026-08-10/outcomes.json",
            pairing.window_first,
            pairing.window_last,
            pairing.session_dates.clone(),
            samples.len(),
            outcomes.len(),
            pairing.rows.len(),
            pairing.duplicate_keys_collapsed,
            &ls,
            &cells,
            &records,
            driver_attribution,
            retention,
        )
    }

    #[test]
    fn evidence_header_is_first_block_and_contains_no_verdict_language() {
        let a = art();
        let console = render_console(&a);
        assert!(console.starts_with("RESEARCH READ"));
        for banned in ["AT BAR", "BELOW BAR", "PASS", "FAIL", "MEETS"] {
            assert!(
                !console.contains(banned),
                "console contains banned token {banned:?}"
            );
        }
        assert!(console.contains("Ranking a candidate signal here is not adopting it."));
    }

    #[test]
    fn evidence_one_liner_repeats_at_the_end() {
        let a = art();
        let console = render_console(&a);
        assert!(console
            .trim_end()
            .ends_with(&format!("authorizes: {}", a.authorizes)));
        assert!(
            console.matches("Evidence:").count() >= 2,
            "the evidence fact must appear in header AND the repeated one-liner"
        );
    }

    #[test]
    fn candidate_blocks_appear_in_declared_order() {
        let a = art();
        let blocks = render_candidate_blocks(&a);
        let mut last_idx = 0;
        for (i, cand) in CANDIDATES.iter().enumerate() {
            let pos = blocks
                .find(&format!("{}  {}", i + 1, cand.display))
                .expect("candidate label present");
            assert!(
                pos >= last_idx || i == 0,
                "candidate {} out of declared order",
                cand.key
            );
            last_idx = pos;
        }
    }

    #[test]
    fn per_symbol_section_present_for_every_requested_symbol() {
        let a = art();
        let blocks = render_candidate_blocks(&a);
        for sym in &a.requested_symbols {
            assert!(
                blocks.contains(&format!("{sym} \u{b7}")),
                "missing per-symbol block for {sym}"
            );
        }
    }

    #[test]
    fn stale_diary_line_fires_seven_plus_days_out_not_same_session() {
        let mut a = art();
        // Newest paired sample is on 2026-08-10; generate "now" far in the future.
        a.generated_at_utc = "2026-09-01T00:00:00Z".to_string();
        let header = render_evidence_header(&a);
        assert!(
            header.contains("this read describes an older diary, not today"),
            "{header}"
        );

        a.generated_at_utc = "2026-08-10T20:00:00Z".to_string();
        let header2 = render_evidence_header(&a);
        assert!(!header2.contains("this read describes an older diary"));
    }

    #[test]
    fn console_equals_artifact_strings_ac21() {
        // Every cell's rendered literal that appears in the console must also be literally
        // present in the artifact's own cells[] — since render.rs never re-derives, this is
        // true by construction; assert it directly as a regression guard.
        let a = art();
        let console = render_console(&a);
        for cell in &a.cells {
            if cell.group == "Pooled" {
                let first_line = cell.rendered.lines().next().unwrap_or("");
                if !first_line.is_empty() {
                    assert!(
                        console.contains(first_line),
                        "console is missing a pooled cell's own literal: {first_line:?}"
                    );
                }
            }
        }
    }
}
