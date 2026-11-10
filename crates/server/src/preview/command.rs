//! One run of a preview command: started in a process group of its own, its output's last lines
//! kept, its group recorded while it runs, and stopped whole.

use std::path::Path;
use std::process::Stdio;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Child;
use tokio::sync::watch;

use super::groups::Groups;
use crate::env::Environment;

/// How long a stopped command has to exit before it is killed.
const KILL: Duration = Duration::from_secs(5);

/// How long a command's output may stay open once its group was killed.
const OUTPUT: Duration = Duration::from_secs(2);

/// How many lines of a command's output are kept.
const LINES_KEPT: usize = 50;

/// What a group is sent.
#[derive(Clone, Copy)]
pub(super) enum Signal {
    /// Asks the processes to end.
    Terminate,
    /// Ends them.
    Kill,
}

/// Sends a signal to the process group led by `leader`: the command, and everything it started.
/// Nothing happens when the group is gone.
#[cfg(unix)]
pub(super) fn signal_group(leader: u32, signal: Signal) {
    let Ok(group) = libc::pid_t::try_from(leader) else {
        return;
    };
    let signal = match signal {
        Signal::Terminate => libc::SIGTERM,
        Signal::Kill => libc::SIGKILL,
    };
    // A group of id 0 or 1 would be the server's own, or every process.
    if group > 1 {
        // SAFETY: `kill` takes no pointer; a negative id names the process group.
        unsafe {
            libc::kill(-group, signal);
        }
    }
}

/// Without unix there is no process group: the command runs to its end.
#[cfg(not(unix))]
pub(super) fn signal_group(_leader: u32, _signal: Signal) {}

/// What starts a run.
pub(super) struct Start<'a> {
    /// The server's environment, the only one a command gets.
    pub environment: &'a Environment,
    /// The decision's command, holding `{port}` where the port goes.
    pub command: &'a str,
    /// The folder it runs in.
    pub folder: &'a Path,
    pub port: u16,
    /// The path it is served under, given as `URAEDA_PREVIEW_BASE`.
    pub base: &'a str,
}

/// One started command: its last lines of output, and its end.
pub(super) struct Run {
    leader: u32,
    lines: Arc<Mutex<Vec<String>>>,
    ended: watch::Receiver<Option<String>>,
}

impl Run {
    /// Starts the command through `sh`, leading a process group of its own, which its signals
    /// reach whole: what the command starts ends with it.
    ///
    /// # Errors
    ///
    /// Why it did not start, as the system says it.
    pub(super) fn start(start: &Start, groups: Arc<Groups>) -> Result<Run, String> {
        let mut command = start.environment.command("sh");
        let text = start.command.replace("{port}", &start.port.to_string());
        command
            .args(["-c", &text])
            .current_dir(start.folder)
            .env("URAEDA_PREVIEW_BASE", start.base)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(unix)]
        std::os::unix::process::CommandExt::process_group(&mut command, 0);
        let mut child = tokio::process::Command::from(command)
            .spawn()
            .map_err(|error| error.to_string())?;
        let leader = child.id().ok_or("the command ended as it started")?;
        let lines = Arc::new(Mutex::new(Vec::new()));
        let output = (
            tokio::spawn(keep_lines(child.stdout.take(), lines.clone())),
            tokio::spawn(keep_lines(child.stderr.take(), lines.clone())),
        );
        let (ending, ended) = watch::channel(None);
        tokio::spawn(async move {
            let why = end(child, leader, output, &groups).await;
            ending.send_replace(Some(why));
        });
        Ok(Run {
            leader,
            lines,
            ended,
        })
    }

    /// The process that leads the command's group.
    pub(super) fn leader(&self) -> u32 {
        self.leader
    }

    /// Whether the command ended, and its group with it.
    pub(super) fn has_ended(&self) -> bool {
        self.ended.borrow().is_some()
    }

    /// Waits for the command's end, once its output closed: why it ended.
    pub(super) async fn ended(&self) -> String {
        let mut ended = self.ended.clone();
        let why = ended.wait_for(Option::is_some).await;
        why.ok().and_then(|why| why.clone()).unwrap_or_default()
    }

    /// Why the command ended, from its output: see [`last_reason`].
    pub(super) fn reason(&self) -> Option<String> {
        last_reason(&self.lines.lock().unwrap_or_else(PoisonError::into_inner))
    }

    /// Asks the command's whole group to end, kills it after 5 seconds, and waits for its end.
    pub(super) async fn stop(&self) {
        let mut ended = self.ended.clone();
        if ended.borrow().is_some() {
            return;
        }
        signal_group(self.leader, Signal::Terminate);
        let asked = tokio::time::timeout(KILL, ended.wait_for(Option::is_some));
        if asked.await.is_err() {
            signal_group(self.leader, Signal::Kill);
            let _ = ended.wait_for(Option::is_some).await;
        }
    }
}

/// The two tasks that keep a command's output.
type Output = (tokio::task::JoinHandle<()>, tokio::task::JoinHandle<()>);

