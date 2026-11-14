//! `ura`, Uraeda's command-line tool.

mod answer;
mod check;
mod complete;
mod init;
mod install;
mod next;
mod output;
mod picker;
mod review;
mod sandbox;
mod serve;
mod shell;
mod status;
mod terminal;
mod upgrade;
mod vault;

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
    /// Set the project up: the specs/ folder, and an offer of the skill for your user
    Init {
        /// Never ask: without a skill found, name the command that installs it
        #[arg(long)]
        no_input: bool,
    },
    /// Install or update the skill, for your user or this repository
    Install(install::Flags),
    /// Show where every feature and change stands, across worktrees
    Status {
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
    /// Answer a round of questions, one question at a time, then submit it
    Answer {
        /// [target] <question> <answer>: the feature (optional), the question (Q2, Q2.B, or
        /// notes), and the answer
        #[arg(add = complete::questions())]
        arguments: Vec<String>,
        /// Submit the round: set it answered, and record its block
        #[arg(long)]
        submit: bool,
        /// With --submit, mark the round answered to continue the implementation: the spec stays
        /// as approved
        #[arg(long)]
        resume: bool,
    },
    /// Review a spec or a plan: comment, then approve or request changes
    Review {
        /// The feature or change, or the file's path
        #[arg(add = complete::started())]
        target: Option<String>,
        /// Comment on lines of the committed file, or on all of it: 50, 50-52, or general
        #[arg(long, num_args = 2, value_names = ["LINES", "TEXT"])]
        comment: Option<Vec<String>>,
        /// Approve the file, with the pending comments for the next step
        #[arg(long)]
        approve: bool,
        /// Request changes, with the pending comments
        #[arg(long)]
        request_changes: bool,
        /// A summary of the review, for its record
        #[arg(long)]
        summary: Option<String>,
        /// Change the spec's risk tier on approval: low, medium, or high
        #[arg(long, value_parser = clap::builder::PossibleValuesParser::new(
            uraeda_core::files::spec::risk_tiers(),
        ))]
        risk_tier: Option<String>,
        /// Whether the plan waits for your review: true or false; by default, the spec's value, or
        /// false with a new --risk-tier, whatever the tier
        #[arg(long)]
        plan_review: Option<bool>,
    },
    /// Check workflow files against the skill's rules
    Check {
        /// A specs/ folder, a folder under it, or a file; specs/ by default
        #[arg(add = complete::checked())]
        target: Option<String>,
        /// Print JSON
        #[arg(long)]
        json: bool,
        /// First relink every link to a file git's history says moved, without committing
        #[arg(long)]
        fix: bool,
    },
    /// Tell an agent the next step, its pick, and its session: of a feature or change, or of the first
    /// one waiting on an agent
    Next {
        /// A feature or change: a path under specs/, a folder name, or a slug
        #[arg(add = complete::started())]
        target: Option<String>,
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
    /// Upgrade ura to the latest release, with the installer script or Homebrew it came from
    Upgrade,
    /// Serve the pages to answer rounds and review specs and plans, from a phone too, until it is
    /// stopped. Prints the address, with its token
    Serve {
        /// The port on 127.0.0.1: else the settings' port, else 4310; 0 takes a free one
        #[arg(long)]
        port: Option<u16>,
        /// The folder the token is kept in
        #[arg(long, value_hint = clap::ValueHint::DirPath)]
        data_dir: Option<std::path::PathBuf>,
    },
    /// Read and write the human's notes, the vault `ura serve` syncs with their phone
    Vault(vault::Args),
    /// Run `ura serve` over sample projects, for Uraeda's own development: from a checkout of
    /// Uraeda, until it is stopped
    #[command(hide = true)]
    Sandbox(sandbox::Args),
}

fn main() -> ExitCode {
    complete::answer();
    let cli = match Cli::try_parse() {
        Ok(cli) => cli,
        Err(error) if !error.use_stderr() => error.exit(),
        Err(error) => {
            let rendered = error.render().to_string();
            let message = rendered.strip_prefix("error: ").unwrap_or(&rendered);
            eprint!("ura: {message}");
            return ExitCode::FAILURE;
        }
    };
    run(cli.command).unwrap_or_else(|message| output::fail(&message))
}

/// Runs a command.
fn run(command: Command) -> Result<ExitCode, String> {
    match command {
        Command::Init { no_input } => init::run(no_input),
        Command::Install(flags) => install::run(flags),
        Command::Status { json } => status::run(json),
        Command::Next { target, json } => next::run(target, json),
        Command::Check { target, json, fix } => check::run(target, json, fix),
        Command::Upgrade => upgrade::run(),
        Command::Serve { port, data_dir } => serve::run(port, data_dir),
        Command::Vault(args) => vault::run(args),
        Command::Sandbox(args) => sandbox::run(args),
        Command::Review {
            target,
            comment,
            approve,
            request_changes,
            summary,
            risk_tier,
            plan_review,
        } => review::run(review::Options {
            target,
            comment,
            approve,
            request_changes,
            summary,
            tier: uraeda_core::actions::review::Tier {
                risk_tier,
                plan_review,
            },
        }),
        Command::Answer {
            arguments,
            submit,
            resume,
        } => answer::run(arguments, submit, resume),
    }
}
