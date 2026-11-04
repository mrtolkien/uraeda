//! The one place the core runs a process: `git` for writes, and `gh` for pull requests.

use std::io::{self, BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc::{self, Sender};

use super::GitError;

/// Why a process gave no output.
#[derive(Debug)]
pub(crate) enum Failure {
    /// The program is not installed.
    NotFound,
    /// It could not start.
    Start(String),
    /// Its output could not be read.
    Read(String),
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
            Failure::Start(error) | Failure::Read(error) => command(error.clone(), error),
            Failure::Exit { message, output } => command(message, output),
        }
    }
}

/// Runs `program` with `args` in `dir`, and returns its stdout once it succeeds.
pub(crate) fn run(program: &str, args: &[&str], dir: &Path) -> Result<Vec<u8>, Failure> {
    run_command(command(program, args, dir))
}

/// Runs `git` with `args` in `dir` for a write the human asked for, which must never wait on
/// someone at a terminal: no stdin, no credential prompt (`GIT_TERMINAL_PROMPT=0`), and no editor
/// (`GIT_EDITOR=true` keeps the message git prepared). Its output is streamed to `on_line` when
/// one is given, as [`stream_command`] does; else it returns stdout once it succeeds, as [`run`].
pub(crate) fn git_write(
    args: &[&str],
    dir: &Path,
    on_line: Option<&dyn Fn(&str)>,
) -> Result<Vec<u8>, Failure> {
    let mut git = command("git", args, dir);
    git.env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_EDITOR", "true");
    match on_line {
        Some(on_line) => stream_command(git, on_line),
        None => run_command(git),
    }
}

/// `program` with `args`, to run in `dir`, its stdin closed.
fn command(program: &str, args: &[&str], dir: &Path) -> Command {
    let mut command = Command::new(program);
    command.args(args).current_dir(dir).stdin(Stdio::null());
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

/// Runs `command` as [`run`] does, its stdout and stderr read line by line, each line given to
/// `on_line` as it comes, like a hook's report while it runs. Returns the whole output, its lines
/// in the order they came, once it succeeds. A failure's message is stderr's first line, then
/// stdout's, as [`run`] has it.
fn stream_command(mut command: Command, on_line: &dyn Fn(&str)) -> Result<Vec<u8>, Failure> {
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(start)?;
    let (stdout, stderr) = (child.stdout.take(), child.stderr.take());
    let (sender, receiver) = mpsc::channel();
    let mut output = Output::default();
    let mut failed = None;
    std::thread::scope(|scope| {
        let to_stdout = sender.clone();
        scope.spawn(move || stdout.map(|pipe| send_lines(pipe, false, &to_stdout)));
        scope.spawn(move || stderr.map(|pipe| send_lines(pipe, true, &sender)));
        for (from_stderr, line) in receiver {
            match line {
                Ok(line) => {
                    on_line(String::from_utf8_lossy(&line).trim_end_matches(['\n', '\r']));
                    output.push(from_stderr, &line);
                }
                Err(error) => {
                    // A pipe no longer read could block the process: it is stopped.
                    let _ = child.kill();
                    failed.get_or_insert(error);
                }
            }
        }
    });
    let status = child.wait().map_err(start)?;
    if let Some(error) = failed {
        return Err(Failure::Read(error.to_string()));
    }
    if status.success() {
        return Ok(output.merged);
    }
    let (stderr, stdout) = (output.stderr(), output.stdout());
    Err(Failure::Exit {
        message: first_line(&stderr, &stdout),
        output: String::from_utf8_lossy(&output.merged)
            .trim_end()
            .to_string(),
    })
}

/// A process's output, each stream's own and both merged in the order their lines came.
#[derive(Default)]
struct Output {
    merged: Vec<u8>,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

impl Output {
    fn push(&mut self, from_stderr: bool, line: &[u8]) {
        self.merged.extend_from_slice(line);
        let stream = if from_stderr {
            &mut self.stderr
        } else {
            &mut self.stdout
        };
        stream.extend_from_slice(line);
    }

    fn stdout(&self) -> String {
        String::from_utf8_lossy(&self.stdout).into_owned()
    }

    fn stderr(&self) -> String {
        String::from_utf8_lossy(&self.stderr).into_owned()
    }
}

/// Sends each line of `pipe` to `sender`, with whether it is stderr's, until its end or a read
/// error, which is sent too.
fn send_lines(pipe: impl Read, from_stderr: bool, sender: &Sender<(bool, io::Result<Vec<u8>>)>) {
    let mut reader = BufReader::new(pipe);
    loop {
        let mut line = Vec::new();
        match reader.read_until(b'\n', &mut line) {
            Ok(0) => return,
            Ok(_) => {
                if sender.send((from_stderr, Ok(line))).is_err() {
                    return;
                }
            }
            Err(error) => {
                let _ = sender.send((from_stderr, Err(error)));
                return;
            }
        }
    }
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

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    /// A failure's message is stderr's first line, though stdout printed first, as [`run`] has it.
    #[test]
    fn a_streamed_failure_is_named_by_stderr_first() {
        let lines = Mutex::new(Vec::new());
        let script = "echo out; sleep 0.1; echo err >&2; exit 1";
        let failed = stream_command(command("sh", &["-c", script], Path::new(".")), &|line| {
            lines.lock().unwrap().push(line.to_string());
        });

        let Err(Failure::Exit { message, output }) = failed else {
            panic!("{failed:?}");
        };
        assert_eq!((message.as_str(), output.as_str()), ("err", "out\nerr"));
        assert_eq!(lines.into_inner().unwrap(), ["out", "err"]);
    }

    /// A write never waits on a terminal: git sees no prompt and no editor, streamed or not.
    #[test]
    fn a_write_runs_git_without_a_prompt_or_an_editor() {
        // SAFETY: nextest runs each test in a process of its own. Without these in the test's own
        // environment, only `git_write` can set them for git.
        unsafe {
            std::env::remove_var("GIT_TERMINAL_PROMPT");
            std::env::remove_var("GIT_EDITOR");
        }
        let env = ["-c", "alias.env=!env", "env"];
        let lines = Mutex::new(Vec::new());
        let streamed = git_write(
            &env,
            Path::new("."),
            Some(&|line| {
                lines.lock().unwrap().push(line.to_string());
            }),
        )
        .unwrap();
        let ran = String::from_utf8(git_write(&env, Path::new("."), None).unwrap()).unwrap();

        for output in [ran, String::from_utf8(streamed).unwrap()] {
            let lines: Vec<&str> = output.lines().collect();
            assert!(lines.contains(&"GIT_TERMINAL_PROMPT=0"), "{output}");
            assert!(lines.contains(&"GIT_EDITOR=true"), "{output}");
        }
        assert!(
            lines
                .into_inner()
                .unwrap()
                .contains(&"GIT_EDITOR=true".to_string())
        );
    }
}
