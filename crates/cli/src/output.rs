//! Printing: JSON with its version, styles that follow the terminal and `NO_COLOR`, and errors.

use std::io::IsTerminal;
use std::process::ExitCode;

use serde::Serialize;
use uraeda_core::actions::Change;
use uraeda_core::actions::place::Place;
use uraeda_core::git::{Git, GitError};
use uraeda_core::target::{self, Purpose, Target};
use uraeda_core::workspace::Workspace;

/// The version of every command's JSON, increased only for incompatible changes.
pub const JSON_VERSION: u32 = 1;

#[derive(Serialize)]
struct Versioned<'a, T: Serialize> {
    version: u32,
    #[serde(flatten)]
    inner: &'a T,
}

/// Prints a value as JSON, with the top-level `"version"`.
pub fn print_json(value: &impl Serialize) {
    let versioned = Versioned {
        version: JSON_VERSION,
        inner: value,
    };
    println!(
        "{}",
        serde_json::to_string_pretty(&versioned).expect("serializable")
    );
}

#[derive(Clone, Copy)]
pub enum Style {
    Bold,
    Dim,
}

fn colours() -> bool {
    std::io::stdout().is_terminal()
        && std::env::var_os("NO_COLOR").is_none_or(|value| value.is_empty())
        && std::env::var("TERM").map_or(true, |term| term != "dumb")
}

/// Text in a style, when stdout is a terminal that wants colours.
pub fn style(style: Style, text: &str) -> String {
    if !colours() {
        return text.to_string();
    }
    let code = match style {
        Style::Bold => "1",
        Style::Dim => "2",
    };
    format!("\x1b[{code}m{text}\x1b[0m")
}

/// Prints `ura: <message>` on stderr, and exits with 1.
pub fn fail(message: &str) -> ExitCode {
    eprintln!("ura: {message}");
    ExitCode::FAILURE
}

/// The repository of the current folder, and its workspace.
pub fn workspace() -> Result<(Git, Workspace), String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let git = Git::discover(&cwd).map_err(|error| error.to_string())?;
    let workspace = Workspace::read(&git).map_err(|error| error.to_string())?;
    Ok((git, workspace))
}

/// Resolves a command's target in the workspace, from the current folder.
pub fn target(
    workspace: &Workspace,
    target: Option<&str>,
    purpose: Purpose,
) -> Result<Target, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    target::resolve(workspace, &cwd, target, purpose).map_err(|error| error.to_string())
}

/// Says where an action wrote, when it is not this working tree: the worktree created or found
/// for its branch, from the main checkout, or the branch this one was switched to.
pub fn say_place(git: &Git, place: &Place) {
    if let Some(branch) = &place.switched {
        println!("switched to {branch}");
    } else if place.root != git.root() {
        let main = git.main_root();
        let shown = place.root.strip_prefix(&main).unwrap_or(&place.root);
        println!("wrote in {}", shown.display());
    }
}

/// Commits an action's files in the working tree it wrote in. A failing hook leaves them written.
pub fn commit(place: &Place, change: &Change) -> Result<(), String> {
    let git = Git::open(&place.root).map_err(|error| error.to_string())?;
    match git.commit(&change.paths, &change.subject, change.body.as_deref()) {
        Ok(()) => Ok(()),
        Err(error @ GitError::Command { .. }) if error.to_string().starts_with("git commit") => {
            eprintln!("ura: {error}");
            Err("commit failed: fix the hook's error, then commit".to_string())
        }
        Err(error) => Err(error.to_string()),
    }
}
