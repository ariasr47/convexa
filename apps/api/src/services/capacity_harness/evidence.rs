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

/// Classify from the live process environment.
pub fn classify_evidence() -> Evidence {
    fn env_truthy(name: &str) -> bool {
        std::env::var(name)
            .ok()
            .map(|v| truthy_value(&v))
            .unwrap_or(false)
    }
    if env_truthy("GITHUB_ACTIONS") || env_truthy("CONVEXA_CAPACITY_CI_STEP") {
        Evidence::Ci
    } else {
        Evidence::Local
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ambient_ci_true_without_github_actions_is_local() {
        assert_eq!(classify_with(&[("CI", "true")]), Evidence::Local);
    }

    #[test]
    fn github_actions_true_is_ci() {
        assert_eq!(classify_with(&[("GITHUB_ACTIONS", "true")]), Evidence::Ci);
    }

    #[test]
    fn capacity_ci_step_truthy_is_ci() {
        assert_eq!(
            classify_with(&[("CONVEXA_CAPACITY_CI_STEP", "1")]),
            Evidence::Ci
        );
    }

    #[test]
    fn empty_vars_is_local() {
        assert_eq!(classify_with(&[]), Evidence::Local);
    }

    #[test]
    fn falsey_github_actions_stays_local() {
        assert_eq!(
            classify_with(&[("GITHUB_ACTIONS", "false"), ("CI", "true")]),
            Evidence::Local
        );
        assert_eq!(
            classify_with(&[("GITHUB_ACTIONS", "0"), ("CONVEXA_CAPACITY_CI_STEP", "")]),
            Evidence::Local
        );
    }
}
