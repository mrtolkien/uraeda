//! What a write's landing says of it in the record, and why one did not land.

use std::path::Path;

use uraeda_core::api::ApiError;
use uraeda_protocol::{ErrorCode, StartStep, WriteFailure};

use super::Queue;
use crate::live::Fault;

/// A write of its own, as it lands: what its landing says of it in the record.
pub(crate) struct Landing<'a> {
    pub(super) queue: &'a Queue,
    pub(super) id: &'a str,
}

impl Landing<'_> {
    /// The repository's main checkout.
    pub(crate) fn path(&self) -> &Path {
        &self.queue.path
    }

    /// Adds a line git or a hook printed to the write's output.
    pub(crate) fn printed(&self, line: &str) {
        self.queue.printed(self.id, line);
    }

    /// Shows a start's steps as they are now.
    pub(crate) fn steps(&self, steps: Vec<StartStep>) {
        self.queue.set_steps(self.id, steps);
    }

    /// Lets the lists' writes stop waiting for this one, which goes on: a start whose commit
    /// landed, as it makes its branch.
    pub(crate) fn free_lists(&self) {
        self.queue.free_lists(self.id);
    }
}

/// Why a write is refused once the server stops.
pub(in crate::records::writing::queue) fn stopped() -> Fault {
    Fault::refused("The server is stopping: nothing is written any more.")
}

/// Why a write did not land, as the record keeps it.
pub(super) struct Refusal {
    pub(super) failure: WriteFailure,
    pub(super) output: String,
}

impl Refusal {
    /// A deferred commit's: only a hook's refusal, which the core undid, is `hook`. Its output
    /// is what failed, then what git and the hooks printed.
    pub(super) fn of_commit(refusal: ApiError) -> Refusal {
        let failure = match refusal.code {
            "hook" => WriteFailure::Hook,
            _ => WriteFailure::Failed,
        };
        let output = match refusal.output.filter(|output| !output.is_empty()) {
            Some(output) => format!("{}\n\n{output}", refusal.message),
            None => refusal.message,
        };
        Refusal { failure, output }
    }

    /// A write of its own's: its fault, whose message is a hook's output for a hook's refusal.
    pub(super) fn of_fault(fault: Fault) -> Refusal {
        let failure = match fault.code() {
            ErrorCode::Hook => WriteFailure::Hook,
            _ => WriteFailure::Failed,
        };
        Refusal {
            failure,
            output: fault.message().to_owned(),
        }
    }
}
