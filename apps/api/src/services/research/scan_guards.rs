//! Test-only closed-vocabulary + banned-term scans (GATE PLAN B18) — the highest-probability
//! regression in the whole feature: a one-line "cleanup" that looks like polish. Scans EVERY
//! rendered string in the console *and* the artifact, for every fixture, with no carve-out.

#![cfg(test)]

use crate::services::research::artifact::{
    build_artifact, build_driver_attribution, build_retention, evidence_class, Artifact,
};
use crate::services::research::comparison::{build_all_records, build_grid, groups_for};
use crate::services::research::labels::build_label_set;
use crate::services::research::pairing::pair_rows;
use crate::services::research::render::render_console;
use crate::services::research::vocabulary::CellState;
use crate::services::scanner::store::StructureSample;
use crate::services::research::StructureOutcome;

const RETIRED: [&str; 5] =
    ["too few (", "undefined (base rate", " — not applicable", "no input (", "not attempted"];

const ADOPTION_VERDICT: [&str; 15] = [
    "better", "best", "winning", "winner", "recommended", "promising", "ready", "top signal",
    "validated", "backtested", "proved", "accurate", "predictive", "works", "edge",
];
const RELATION_CLAIMS: [&str; 3] = ["independent", "unrelated", "orthogonal"];

const BAR_VERDICTS: [&str; 7] =
    ["AT BAR", "BELOW BAR", "PASS", "FAIL", "MEETS", "above the bar", "below the bar"];

const RETENTION_LITERALS: [&str; 8] = [
    "about 7 sessions",
    "7 sessions per symbol",
    "about seven sessions",
    "keeps about",
    "~74",
    "78 samples",
    "168 samples",
    "3.4 days",
];

/// The scan itself — every violation found, with the offending needle named. Reusable across
/// every fixture's corpus AND the anti-vacuity "bites" check below.
fn violations(corpus: &[String]) -> Vec<(String, &'static str)> {
    let mut out = Vec::new();
    for s in corpus {
        for needle in RETIRED {
            if s.contains(needle) {
                out.push((s.clone(), needle));
            }
        }
        for needle in ADOPTION_VERDICT {
            if s.to_ascii_lowercase().contains(needle) {
                out.push((s.clone(), needle));
            }
        }
        for needle in RELATION_CLAIMS {
            if s.to_ascii_lowercase().contains(needle) {
                out.push((s.clone(), needle));
            }
        }
        for needle in BAR_VERDICTS {
            if s.contains(needle) {
                out.push((s.clone(), needle));
            }
        }
        for needle in RETENTION_LITERALS {
            if s.contains(needle) {
                out.push((s.clone(), needle));
            }
        }
        if s.contains("net_gex_vol_norm_signed") {
            out.push((s.clone(), "net_gex_vol_norm_signed"));
        }
        for needle in ["n/a", "NaN", "null", "undefined ("] {
            // "undefined for this data (" is the ONLY legal use of "undefined "; a bare
            // "undefined (" (the retired abbreviation, AC-36) is what this catches.
            if needle == "undefined (" {
                if s.contains("undefined (") && !s.contains("undefined for this data (") {
                    out.push((s.clone(), needle));
                }
            } else if s.contains(needle) {
                out.push((s.clone(), needle));
            }
        }
        // A bare "0"/"0.00" token on a line that contains NO parenthetical AT ALL is the C-2 /
        // AC-26 defect (an absence rendered as a plain zero with nothing qualifying it). Every
        // LEGITIMATE zero this feature ever emits — a real computed value, an "excluded 0" clause,
        // a retention "0 of 0" literal — always sits on a line that also carries a parenthetical
        // somewhere (the same line's own qualifier), so restricting to zero-parens lines keeps
        // this conservative rather than fighting the renderer's own bracketing.
        for line in s.lines() {
            if line.contains('(') {
                continue;
            }
            for tok in line.split_whitespace() {
                let bare = tok.trim_end_matches([',', ':', ';']);
                if bare == "0" || bare == "0.00" {
                    out.push((s.clone(), "bare zero token with no qualifier anywhere on its line"));
                }
            }
        }
    }
    out
}

