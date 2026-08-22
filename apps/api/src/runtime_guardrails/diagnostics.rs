use super::config::{BootstrapRefusal, BootstrapViolation, ViolationCategory, ViolationReason};

pub fn render(refusal: &BootstrapRefusal) -> String {
    let count = refusal.violations.len();
    let mut out = format!("Production startup refused\nFix {count} configuration issue{} before starting the API in production.", if count == 1 { "" } else { "s" });
    for v in &refusal.violations {
        out.push('\n');
        out.push_str(&v.render());
    }
    out
}

pub fn render_violation(v: &BootstrapViolation) -> String {
    v.render()
}

pub fn category_name(c: ViolationCategory) -> &'static str {
    match c {
        ViolationCategory::RuntimeMode => "Runtime mode",
        ViolationCategory::DurableStore => "Durable store",
        ViolationCategory::ArchiveBodyRoot => "Archive body root",
        ViolationCategory::SessionSigning => "Session signing",
        ViolationCategory::ApiKeyEncryption => "API-key encryption",
        ViolationCategory::ApiKeyRotation => "API-key rotation",
        ViolationCategory::OperatorMetrics => "Operator metrics",
        ViolationCategory::AllowedBrowserOrigins => "Allowed browser origins",
        ViolationCategory::SessionCookies => "Session cookies",
    }
}

pub fn reason_name(r: ViolationReason) -> &'static str {
    r.message()
}
