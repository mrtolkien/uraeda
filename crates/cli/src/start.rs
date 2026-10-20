//! `ura start`: a drafted feature or change, started as the skill says.

use std::process::ExitCode;

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
    let draft = match target::resolve(&workspace, &cwd, target_name.as_deref(), Purpose::Start) {
        Ok(Target::Draft(draft)) => draft,
        Ok(_) | Err(TargetError::NoPath(_)) => {
            return Err(
                "not a draft: ura start takes a file or folder in specs/drafts/ or specs/backlog/"
                    .into(),
            );
        }
        Err(error) => return Err(error.to_string()),
    };
    let kind = if change { Kind::Change } else { Kind::Feature };
    match start::run(
        &git,
        &workspace,
        &draft,
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
        Err(StartError::Partial { done, left, cause }) => {
            eprintln!("ura: {cause}");
            if !done.is_empty() {
                eprintln!("Done: {}.", done.join(", "));
            }
            eprintln!("Left: {}.", left.join(", then "));
            Ok(ExitCode::FAILURE)
        }
        Err(error) => Err(error.to_string()),
    }
}
