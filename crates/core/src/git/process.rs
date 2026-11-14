//! The one place the core runs a process: `git` for what gix does not read, and `gh` for pull
//! requests.

use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{PoisonError, RwLock};

use super::GitError;

/// The variables every process started here gets besides this process's own environment.
static ADDED: RwLock<Vec<(String, String)>> = RwLock::new(Vec::new());

/// Why a process gave no output.
#[derive(Debug)]
pub(crate) enum Failure {
    /// The program is not installed.
    NotFound,
    /// It could not start.
    Start(String),
    /// It exited with an error: `message` is its output's first line, `output` all of it.
    Exit { message: String, output: String },
}

impl Failure {
    /// The error of `git <subcommand>` that failed this way.
    pub(crate) fn into_git(self, subcommand: &str) -> GitError {
        let command = |message: String, output: String| GitError::Command {
            subcommand: subcommand.to_string(),
            message,
            output,
        };
        match self {
            Failure::NotFound => GitError::GitNotFound,
            Failure::Start(error) => command(error.clone(), error),
            Failure::Exit { message, output } => command(message, output),
        }
    }
}

/// Runs `program` with `args` in `dir`, and returns its stdout once it succeeds.
pub(crate) fn run(program: &str, args: &[&str], dir: &Path) -> Result<Vec<u8>, Failure> {
    run_command(command(program, args, dir))
}

/// `program` with `args`, to run in `dir`, its stdin closed, in this process's environment and
/// the variables [`set_environment`] added to it.
fn command(program: &str, args: &[&str], dir: &Path) -> Command {
    let mut command = Command::new(program);
    command.args(args).current_dir(dir).stdin(Stdio::null());
    let added = ADDED.read().unwrap_or_else(PoisonError::into_inner);
    command.envs(added.iter().map(|(name, value)| (name, value)));
    command
}

/// Why a process could not start.
fn start(error: std::io::Error) -> Failure {
    match error.kind() {
        std::io::ErrorKind::NotFound => Failure::NotFound,
        _ => Failure::Start(error.to_string()),
    }
}

/// Runs `command`, and returns its stdout once it succeeds.
fn run_command(mut command: Command) -> Result<Vec<u8>, Failure> {
    let output = command.output().map_err(start)?;
    if output.status.success() {
        return Ok(output.stdout);
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    Err(exit(&stderr, &stdout))
}

/// The failure of a process that exited with an error: its first line, stderr's first, and all
/// of its output.
fn exit(stderr: &str, stdout: &str) -> Failure {
    let output = format!("{stdout}{stderr}").trim_end().to_string();
    Failure::Exit {
        message: first_line(stderr, stdout),
        output,
    }
}

/// The first line of a failed process's output that is not blank, stderr's first.
fn first_line(stderr: &str, stdout: &str) -> String {
    stderr
        .lines()
        .chain(stdout.lines())
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("no output")
        .to_string()
}
