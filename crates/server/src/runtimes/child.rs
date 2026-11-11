//! The process a runtime runs its agent in: started in the server's environment, leading a
//! process group of its own, one JSON line per message both ways, and ended with everything it
//! started.
//!
//! - **Its output is read as it comes**, whether or not its lines are: an agent that is read
//!   slowly loses its last lines.
//! - **Its group ends with it.** A signal reaches the whole group, and the group is killed as
//!   soon as its leader exits, so a command the agent left running never holds its output open.
//! - **The server stops it.** Every process still running as the server stops is asked to end,
//!   killed 5 seconds later, and waited for. A stopping server starts none.

use std::collections::HashMap;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout};
use tokio::sync::{mpsc, watch};

use crate::live::locked;
use crate::process::{Signal, lead_group, signal_group};
use crate::runner::Event;
use crate::shared::Shared;

/// How long a process asked to end has before it is killed: as the server stops, and for a
/// short process done with.
pub const KILL_AFTER: Duration = Duration::from_secs(5);

/// How long a process's output may stay open once its group was killed.
const OUTPUT: Duration = Duration::from_secs(2);

/// A failed process keeps this many lines of stderr.
const STDERR_LINES: usize = 20;

/// The bytes of stderr kept while a process runs, enough for its last lines.
const STDERR_KEPT: usize = 64_000;

/// What starts an agent's process.
#[derive(Clone, Debug)]
pub struct Spawn {
    /// The command, found on the server's `PATH`.
    pub program: String,
    pub args: Vec<String>,
    /// The folder it runs in.
    pub cwd: PathBuf,
    /// The variables it gets besides the server's environment, as its token: `Tools::env()`.
    pub env: Vec<(String, String)>,
}

/// The server's agent processes that still run: `shared.get::<Children>()`, for
/// [`Child::spawn`] alone.
#[derive(Default)]
pub(super) struct Children {
    state: Mutex<Running>,
}

#[derive(Default)]
struct Running {
    stopping: bool,
    /// Each running process's end, by its group's leader.
    ended: HashMap<u32, watch::Receiver<Option<Event>>>,
}

impl Children {
    /// Stops every process still running, and starts none from now on: each group is asked to
    /// end, killed 5 seconds later, and waited for.
    pub(super) async fn stop(&self) {
        let running: Vec<(u32, watch::Receiver<Option<Event>>)> = {
            let mut state = locked(&self.state);
            state.stopping = true;
            state.ended.drain().collect()
        };
        for (leader, _) in &running {
            signal_group(*leader, Signal::Terminate);
        }
        let all = async {
            for (_, ended) in &running {
                let _ = ended.clone().wait_for(Option::is_some).await;
            }
        };
        if tokio::time::timeout(KILL_AFTER, all).await.is_ok() {
            return;
        }
        for (leader, mut ended) in running {
            signal_group(leader, Signal::Kill);
            let _ = ended.wait_for(Option::is_some).await;
        }
    }
}

/// An agent's process, from its start to its exit. Dropped while it runs, its stdin closes,
/// which ends an agent, and the server still stops it.
pub struct Child {
    /// The group's leader: none for a process that did not start.
    leader: Option<u32>,
    lines: Option<Lines>,
    input: mpsc::UnboundedSender<Input>,
    ended: watch::Receiver<Option<Event>>,
}

/// What the task that owns the process's stdin is told.
enum Input {
    Line(String),
    End,
}

