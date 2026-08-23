//! Pure OpenAPI exporter.
//!
//! This binary only builds the contract graph and serializes it. It has no
//! environment, network, or persistence dependencies.

use api_rust::routes;
use serde_json::{Map, Value};

fn canonicalize(value: Value) -> Value {
    match value {
        Value::Object(object) => {
            let mut ordered = Map::new();
            let mut entries: Vec<_> = object.into_iter().collect();
            entries.sort_by(|a, b| a.0.cmp(&b.0));
            for (key, value) in entries {
                ordered.insert(key, canonicalize(value));
            }
            Value::Object(ordered)
        }
        Value::Array(values) => Value::Array(values.into_iter().map(canonicalize).collect()),
        other => other,
    }
}

fn main() {
    let document = match routes::openapi() {
        Ok(document) => serde_json::to_value(document).expect("OpenAPI document serializes"),
        Err(error) => {
            eprintln!("incomplete contract coverage: {error}");
            std::process::exit(1);
        }
    };
    let canonical = canonicalize(document);
    let output = serde_json::to_string_pretty(&canonical).expect("canonical OpenAPI serializes");
    println!("{output}");
}
