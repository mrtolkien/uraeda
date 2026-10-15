//! `ura note`: a note added to `specs/INBOX.md` on the default branch, and committed alone.

use std::process::ExitCode;

use uraeda_core::actions::inbox::{self, Marks, Noted};
use uraeda_core::actions::place;
use uraeda_core::git::{Git, GitError};
use uraeda_core::target::{self, Purpose, Target, TargetError};
use uraeda_core::workspace::{Workspace, WorkspaceError, branch_folder, folder_slug};

use crate::output;

const NO_SPECS: &str = "No specs/ folder here.";

pub struct Options {
    pub text: String,
    pub category: Option<String>,
    pub about: Option<String>,
    pub agent: bool,
    pub no_commit: bool,
}

pub fn run(options: Options) -> Result<ExitCode, String> {
    let (git, workspace) = workspace()?;
    let marks = Marks {
        agent: options.agent,
        about: about(&workspace, options.about.as_deref())?,
    };
    inbox::checked_note(&marks, &options.text).map_err(|error| error.to_string())?;
    let default = workspace
        .default_branch
        .clone()
        .ok_or("no default branch: commit on main first")?;
    let place = place::reach(&git, &default).map_err(|error| error.to_string())?;
    let noted = inbox::note(
        &place,
        options.category.as_deref(),
        &marks,
        &options.text,
        !options.no_commit,
    )
    .map_err(output::action_error)?;
    if let Some(message) = output::place_message(&git, &place) {
        eprintln!("{message}");
    }
    eprintln!(
        "{}",
        match noted {
            Noted::Committed(_) => "added to the inbox",
            Noted::Written => "added to the inbox, not committed",
            Noted::Uncommitted => {
                "INBOX.md had uncommitted changes: the note is written but not committed."
            }
        }
    );
    Ok(ExitCode::SUCCESS)
}

/// The repository and its workspace, or "No specs/ folder here." outside a repository with one.
fn workspace() -> Result<(Git, Workspace), String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let git = Git::discover(&cwd).map_err(|error| match error {
        GitError::NotARepository(_) => NO_SPECS.to_string(),
        error => error.to_string(),
    })?;
    let workspace = Workspace::read(&git).map_err(|error| match error {
        WorkspaceError::NoSpecs(_) => NO_SPECS.to_string(),
        error => error.to_string(),
    })?;
    Ok((git, workspace))
}

/// The slug the note is about: the feature or change `--about` names, or the one of this checkout's
/// branch, or none. Drafts are no target here: `Purpose::Inspect` resolves features and changes
/// only.
fn about(workspace: &Workspace, about: Option<&str>) -> Result<Option<String>, String> {
    let Some(about) = about else {
        return Ok(workspace
            .current_branch
            .as_deref()
            .and_then(branch_folder)
            .and_then(|(_, folder)| folder_slug(folder))
            .map(String::from));
    };
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    match target::resolve(workspace, &cwd, Some(about), Purpose::Inspect) {
        Ok(Target::Feature(index) | Target::File(index, _)) => {
            Ok(Some(workspace.features[index].slug.clone()))
        }
        Ok(Target::Draft(_)) | Err(TargetError::NotFound(_) | TargetError::NoPath(_)) => Err(
            format!("--about names a feature or a change: none is named {about}"),
        ),
        Err(error) => Err(error.to_string()),
    }
}
