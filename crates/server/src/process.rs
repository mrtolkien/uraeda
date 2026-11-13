//! The processes the server starts, and their groups: the one home of the rule that a command,
//! a preview's or an agent's, leads a process group of its own and is signalled with it.
//!
//! A process the server runs starts from `shared.environment().command(..)`, takes
//! [`lead_group`] before it is spawned, and is ended with [`signal_group`]: what it started ends
//! with it. In a group of its own, the terminal's Ctrl-C no longer reaches it, so what started
//! it registers its stop with `shared.on_stop(..)`. A short command, whose output is all the
//! server reads, runs through [`output`].

use std::io;
use std::process::{Command, Output, Stdio};
use std::time::Duration;

/// What a group is sent.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Signal {
    /// Interrupts them, as Ctrl-C does: `SIGINT`.
    Interrupt,
    /// Asks the processes to end: `SIGTERM`.
    Terminate,
    /// Ends them: `SIGKILL`.
    Kill,
}

impl Signal {
    /// The signal's name, as the adapter of an extension's runtime takes it: `SIGTERM`.
    pub fn name(self) -> &'static str {
        match self {
            Signal::Interrupt => "SIGINT",
            Signal::Terminate => "SIGTERM",
            Signal::Kill => "SIGKILL",
        }
    }
}

/// Makes the command lead a process group of its own once it starts, which [`signal_group`]
/// reaches whole.
#[cfg(unix)]
pub(crate) fn lead_group(command: &mut Command) {
    std::os::unix::process::CommandExt::process_group(command, 0);
}

/// Without unix there is no process group: the command is signalled alone.
#[cfg(not(unix))]
pub(crate) fn lead_group(_command: &mut Command) {}

/// Sends a signal to the process group led by `leader`: the command, and everything it started.
/// Nothing happens when the group is gone.
#[cfg(unix)]
pub(crate) fn signal_group(leader: u32, signal: Signal) {
    let Ok(group) = libc::pid_t::try_from(leader) else {
        return;
    };
    let signal = match signal {
        Signal::Interrupt => libc::SIGINT,
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
pub(crate) fn signal_group(_leader: u32, _signal: Signal) {}

/// Runs a short command to its end, leading a group of its own, and gathers what it printed:
/// none when it is not done within `within`. Its stdin is empty. Its whole group is killed as it
/// ends, as the wait times out, and as the wait is dropped, as when the server stops: what the
/// command started never outlives it.
pub(crate) async fn output(mut command: Command, within: Duration) -> Option<io::Result<Output>> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    lead_group(&mut command);
    let mut command = tokio::process::Command::from(command);
    let child = match command.kill_on_drop(true).spawn() {
        Ok(child) => child,
        Err(error) => return Some(Err(error)),
    };
    let _group = child.id().map(Group);
    tokio::time::timeout(within, child.wait_with_output())
        .await
        .ok()
}

/// A process group, killed when this is dropped.
struct Group(u32);

impl Drop for Group {
    fn drop(&mut self) {
        signal_group(self.0, Signal::Kill);
    }
}

#[cfg(all(test, unix))]
mod tests {
    use std::time::{Duration, Instant};

    use super::*;

    /// Whether a process runs: gone, or a zombie no one reaped yet, is not running.
    fn runs(pid: &str) -> bool {
        let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).unwrap_or_default();
        let state = stat.rsplit_once(") ").map(|(_, rest)| rest);
        state.is_some_and(|state| !state.starts_with('Z'))
    }

    /// Waits until `done` holds, for 10 seconds at most.
    async fn until(done: impl Fn() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(10);
        while !done() && Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    }

    // Breaks if `output` kills only the command, as `kill_on_drop` alone does: the `sleep` it
    // started in the background lives on.
    #[tokio::test]
    async fn a_short_command_dropped_ends_with_what_it_started() {
        let folder = tempfile::tempdir().unwrap();
        let file = folder.path().join("pid");
        let mut command = Command::new("sh");
        let script = format!("sleep 60 & echo $! > {}; wait", file.display());
        command.args(["-c", &script]);
        let waited = tokio::spawn(output(command, Duration::from_secs(60)));
        until(|| std::fs::read_to_string(&file).is_ok_and(|pid| pid.ends_with('\n'))).await;
        let pid = std::fs::read_to_string(&file).unwrap();
        assert!(runs(pid.trim()), "the background process started");
        waited.abort();
        let _ = waited.await;
        until(|| !runs(pid.trim())).await;
        assert!(
            !runs(pid.trim()),
            "the command's background process was killed"
        );
    }
}
