//! `scripts/isolated.sh`, which every test, picture, gallery, frame, and sandbox recipe and
//! `hidden-display` go through: the run's data, configuration, cache, and state folders are its own,
//! and a run that writes in the person's folders of the app anyway fails, naming what it wrote.
//!
//! Each test runs the script with a home of its own, so the person's is never read or written.

use std::path::{Path, PathBuf};
use std::process::{Command, Output};

/// Runs `script`, a shell command, through `scripts/isolated.sh`, with `home` as `HOME` and its
/// runtime folder, and no variable of an outer run.
fn isolated(home: &Path, script: &str) -> Output {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../scripts/isolated.sh");
    let runtime = home.join("run");
    std::fs::create_dir_all(&runtime).unwrap();
    let mut command = Command::new("bash");
    command.arg(path).args(["sh", "-c", script]);
    for name in [
        "URAEDA_ISOLATED",
        "URAEDA_SLOT",
        "XDG_DATA_HOME",
        "XDG_CONFIG_HOME",
        "XDG_CACHE_HOME",
        "XDG_STATE_HOME",
        "TMPDIR",
    ] {
        command.env_remove(name);
    }
    command.env("HOME", home).env("XDG_RUNTIME_DIR", &runtime);
    command.output().expect("bash runs the script")
}

#[test]
fn a_run_writes_in_folders_of_its_own_that_go_with_it() {
    let home = tempfile::tempdir().unwrap();
    let output = isolated(
        home.path(),
        r#"printf '%s\n' "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_STATE_HOME" "$TMPDIR"
           for folder in "$XDG_DATA_HOME" "$XDG_CACHE_HOME"; do
             mkdir -p "$folder/dev.uraeda.app" && echo '{}' > "$folder/dev.uraeda.app/storage.json"
           done
           mkdir -p "$XDG_CONFIG_HOME/uraeda-next" "$XDG_STATE_HOME/uraeda-next""#,
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(output.status.success(), "the run failed: {stderr}");
    let folders: Vec<PathBuf> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(PathBuf::from)
        .collect();
    assert_eq!(folders.len(), 5, "five folders: {folders:?}");
    let runtime = home.path().join("run");
    for folder in &folders {
        assert!(
            folder.starts_with(&runtime),
            "{} is not in the run's own folder",
            folder.display()
        );
        assert!(!folder.exists(), "{} outlived the run", folder.display());
    }
    let mut left: Vec<_> = std::fs::read_dir(home.path())
        .unwrap()
        .map(|entry| entry.unwrap().file_name())
        .collect();
    left.sort();
    assert_eq!(left, ["run"], "the run wrote in the home folder");
}

#[test]
fn a_run_that_writes_in_the_persons_folders_of_the_app_fails_naming_them() {
    let home = tempfile::tempdir().unwrap();
    let storage = home.path().join(".local/share/dev.uraeda.app/storage.json");
    std::fs::create_dir_all(storage.parent().unwrap()).unwrap();
    std::fs::write(&storage, "{}").unwrap();
    let output = isolated(
        home.path(),
        r#"echo '{"theme":"dark"}' > "$HOME/.local/share/dev.uraeda.app/storage.json"
           mkdir -p "$HOME/.config/uraeda-next" && echo x > "$HOME/.config/uraeda-next/config.toml"
           echo '{}' > "$HOME/.local/share/elsewhere.json""#,
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(!output.status.success(), "the run passed: {stderr}");
    for written in [storage, home.path().join(".config/uraeda-next/config.toml")] {
        assert!(
            stderr.contains(&*written.to_string_lossy()),
            "{} is not named: {stderr}",
            written.display()
        );
    }
    assert!(
        !stderr.contains("elsewhere"),
        "a file of another app is named: {stderr}"
    );
}
