//! The priorities: `PRIORITIES.md` read for editing, and the commit bar's Commit and Discard.

use uraeda_core::api;
use uraeda_protocol::{
    ListWritten, Priorities, PrioritiesCommit, PrioritiesDiscard, RepositoryArgs,
};

use super::{lists, views};
use crate::live::{Call, Fault, Registry};
use crate::records::repositories;
use crate::shared::Shared;

/// Registers the record `Priorities` and the two actions on the whole file.
pub(super) fn register(registry: &Registry) {
    registry.record::<Priorities>(read);
    registry.action::<PrioritiesCommit>(commit);
    registry.action::<PrioritiesDiscard>(discard);
}

/// The value of the record `Priorities`.
fn read(shared: &Shared, args: RepositoryArgs) -> Result<Priorities, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    views::sent(&api::read_priorities(&repository.path)?)
}

/// The action `priorities.commit`: commits the priorities alone.
fn commit(call: &Call, input: PrioritiesCommit) -> Result<ListWritten, Fault> {
    lists::plain(call, &input.repo, Box::new(api::commit_priorities))
}

/// The action `priorities.discard`: restores the committed priorities.
fn discard(call: &Call, input: PrioritiesDiscard) -> Result<ListWritten, Fault> {
    lists::plain(call, &input.repo, Box::new(api::discard_priorities))
}
