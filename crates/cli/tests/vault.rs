//! `ura vault`: an agent's reads and writes of the human's notes, in the vault the settings name.

mod common;

use std::io::Write;
use std::process::Stdio;

use common::*;

struct Vault {
    home: tempfile::TempDir,
}

impl Vault {
    fn new() -> Vault {
        let home = tempfile::TempDir::new().unwrap();
        let config = home.path().join("config");
        std::fs::create_dir(&config).unwrap();
        let vault = home.path().join("Notes");
        std::fs::write(
            config.join("config.toml"),
            format!("[vault]\npath = \"{}\"\n", vault.display()),
        )
        .unwrap();
        Vault { home }
    }

    fn env(&self) -> Vec<(&'static str, String)> {
        let home = self.home.path();
        vec![
            ("HOME", home.display().to_string()),
            (
                "URAEDA_CONFIG_DIR",
                home.join("config").display().to_string(),
            ),
            ("URAEDA_DATA_DIR", home.join("data").display().to_string()),
        ]
    }

    fn ura(&self, args: &[&str]) -> Output {
        let env = self.env();
        let env: Vec<(&str, &str)> = env.iter().map(|(n, v)| (*n, v.as_str())).collect();
        ura_in(self.home.path(), args, &env)
    }

    fn write(&self, path: &str, text: &str) -> std::process::Output {
        let mut child = command(self.home.path(), &["vault", "write", path])
            .envs(self.env())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(text.as_bytes())
            .unwrap();
        child.wait_with_output().unwrap()
    }
}

#[test]
fn writes_lists_sets_and_removes_notes() {
    let vault = Vault::new();
    let missing = vault.ura(&["vault", "ls"]);
    assert_eq!(missing.code, 1, "{}", missing.stdout);
    assert!(missing.stderr.contains("no vault at"), "{}", missing.stderr);

    let note =
        "---\ndescription: A todo app, studied as a model\nchecked: 2026-10-06\n---\n# Todoist\n";
    assert!(vault.write("wiki/apps/todoist.md", note).status.success());
    let listed = vault.ura(&["vault", "ls", "wiki/apps"]);
    assert_eq!(
        listed.stdout,
        "wiki/apps/todoist.md  A todo app, studied as a model\n"
    );
    let json = vault.ura(&["vault", "ls", "--json"]);
    assert!(
        json.stdout.contains("\"path\": \"wiki/\""),
        "{}",
        json.stdout
    );

    let set = vault.ura(&[
        "vault",
        "write",
        "wiki/apps/todoist.md",
        "--set",
        "checked=2026-11-14",
    ]);
    assert_eq!(set.code, 0, "{}", set.stderr);
    let read = vault.ura(&["vault", "read", "wiki/apps/todoist.md"]);
    assert_eq!(read.stdout, note.replace("2026-10-06", "2026-11-14"));

    let refused = vault.write("projects/todo/specs/spec.md", "x");
    assert!(!refused.status.success());
    assert!(String::from_utf8_lossy(&refused.stderr).contains("read only"));

    assert_eq!(vault.ura(&["vault", "rm", "wiki/apps/todoist.md"]).code, 0);
    assert!(
        vault
            .home
            .path()
            .join("Notes/.trash/wiki/apps/todoist.md")
            .is_file()
    );
    assert_eq!(
        vault.ura(&["vault", "read", "wiki/apps/todoist.md"]).code,
        1
    );
}

#[test]
fn check_reports_and_fails() {
    let vault = Vault::new();
    assert!(vault.write("inbox/a.md", "[[nowhere]]\n").status.success());
    let checked = vault.ura(&["vault", "check"]);
    assert_eq!(checked.code, 1);
    assert_eq!(
        checked.stdout,
        "inbox/a.md:1: [[nowhere]] is no note of the vault\n"
    );
    assert!(vault.write("inbox/nowhere.md", "# Here\n").status.success());
    assert_eq!(vault.ura(&["vault", "check"]).code, 0);
}
