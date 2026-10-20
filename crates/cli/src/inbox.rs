//! `ura inbox`: what is done to the inbox and to the images its notes hold, on the default branch.

use std::process::ExitCode;

use clap::Subcommand;
use uraeda_core::api;

use crate::output;

#[derive(Subcommand)]
pub enum Command {
    /// Delete the images of drafts and of the backlog that no file of their folder links
    Clean {
        /// Print what would be deleted, and delete nothing
        #[arg(long)]
        dry_run: bool,
    },
}

pub fn run(command: Command) -> Result<ExitCode, String> {
    match command {
        Command::Clean { dry_run } => clean(dry_run),
    }
}

/// Lists the unlinked images, one path a line, and deletes them unless `dry_run`: the deletion is
/// left for the human to commit.
fn clean(dry_run: bool) -> Result<ExitCode, String> {
    let (git, _) = output::workspace()?;
    let found = api::clean_images(git.root(), dry_run).map_err(|error| error.message)?;
    for path in &found {
        println!("{path}");
    }
    eprintln!(
        "{}",
        match (found.len(), dry_run) {
            (0, _) => "no unlinked images".to_string(),
            (1, true) => "1 unlinked image: run again without --dry-run to delete it".to_string(),
            (count, true) => {
                format!("{count} unlinked images: run again without --dry-run to delete them")
            }
            (1, false) => "removed 1 unlinked image".to_string(),
            (count, false) => format!("removed {count} unlinked images"),
        }
    );
    Ok(ExitCode::SUCCESS)
}
