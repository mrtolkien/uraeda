use std::path::PathBuf;
use std::process::Command;

/// A path inside the repository's shared `fixtures/` folder.
pub fn fixture(path: &str) -> String {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures")
        .join(path)
        .to_string_lossy()
        .into_owned()
}

pub struct Output {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

/// Runs the built `ura` binary.
pub fn ura(args: &[&str]) -> Output {
    let output = Command::new(env!("CARGO_BIN_EXE_ura"))
        .args(args)
        .output()
        .expect("ura runs");
    Output {
        stdout: String::from_utf8(output.stdout).unwrap(),
        stderr: String::from_utf8(output.stderr).unwrap(),
        code: output.status.code().unwrap(),
    }
}
