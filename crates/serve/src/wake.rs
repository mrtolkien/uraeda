//! Telling the agent's session to continue, after the human submits a round or a verdict.
//!
//! With `wake = "t3"`, the session is found through T3 Code's CLI: the project's unsettled threads,
//! newest first, until one works in the worktree the human's file is in, and it is sent a message,
//! which a busy thread takes as its next turn. Nothing here is written but that message, and no
//! shell is involved: the program runs with its arguments. A failure never stops the submit, it
//! is the page's note.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::Value;

use crate::config::Wake;

/// The time every wake has in all, over every command it runs.
const BUDGET: Duration = Duration::from_secs(5);

/// How the wake ended.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Woken {
    /// The session with this title was sent the message.
    Told { title: String },
    /// No unsettled thread works in the worktree: the next step starts when the human says so.
    NoSession,
    /// What went wrong, in a sentence.
    Failed(String),
}

/// The message a session is sent: `what` is what happened, such as "the human answered round 01 of
/// recurring-tasks".
pub fn message(what: &str) -> String {
    let what = what.trim().trim_end_matches('.');
    format!("{what}: continue.")
}

/// Tells the session working in `worktree`, in the project whose main checkout is `main_checkout`.
pub async fn wake(how: &Wake, main_checkout: &Path, worktree: &Path, message: &str) -> Woken {
    let (how, main, tree, message) = (
        how.clone(),
        main_checkout.to_path_buf(),
        worktree.to_path_buf(),
        message.to_string(),
    );
    tokio::task::spawn_blocking(move || wake_blocking(&how, &main, &tree, &message))
        .await
        .unwrap_or_else(|error| Woken::Failed(format!("the wake stopped: {error}")))
}

/// [`wake`], on the calling thread.
pub fn wake_blocking(how: &Wake, main_checkout: &Path, worktree: &Path, message: &str) -> Woken {
    let Wake::T3 { program } = how;
    match find_and_send(program, main_checkout, worktree, message) {
        Ok(woken) => woken,
        Err(problem) => Woken::Failed(problem),
    }
}

fn find_and_send(
    program: &Path,
    main_checkout: &Path,
    worktree: &Path,
    message: &str,
) -> Result<Woken, String> {
    let deadline = Instant::now() + BUDGET;
    let target = canonical(worktree);
    let main = canonical(main_checkout);
    let main_arg = main_checkout.to_string_lossy().into_owned();
    let list = run(
        program,
        &["thread", "list", "--project", &main_arg, "--json"],
        deadline,
    )?;
    let mut threads: Vec<Value> = match serde_json::from_str::<Value>(&list) {
        Ok(Value::Array(threads)) => threads,
        _ => return Err("t3 thread list did not answer a list of threads".into()),
    };
    threads.retain(|t| t.get("settled").and_then(Value::as_bool) == Some(false));
    // ISO timestamps sort as text.
    threads.sort_by(|a, b| updated(b).cmp(updated(a)));
    for thread in &threads {
        let Some(id) = thread.get("threadId").and_then(Value::as_str) else {
            continue;
        };
        let shown = run(program, &["thread", "show", "--json", id], deadline)?;
        let Ok(shown) = serde_json::from_str::<Value>(&shown) else {
            continue;
        };
        let path = shown
            .pointer("/thread/worktreePath")
            .and_then(Value::as_str)
            .map(canonical);
        let matches = match path {
            Some(path) => path == target,
            None => target == main,
        };
        if matches {
            run(program, &["thread", "send", id, message], deadline)?;
            let title = thread
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("untitled")
                .to_string();
            return Ok(Woken::Told { title });
        }
    }
    Ok(Woken::NoSession)
}

fn updated(thread: &Value) -> &str {
    thread
        .get("updatedAt")
        .and_then(Value::as_str)
        .unwrap_or("")
}

fn canonical(path: impl AsRef<Path>) -> PathBuf {
    let path = path.as_ref();
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

/// Runs the program with these arguments, no shell, and answers its output; stops it at the
/// deadline.
fn run(program: &Path, args: &[&str], deadline: Instant) -> Result<String, String> {
    let name = program.display();
    let what = args[..2].join(" ");
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| match error.kind() {
            std::io::ErrorKind::NotFound => {
                format!("{name} was not found: is T3 Code's CLI installed?")
            }
            _ => format!("{name} could not start: {error}"),
        })?;
    let out = drain(child.stdout.take());
    let err = drain(child.stderr.take());
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(10)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("{name} {what} took too long"));
            }
            Err(error) => return Err(format!("{name} could not be waited for: {error}")),
        }
    };
    let out = out.join().unwrap_or_default();
    if status.success() {
        return Ok(out);
    }
    let err = err.join().unwrap_or_default();
    let reason = err
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("no reason given");
    Err(format!("{name} {what} failed: {}", reason.trim()))
}

fn drain<R: Read + Send + 'static>(stream: Option<R>) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut text = String::new();
        if let Some(mut stream) = stream {
            let _ = stream.read_to_string(&mut text);
        }
        text
    })
}
