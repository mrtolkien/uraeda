//! The processes the server starts, and their groups: the one home of the rule that a command,
//! a preview's or an agent's, leads a process group of its own and is signalled with it.
//!
//! A process the server runs starts from `shared.environment().command(..)`, takes
//! [`lead_group`] before it is spawned, and is ended with [`signal_group`]: what it started ends
//! with it. In a group of its own, the terminal's Ctrl-C no longer reaches it, so what started
//! it registers its stop with `shared.on_stop(..)`.

use std::process::Command;

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
