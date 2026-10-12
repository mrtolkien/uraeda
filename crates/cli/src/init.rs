//! `ura init`: the `specs/` folder in the repository's top level, and an offer of the skill for
//! the user when no Uraeda skill is found.

use std::process::ExitCode;

use uraeda_core::actions::init::{self, InitLine};
use uraeda_core::actions::install;
use uraeda_core::git::Git;

use crate::terminal;

pub fn run(no_input: bool) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let git = Git::discover(&cwd).map_err(|error| error.to_string())?;
    let lines = init::run(git.root()).map_err(|error| error.to_string())?;
    let mut constitution = false;
    for line in &lines {
        match line {
            InitLine::Created(path) => {
                constitution |= path == "specs/CONSTITUTION.md";
                println!("created {path}");
            }
            InitLine::Kept(path) => println!("kept    {path}"),
        }
    }
    let home = crate::install::home();
    let in_home = home
        .as_deref()
        .is_some_and(|home| !install::existing(home).is_empty());
    if !in_home && install::existing(git.root()).is_empty() {
        offer(terminal::interactive(no_input))?;
    }
    if constitution {
        println!("Next: ask your agent to write specs/CONSTITUTION.md with you, then commit.");
    }
    Ok(ExitCode::SUCCESS)
}

/// Offers the skill for the user, with no Uraeda skill found: asks in a terminal, and names
/// `ura install` without one, or without a home folder to install in.
pub fn offer(interactive: bool) -> Result<(), String> {
    if interactive && crate::install::home().is_some() {
        unimplemented!("pickers: task 4")
    }
    println!("No Uraeda skill found: install it with ura install --user --agents --claude.");
    Ok(())
}
