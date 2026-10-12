//! `research::render` — the console assembly (SPEC §4). Every block below reuses the SAME
//! literal strings already computed onto `Cell.rendered` / `Retention.rendered` /
//! `DriverAttribution.rendered` (comparison.rs / artifact.rs) — render.rs never re-derives a
//! number or a literal, it only orders and labels blocks, so console and artifact can never
//! disagree (AC-21).

use crate::services::research::artifact::{Artifact, BAR_TEXT};
use crate::services::research::candidates::{Family, Role, CANDIDATES};

/// AC-64: "beyond one session" — not the 7-day figure a prior version used (which meant a
/// 1.8-day-stale run, well past a session boundary, printed nothing at all).
const STALE_DIARY_SESSION_DAYS: f64 = 1.0;

/// AC-16/AC-45: `YYYY-MM-DD HH:MM\u{2013}HH:MM UTC (XhYYm)` when the window sits inside one
/// calendar day (SPEC §4's exact instance: `2026-08-10 17:15\u{2013}23:58 UTC (6h43m)`), else
/// `YYYY-MM-DD HH:MM UTC \u{2013} YYYY-MM-DD HH:MM UTC`. Epoch floats are legible in NO other
/// rendering context in this artifact — `retention[]` already proves the code can format ISO
/// (`build_retention`'s `utc_string`) — so printing them raw here was a rendering omission, not a
/// data one.
fn human_window(first: Option<f64>, last: Option<f64>) -> String {
    use chrono::TimeZone;
    let (Some(a), Some(b)) = (first, last) else {
        return "no window (zero paired rows)".to_string();
    };
    let (Some(da), Some(db)) = (
        chrono::Utc.timestamp_opt(a.floor() as i64, 0).single(),
        chrono::Utc.timestamp_opt(b.floor() as i64, 0).single(),
    ) else {
        return "no window (zero paired rows)".to_string();
    };
    if da.format("%Y-%m-%d").to_string() == db.format("%Y-%m-%d").to_string() {
        let total_min = db.signed_duration_since(da).num_minutes().max(0);
        let (hh, mm) = (total_min / 60, total_min % 60);
        format!(
            "{} {}\u{2013}{} UTC ({hh}h{mm:02}m)",
            da.format("%Y-%m-%d"),
            da.format("%H:%M"),
            db.format("%H:%M"),
        )
    } else {
        format!(
            "{} UTC \u{2013} {} UTC",
            da.format("%Y-%m-%d %H:%M"),
            db.format("%Y-%m-%d %H:%M"),
        )
    }
}