impl Child {
    /// Starts the process: `shared.environment().command(program)`, with its own variables,
    /// its stdin, stdout, and stderr piped, leading a process group of its own. Call it where
    /// tokio runs, a blocking thread included.
    ///
    /// It never fails: a command that cannot start is a process with no output, whose
    /// [`Child::exited`] says why, `missing` when the command was not found.
    pub fn spawn(shared: &Shared, spawn: Spawn) -> Child {
        let children = shared.get::<Children>();
        let mut state = locked(&children.state);
        if state.stopping {
            return failed("The server is stopping.".to_owned(), None);
        }
        let mut command = shared.environment().command(&spawn.program);
        command
            .args(&spawn.args)
            .envs(spawn.env)
            .current_dir(&spawn.cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        lead_group(&mut command);
        let mut child = match tokio::process::Command::from(command).spawn() {
            Ok(child) => child,
            Err(error) => return not_started(&error, &spawn.cwd),
        };
        let Some(leader) = child.id() else {
            return failed("The command ended as it started.".to_owned(), None);
        };
        let (line, lines) = mpsc::unbounded_channel();
        let (input, written) = mpsc::unbounded_channel();
        let stderr = Arc::new(Mutex::new(Vec::new()));
        tokio::spawn(write(child.stdin.take(), written));
        let output = (
            tokio::spawn(read_lines(child.stdout.take(), line)),
            tokio::spawn(keep_end(child.stderr.take(), stderr.clone())),
        );
        let (ending, ended) = watch::channel(None);
        state.ended.insert(leader, ended.clone());
        drop(state);
        tokio::spawn(async move {
            let status = child.wait().await;
            // What the agent started may outlive it, and keep its output open.
            signal_group(leader, Signal::Kill);
            let closed = async { (output.0.await, output.1.await) };
            let _ = tokio::time::timeout(OUTPUT, closed).await;
            locked(&children.state).ended.remove(&leader);
            let code = status.ok().and_then(|status| status.code());
            ending.send_replace(Some(exit(code, last_lines(&locked(&stderr)), None)));
        });
        Child {
            leader: Some(leader),
            lines: Some(Lines(lines)),
            input,
            ended,
        }
    }

    /// The process that leads, or led, its group: none for one that did not start.
    pub fn leader(&self) -> Option<u32> {
        self.leader
    }

    /// The lines of its stdout, for the one task that reads them: taken once.
    pub fn lines(&mut self) -> Lines {
        let lines = self.lines.take();
        lines.unwrap_or_else(|| Lines(mpsc::unbounded_channel().1))
    }

    /// Writes a value as one JSON line to its stdin, without waiting: dropped once its stdin
    /// closed.
    pub fn write(&self, value: &serde_json::Value) {
        let _ = self.input.send(Input::Line(value.to_string()));
    }

    /// Closes its stdin, once what was written reached it: an agent ends on it.
    pub fn end_input(&self) {
        let _ = self.input.send(Input::End);
    }

    /// Signals the process's whole group, until its output closed.
    pub fn signal(&self, signal: Signal) {
        // Once it ended, its id may be another process's.
        let running = self.leader.filter(|_| self.ended.borrow().is_none());
        if let Some(leader) = running {
            signal_group(leader, signal);
        }
    }

    /// Waits for the process's end: its `exit` event, once its stdout and stderr closed, with
    /// its code, none when a signal ended it, and the last 20 lines of its stderr.
    pub async fn exited(&self) -> Event {
        let mut ended = self.ended.clone();
        let exit = ended.wait_for(Option::is_some).await;
        let exit = exit.ok().and_then(|exit| exit.clone());
        exit.unwrap_or_else(|| self::exit(None, String::new(), None))
    }

    /// Ends a short process done with, answered or not, as one that lists an agent's models:
    /// its stdin closes, its group is asked to end, and killed if it still runs 5 seconds
    /// later. It does not wait.
    pub fn end_short(&self) {
        self.end_input();
        self.signal(Signal::Terminate);
        let (Some(leader), mut ended) = (self.leader, self.ended.clone()) else {
            return;
        };
        tokio::spawn(async move {
            let exited = ended.wait_for(Option::is_some);
            if tokio::time::timeout(KILL_AFTER, exited).await.is_err() {
                signal_group(leader, Signal::Kill);
            }
        });
    }
}

/// The lines of a process's stdout, in order: each without its line break, the blank ones left
/// out, and what is no UTF-8 replaced.
pub struct Lines(mpsc::UnboundedReceiver<String>);

impl Lines {
    /// The next line: none once the output closed.
    pub async fn next(&mut self) -> Option<String> {
        self.0.recv().await
    }
}

/// An `exit` event.
fn exit(code: Option<i32>, stderr: String, missing: Option<bool>) -> Event {
    Event::Exit {
        code,
        missing,
        stderr,
    }
}

/// A process that did not start: it gives no line, and its exit says why.
fn failed(why: String, missing: Option<bool>) -> Child {
    Child {
        leader: None,
        lines: None,
        input: mpsc::unbounded_channel().0,
        ended: watch::channel(Some(exit(None, why, missing))).1,
    }
}

/// The process of a command that could not start. The system says "not found" for a missing
/// directory as for a missing command.
fn not_started(error: &std::io::Error, cwd: &Path) -> Child {
    let missing = error.kind() == ErrorKind::NotFound;
    if missing && !cwd.exists() {
        let gone = format!("The session's directory is gone: {}", cwd.display());
        return failed(gone, None);
    }
    failed(error.to_string(), missing.then_some(true))
}

/// Writes each line to the process's stdin, until it is told the end, or the process closed it.
async fn write(stdin: Option<ChildStdin>, mut written: mpsc::UnboundedReceiver<Input>) {
    let Some(mut stdin) = stdin else {
        return;
    };
    while let Some(Input::Line(mut line)) = written.recv().await {
        line.push('\n');
        if stdin.write_all(line.as_bytes()).await.is_err() || stdin.flush().await.is_err() {
            break;
        }
    }
    // Dropped here, stdin closes; the lines written since are dropped with the receiver.
}

/// Sends each line of the process's stdout as it comes.
async fn read_lines(stdout: Option<ChildStdout>, line: mpsc::UnboundedSender<String>) {
    let Some(stdout) = stdout else {
        return;
    };
    let mut stdout = BufReader::new(stdout);
    let mut bytes = Vec::new();
    while let Ok(1..) = stdout.read_until(b'\n', &mut bytes).await {
        let text = String::from_utf8_lossy(&bytes);
        let text = text.trim_end_matches('\n').trim_end_matches('\r');
        if !text.is_empty() {
            // With nobody left to read the lines, the output is still read to its end.
            let _ = line.send(text.to_owned());
        }
        bytes.clear();
    }
}

/// Keeps the end of a stream, the process's stderr.
async fn keep_end(stream: Option<impl AsyncRead + Unpin>, kept: Arc<Mutex<Vec<u8>>>) {
    let Some(mut stream) = stream else {
        return;
    };
    let mut chunk = [0; 4096];
    while let Ok(read @ 1..) = stream.read(&mut chunk).await {
        let mut kept = locked(&kept);
        kept.extend_from_slice(&chunk[..read]);
        let extra = kept.len().saturating_sub(STDERR_KEPT);
        kept.drain(..extra);
    }
}

/// The last lines of what a process wrote to its stderr.
fn last_lines(stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    let lines: Vec<&str> = text.trim_end().lines().collect();
    lines[lines.len().saturating_sub(STDERR_LINES)..].join("\n")
}
