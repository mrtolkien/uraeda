//! `ura start`: a drafted feature, started as the skill says.

use std::process::ExitCode;

use uraeda_core::actions::start::{self, StartError};
use uraeda_core::target::{self, Purpose, Target, TargetError};
use uraeda_core::today;

use crate::output;

/// Whether a target is a bug's report or folder, which has no start yet.
fn is_bug(cwd: &std::path::Path, root: &std::path::Path, target: &str) -> bool {
    let joined = cwd.join(target);
    let mut parts = std::path::PathBuf::new();
    for component in joined.components() {
        match component {
            std::path::Component::ParentDir => {
                parts.pop();
            }
            std::path::Component::CurDir => {}
            other => parts.push(other),
        }
    }
    let root = root.canonicalize().unwrap_or(root.to_path_buf());
    parts
        .strip_prefix(&root)
        .is_ok_and(|relative| relative.starts_with("specs/bugs"))
}

pub fn run(
    target_name: Option<String>,
    slug: Option<String>,
    switch: bool,
) -> Result<ExitCode, String> {
    let (git, workspace) = output::workspace()?;
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    if let Some(name) = &target_name
        && is_bug(&cwd, git.root(), name)
    {
        unimplemented!("starting a bug, until the bug flow has its spec");
    }
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
    match start::run(
        &git,
        &workspace,
        &draft,
        slug.as_deref(),
        today::today(),
        switch,
    ) {
        Ok(started) => {
            println!(
                "on {}: committed \"{}\"",
                started.default_branch, started.start_subject
            );
            match &started.worktree {
                Some(worktree) => println!("created branch {} in {worktree}", started.branch),
                None => println!("created branch {}", started.branch),
            }
            for (from, to) in &started.moves {
                println!("moved   {from} -> {to}");
            }
            println!("committed \"{}\"", started.proposal_subject);
            println!("Next: discovery. Ask an agent, or run ura next.");
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
