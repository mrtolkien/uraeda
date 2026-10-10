//! `ura`, Uraeda's command-line tool.

mod temporary_status;

use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "ura", version, about = "Uraeda's command-line tool")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Show the status of each workflow file in a feature folder (temporary)
    Status {
        /// The feature folder, like specs/2026-10-10-stack-decision
        folder: PathBuf,
    },
}

fn main() -> ExitCode {
    match Cli::parse().command {
        Command::Status { folder } => temporary_status::temporary_status(&folder),
    }
}
