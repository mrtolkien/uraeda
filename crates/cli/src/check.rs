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
    problems: &'a [Problem],
}

/// The top level of the repository holding `cwd`, or `cwd` outside one.
fn root(cwd: &Path) -> PathBuf {
    Git::discover(cwd).map_or_else(|_| cwd.to_path_buf(), |git| git.root().to_path_buf())
}

pub fn run(target: Option<String>, json: bool) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let root = root(&cwd);
    let target_path = match &target {
        Some(name) if !cwd.join(name).exists() && !name.contains('/') => {
            let (_, workspace) = output::workspace()?;
            match output::target(&workspace, Some(name), Purpose::Inspect)? {
                Target::Feature(index) => root.join(workspace.features[index].checked_path()),
                Target::File(index, file) => root.join(&workspace.features[index].path).join(file),
                Target::Draft(draft) => root.join(draft),
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
    };
    let problems = check::check(&root, &target_path).map_err(|_| {
        let shown = target.clone().unwrap_or_else(|| "specs".to_string());
        format!("{shown}: no such file or folder")
    })?;
    if json {
        output::print_json(&Problems {
            problems: &problems,
        });
    } else if problems.is_empty() {
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
    Ok(
        if problems
            .iter()
            .any(|problem| problem.severity == Severity::Error)
        {
            ExitCode::FAILURE
        } else {
            ExitCode::SUCCESS
        },
    )
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
