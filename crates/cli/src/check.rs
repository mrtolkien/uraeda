//! `ura check`: every workflow file against the skill's rules.

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use serde::Serialize;
use uraeda_core::check;
use uraeda_core::git::Git;
use uraeda_core::workspace::Problem;

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
        Some(target) => cwd.join(target),
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
        for problem in &problems {
            match problem.line {
                Some(line) => println!("{}:{line}: {}", problem.file, problem.message),
                None => println!("{}: {}", problem.file, problem.message),
            }
        }
        let plural = if problems.len() == 1 { "" } else { "s" };
        println!("{} problem{plural}", problems.len());
    }
    Ok(if problems.is_empty() {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    })
}
