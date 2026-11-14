use std::fs;
use std::path::{Path, PathBuf};

use tempfile::TempDir;
use uraeda_core::settings;

fn tempdir() -> TempDir {
    TempDir::new().expect("a temporary folder")
}

fn file(dir: &Path) -> PathBuf {
    dir.join("config.toml")
}

fn write(dir: &Path, text: &str) {
    fs::write(file(dir), text).unwrap();
}

/// The file's path as messages show it.
fn shown(dir: &Path) -> String {
    settings::shown(&file(dir), &std::env::home_dir().unwrap_or_default())
}

#[test]
fn reports_where_a_file_does_not_parse() {
    let dir = tempdir();
    write(dir.path(), "[server\n");

    let error = settings::read(dir.path()).unwrap_err();

    assert_eq!(error.code, "unreadable");
    let start = format!("Cannot read {}: line 1", shown(dir.path()));
    assert!(error.message.starts_with(&start), "{}", error.message);
}

#[test]
fn shows_the_settings_file_with_the_home_folder_as_tilde() {
    let home = std::env::home_dir().unwrap_or_default();

    assert_eq!(
        settings::shown_file(&home.join(".config/uraeda")),
        "~/.config/uraeda/config.toml"
    );
    assert_eq!(
        settings::shown(Path::new("/srv/uraeda/config.toml"), Path::new("/home/me/")),
        "/srv/uraeda/config.toml"
    );
    assert_eq!(
        settings::shown(
            Path::new("/home/me/.config/uraeda/config.toml"),
            Path::new("/home/me/")
        ),
        "~/.config/uraeda/config.toml"
    );
}

#[test]
fn finds_the_config_folder() {
    let home = Path::new("/home/me");
    let rows: [(&[(&str, &str)], &str); 5] = [
        (&[("URAEDA_CONFIG_DIR", "/c")], "/c"),
        (
            &[("URAEDA_CONFIG_DIR", "/c"), ("XDG_CONFIG_HOME", "/x")],
            "/c",
        ),
        (
            &[("URAEDA_CONFIG_DIR", ""), ("XDG_CONFIG_HOME", "/x")],
            "/x/uraeda",
        ),
        (&[("XDG_CONFIG_HOME", "")], "/home/me/.config/uraeda"),
        (&[], "/home/me/.config/uraeda"),
    ];
    for (variables, expected) in rows {
        let var = |name: &str| {
            variables
                .iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| (*value).to_owned())
        };

        let dir = settings::config_dir(var, home);

        assert_eq!(dir, PathBuf::from(expected), "for {variables:?}");
    }
}

/// The file's `[runs]` table is read; the tables `ura` reads elsewhere, `[serve]` and `[vault]`,
/// and keys `ura` no longer has, are left alone.
#[test]
fn reads_the_run_options_and_leaves_the_rest() {
    let dir = tempdir();
    write(
        dir.path(),
        "[serve]\nport = 4310\n\n[other]\nkept = true\n\n[runs.steps.spec]\nmodel = \"opus\"\n",
    );

    let read = settings::read(dir.path()).unwrap();

    assert_eq!(read.runs.steps.len(), 1);
    assert_eq!(read.runs.steps[0].model.as_deref(), Some("opus"));
}