/// Waits for the command to exit, then ends its group: why it ended. What the command started
/// may outlive it, and keep its output open: its whole group goes as soon as it exits, so its
/// output closes.
async fn end(mut child: Child, leader: u32, output: Output, groups: &Groups) -> String {
    let status = child.wait().await;
    signal_group(leader, Signal::Kill);
    groups.remove(leader);
    let closed = async { (output.0.await, output.1.await) };
    let _ = tokio::time::timeout(OUTPUT, closed).await;
    match status {
        Ok(status) => stopped_by(&status)
            .map(|signal| format!("The command was stopped by signal {signal}."))
            .or_else(|| Some(format!("The command exited with code {}.", status.code()?)))
            .unwrap_or_else(|| "The command ended.".to_owned()),
        Err(error) => error.to_string(),
    }
}

/// The signal that ended a process, if one did.
#[cfg(unix)]
fn stopped_by(status: &std::process::ExitStatus) -> Option<i32> {
    std::os::unix::process::ExitStatusExt::signal(status)
}

#[cfg(not(unix))]
fn stopped_by(_status: &std::process::ExitStatus) -> Option<i32> {
    None
}

/// Keeps a stream's lines, without colour codes, in `lines`, the last `LINES_KEPT` only.
async fn keep_lines(stream: Option<impl AsyncRead + Unpin>, lines: Arc<Mutex<Vec<String>>>) {
    let Some(mut stream) = stream else {
        return;
    };
    let keep = |line: &[u8]| {
        let text = plain(&String::from_utf8_lossy(line));
        let text = text.trim();
        if !text.is_empty() {
            let mut lines = lines.lock().unwrap_or_else(PoisonError::into_inner);
            lines.push(text.to_owned());
            let extra = lines.len().saturating_sub(LINES_KEPT);
            lines.drain(..extra);
        }
    };
    let (mut partial, mut chunk) = (Vec::new(), [0; 4096]);
    while let Ok(read @ 1..) = stream.read(&mut chunk).await {
        partial.extend_from_slice(&chunk[..read]);
        while let Some(end) = partial.iter().position(|byte| b"\r\n".contains(byte)) {
            keep(&partial[..end]);
            partial.drain(..=end);
        }
    }
    keep(&partial);
}

/// A line without its terminal control sequences, as colours.
fn plain(line: &str) -> String {
    let mut text = String::with_capacity(line.len());
    let mut letters = line.chars();
    while let Some(letter) = letters.next() {
        if letter != '\u{1b}' {
            text.push(letter);
            continue;
        }
        match letters.next() {
            // A control sequence ends at its first letter or symbol from `@` to `~`.
            Some('[') => drop(letters.find(|end| ('@'..='~').contains(end))),
            // An operating system command ends at a bell.
            Some(']') => drop(letters.find(|end| *end == '\u{7}')),
            _ => {}
        }
    }
    text
}

/// Why a command ended, from its kept lines: the last one naming an error, as `Error: ..` or
/// `SyntaxError: ..`, else the last one, without the frame Storybook draws before its lines.
/// Storybook's own last line, "Storybook exited with an error", says nothing of why. Nothing
/// when it printed nothing but its frame.
pub(super) fn last_reason(lines: &[String]) -> Option<String> {
    // The frame: box drawing, the shapes marking each line, and blanks.
    let framed =
        |letter: char| ('\u{2500}'..='\u{25ff}').contains(&letter) || letter.is_whitespace();
    let texts = lines.iter().map(|line| line.trim_start_matches(framed));
    let texts: Vec<&str> = texts.filter(|text| !text.is_empty()).collect();
    let names_error = |text: &&&str| {
        let word = text.find(|letter: char| !letter.is_alphanumeric() && letter != '_');
        text[..word.unwrap_or(text.len())].ends_with("Error")
    };
    let reason = texts.iter().rev().find(names_error).or(texts.last());
    reason.map(|text| (*text).to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(text: &[&str]) -> Vec<String> {
        text.iter().map(|line| (*line).to_owned()).collect()
    }

    #[test]
    fn a_commands_reason_is_its_last_error_line_without_storybooks_frame() {
        let storybook = lines(&[
            "│",
            "▲  Failed to load preset: \".storybook/main.ts\"",
            "■  Error: Cannot find module 'storybook'",
            "└  Storybook exited with an error",
        ]);
        let reason = |text: &[String]| last_reason(text);

        assert_eq!(
            reason(&storybook).unwrap(),
            "Error: Cannot find module 'storybook'"
        );
        let typed = lines(&[
            "SyntaxError: Unexpected token",
            "ErrorHandler started",
            "done",
        ]);
        assert_eq!(reason(&typed).unwrap(), "SyntaxError: Unexpected token");
        assert_eq!(
            reason(&lines(&["Port 6006 is not available"])).unwrap(),
            "Port 6006 is not available"
        );
        assert_eq!(reason(&lines(&["│", "└"])), None);
        assert_eq!(plain("\u{1b}[31mError: no\u{1b}[39m"), "Error: no");
    }
}
