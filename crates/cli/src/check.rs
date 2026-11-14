//! `ura check`: every workflow file against the skill's rules.

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use serde::Serialize;
use uraeda_core::check;
use uraeda_core::git::Git;
use uraeda_core::target::{Purpose, Target};
use uraeda_core::workspace::{Problem, Severity};

use crate::output;

#[derive(Serialize)]
struct Problems<'a> {
    /// The files `--fix` rewrote, only with `--fix`.
    #[serde(skip_serializing_if = "Option::is_none")]
    fixed: Option<&'a [check::Fixed]>,
    problems: &'a [Problem],
}

/// The top level of the repository holding `cwd`, or `cwd` outside one.
fn root(cwd: &Path) -> PathBuf {
    Git::discover(cwd).map_or_else(|_| cwd.to_path_buf(), |git| git.root().to_path_buf())
}

/// Checks `target`, after relinking the links to moved files under it with `fix`: exits as the
/// check.
pub fn run(target: Option<String>, json: bool, fix: bool) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let root = root(&cwd);
    let target_path = target_path(&cwd, &root, target.as_deref())?;
    let missing = || {
        let shown = target.clone().unwrap_or_else(|| "specs".to_string());
        format!("{shown}: no such file or folder")
    };
    let fixed = if fix {
        Some(
            check::fix(&root, &target_path).map_err(|error| match error {
                check::CheckError::Missing(_) => missing(),
                error => error.to_string(),
            })?,
        )
    } else {
        None
    };
    let problems = check::check(&root, &target_path).map_err(|_| missing())?;
    if json {
        output::print_json(&Problems {
            fixed: fixed.as_deref(),
            problems: &problems,
        });
        return Ok(exit(&problems));
    }
    for file in fixed.iter().flatten() {
        let noun = if file.links == 1 { "link" } else { "links" };
        println!("fixed {}: {} {noun}", file.file, file.links);
    }
    if problems.is_empty() {
        let canonical = target_path.canonicalize().unwrap_or(target_path.clone());
        let mut shown = canonical
            .strip_prefix(root.canonicalize().unwrap_or(root.clone()))
            .unwrap_or(&canonical)
            .to_string_lossy()
            .into_owned();
        if canonical.is_dir() {
            shown.push('/');
        }
        println!("{shown}: no problems");
    } else {
        print_problems(&problems);
    }
    Ok(exit(&problems))
}

/// Failure when a problem is an error, else success.
fn exit(problems: &[Problem]) -> ExitCode {
    if problems
        .iter()
        .any(|problem| problem.severity == Severity::Error)
    {
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    }
}

/// The path `ura check` reads: `target` under `cwd`, a feature's by name, or the
/// repository's `specs/`.
fn target_path(cwd: &Path, root: &Path, target: Option<&str>) -> Result<PathBuf, String> {
    Ok(match target {
        Some(name) if !cwd.join(name).exists() && !name.contains('/') => {
            let (_, workspace) = output::workspace()?;
            match output::target(&workspace, Some(name), Purpose::Inspect)? {
                Target::Feature(index) => root.join(workspace.features[index].checked_path()),
                Target::File(index, file) => root.join(&workspace.features[index].path).join(file),
            }
        }
        Some(target) => cwd.join(target),
        None if !root.join("specs").is_dir() => {
            return Err(format!(
                "no specs/ folder at {}: run ura init",
                root.display()
            ));
        }
        None => root.join("specs"),
    })
}

/// The errors, then the warnings, each `warning: ` first, then their counts.
fn print_problems(problems: &[Problem]) {
    let (errors, warnings): (Vec<&Problem>, Vec<&Problem>) = problems
        .iter()
        .partition(|problem| problem.severity == Severity::Error);
    for (problem, prefix) in errors
        .iter()
        .map(|problem| (problem, ""))
        .chain(warnings.iter().map(|problem| (problem, "warning: ")))
    {
        match problem.line {
            Some(line) => println!("{prefix}{}:{line}: {}", problem.file, problem.message),
            None => println!("{prefix}{}: {}", problem.file, problem.message),
        }
    }
    let count = |n: usize, noun: &str| format!("{n} {noun}{}", if n == 1 { "" } else { "s" });
    let counts: Vec<String> = [(errors.len(), "problem"), (warnings.len(), "warning")]
        .into_iter()
        .filter(|(n, _)| *n > 0)
        .map(|(n, noun)| count(n, noun))
        .collect();
    println!("{}", counts.join(", "));
}