/// Block 1 — the evidence header. First block on EVERY run, including partial/degenerate/stale
/// ones (AC-43). Every number in the "Not evaluable here" line except the cap comes from
/// `retention[]` (derived per run, never a baked-in span — AC-78).
pub fn render_evidence_header(art: &Artifact) -> String {
    let symbols = art.requested_symbols.join(", ");
    let window = human_window(art.window_utc_first, art.window_utc_last);

    let spy_retention = art
        .retention
        .iter()
        .find(|r| r.symbol == "SPY")
        .or_else(|| art.retention.first());
    // AC-45b — the multi-week-not-evaluable sentence must state the WINDOW the observed rate was
    // derived over (SPEC's exact instance: "over 2026-08-10\u{2192}2026-08-12"), not merely the
    // rate — a prior version dropped this clause entirely.
    let window_clause = spy_retention
        .and_then(|r| match (&r.window_first, &r.window_last) {
            (Some(a), Some(b)) => Some(format!(
                " over {}\u{2192}{}",
                &a[..a.len().min(10)],
                &b[..b.len().min(10)]
            )),
            _ => None,
        })
        .unwrap_or_default();
    let not_evaluable = match spy_retention {
        Some(r) if r.samples_loaded > 0 => format!(
            "the multi-week half needs more history than the raw diary holds. The diary is a \
             per-symbol ring capped at STRUCTURE_HISTORY_MAX = {} samples, oldest evicted first. \
             At this run's own observed rate — {} — derived from these rows{window_clause}; not \
             a stored constant, and it moves when the capture rate moves.",
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

    // AC-64 — when the newest paired sample predates the run beyond ONE SESSION, name both dates.
    if let Some(days_before) = stale_diary_days(art) {
        if days_before > STALE_DIARY_SESSION_DAYS {
            let last_dt = art
                .window_utc_last
                .and_then(epoch_to_date_string)
                .unwrap_or_default();
            lines.push(format!(
                "  Newest sample {last_dt} ({days_before:.1} days before this run) \u{2014} this read \
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
/// unavailable (zero paired rows).
fn stale_diary_days(art: &Artifact) -> Option<f64> {
    use chrono::DateTime;
    let last = art.window_utc_last?;
    let now: DateTime<chrono::Utc> = art.generated_at_utc.parse().ok()?;
    let days = (now.timestamp() as f64 - last) / 86_400.0;
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

/// The candidate label block — row header + basis/direction/vol-basis-mix/control-rationale +
/// shared-derivation note, in declared order, printed once ahead of that candidate's cells (SPEC
/// §4 "Copy — candidate labels"). AC-18: every row states its ranking direction in words. AC-19:
/// the vol-normalized row carries the vol-basis counts triple. AC-2: the control carries its own
/// one-sentence rationale, in its own label. AC-20: every geometry row prints both its raw field
/// name and the fold applied to it.
fn render_candidate_label(idx: usize, key: &str, art: &Artifact) -> String {
    let c = CANDIDATES.iter().find(|c| c.key == key).unwrap();
    let detail = match (c.family, c.role) {
        (Family::Score, _) => format!("({})", c.orientation.direction),
        (Family::GexMagnitude, Role::Control { .. }) => {
            "(ranked on |net GEX|; same eligible rows as the row above, so a vol-norm result can \
             be attributed to the normalization)"
                .to_string()
        }
        (Family::GexMagnitude, Role::Primary) => {
            let mix = art
                .candidate_scope
                .iter()
                .find(|r| r.candidate == key && r.group == "Pooled")
                .map(|r| r.basis_mix.clone())
                .unwrap_or_default();
            let atm = mix.get("atm_iv").copied().unwrap_or(0);
            let hv = mix.get("hv_30d").copied().unwrap_or(0);
            let unavail = mix.get("unavailable").copied().unwrap_or(0);
            format!(
                "(ranked on |net GEX| / vol scalar; {}; basis mix: ATM IV {atm}, HV 30d {hv}, \
                 unavailable {unavail})",
                c.orientation.direction
            )
        }
        (Family::LevelGeometry, _) => format!(
            "(ranked on -|{}, %|; {})",
            c.orientation.raw_field, c.orientation.direction
        ),
    };
    let mut out = format!("{idx}  {} {detail}", c.display);
    if let Some(note) = crate::services::research::candidates::shared_derivation_note(c) {
        out.push_str(&format!("\n   {note}"));
    }
    out
}

/// AC-47 — the window banner on the metric tables themselves, not only the evidence header.
fn render_window_banner(art: &Artifact) -> String {
    format!(
        "Window: {} \u{b7} {}",
        human_window(art.window_utc_first, art.window_utc_last),
        art.evidence_class
    )
}

/// AC-17 — every metric row carries its label definition verbatim, in the SAME block as the
/// number, never only in a legend. `l` is `None` when the label echo cannot be found (defensive;
/// unreachable on a well-formed artifact, since `art.labels` always carries all three).
fn label_definition_line(art: &Artifact, label_key: &str) -> String {
    match art.labels.iter().find(|l| l.key == label_key) {
        Some(l) => {
            let threshold = l
                .threshold
                .map(|t| format!("{t:.4}"))
                .unwrap_or_else(|| "no numeric threshold (rule-based label)".to_string());
            format!(
                "    label {}: {} (threshold={threshold})",
                l.key, l.definition
            )
        }
        None => format!("    label {label_key}"),
    }
}

fn primary_label_key(art: &Artifact) -> &'static str {
    art.labels
        .iter()
        .find(|l| true_is_primary(l.key))
        .map(|l| l.key)
        .unwrap_or("")
}

/// Blocks 4-6, in the FIXED SPEC §4 order: 4) every candidate's PRIMARY label, pooled; 5) every
/// candidate's PRIMARY label, per symbol; 6) every candidate's SECONDARY labels. GATE Q (AC-58):
/// a prior version was candidate-major across ALL labels, so candidate 2's primary block followed
/// candidate 1's secondary blocks — the primary KPI did not appear before every secondary block.
/// AC-47: the window banner opens both the primary section and the secondary section. AC-17: the
/// label definition rides in the SAME block as the number, on every cell.
pub fn render_candidate_blocks(art: &Artifact) -> String {
    let mut out = Vec::new();
    let primary_key = primary_label_key(art);

    // Block 4 — candidates x primary label, POOLED.
    out.push(render_window_banner(art));
    for (i, cand) in CANDIDATES.iter().enumerate() {
        out.push(render_candidate_label(i + 1, cand.key, art));
        if let Some(cell) = art
            .cells
            .iter()
            .find(|c| c.candidate == cand.key && c.label == primary_key && c.group == "Pooled")
        {
            out.push(format!(
                "  {} \u{b7} {}\n{}\n{}",
                cand.display,
                primary_key,
                cell.rendered,
                label_definition_line(art, primary_key)
            ));
        }
    }

    // Block 5 — candidates x primary label, PER SYMBOL. AC-14: the heading itself is computed
    // once in artifact.rs (`per_symbol_heading`) and reused here verbatim — never re-derived —
    // so a single-symbol run's console and artifact state the same fact the same way.
    out.push(art.per_symbol_note.clone());
    for cand in CANDIDATES {
        for sym in &art.requested_symbols {
            let group_key = format!("Symbol({})", sym.trim().to_ascii_uppercase());
            if let Some(cell) = art
                .cells
                .iter()
                .find(|c| c.candidate == cand.key && c.label == primary_key && c.group == group_key)
            {
                out.push(format!(
                    "    {sym} \u{b7} {} \u{b7} {}\n{}\n{}",
                    cand.display,
                    primary_key,
                    cell.rendered,
                    label_definition_line(art, primary_key)
                ));
            }
        }
    }

    // Block 6 — SECONDARY labels, visibly secondary, per candidate (pooled then per symbol).
    out.push(render_window_banner(art));
    for label in &art.labels {
        if label.key == primary_key {
            continue;
        }
        out.push(format!("Secondary label: {} [secondary]", label.key));
        for cand in CANDIDATES {
            if let Some(cell) = art
                .cells
                .iter()
                .find(|c| c.candidate == cand.key && c.label == label.key && c.group == "Pooled")
            {
                out.push(format!(
                    "  {} \u{b7} {} [secondary]\n{}\n{}",
                    cand.display,
                    label.key,
                    cell.rendered,
                    label_definition_line(art, label.key)
                ));
            }
            for sym in &art.requested_symbols {
                let group_key = format!("Symbol({})", sym.trim().to_ascii_uppercase());
                if let Some(cell) = art.cells.iter().find(|c| {
                    c.candidate == cand.key && c.label == label.key && c.group == group_key
                }) {
                    out.push(format!(
                        "    {sym} \u{b7} {} \u{b7} {} [secondary]\n{}\n{}",
                        cand.display,
                        label.key,
                        cell.rendered,
                        label_definition_line(art, label.key)
                    ));
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
    let mut out = vec![
        render_window_banner(art),
        "Calibration (quintile bins, pooled)".to_string(),
    ];
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

    /// AC-64 — GATE Q: the prior threshold was 7 DAYS (`STALE_DIARY_THRESHOLD_DAYS`), so QA's
    /// exact repro — a run 1.8 days after the newest paired sample, at least one intervening
    /// session — printed NO stale line at all. The rule is "beyond one session", not "beyond a
    /// week".
    #[test]
    fn stale_diary_line_fires_beyond_one_session_not_same_session() {
        let mut a = art();
        // Newest paired sample is on 2026-08-10; generate "now" far in the future.
        a.generated_at_utc = "2026-09-01T00:00:00Z".to_string();
        let header = render_evidence_header(&a);
        assert!(
            header.contains("this read describes an older diary, not today"),
            "{header}"
        );

        // QA's exact repro: ~1.8 days stale — well past a session boundary, well short of the
        // old 7-day threshold. Must fire now.
        a.generated_at_utc = "2026-08-12T19:37:00Z".to_string();
        let header_qa_repro = render_evidence_header(&a);
        assert!(
            header_qa_repro.contains("Newest sample")
                && header_qa_repro.contains("this read describes an older diary, not today"),
            "1.8-day-stale run printed no stale-diary line: {header_qa_repro}"
        );

        // Same-session (a few hours later, same calendar day) must NOT fire.
        a.generated_at_utc = "2026-08-10T20:00:00Z".to_string();
        let header2 = render_evidence_header(&a);
        assert!(!header2.contains("this read describes an older diary"));
    }

    /// AC-45b — the "Not evaluable here" block must state the WINDOW the observed rate was
    /// derived over (`over <date>\u{2192}<date>`), not only the rate.
    #[test]
    fn not_evaluable_states_its_own_window() {
        let a = art();
        let header = render_evidence_header(&a);
        assert!(
            header.contains("derived from these rows over 2026-08-10"),
            "{header}"
        );
    }

    /// AC-47 — the window banner appears on the metric tables themselves (blocks 4/6/7), not only
    /// in the evidence header (block 1).
    #[test]
    fn window_banner_appears_on_the_metric_tables_not_only_the_header() {
        let a = art();
        let candidate_blocks = render_candidate_blocks(&a);
        let calibration_block = render_calibration_block(&a);
        assert!(
            candidate_blocks.starts_with("Window:"),
            "candidate blocks must open with the window banner: {candidate_blocks}"
        );
        assert!(
            calibration_block.starts_with("Window:"),
            "calibration block must open with the window banner: {calibration_block}"
        );
    }

    /// AC-2/AC-18/AC-19/AC-20 — every candidate row carries its ranking direction, the control's
    /// own rationale sentence, the vol-basis counts triple, and the geometry raw-field+fold — in
    /// the row itself, not only in the artifact's registry echo.
    #[test]
    fn candidate_rows_carry_direction_basis_and_control_rationale() {
        let a = art();
        let blocks = render_candidate_blocks(&a);
        assert!(
            blocks.contains("Composite opportunity score (higher score ranks first)"),
            "{blocks}"
        );
        assert!(
            blocks.contains(
                "(ranked on |net GEX|; same eligible rows as the row above, so a \
                              vol-norm result can be attributed to the normalization)"
            ),
            "control row missing its one-sentence rationale"
        );
        assert!(
            blocks.contains("basis mix: ATM IV"),
            "vol-normalized row missing the vol-basis counts triple"
        );
        assert!(
            blocks.contains(
                "Closeness to flip (ranked on -|dist_to_flip_pct, %|; nearer the \
                              flip ranks first)"
            ),
            "geometry row missing its raw field name + fold"
        );
        assert!(
            blocks.contains("Closeness to nearer wall (ranked on -|dist_to_wall_pct, %; ")
                || blocks.contains(
                    "Closeness to nearer wall (ranked on -|dist_to_wall_pct, %|; nearer the \
                     nearer wall ranks first)"
                ),
            "geometry row missing its raw field name + fold"
        );
    }

    /// AC-15 — every Pooled GEX-magnitude cell carries the not-symbol-comparable caveat inside its
    /// own rendered block.
    #[test]
    fn pooled_gex_magnitude_cells_carry_the_not_symbol_comparable_caveat() {
        let a = art();
        let console = render_console(&a);
        assert!(
            console.contains("not symbol-comparable: net GEX magnitude"),
            "{console}"
        );
    }

    /// AC-17 — every metric row carries its label definition verbatim, in the SAME block as the
    /// number.
    #[test]
    fn every_cell_block_carries_its_label_definition() {
        let a = art();
        let blocks = render_candidate_blocks(&a);
        let large_abs_move_def = a
            .labels
            .iter()
            .find(|l| l.key == "large_abs_move")
            .unwrap()
            .definition;
        // The definition must appear immediately following AT LEAST one cell's rendered block,
        // not only once in the top slice-description block.
        assert!(
            blocks
                .matches(&format!("label large_abs_move: {large_abs_move_def}"))
                .count()
                > 1,
            "label definition must ride alongside multiple cells, not appear once globally"
        );
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
