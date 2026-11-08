//! `ura extension add`: links a folder or clones a git repository into the extensions folder,
//! then turns it on where the flags or the picker say: in those repositories too, for an extension
//! already there.

use std::process::ExitCode;

use uraeda_core::extensions::{add_on, install};

use super::Folders;
use super::r#where::{self, Flags as Where};
use crate::install::Choice;
use crate::terminal;

#[derive(clap::Args)]
pub struct Flags {
    /// A folder to link, a git URL to clone and pin, or an installed extension's name
    #[arg(value_hint = clap::ValueHint::AnyPath)]
    source: String,
    /// On in every repository
    #[arg(long, conflicts_with_all = ["here", "repo"])]
    all: bool,
    /// On in this repository, as Uraeda's list names it
    #[arg(long)]
    here: bool,
    /// On in this repository of Uraeda's list; repeat it for more
    #[arg(long, value_name = "NAME")]
    repo: Vec<String>,
    /// Never ask: without --all, --here, or --repo, fail and name them
    #[arg(long)]
    no_input: bool,
}

pub fn run(folders: &Folders, flags: &Flags) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let here = r#where::here(&folders.data, &cwd);
    let given = Where {
        all: flags.all,
        here: flags.here,
        repo: &flags.repo,
    };
    // Answered before anything is cloned: a question no one can answer fails first.
    let choice = r#where::resolve(
        &given,
        terminal::interactive(flags.no_input),
        here.as_deref(),
        &r#where::listed(&folders.data),
    )?;
    let extension =
        install::add(&folders.config, &flags.source, &cwd).map_err(|error| error.message)?;
    let on = match choice {
        Choice::Given(on) | Choice::Implied(on) => on,
        Choice::Ask => r#where::ask(&extension.title, &extension.scope, here.as_deref())?
            .ok_or_else(|| format!("cancelled: where {} is on did not change", extension.title))?,
    };
    // An extension already there is on in these repositories too.
    let on = add_on(&folders.config, &folders.data, &extension.name, on)
        .map_err(|error| error.message)?;
    println!("Turned {} on for: {}", extension.title, r#where::words(&on));
    Ok(ExitCode::SUCCESS)
}
