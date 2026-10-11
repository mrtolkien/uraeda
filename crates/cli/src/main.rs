//! `ura`, Uraeda's command-line tool.

mod answer;
mod check;
mod draft;
mod editor;
mod init;
mod next;
mod output;
mod review;
mod start;
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
    /// Set the project up: the specs/ folder, and the skill for your agents
    Init {
        /// Leave the skill out, to install it another way
        #[arg(long)]
        no_skill: bool,
    },
    /// Turn a line of PRIORITIES.md into a draft, and open it in your editor
    Draft {
        /// Text of the line, matched without case
        text: Option<String>,
        /// Do not open the editor
        #[arg(long)]
        no_edit: bool,
    },
    /// Start a drafted feature: its entry in Now, its branch, and its proposal
    Start {
        /// The draft: a file or folder in specs/drafts/ or specs/backlog/, or its name
        target: Option<String>,
        /// The slug of the feature's folder and branch, instead of the draft's name
        #[arg(long)]
        slug: Option<String>,
    },
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
    /// Review a spec, a plan, or an assessment: comment, then approve or request changes
    Review {
        /// The feature or bug, or the file's path
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
        /// A summary of the review, for its record and its commit
        #[arg(long)]
        summary: Option<String>,
        /// Change the spec's risk tier on approval: low, medium, or high
        #[arg(long)]
        risk_tier: Option<String>,
        /// Whether a medium-risk plan waits for your review
        #[arg(long)]
        plan_review: Option<bool>,
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
        Command::Init { no_skill } => init::run(no_skill),
        Command::Draft { text, no_edit } => draft::run(text, no_edit),
        Command::Start { target, slug } => start::run(target, slug),
        Command::Status { json } => status::run(json),
        Command::Next { target, json } => next::run(target, json),
        Command::Check { target, json } => check::run(target, json),
        Command::Review {
            target,
            comment,
            approve,
            request_changes,
            summary,
            risk_tier,
            plan_review,
            no_commit,
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
            no_commit,
        }),
        Command::Answer {
            arguments,
            submit,
            no_commit,
        } => answer::run(arguments, submit, no_commit),
    };
    result.unwrap_or_else(|message| output::fail(&message))
}
