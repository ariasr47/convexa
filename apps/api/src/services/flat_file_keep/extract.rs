//! Watchlist extract from a Massive universe gzip (trades or quotes day file).
//! Never returns the gzip body as an extract. Header-driven ticker/symbol column.

use super::watchlist::{in_flat_files_watchlist, normalize_symbol, FLAT_FILES_WATCHLIST};
use flate2::read::GzDecoder;
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

/// Per-symbol CSV extract (header + rows) for one locked name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SymbolCsv {
    pub csv: String,
    pub row_count: usize,
}

/// Locked-name extracts produced from one universe day file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LockedExtracts {
    pub by_symbol: HashMap<String, SymbolCsv>,
}

/// Extract fault — promoted as unreadable, not empty extract.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExtractError {
    Unreadable { reason: String },
}

/// Decode gzip + CSV; filter to SPY/QQQ/IWM. Zero rows for a locked name → empty extract.
pub fn extract_locked_from_gzip(gzip_bytes: &[u8]) -> Result<LockedExtracts, ExtractError> {
    let mut decoder = GzDecoder::new(gzip_bytes);
    let mut csv_text = String::new();
    decoder
        .read_to_string(&mut csv_text)
        .map_err(|e| ExtractError::Unreadable {
            reason: format!("gzip decode: {e}"),
        })?;
    extract_locked_from_csv(&csv_text)
}

/// Read a gzip temp path and extract locked names.
pub fn extract_locked_from_path(path: &Path) -> Result<LockedExtracts, ExtractError> {
    let bytes = std::fs::read(path).map_err(|e| ExtractError::Unreadable {
        reason: format!("read temp: {e}"),
    })?;
    extract_locked_from_gzip(&bytes)
}

fn extract_locked_from_csv(csv_text: &str) -> Result<LockedExtracts, ExtractError> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(csv_text.as_bytes());

    let headers = reader
        .headers()
        .map_err(|e| ExtractError::Unreadable {
            reason: format!("csv header: {e}"),
        })?
        .clone();

    let ticker_idx = headers
        .iter()
        .position(|h| {
            let n = h.trim().to_ascii_lowercase();
            n == "ticker" || n == "symbol"
        })
        .ok_or_else(|| ExtractError::Unreadable {
            reason: "unrecognized header: no ticker/symbol column".into(),
        })?;

    let header_line = headers.iter().collect::<Vec<_>>().join(",");

    let mut rows_by_sym: HashMap<String, Vec<String>> = HashMap::new();
    for sym in FLAT_FILES_WATCHLIST {
        rows_by_sym.insert((*sym).to_string(), Vec::new());
    }

    for rec in reader.records() {
        let rec = rec.map_err(|e| ExtractError::Unreadable {
            reason: format!("csv row: {e}"),
        })?;
        let raw = rec.get(ticker_idx).unwrap_or("").trim();
        if raw.is_empty() {
            continue;
        }
        let sym = normalize_symbol(raw);
        if !in_flat_files_watchlist(&sym) {
            continue;
        }
        let line = rec.iter().collect::<Vec<_>>().join(",");
        rows_by_sym.entry(sym).or_default().push(line);
    }

    let mut by_symbol = HashMap::new();
    for sym in FLAT_FILES_WATCHLIST {
        let rows = rows_by_sym.remove(*sym).unwrap_or_default();
        let row_count = rows.len();
        let mut csv = String::with_capacity(header_line.len() + 1);
        csv.push_str(&header_line);
        csv.push('\n');
        for row in &rows {
            csv.push_str(row);
            csv.push('\n');
        }
        by_symbol.insert((*sym).to_string(), SymbolCsv { csv, row_count });
    }

    Ok(LockedExtracts { by_symbol })
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    fn plant_gzip(csv: &str) -> Vec<u8> {
        let mut enc = GzEncoder::new(Vec::new(), Compression::default());
        enc.write_all(csv.as_bytes()).unwrap();
        enc.finish().unwrap()
    }

    #[test]
    fn extract_filters_locked_names_discards_nvda() {
        let gz = plant_gzip("ticker,price\nSPY,1.0\nNVDA,9.0\nQQQ,2.0\nAAPL,3.0\nIWM,4.0\n");
        let out = extract_locked_from_gzip(&gz).unwrap();
        assert!(out.by_symbol["SPY"].csv.contains("SPY"));
        assert!(out.by_symbol["QQQ"].csv.contains("QQQ"));
        assert!(out.by_symbol["IWM"].csv.contains("IWM"));
        assert!(!out.by_symbol["SPY"].csv.contains("NVDA"));
        assert!(!out.by_symbol["QQQ"].csv.contains("AAPL"));
        assert_eq!(out.by_symbol["SPY"].row_count, 1);
        assert_eq!(out.by_symbol["QQQ"].row_count, 1);
        assert_eq!(out.by_symbol["IWM"].row_count, 1);
        // symbol-header twin
        let gz2 = plant_gzip("symbol,price\nSPY,1.0\nNVDA,9.0\n");
        let out2 = extract_locked_from_gzip(&gz2).unwrap();
        assert_eq!(out2.by_symbol["SPY"].row_count, 1);
        assert_eq!(out2.by_symbol["QQQ"].row_count, 0);
        assert!(!out2.by_symbol["SPY"].csv.contains("NVDA"));
    }

    #[test]
    fn unrecognized_header_is_unreadable_not_empty_extract() {
        let gz = plant_gzip("price,volume\n1.0,100\n");
        let err = extract_locked_from_gzip(&gz).unwrap_err();
        match err {
            ExtractError::Unreadable { reason } => {
                assert!(
                    reason.contains("unrecognized header") || reason.contains("ticker"),
                    "reason={reason}"
                );
            }
        }
    }

    #[test]
    fn zero_rows_for_iwm_is_empty_extract_content_hit() {
        let gz = plant_gzip("ticker,price\nSPY,1.0\nQQQ,2.0\n");
        let out = extract_locked_from_gzip(&gz).unwrap();
        assert_eq!(out.by_symbol["IWM"].row_count, 0);
        assert!(out.by_symbol["IWM"].csv.starts_with("ticker,price"));
        // header present, no IWM data row
        assert!(!out.by_symbol["IWM"]
            .csv
            .lines()
            .skip(1)
            .any(|l| l.contains("IWM")));
        assert_eq!(out.by_symbol["SPY"].row_count, 1);
    }

    #[test]
    fn gzip_temp_is_not_returned_as_extract_body() {
        let csv = "ticker,price\nSPY,1.0\n";
        let gz = plant_gzip(csv);
        let out = extract_locked_from_gzip(&gz).unwrap();
        let body = &out.by_symbol["SPY"].csv;
        // Must be CSV text, not the gzip magic / compressed bytes.
        assert!(body.starts_with("ticker"));
        assert!(!body.as_bytes().starts_with(&[0x1f, 0x8b]));
        assert_ne!(body.as_bytes(), gz.as_slice());
        assert!(!body.as_bytes().windows(2).any(|w| w == [0x1f, 0x8b]));
    }
}
