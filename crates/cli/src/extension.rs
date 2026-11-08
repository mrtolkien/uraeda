//! `ura extension`: adds, updates, removes, and lists your extensions, the folders in
//! `extensions/` in the config folder. It never runs an extension's code: the server does, from
//! the folder `ura` leaves.

mod add;
mod list;
mod remove;
mod update;
mod r#where;

use std::path::PathBuf;
use std::process::ExitCode;

use clap::Subcommand;
use uraeda_core::extensions;
use uraeda_core::repositories::default_data_dir;
use uraeda_core::settings::default_config_dir;

#[derive(clap::Args)]
pub struct Args {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Add an extension: link a folder, or clone a git repository pinned to its default branch's
    /// commit, then say where it is on
    Add(add::Flags),
    /// Fetch an installed extension's branch, print the diff, and move to it once confirmed
    Update {
        /// The extension's name
        name: String,
        /// Move without asking
        #[arg(long)]
        yes: bool,
    },
    /// Remove an extension's folder, or only the link to it; its settings stay
    Remove {
        /// The extension's name
        name: String,
    },
    /// List the extensions, built-in ones first: where each is on, and where it came from
    List {
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
}

pub fn run(args: Args) -> Result<ExitCode, String> {
    let folders = Folders {
        config: default_config_dir(),
        data: default_data_dir(),
    };
    match args.command {
        Command::Add(flags) => add::run(&folders, &flags),
        Command::Update { name, yes } => update::run(&folders, &name, yes),
        Command::Remove { name } => remove::run(&folders, &name),
        Command::List { json } => list::run(&folders, json),
    }
}

/// Uraeda's config folder, which holds the extensions and their settings, and its data folder,
/// which holds the list of repositories.
pub struct Folders {
    pub config: PathBuf,
    pub data: PathBuf,
}

/// The title of the extension `name`, or its name when there is none.
fn title(folders: &Folders, name: &str) -> String {
    extensions::read(&folders.config)
        .extensions
        .into_iter()
        .find(|extension| extension.name == name)
        .map_or_else(|| name.to_owned(), |extension| extension.title)
}

/// A commit, short, as git shows it.
fn short(commit: &str) -> &str {
    commit.get(..7).unwrap_or(commit)
}
