//! The command of a session's process, from before it started: Codex's catalog is read first,
//! so what is written or signalled meanwhile waits for the command.

use std::sync::Arc;

use serde_json::Value;

use crate::runtimes::{Child, Signal};

/// The process's command: what is written or signalled before it started waits for it.
pub(super) enum Wire {
    Starting {
        lines: Vec<Value>,
        signals: Vec<Signal>,
        ended: bool,
    },
    Running(Arc<Child>),
}

impl Wire {
    pub(super) fn write(&mut self, line: Value) {
        match self {
            Wire::Starting { lines, .. } => lines.push(line),
            Wire::Running(child) => child.write(&line),
        }
    }

    pub(super) fn signal(&mut self, signal: Signal) {
        match self {
            Wire::Starting { signals, .. } => signals.push(signal),
            Wire::Running(child) => child.signal(signal),
        }
    }

    pub(super) fn end_input(&mut self) {
        match self {
            Wire::Starting { ended, .. } => *ended = true,
            Wire::Running(child) => child.end_input(),
        }
    }

    /// The command started: it gets what waited for it.
    pub(super) fn start(&mut self, child: Arc<Child>) {
        let waiting = std::mem::replace(self, Wire::Running(child.clone()));
        let Wire::Starting {
            lines,
            signals,
            ended,
        } = waiting
        else {
            return;
        };
        for line in lines {
            child.write(&line);
        }
        if ended {
            child.end_input();
        }
        for signal in signals {
            child.signal(signal);
        }
    }
}
