//! Two rules of the repository itself that a linter does not check: the skill names every command
//! the CLI has (the CLI decision), and a Rust file stays under 500 lines (the code quality
//! decision's "limit no linter has").

use std::fs;
use std::path::{Path, PathBuf};

use crate::common::*;

/// The most lines a Rust source file may have, tests excluded.
const LIMIT: usize = 500;

/// The files over the limit when the code quality decision was approved, with their length then.
/// A listed file may only shrink, and leaves the list once it is at or under the limit.
const LARGE: &[(&str, usize)] = &[
    ("crates/core/src/files/document.rs", 686),
    ("crates/core/src/workspace.rs", 742),
];

/// A file's length without its tests: its lines before the `#[cfg(test)]` line of its first test
/// module, or all of them when it has none.
fn measure(text: &str) -> usize {
    let lines: Vec<&str> = text.lines().map(str::trim_start).collect();
    (0..lines.len())
        .find(|&start| {
            lines[start].starts_with("#[cfg(test)]")
                && lines[start + 1..]
                    .iter()
                    .find(|line| !line.is_empty())
                    .is_some_and(|line| line.starts_with("mod ") || line.starts_with("pub mod "))
        })
        .unwrap_or(lines.len())
}

fn rust_files(dir: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            rust_files(&path, files);
        } else if path.extension().is_some_and(|extension| extension == "rs") {
            files.push(path);
        }
    }
}

#[test]
fn rust_source_files_stay_under_500_lines_unless_listed_and_only_shrink() {
    let root = repository();
    let mut files = Vec::new();
    for entry in fs::read_dir(root.join("crates")).unwrap() {
        let source = entry.unwrap().path().join("src");
        if source.is_dir() {
            rust_files(&source, &mut files);
        }
    }
    assert!(
        !files.is_empty(),
        "no Rust source file found under crates/*/src"
    );

    let mut problems = Vec::new();
    for path in &files {
        let name = path
            .strip_prefix(&root)
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");
        let lines = measure(&fs::read_to_string(path).unwrap());
        match LARGE.iter().find(|(listed, _)| *listed == name) {
            None if lines > LIMIT => problems.push(format!(
                "{name} has {lines} lines, over the {LIMIT} of the code quality decision: split it by responsibility, into modules of its folder."
            )),
            Some(_) if lines <= LIMIT => problems.push(format!("{name} has {lines} lines: remove it from LARGE in tests/flows/repo_rules.rs.")),
            Some((_, listed)) if lines > *listed => problems.push(format!(
                "{name} grew from {listed} to {lines} lines: it is over the {LIMIT} of the code quality decision, so it may only shrink. Restructure it first, in a commit of its own."
            )),
            _ => {}
        }
    }
    for (listed, _) in LARGE {
        if !root.join(listed).is_file() {
            problems.push(format!(
                "{listed} no longer exists: remove it from LARGE in tests/flows/repo_rules.rs."
            ));
        }
    }
    assert!(problems.is_empty(), "{}", problems.join("\n"));
}

#[test]
fn every_command_of_the_cli_is_named_in_the_skill() {
    let skill = repository().join("skills/uraeda");
    let mut text = fs::read_to_string(skill.join("SKILL.md")).unwrap();
    for entry in fs::read_dir(skill.join("references")).unwrap() {
        text.push_str(&fs::read_to_string(entry.unwrap().path()).unwrap());
    }
    let help = ura_in(&repository(), &["--help"], &[]);
    let commands: Vec<String> = help
        .stdout
        .split("Commands:")
        .nth(1)
        .unwrap()
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .filter(|name| *name != "help")
        .take_while(|name| !name.ends_with(':'))
        .map(String::from)
        .collect();

    assert!(!commands.is_empty(), "the commands were read from --help");
    for command in commands {
        assert!(
            text.contains(&format!("`ura {command}")),
            "ura {command} is not in the skill"
        );
    }
}
