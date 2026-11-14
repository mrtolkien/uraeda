//! The one place the core runs a process: `git` for writes, and `gh` for pull requests.

use std::io::{self, BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{PoisonError, RwLock};
use std::time::Duration;

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
    /// Its output could not be read.
    Read(String),
    /// It exited with an error: `message` is its output's first line, `output` all of it.
    Exit { message: String, output: String },
    /// It ran past its deadline, and was stopped with every process it started.
    Deadline,
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
            Failure::Deadline => command(
                "it ran too long, and was stopped".to_string(),
                String::new(),
            ),
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
    let git = write_command(args, dir);
    match on_line {
        Some(on_line) => stream_command(git, on_line, None),
        None => run_command(git),
    }
}

/// Runs `git` with `args` in `dir` as [`git_write`] does, its output streamed to `on_line`, and
/// stops it, with every process it started, like `ssh`, once it runs past `deadline`: a remote
/// that never answers fails it with [`Failure::Deadline`].
pub(crate) fn git_write_within(
    args: &[&str],
    dir: &Path,
    on_line: &dyn Fn(&str),
    deadline: Duration,
) -> Result<Vec<u8>, Failure> {
    stream_command(write_command(args, dir), on_line, Some(deadline))
}

/// `git` with `args`, to run in `dir` for a write: see [`git_write`].
fn write_command(args: &[&str], dir: &Path) -> Command {
    let mut git = command("git", args, dir);
    git.env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_EDITOR", "true");
    git
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

/// Runs `command` as [`run`] does, its stdout and stderr read line by line, each line given to
/// `on_line` as it comes, like a hook's report while it runs. Returns the whole output, its lines
/// in the order they came, once it succeeds. A failure's message is stderr's first line, then
/// stdout's, as [`run`] has it. Past `deadline`, the process and every one it started are stopped,
/// as they may hold its output open, and it fails with [`Failure::Deadline`]: on unix alone, where
/// a process group can be stopped.
fn stream_command(
    mut command: Command,
    on_line: &dyn Fn(&str),
    deadline: Option<Duration>,
) -> Result<Vec<u8>, Failure> {
    // A group of its own, so a stop reaches what it started too.
    #[cfg(unix)]
    if deadline.is_some() {
        std::os::unix::process::CommandExt::process_group(&mut command, 0);
    }
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(start)?;
    let (stdout, stderr) = (child.stdout.take(), child.stderr.take());
    let (sender, receiver) = mpsc::channel();
    let mut output = Output::default();
    let mut failed = None;
    let (finished, finish) = mpsc::channel::<()>();
    let timed_out = AtomicBool::new(false);
    let group = child.id();
    std::thread::scope(|scope| {
        if let Some(deadline) = deadline {
            let timed_out = &timed_out;
            scope.spawn(move || {
                // Marked before the stop, which `wait` then sees; not without unix, as nothing stops.
                if finish.recv_timeout(deadline) == Err(RecvTimeoutError::Timeout) && cfg!(unix) {
                    timed_out.store(true, Ordering::SeqCst);
                    stop_group(group);
                }
            });
        }
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
        // Every pipe is closed: the deadline's watch ends.
        drop(finished);
    });
    let status = child.wait().map_err(start)?;
    if timed_out.load(Ordering::SeqCst) {
        return Err(Failure::Deadline);
    }
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

/// Stops the process group `group`, a process started in a group of its own and everything it
/// started. Its leader is not waited for yet, so the group's id is still its own.
#[cfg(unix)]
fn stop_group(group: u32) {
    let Ok(group) = libc::pid_t::try_from(group) else {
        return;
    };
    // SAFETY: `kill` takes no pointer; a negative id names the process group.
    unsafe {
        libc::kill(-group, libc::SIGKILL);
    }
}

/// No process groups to stop without unix: the process runs to its end, and is not marked past
/// its deadline.
#[cfg(not(unix))]
fn stop_group(_group: u32) {}

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
        let failed = stream_command(
            command("sh", &["-c", script], Path::new(".")),
            &|line| {
                lines.lock().unwrap().push(line.to_string());
            },
            None,
        );

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
