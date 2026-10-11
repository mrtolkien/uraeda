//! `ura`, Uraeda's command-line tool.

mod answer;
mod check;
mod next;
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
    /// Answer a round of questions, one question at a time, then submit it
    Answer {
        /// [target] <question> <answer>: the feature (optional), the question (Q2, Q2.B, or
        /// notes), and the answer
        arguments: Vec<String>,
        /// Submit the round: set it answered, record its block, and commit
        #[arg(long)]
        submit: bool,
        /// Leave the files for you to commit
        #[arg(long)]
        no_commit: bool,
    },
    /// Check workflow files against the skill's rules
    Check {
        /// A specs/ folder, a folder under it, or a file; specs/ by default
        target: Option<String>,
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
    /// Tell an agent the next step: of a feature or bug, or of the first one in Now with work
    Next {
        /// A feature or bug: a path under specs/, a folder name, or a slug
        target: Option<String>,
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
}

fn main() -> ExitCode {
    let result = match Cli::parse().command {
        Command::Status { json } => status::run(json),
        Command::Next { target, json } => next::run(target, json),
        Command::Check { target, json } => check::run(target, json),
        Command::Answer {
            arguments,
            submit,
            no_commit,
        } => answer::run(arguments, submit, no_commit),
    };
    result.unwrap_or_else(|message| output::fail(&message))
}
