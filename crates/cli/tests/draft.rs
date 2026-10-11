mod common;

use std::path::Path;
use std::process::Command;

use common::*;

const PRIORITIES: &str = "# Priorities\n\n## Now\n\n- Basic web UI for viewing\n\n## Next\n\n- Git listener process\n- Web UI for editing\n- [Runner](drafts/runner.md)\n\n## Later\n\n## Blocked\n";

fn repo() -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    repo
}

/// Runs `ura` with a terminal, through `script`, when it is installed.
fn ura_with_a_terminal(dir: &Path, command: &str) -> Option<String> {
    let script = Command::new("script").arg("--version").output().ok()?;
    if !script.status.success() {
        return None;
    }
    let output = Command::new("script")
        .args(["--quiet", "--return", "--command", command, "/dev/null"])
        .current_dir(dir)
        .env("URA_TODAY", "2026-10-11")
        .env("NO_COLOR", "1")
        .output()
        .ok()?;
    Some(String::from_utf8_lossy(&output.stdout).replace('\r', ""))
}

#[test]
fn drafts_a_line_and_opens_the_editor() {
    let repo = repo();
    let editor = repo.parent().join("editor.sh");
    std::fs::write(
        &editor,
        "#!/bin/sh\necho \"$1\" > \"$(dirname \"$0\")/edited\"\n",
    )
    .unwrap();
    Command::new("chmod")
        .args(["+x", editor.to_str().unwrap()])
        .status()
        .unwrap();
    let ura = env!("CARGO_BIN_EXE_ura");

    let Some(output) = ura_with_a_terminal(
        repo.path(),
        &format!("VISUAL= EDITOR={} {ura} draft listener", editor.display()),
    ) else {
        return;
    };

    assert!(
        repo.read("specs/drafts/git-listener-process.md")
            .starts_with("# Git listener process\n")
    );
    assert!(
        repo.read("specs/PRIORITIES.md")
            .contains("- [Git listener process](drafts/git-listener-process.md)\n- Web UI")
    );
    let edited = std::fs::read_to_string(repo.parent().join("edited")).unwrap();
    assert!(
        edited
            .trim()
            .ends_with("specs/drafts/git-listener-process.md"),
        "{edited}\n{output}"
    );
    assert_eq!(repo.subjects("HEAD").len(), 2);
}

#[test]
fn several_lines_match() {
    let repo = repo();

    let output = ura(&repo, &["draft", "web ui"]);

    assert_eq!(
        output.stderr,
        "ura: 2 lines match \"web ui\":\n  Now   Basic web UI for viewing\n  Next  Web UI for editing\n"
    );
    assert_eq!(output.code, 1);
    assert!(!repo.exists("specs/drafts"));
}

#[test]
fn a_line_with_a_link() {
    let repo = repo();

    let output = ura(&repo, &["draft", "runner"]);

    assert_eq!(
        output.stderr,
        "ura: Runner already links drafts/runner.md\n"
    );
    assert_eq!(output.code, 1);
}

#[test]
fn without_a_terminal_it_prints_the_path() {
    let repo = repo();

    let output = ura(&repo, &["draft", "listener"]);

    assert_eq!(
        output.stdout,
        "created specs/drafts/git-listener-process.md\nlinked  \"Git listener process\" in specs/PRIORITIES.md\n"
    );
    assert!(repo.exists("specs/drafts/git-listener-process.md"));
    assert_eq!(output.code, 0);
}

#[test]
fn no_editor_found() {
    let repo = repo();
    let ura = env!("CARGO_BIN_EXE_ura");

    let Some(output) = ura_with_a_terminal(
        repo.path(),
        &format!("env -u VISUAL -u EDITOR PATH=/nonexistent {ura} draft listener"),
    ) else {
        return;
    };

    assert!(
        output.contains("open it in your editor: specs/drafts/git-listener-process.md"),
        "{output}"
    );
    assert!(repo.exists("specs/drafts/git-listener-process.md"));
}

#[test]
fn without_text_it_lists_the_lines() {
    let repo = repo();

    let output = ura(&repo, &["draft"]);

    assert_eq!(
        output.stderr,
        "ura: name the line: ura draft <text>\n  Now   Basic web UI for viewing\n  Next  Git listener process\n  Next  Web UI for editing\n"
    );
    assert_eq!(output.code, 1);
}
