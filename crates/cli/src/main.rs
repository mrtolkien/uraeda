//! `ura`, Uraeda's command-line tool.

mod add;
mod answer;
mod check;
mod clean;
mod draft;
mod editor;
mod init;
mod install;
mod next;
mod note;
mod output;
mod picker;
mod review;
mod start;
mod status;
mod terminal;
mod upgrade;

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
    /// Turn a line of PRIORITIES.md into a draft, and open it in your editor
    Draft {
        /// Text of the line, matched without case
        text: Option<String>,
        /// Do not open the editor
        #[arg(long)]
        no_edit: bool,
    },
    /// Add a note to the inbox, specs/INBOX.md, on the default branch, and commit it
    Note {
        /// The note's text, on one line
        text: String,
        /// The category, a ## heading of INBOX.md, created when missing
        #[arg(long)]
        category: Option<String>,
        /// The feature or change the note is about, written as its slug; by default, the one of
        /// this checkout's branch
        #[arg(long)]
        about: Option<String>,
        /// Mark the note as written by an agent
        #[arg(long)]
        agent: bool,
        /// Leave INBOX.md for you to commit
        #[arg(long)]
        no_commit: bool,
    },
    /// Start a drafted feature or change: its entry in Now, its branch, and its proposal
    Start {
        /// The draft: a file or folder in specs/drafts/ or specs/backlog/, or its name
        target: Option<String>,
        /// The slug of the feature's or change's folder and branch, instead of the draft's name
        #[arg(long)]
        slug: Option<String>,
        /// Start the draft as a change, on a change/ branch, in specs/changes/
        #[arg(long)]
        change: bool,
        /// Switch this checkout to the new branch, instead of creating its worktree in
        /// .worktrees/
        #[arg(long)]
        switch: bool,
    },
    /// Show where every feature and change stands, across branches
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
        /// With --submit, mark the round answered to continue the implementation: the spec stays
        /// as approved
        #[arg(long)]
        resume: bool,
        /// Leave the files for you to commit
        #[arg(long)]
        no_commit: bool,
    },
    /// Review a spec or a plan: comment, then approve or request changes
    Review {
        /// The feature or change, or the file's path
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
        #[arg(long, value_parser = clap::builder::PossibleValuesParser::new(
            uraeda_core::files::spec::risk_tiers(),
        ))]
        risk_tier: Option<String>,
        /// Whether the plan waits for your review: true or false; by default, the spec's value, or
        /// false with a new --risk-tier, whatever the tier
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
    /// Tell an agent the next step: of a feature or change, or of the first one in Now with work
    Next {
        /// A feature or change: a path under specs/, a folder name, or a slug
        target: Option<String>,
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
    /// Remove the worktree and the branch merged features left behind
    Clean {
        /// A merged feature or change: a path under specs/, a folder name, or a slug
        target: Option<String>,
        /// Clean every merged feature with a worktree or a branch left
        #[arg(long)]
        all: bool,
        /// Print what would be removed, and remove nothing
        #[arg(long)]
        dry_run: bool,
    },
    /// Serve workflow files to editors over stdio: diagnostics, completion, outline, actions
    Lsp,
    /// Upgrade ura to the latest release, with the installer script or Homebrew it came from
    Upgrade,
    /// Add the git repository holding a folder to the web UI's list
    Add {
        /// A folder in the repository; the current folder by default
        folder: Option<std::path::PathBuf>,
    },
}

fn main() -> ExitCode {
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
    let result = match cli.command {
        Command::Init { no_input } => init::run(no_input),
        Command::Install(flags) => install::run(flags),
        Command::Draft { text, no_edit } => draft::run(text, no_edit),
        Command::Note {
            text,
            category,
            about,
            agent,
            no_commit,
        } => note::run(note::Options {
            text,
            category,
            about,
            agent,
            no_commit,
        }),
        Command::Start {
            target,
            slug,
            change,
            switch,
        } => start::run(target, slug, change, switch),
        Command::Status { json } => status::run(json),
        Command::Next { target, json } => next::run(target, json),
        Command::Check { target, json } => check::run(target, json),
        Command::Clean {
            target,
            all,
            dry_run,
        } => clean::run(target, all, dry_run),
        Command::Lsp => uraeda_lsp::stdio()
            .map(|()| ExitCode::SUCCESS)
            .map_err(|error| error.to_string()),
        Command::Upgrade => upgrade::run(),
        Command::Add { folder } => add::run(folder),
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
            resume,
            no_commit,
        } => answer::run(arguments, submit, resume, no_commit),
    };
    result.unwrap_or_else(|message| output::fail(&message))
}
