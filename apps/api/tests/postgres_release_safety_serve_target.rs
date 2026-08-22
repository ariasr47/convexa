use serde_json::Value;
use std::fs;

#[test]
fn nx_serve_target_enables_postgres_for_the_production_arm() {
    let project_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("project.json");
    let project: Value = serde_json::from_str(
        &fs::read_to_string(project_path).expect("apps/api/project.json must be readable"),
    )
    .expect("apps/api/project.json must be valid JSON");
    let command = project["targets"]["serve"]["options"]["command"]
        .as_str()
        .expect("api serve target must define a command");

    assert_eq!(
        command, "cargo run -p api-rust --features postgres -- serve",
        "the standard Nx serve target must compile the PostgreSQL production arm"
    );
}
