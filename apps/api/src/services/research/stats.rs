//! Stats helpers (no external crates). Moved verbatim out of `score_lab.rs` (B1) so the
//! comparison path (`research::comparison`) calls the SAME functions the shipped
//! `evaluate_baseline` parity oracle uses — bit-exact reuse, not a re-implementation.

pub(crate) fn pearson(pairs: &[(f64, f64)]) -> Option<f64> {
    let n = pairs.len();
    if n < 3 {
        return None;
    }
    let mx = pairs.iter().map(|(x, _)| *x).sum::<f64>() / n as f64;
    let my = pairs.iter().map(|(_, y)| *y).sum::<f64>() / n as f64;
    let mut num = 0.0;
    let mut dx = 0.0;
    let mut dy = 0.0;
    for (x, y) in pairs {
        let a = x - mx;
        let b = y - my;
        num += a * b;
        dx += a * a;
        dy += b * b;
    }
    if dx <= 0.0 || dy <= 0.0 {
        return None;
    }
    Some(num / (dx.sqrt() * dy.sqrt()))
}

pub(crate) fn spearman(pairs: &[(f64, f64)]) -> Option<f64> {
    if pairs.len() < 3 {
        return None;
    }
    let rx = ranks(pairs.iter().map(|(x, _)| *x).collect());
    let ry = ranks(pairs.iter().map(|(_, y)| *y).collect());
    let ranked: Vec<(f64, f64)> = rx.into_iter().zip(ry).collect();
    pearson(&ranked)
}

/// Average ranks with tie mid-ranks.
pub(crate) fn ranks(mut vals: Vec<f64>) -> Vec<f64> {
    let n = vals.len();
    let mut order: Vec<usize> = (0..n).collect();
    order.sort_by(|&i, &j| vals[i].partial_cmp(&vals[j]).unwrap_or(std::cmp::Ordering::Equal));
    let mut out = vec![0.0; n];
    let mut i = 0;
    while i < n {
        let mut j = i + 1;
        while j < n && (vals[order[j]] - vals[order[i]]).abs() < 1e-15 {
            j += 1;
        }
        // ranks are 1-based; mid-rank for ties
        let mean_rank = (i + j - 1) as f64 / 2.0 + 1.0;
        for k in i..j {
            out[order[k]] = mean_rank;
        }
        i = j;
    }
    let _ = &mut vals; // silence unused mut if not needed
    out
}

pub(crate) fn percentile_sorted(sorted: &[f64], q: f64) -> Option<f64> {
    if sorted.is_empty() {
        return None;
    }
    let q = q.clamp(0.0, 1.0);
    let idx = (q * (sorted.len() - 1) as f64).round() as usize;
    Some(sorted[idx.min(sorted.len() - 1)])
}

/// AUC via Mann–Whitney U (score ranks positives vs negatives).
pub(crate) fn man_whitney_auc(labeled: &[(f64, bool)]) -> Option<f64> {
    let pos: Vec<f64> = labeled
        .iter()
        .filter(|(_, y)| *y)
        .map(|(s, _)| *s)
        .collect();
    let neg: Vec<f64> = labeled
        .iter()
        .filter(|(_, y)| !*y)
        .map(|(s, _)| *s)
        .collect();
    if pos.is_empty() || neg.is_empty() {
        return None;
    }
    let mut concordant = 0.0;
    for p in &pos {
        for n in &neg {
            if p > n {
                concordant += 1.0;
            } else if (*p - *n).abs() < 1e-15 {
                concordant += 0.5;
            }
        }
    }
    Some(concordant / (pos.len() as f64 * neg.len() as f64))
}

/// Top ~10% by score: precision and recall for positives.
pub(crate) fn top_decile_precision_recall(labeled: &[(f64, bool)]) -> (Option<f64>, Option<f64>, usize) {
    let n = labeled.len();
    if n == 0 {
        return (None, None, 0);
    }
    let top_n = ((n as f64) * 0.10).ceil().max(1.0) as usize;
    let top_n = top_n.min(n);
    let mut ordered = labeled.to_vec();
    ordered.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    let top = &ordered[..top_n];
    let tp = top.iter().filter(|(_, y)| *y).count();
    let total_pos = labeled.iter().filter(|(_, y)| *y).count();
    let prec = Some(tp as f64 / top_n as f64);
    let rec = if total_pos == 0 {
        None
    } else {
        Some(tp as f64 / total_pos as f64)
    };
    (prec, rec, top_n)
}
