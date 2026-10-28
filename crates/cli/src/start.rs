//! `ura start`: a proposed feature or change, started as the skill says, and, with `--feature`, a
//! started change made a feature, in place.

use std::process::ExitCode;

use uraeda_core::actions::promote;
use uraeda_core::actions::start::{self, StartError};
use uraeda_core::target::{self, Purpose, Target, TargetError};
use uraeda_core::today;
use uraeda_core::workspace::Kind;

use crate::output;

pub fn run(
    target_name: Option<String>,
    slug: Option<String>,
    change: bool,
    switch: bool,
) -> Result<ExitCode, String> {
    let (git, workspace) = output::workspace()?;
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let proposal = match target::resolve(&workspace, &cwd, target_name.as_deref(), Purpose::Start) {
        Ok(Target::Proposal(proposal)) => proposal,
        Ok(_) | Err(TargetError::NoPath(_)) => {
            return Err(
                "not a proposal: ura start takes a file or folder in specs/proposals/".into(),
            );
        }
        Err(error) => return Err(error.to_string()),
    };
    let kind = if change { Kind::Change } else { Kind::Feature };
    match start::run(
        &git,
        &workspace,
        &proposal,
        slug.as_deref(),
        kind,
        today::today(),
        switch,
    ) {
        Ok(started) => {
            for (from, to) in &started.moves {
                println!("moved   {from} -> {to}");
            }
            println!(
                "on {}: committed \"{}\"",
                started.default_branch, started.start_subject
            );
            match &started.worktree {
                Some(worktree) => println!("created branch {} in {worktree}", started.branch),
                None => println!("created branch {}", started.branch),
            }
            let next = match kind {
                Kind::Feature => "discovery",
                Kind::Change => "change",
            };
            println!("Next: {next}. Ask an agent, or run ura next.");
            Ok(ExitCode::SUCCESS)
        }
        Err(error) => failed(error),
    }
}

/// A refusal, or a failure after the first commit, which says what was done and what is left.
fn failed(error: StartError) -> Result<ExitCode, String> {
    match error {
        StartError::Partial { done, left, cause } => {
            eprintln!("ura: {cause}");
            if !done.is_empty() {
                eprintln!("Done: {}.", done.join(", "));
            }
            eprintln!("Left: {}.", left.join(", then "));
            Ok(ExitCode::FAILURE)
        }
        error => Err(error.to_string()),
    }
}

/// `ura start <change> --feature`: makes a started change a feature, in place, its open pull
/// requests asked of `gh` first: one refuses the move.
pub fn promote(target_name: Option<String>) -> Result<ExitCode, String> {
    let (git, workspace) = output::workspace_with_pull_requests()?;
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let name = target_name.as_deref();
    let folder = match target::resolve(&workspace, &cwd, name, Purpose::Inspect) {
        Ok(Target::Feature(index)) => workspace.features[index].folder.clone(),
        resolved => {
            if let Ok(Target::Proposal(_)) = target::resolve(&workspace, &cwd, name, Purpose::Start)
            {
                return Err(
                    "--feature takes a change: start a proposal as a feature without it".into(),
                );
            }
            return Err(match resolved {
                Err(error) => error.to_string(),
                Ok(_) => "--feature takes a change: name its folder".into(),
            });
        }
    };
    match promote::run(&git, &workspace, &folder) {
        Ok(promoted) => {
            println!(
                "Started {} as a feature, on {}.",
                promoted.folder, promoted.branch
            );
            if !promoted.decisions.is_empty() {
                println!(
                    "Proposed again: {}.",
                    uraeda_core::actions::list(&promoted.decisions)
                );
            }
            Ok(ExitCode::SUCCESS)
        }
        Err(error) => failed(error),
    }
}
