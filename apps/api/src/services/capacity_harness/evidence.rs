//! Evidence classifier: `ci` only via GITHUB_ACTIONS or CONVEXA_CAPACITY_CI_STEP.

pub use super::types::Evidence;

fn truthy_value(v: &str) -> bool {
    let t = v.trim();
    !t.is_empty() && t != "0" && !t.eq_ignore_ascii_case("false")
}

fn truthy_in(vars: &[(&str, &str)], name: &str) -> bool {
    vars.iter()
        .find(|(k, _)| *k == name)
        .map(|(_, v)| truthy_value(v))
        .unwrap_or(false)
}

/// Testable classifier over an explicit env map (does not mutate process env).
///
/// Ambient `CI=true` alone is **local**. Only `GITHUB_ACTIONS` or
/// `CONVEXA_CAPACITY_CI_STEP` (truthy) classify as `ci`.
pub fn classify_with(vars: &[(&str, &str)]) -> Evidence {
    if truthy_in(vars, "GITHUB_ACTIONS") || truthy_in(vars, "CONVEXA_CAPACITY_CI_STEP") {
        Evidence::Ci
    } else {
        Evidence::Local
    }
}

/// Classify from the live process environment: [`classify_with`]'s rule applied to a snapshot of
/// the process env, so the rule exists exactly once. Non-UTF-8 entries are skipped, matching the
/// old `std::env::var(..).ok()` behaviour of treating them as unset.
pub fn classify_evidence() -> Evidence {
    let env: Vec<(String, String)> = std::env::vars_os()
        .filter_map(|(k, v)| Some((k.into_string().ok()?, v.into_string().ok()?)))
        .collect();
    let vars: Vec<(&str, &str)> = env.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
    classify_with(&vars)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_truthy_github_actions_or_capacity_ci_step_classifies_as_ci() {
        let cases: &[(&[(&str, &str)], Evidence)] = &[
            (&[("CI", "true")], Evidence::Local),
            (&[("GITHUB_ACTIONS", "true")], Evidence::Ci),
            (&[("CONVEXA_CAPACITY_CI_STEP", "1")], Evidence::Ci),
            (&[], Evidence::Local),
            (
                &[("GITHUB_ACTIONS", "false"), ("CI", "true")],
                Evidence::Local,
            ),
            (
                &[("GITHUB_ACTIONS", "0"), ("CONVEXA_CAPACITY_CI_STEP", "")],
                Evidence::Local,
            ),
        ];
        for (vars, expected) in cases {
            assert_eq!(classify_with(vars), *expected, "vars: {vars:?}");
        }
    }
}
