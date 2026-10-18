//! Measures on this repository's own history, ignored by default: they read the local `main`.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

use tempfile::TempDir;
use uraeda_core::workspace::Severity;
use uraeda_core::{api, check};

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn git(args: &[&str]) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(root())
        .output()
        .unwrap();
    assert!(output.status.success(), "git {args:?}: {output:?}");
    String::from_utf8(output.stdout).unwrap()
}

/// The `specs/` folder of a commit, written into `into`.
fn export_specs(commit: &str, into: &Path) {
    let archive = Command::new("git")
        .args(["archive", "--format=tar", commit, "specs"])
        .current_dir(root())
        .output()
        .unwrap();
    assert!(archive.status.success(), "git archive {commit}");
    let mut tar = Command::new("tar")
        .args(["-x", "-C"])
        .arg(into)
        .stdin(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    std::io::Write::write_all(tar.stdin.as_mut().unwrap(), &archive.stdout).unwrap();
    assert!(tar.wait().unwrap().success());
}

/// A rule about a broken file or a missing answer: the only rules that may block.
fn broken_or_unanswered(rule: &str) -> bool {
    rule.starts_with("frontmatter.") || ["file.utf8", "answers.blank"].contains(&rule)
}

/// A rule about drift between versions of the workflow's files: never a problem.
fn drift(rule: &str) -> bool {
    rule.starts_with("sections.") || rule.starts_with("links.") || rule == "settled.group"
}

/// SC-001: over the feature folders the commits of every branch touched from 2026-10-17 16:48 to 2026-10-18
/// 10:00, only a broken file or a missing answer is ever a problem: drift and unfinished files
/// never block.
#[test]
#[ignore = "this repository's history"]
fn sc001_drift_is_never_a_problem() {
    let commits = git(&[
        "log",
        "--format=%H",
        "--since=2026-10-17T16:48",
        "--until=2026-10-18T10:00",
        "--all",
        "--",
        "specs/20*",
    ]);
    let (mut snapshots, mut with_errors, mut blocked) = (0, 0, 0);
    for commit in commits.lines() {
        let touched = git(&["diff-tree", "--no-commit-id", "--name-only", "-r", commit]);
        let folders: BTreeSet<&str> = touched
            .lines()
            .filter_map(|path| path.strip_prefix("specs/"))
            .filter_map(|path| path.split_once('/').map(|(folder, _)| folder))
            .filter(|folder| folder.starts_with("20"))
            .collect();
        let dir = TempDir::new().unwrap();
        export_specs(commit, dir.path());
        for folder in folders {
            let path = dir.path().join("specs").join(folder);
            if !path.is_dir() {
                continue;
            }
            snapshots += 1;
            let found = check::check_files(dir.path(), &path).unwrap();
            with_errors += usize::from(found.iter().any(|p| p.severity == Severity::Error));
            let blocking: Vec<_> = found.iter().filter(|p| p.blocks()).collect();
            blocked += usize::from(!blocking.is_empty());
            for problem in blocking {
                assert!(
                    broken_or_unanswered(&problem.rule),
                    "{commit} {folder}: {problem:?}"
                );
            }
            for problem in found.iter().filter(|p| drift(&p.rule)) {
                assert!(!problem.blocks(), "{commit} {folder}: {problem:?}");
            }
        }
    }
    println!("{snapshots} snapshots, {with_errors} with errors, {blocked} with a blocking result");
    assert!(snapshots > 0, "no branch has a commit in the window");
}

/// SC-004: 25 of the 30 records of `specs/done/` show timed stages. Prints the slowest read too,
/// for SC-002 on an old feature: measured, not asserted, as this repository's history grows.
#[test]
#[ignore = "this repository's history"]
fn sc004_past_features_show_timed_stages() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let mut folders: Vec<String> = std::fs::read_dir(root.join("specs/done"))
        .unwrap()
        .filter_map(|entry| {
            let name = entry.ok()?.file_name().into_string().ok()?;
            name.strip_suffix(".md").map(String::from)
        })
        .collect();
    folders.sort();

    let mut timed = 0;
    let mut without = Vec::new();
    let mut slowest = (Duration::ZERO, "");
    for folder in &folders {
        let start = Instant::now();
        let history = api::read_history(&root, folder).unwrap();
        slowest = slowest.max((start.elapsed(), folder.as_str()));
        let started = history
            .stages
            .iter()
            .filter(|stage| stage.started.is_some());
        if started.count() >= 2 {
            timed += 1;
        } else {
            without.push(folder.as_str());
        }
    }

    println!("{timed} of {} records show timed stages", folders.len());
    println!("Without: {}", without.join(", "));
    println!("Slowest read: {} in {:?}", slowest.1, slowest.0);
    assert!(
        timed >= 25,
        "{timed} records with timed stages; without: {without:?}"
    );
}

/// US2 on this repository's rebased features: the lines, files, and decisions of each record read
/// over every run of its commits on `main`, its review fixes included, with the time of each read.
/// Printed, for the pull request: `2026-10-17-redesign-specs` holds about +13,263 −4,053 over 208
/// files and 18 decisions.
#[test]
#[ignore = "this repository's history"]
fn rebased_features_count_every_run() {
    let root = root();
    for folder in [
        "2026-10-17-redesign-specs",
        "2026-10-16-redesign-interface",
        "2026-10-17-redesign-clarifications",
    ] {
        let start = Instant::now();
        let history = api::read_history(&root, folder).unwrap();
        let elapsed = start.elapsed();
        let lines = history.lines.as_ref().unwrap();
        println!(
            "{folder}: +{} −{} over {} files, {} decisions, merged {:?}, in {elapsed:?}",
            lines.added,
            lines.removed,
            lines.files,
            history.decisions.len(),
            history
                .stages
                .last()
                .and_then(|stage| stage.started.as_deref()),
        );
        assert!(history.found, "{folder}");
    }
}
