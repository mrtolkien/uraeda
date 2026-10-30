//! The one place the core runs a process: `git` for writes, and `gh` for pull requests.

use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};

use super::GitError;

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
    let output = Command::new(program)
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|error| match error.kind() {
            std::io::ErrorKind::NotFound => Failure::NotFound,
            _ => Failure::Start(error.to_string()),
        })?;
    if output.status.success() {
        return Ok(output.stdout);
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    Err(exit(&stderr, &stdout))
}

/// Runs `program` as [`run`] does, its stdout and stderr merged in one pipe and read line by line,
/// each line given to `on_line` as it comes, like a hook's report while it runs. Returns the whole
/// merged output once it succeeds.
pub(crate) fn run_streaming(
    program: &str,
    args: &[&str],
    dir: &Path,
    on_line: &dyn Fn(&str),
) -> Result<Vec<u8>, Failure> {
    let start = |error: std::io::Error| match error.kind() {
        std::io::ErrorKind::NotFound => Failure::NotFound,
        _ => Failure::Start(error.to_string()),
    };
    let (reader, writer) = std::io::pipe().map_err(start)?;
    let mut command = Command::new(program);
    command
        .args(args)
        .current_dir(dir)
        .stdin(Stdio::null())
        .stdout(writer.try_clone().map_err(start)?)
        .stderr(writer);
    let mut child = command.spawn().map_err(start)?;
    // The command holds the pipe's writing ends: dropped, the pipe ends with the process.
    drop(command);
    let mut merged = Vec::new();
    let mut reader = BufReader::new(reader);
    let mut line = Vec::new();
    while reader.read_until(b'\n', &mut line).unwrap_or(0) > 0 {
        let text = String::from_utf8_lossy(&line);
        on_line(text.trim_end_matches(['\n', '\r']));
        merged.append(&mut line);
    }
    let status = child.wait().map_err(start)?;
    if status.success() {
        return Ok(merged);
    }
    Err(exit("", &String::from_utf8_lossy(&merged)))
}

/// The failure of a process that exited with an error: its first line, stderr's first, and all
/// of its output.
fn exit(stderr: &str, stdout: &str) -> Failure {
    let message = stderr
        .lines()
        .chain(stdout.lines())
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("no output")
        .to_string();
    let output = format!("{stdout}{stderr}").trim_end().to_string();
    Failure::Exit { message, output }
}