fn build(samples: &[StructureSample], outcomes: &[StructureOutcome], requested: &[String]) -> Artifact {
    let pairing = pair_rows(samples, outcomes, "1d");
    let ls = build_label_set(&pairing.rows);
    let groups = groups_for(requested);
    let ev = evidence_class(&pairing.session_dates);
    let cells = build_grid(&pairing.rows, &ls, &groups, "1d", &ev, &pairing.n_samples_by_symbol);
    let records = build_all_records(&pairing.rows, &groups, "1d");
    let driver_attribution = build_driver_attribution(&pairing.rows, true);
    let retention = build_retention(&pairing.loaded_by_symbol, requested);
    build_artifact(
        "2026-08-12T00:00:00Z".to_string(),
        "1d",
        requested,
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

fn corpus_of(art: &Artifact) -> Vec<String> {
    let mut c = vec![render_console(art)];
    for cell in &art.cells {
        c.push(cell.rendered.clone());
    }
    for r in &art.candidate_scope {
        c.push(r.rendered.clone());
    }
    for r in &art.retention {
        c.push(r.rendered.clone());
    }
    c.push(art.driver_attribution.rendered.clone());
    for cand in &art.candidates {
        if let Some(n) = &cand.shares_derivation_with {
            c.push(n.clone());
        }
    }
    c
}

#[test]
fn scanner_bites_on_a_synthetic_dirty_string() {
    let dirty = vec!["score is 0.42 (n/a)".to_string()];
    assert!(!violations(&dirty).is_empty(), "the scanner failed to catch a synthetic n/a");

    let dirty2 = vec!["this signal keeps about 7 sessions of history".to_string()];
    assert!(!violations(&dirty2).is_empty(), "the scanner failed to catch a retention literal");

    let dirty3 = vec!["opportunity_score is the best candidate".to_string()];
    assert!(!violations(&dirty3).is_empty(), "the scanner failed to catch adoption language");

    let dirty4 = vec!["the value is 0.00".to_string()];
    assert!(!violations(&dirty4).is_empty(), "the scanner failed to catch a bare unqualified zero");

    let clean = vec!["AUC 0.47 (n=147, sessions=4)".to_string()];
    assert!(violations(&clean).is_empty(), "a clean literal must not false-positive");

    // A LEGITIMATE computed zero, fully qualified, must NOT false-positive.
    let clean_zero = vec!["Precision@10 0.00 (n=147, sessions=4)".to_string()];
    assert!(violations(&clean_zero).is_empty(), "a qualified real zero must not false-positive: {:?}", violations(&clean_zero));
}

#[test]
fn slice_0810_totality_fixture_is_clean() {
    use crate::services::research::fixtures::{slice_0810_outcomes, slice_0810_samples};
    let requested = vec!["SPY".to_string(), "QQQ".to_string(), "IWM".to_string(), "DIA".to_string()];
    let art = build(&slice_0810_samples(), &slice_0810_outcomes(), &requested);

    let corpus = corpus_of(&art);
    // anti-vacuity: the scanned corpus is non-empty and exceeds a floor.
    let console_len: usize = corpus.first().map(|s| s.len()).unwrap_or(0);
    assert!(console_len > 4_000, "console too short to be a real scan target (len {console_len})");
    assert_eq!(art.cells.len(), 75);

    let v = violations(&corpus);
    assert!(v.is_empty(), "banned-term scan found violations: {v:?}");

    // AC-38 — NotApplicable must not fire in any run or fixture.
    for c in &art.cells {
        assert!(!matches!(c.state, CellState::NotApplicable { .. }), "AC-38 violated: {:?}", c.group);
    }
}

#[test]
fn constructed_fixtures_are_clean() {
    use crate::services::research::fixtures::constructed::{
        f_const_candidate, f_const_outcome, f_mixed, f_no_positives, f_perfect_and_inverse,
        f_sparse_pearson, f_thin,
    };
    for (samples, outcomes, syms) in [
        f_mixed(),
        f_no_positives(),
        f_const_outcome(),
        f_const_candidate(),
        f_thin(),
        f_sparse_pearson(),
        f_perfect_and_inverse(),
    ] {
        let art = build(&samples, &outcomes, &syms);
        let corpus = corpus_of(&art);
        let v = violations(&corpus);
        assert!(v.is_empty(), "fixture over {syms:?} failed the scan: {v:?}");
        for c in &art.cells {
            assert!(!matches!(c.state, CellState::NotApplicable { .. }));
        }
    }
}
