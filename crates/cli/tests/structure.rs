//! The Rust file length limit of the code quality decision, which no clippy lint checks.

use std::fs;
use std::path::{Path, PathBuf};

/// The most lines a Rust source file may have, tests excluded.
const LIMIT: usize = 500;

/// The files over the limit when the code quality decision was approved, with their length then.
/// A listed file may only shrink, and leaves the list once it is at or under the limit.
const LARGE: &[(&str, usize)] = &[
    ("crates/core/src/api.rs", 633),
    ("crates/core/src/files/document.rs", 686),
    ("crates/core/src/git.rs", 511),
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

/// The `.rs` files under `dir`, at any depth.
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

/// What breaks the limit, for a file at `name` measuring `lines`, with `large` the files over it
/// when the decision was approved.
fn problem(large: &[(&str, usize)], name: &str, lines: usize) -> Option<String> {
    match large.iter().find(|(listed, _)| *listed == name) {
        None if lines > LIMIT => Some(format!(
            "{name} has {lines} lines, over the {LIMIT} of the code quality decision: split it by \
             responsibility, into modules of its folder."
        )),
        Some(_) if lines <= LIMIT => Some(format!(
            "{name} has {lines} lines: remove it from LARGE in tests/structure.rs."
        )),
        Some((_, listed)) if lines > *listed => Some(format!(
            "{name} grew from {listed} to {lines} lines: it is over the {LIMIT} of the code \
             quality decision, so it may only shrink. Restructure it first, in a commit of its own."
        )),
        _ => None,
    }
}

#[test]
fn rust_source_files_stay_under_500_lines() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let mut files = Vec::new();
    for entry in fs::read_dir(root.join("crates")).unwrap() {
        let source = entry.unwrap().path().join("src");
        if source.is_dir() {
            rust_files(&source, &mut files);
        }
    }
    files.sort();
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
        problems.extend(problem(LARGE, &name, lines));
    }
    for (listed, _) in LARGE {
        if !root.join(listed).is_file() {
            problems.push(format!(
                "{listed} no longer exists: remove it from LARGE in tests/structure.rs."
            ));
        }
    }
    assert!(problems.is_empty(), "{}", problems.join("\n"));
}

#[test]
fn a_problem_names_what_breaks_the_limit() {
    let large = [("src/large.rs", 600)];
    let rows: [(&str, usize, Option<&str>); 6] = [
        ("src/new.rs", 500, None),
        ("src/new.rs", 501, Some("split it by responsibility")),
        ("src/large.rs", 601, Some("grew from 600 to 601 lines")),
        ("src/large.rs", 600, None),
        ("src/large.rs", 550, None),
        ("src/large.rs", 500, Some("remove it from LARGE")),
    ];
    for (name, lines, expected) in rows {
        let found = problem(&large, name, lines);
        match expected {
            None => assert_eq!(found, None, "{name} at {lines} lines"),
            Some(text) => assert!(
                found.as_deref().is_some_and(|found| found.contains(text)),
                "{name} at {lines} lines: expected {text:?}, found {found:?}"
            ),
        }
    }
}

#[test]
fn the_measure_skips_test_modules() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("long.rs");
    let mut text = "fn line() {}\n".repeat(10);
    text.push_str("#[cfg(test)]\nmod tests {\n");
    text.push_str(&"fn test_line() {}\n".repeat(600));
    text.push_str("}\n");
    fs::write(&path, text).unwrap();

    assert_eq!(measure(&fs::read_to_string(&path).unwrap()), 10);
}

/// Only a test module ends the measure: an earlier `#[cfg(test)]` item does not exempt the code
/// after it.
#[test]
fn an_early_test_item_does_not_end_the_measure() {
    let mut text = "#[cfg(test)]\nuse std::fs;\n".to_owned();
    text.push_str(&"fn line() {}\n".repeat(600));
    text.push_str("#[cfg(test)]\n\nmod tests {}\n");

    assert_eq!(measure(&text), 602);
}
