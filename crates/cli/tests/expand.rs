mod common;

use std::path::Path;
use std::process::Command;

use common::repo::without_user_git;
use common::*;
use uraeda_core::actions::{expand, place};
use uraeda_core::git::Git;

const PRIORITIES: &str = "# Priorities\n\n## Now\n\n- Basic web UI for viewing\n\n## Next\n\n- Git listener process\n- Web UI for editing\n- [Runner](proposals/runner.md)\n\n## Later\n\n## Blocked\n";

fn repo() -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    repo
}

/// Runs `ura` with a terminal, through util-linux's `script`. The tests using it are ignored off
/// Linux, where `script` takes other arguments, and fail on a Linux without it, rather than pass
/// without running.
fn ura_with_a_terminal(dir: &Path, command: &str) -> String {
    let output = without_user_git(&mut Command::new("script"))
        .args(["--quiet", "--return", "--command", command, "/dev/null"])
        .current_dir(dir)
        .env("URA_TODAY", "2026-10-11")
        .env("NO_COLOR", "1")
        // `script` provides a terminal, but inherits TERM=dumb from headless callers. These
        // scenarios exercise an interactive terminal regardless of the caller's environment.
        .env("TERM", "xterm-256color")
        .env("SHELL", "/bin/sh")
        .output()
        .expect("util-linux's script runs: install it to run the terminal tests");
    assert!(
        output.status.success(),
        "terminal command failed: {}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout).replace('\r', "")
}

#[test]
#[cfg_attr(not(target_os = "linux"), ignore = "needs util-linux's script")]
fn expands_a_proposal_and_opens_the_editor() {
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

    let output = ura_with_a_terminal(
        repo.path(),
        &format!("VISUAL= EDITOR={} {ura} expand listener", editor.display()),
    );

    assert!(
        repo.read("specs/proposals/git-listener-process.md")
            .contains("---\n\n# Git listener process\n")
    );
    assert!(
        repo.read("specs/PRIORITIES.md")
            .contains("- [Git listener process](proposals/git-listener-process.md)\n- Web UI")
    );
    let edited = std::fs::read_to_string(repo.parent().join("edited")).unwrap();
    assert!(
        edited
            .trim()
            .ends_with("specs/proposals/git-listener-process.md"),
        "{edited}\n{output}"
    );
    assert_eq!(repo.subjects("HEAD").len(), 2);
}

#[test]
fn several_proposals_match() {
    let repo = repo();

    let output = ura(&repo, &["expand", "web ui"]);

    assert_eq!(
        output.stderr,
        "ura: 2 proposals match \"web ui\":\n  Now   Basic web UI for viewing\n  Next  Web UI for editing\n"
    );
    assert_eq!(output.code, 1);
    assert!(!repo.exists("specs/proposals"));
}

#[test]
fn a_proposal_with_a_link() {
    let repo = repo();

    let output = ura(&repo, &["expand", "runner"]);

    assert_eq!(
        output.stderr,
        "ura: Runner already links proposals/runner.md\n"
    );
    assert_eq!(output.code, 1);
}

#[test]
fn without_a_terminal_it_prints_the_path() {
    let repo = repo();

    let output = ura(&repo, &["expand", "listener"]);

    assert_eq!(
        output.stdout,
        "created specs/proposals/git-listener-process.md\nlinked  \"Git listener process\" in specs/PRIORITIES.md\n"
    );
    assert!(repo.exists("specs/proposals/git-listener-process.md"));
    assert_eq!(output.code, 0);
}

#[test]
#[cfg_attr(not(target_os = "linux"), ignore = "needs util-linux's script")]
fn no_editor_found() {
    let repo = repo();
    let ura = env!("CARGO_BIN_EXE_ura");

    let output = ura_with_a_terminal(
        repo.path(),
        &format!("env -u VISUAL -u EDITOR PATH=/nonexistent {ura} expand listener"),
    );

    assert!(
        output.contains("open it in your editor: specs/proposals/git-listener-process.md"),
        "{output}"
    );
    assert!(repo.exists("specs/proposals/git-listener-process.md"));
}

#[test]
fn without_text_it_lists_the_proposals() {
    let repo = repo();

    let output = ura(&repo, &["expand"]);

    assert_eq!(
        output.stderr,
        "ura: name the proposal: ura expand <text>\n  Now   Basic web UI for viewing\n  Next  Git listener process\n  Next  Web UI for editing\n"
    );
    assert_eq!(output.code, 1);
}

/// A repository with the priorities of the shared fixture.
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        &std::fs::read_to_string(fixture("repo/main/specs/PRIORITIES.md")).unwrap(),
    );
    repo
}

/// US5.2: `ura expand` writes the same file as the UI's Expand, byte for byte.
#[test]
fn ura_expand_writes_what_the_ui_writes() {
    let (cli, ui) = (fixture_repo(), fixture_repo());

    let output = ura(&cli, &["expand", "claude code runner"]);
    assert_eq!(output.code, 0, "{}", output.stderr);
    let main = place::reach(&Git::discover(ui.path()).unwrap(), "main").unwrap();
    let path = expand::create(&main, "next-1").unwrap().path;

    assert_eq!(cli.read(&path), ui.read(&path));
}

#[test]
fn candidates_of_the_blocked_section_are_spaced() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n- Basic web UI for viewing\n\n## Blocked\n\n- Benchmarks\n",
    );

    let output = ura(&repo, &["expand"]);

    assert_eq!(
        output.stderr,
        "ura: name the proposal: ura expand <text>\n  Now      Basic web UI for viewing\n  Blocked  Benchmarks\n"
    );
}

/// From another worktree, a proposal file written in the main checkout names its full path.
#[test]
fn from_a_worktree_it_names_the_main_checkout() {
    let repo = repo();
    repo.branch("2026-10-15-other");
    let worktree = repo.parent().join("other");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        "2026-10-15-other",
    ]);

    let output = ura_in(&worktree, &["expand", "listener"], &[]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(
        output
            .stdout
            .starts_with(&format!("wrote in {}\ncreated ", repo.path().display())),
        "{}",
        output.stdout
    );
    assert!(repo.exists("specs/proposals/git-listener-process.md"));
}
