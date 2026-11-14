//! `ura`, Uraeda's command-line tool.

mod add;
mod answer;
mod check;
mod clean;
mod complete;
mod editor;
mod expand;
mod extension;
mod import_sessions;
mod inbox;
mod init;
mod install;
mod key;
mod next;
mod note;
mod output;
mod pair;
mod picker;
mod review;
mod sandbox;
mod serve;
mod serve_app;
mod shell;
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
    /// Expand a proposal of PRIORITIES.md into a file, and open it in your editor
    Expand {
        /// Text of the proposal, matched without case
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
        #[arg(long, add = complete::categories())]
        category: Option<String>,
        /// The feature or change the note is about, written as its slug; by default, the one of
        /// this checkout's branch
        #[arg(long, add = complete::started())]
        about: Option<String>,
        /// Mark the note as written by an agent. In a feature's or a change's worktree, write it as
        /// a note file of its own, specs/notes/<slug>-<words>.md, committed on its branch
        #[arg(long)]
        agent: bool,
        /// Leave INBOX.md for you to commit
        #[arg(long)]
        no_commit: bool,
    },
    /// Print the inbox of the default branch, by category, or work on it
    Inbox(inbox::Args),
    /// Start a feature or change from its proposal: its line in Now, its branch, and its folder.
    /// With --feature, make a started change a feature, in place
    Start {
        /// The proposal: a file or folder in specs/proposals/, or its name; with --feature, the
        /// change
        #[arg(add = complete::proposals())]
        target: Option<String>,
        /// The slug of the feature's or change's folder and branch, instead of the proposal's name
        #[arg(long)]
        slug: Option<String>,
        /// Start the proposal as a change, on a change/ branch, in specs/changes/
        #[arg(long)]
        change: bool,
        /// Switch this checkout to the new branch, instead of creating its worktree in
        /// .worktrees/
        #[arg(long)]
        switch: bool,
        /// Make a started change a feature, in place: its branch loses its change/ prefix, and
        /// its folder moves to specs/
        #[arg(long, conflicts_with_all = ["change", "slug", "switch"])]
        feature: bool,
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
        #[arg(add = complete::questions())]
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
        #[arg(add = complete::checked())]
        target: Option<String>,
        /// Print JSON
        #[arg(long)]
        json: bool,
        /// First relink every link to a file git's history says moved, without committing
        #[arg(long)]
        fix: bool,
    },
    /// Tell an agent the next step: of a feature or change, or of the first one in Now with work
    Next {
        /// A feature or change: a path under specs/, a folder name, or a slug
        #[arg(add = complete::started())]
        target: Option<String>,
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
    /// Remove the worktree and the branch merged features left behind
    Clean {
        /// A merged feature or change: a path under specs/, a folder name, or a slug
        #[arg(add = complete::merged())]
        target: Option<String>,
        /// Clean every merged feature with a worktree, a branch, or a line of the priorities left
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
    /// Add the git repository holding a folder to the app's list
    Add {
        /// A folder in the repository; the current folder by default
        #[arg(value_hint = clap::ValueHint::DirPath)]
        folder: Option<std::path::PathBuf>,
    },
    /// Add, update, remove, and list your extensions, in the config folder's extensions/
    Extension(extension::Args),
    /// Serve the pages to answer rounds and review specs and plans, from a phone too, until it is
    /// stopped. Prints the address, with its token
    Serve {
        /// The port on 127.0.0.1: else the settings' port, else 4320; 0 takes a free one
        #[arg(long)]
        port: Option<u16>,
        /// The folder the token is kept in
        #[arg(long, value_hint = clap::ValueHint::DirPath)]
        data_dir: Option<std::path::PathBuf>,
    },
    /// Run Uraeda's earlier server on this machine, until it is stopped
    ServeApp {
        /// The port on 127.0.0.1: else URAEDA_PORT, else the settings' port, else 4310; 0 takes
        /// a free one
        #[arg(long)]
        port: Option<u16>,
        /// The folder the server keeps its data in
        #[arg(long, value_hint = clap::ValueHint::DirPath)]
        data_dir: Option<std::path::PathBuf>,
        /// Start no scheduled job at its times, whatever the settings say; "Run now" still works
        #[arg(long)]
        no_scheduled_jobs: bool,
        /// Do not open the app in the browser, whatever the settings say
        #[arg(long)]
        no_open: bool,
    },
    /// Run the server over sample projects and a fake agent, without sign-in, for Uraeda's own
    /// development: from a checkout of Uraeda, until it is stopped
    #[command(hide = true)]
    Sandbox(sandbox::Args),
    /// Play Storybook for the sandbox's stories: a page for each story, and their index
    #[command(hide = true, disable_help_flag = true)]
    FakeStorybook {
        /// The fake's own arguments: see `uraeda_server::sandbox::storybook`
        #[arg(allow_hyphen_values = true, trailing_var_arg = true)]
        args: Vec<String>,
    },
    /// Show a one-time code, and its QR code, that pairs another device with the running server
    Pair {
        /// The data folder of the server to pair with
        #[arg(long, value_hint = clap::ValueHint::DirPath)]
        data_dir: Option<std::path::PathBuf>,
    },
    /// Show an access key, once, that signs a browser in to the running server
    Key {
        /// The data folder of the server
        #[arg(long, value_hint = clap::ValueHint::DirPath)]
        data_dir: Option<std::path::PathBuf>,
        /// Make a new key in place of the one there: every browser and device is signed out
        #[arg(long)]
        replace: bool,
    },
    /// Copy the earlier server's sessions into the store of `ura serve-app`, once
    ImportSessions {
        /// The earlier server's data folder, which is only read
        #[arg(long, value_hint = clap::ValueHint::DirPath)]
        from: Option<std::path::PathBuf>,
        /// The data folder of the server to import into
        #[arg(long, value_hint = clap::ValueHint::DirPath)]
        data_dir: Option<std::path::PathBuf>,
        /// Remove the sessions the store already holds, and import in their place
        #[arg(long)]
        replace: bool,
    },
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
    let result = match cli.command {
        Command::Init { no_input } => init::run(no_input),
        Command::Install(flags) => install::run(flags),
        Command::Expand { text, no_edit } => expand::run(text, no_edit),
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
        Command::Inbox(args) => inbox::run(args),
        Command::Start {
            target,
            feature: true,
            ..
        } => start::promote(target),
        Command::Start {
            target,
            slug,
            change,
            switch,
            feature: false,
        } => start::run(target, slug, change, switch),
        Command::Status { json } => status::run(json),
        Command::Next { target, json } => next::run(target, json),
        Command::Check { target, json, fix } => check::run(target, json, fix),
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
        Command::Extension(args) => extension::run(args),
        Command::Serve { port, data_dir } => serve::run(port, data_dir),
        Command::ServeApp {
            port,
            data_dir,
            no_scheduled_jobs,
            no_open,
        } => serve_app::run(port, data_dir, no_scheduled_jobs, no_open),
        Command::Sandbox(args) => sandbox::run(args),
        Command::FakeStorybook { args } => Ok(uraeda_server::sandbox::storybook::run(args)),
        Command::Pair { data_dir } => pair::run(data_dir),
        Command::Key { data_dir, replace } => key::run(data_dir, replace),
        Command::ImportSessions {
            from,
            data_dir,
            replace,
        } => import_sessions::run(from, data_dir, replace),
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
