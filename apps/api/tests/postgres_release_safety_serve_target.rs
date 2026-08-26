use serde_json::Value;
use std::fs;
use std::path::Path;

#[test]
fn nx_serve_target_enables_postgres_for_the_production_arm() {
    let project_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("project.json");
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

#[test]
fn railway_predeploy_binary_is_installed_on_the_standard_executable_path() {
    let repository_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let railway: Value = serde_json::from_str(
        &fs::read_to_string(repository_root.join("railway.json"))
            .expect("railway.json must be readable"),
    )
    .expect("railway.json must be valid JSON");
    let predeploy_command = railway["deploy"]["preDeployCommand"]
        .as_array()
        .expect("Railway must define preDeployCommand");
    let predeploy_command: Vec<_> = predeploy_command
        .iter()
        .map(|part| {
            part.as_str()
                .expect("preDeployCommand entries must be strings")
        })
        .collect();

    assert_eq!(
        predeploy_command,
        ["api-rust postgres-migrate"],
        "the release contract requires the exact bare Railway pre-deploy command"
    );

    let executable = predeploy_command[0]
        .split_ascii_whitespace()
        .next()
        .expect("the pre-deploy command must name an executable");
    let standard_executable = format!("/usr/local/bin/{executable}");
    let expected_copy = format!(
        "COPY --from=builder /src/target/x86_64-unknown-linux-musl/release/{executable} {standard_executable}"
    );
    let dockerfile = fs::read_to_string(repository_root.join("apps/api/Dockerfile"))
        .expect("apps/api/Dockerfile must be readable");
    let binary_copy_lines: Vec<_> = dockerfile
        .lines()
        .map(str::trim)
        .filter(|line| {
            line.starts_with("COPY --from=builder ")
                && line.contains(&format!(
                    "/target/x86_64-unknown-linux-musl/release/{executable}"
                ))
        })
        .collect();

    assert_eq!(
        binary_copy_lines,
        [expected_copy.as_str()],
        "the image must install exactly one copy of the Railway executable at {standard_executable} so the bare pre-deploy command resolves it"
    );
    assert!(
        dockerfile.contains(&format!("CMD [\"{standard_executable}\", \"serve\"]")),
        "the runtime command must use the same canonical executable installed for Railway pre-deploy"
    );
}
