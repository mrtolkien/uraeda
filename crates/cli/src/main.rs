//! `ura`, Uraeda's command-line tool.

mod output;
mod status;

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
    /// Show where every feature and bug stands, across branches
    Status {
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
}

fn main() -> ExitCode {
    let result = match Cli::parse().command {
        Command::Status { json } => status::run(json),
    };
    result.unwrap_or_else(|message| output::fail(&message))
}
