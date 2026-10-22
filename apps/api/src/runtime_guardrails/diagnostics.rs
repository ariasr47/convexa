use super::config::BootstrapRefusal;

pub fn render(refusal: &BootstrapRefusal) -> String {
    let count = refusal.violations.len();
    let mut out = format!("Production startup refused\nFix {count} configuration issue{} before starting the API in production.", if count == 1 { "" } else { "s" });
    for v in &refusal.violations {
        out.push('\n');
        out.push_str(&v.render());
    }
    out
}
