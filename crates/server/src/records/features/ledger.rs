//! The ledger, the constitution and the decisions of the default branch, and a feature's
//! history, read from git.

use uraeda_core::actions::default_round::DefaultRound;
use uraeda_core::api;
use uraeda_protocol::{History, HistoryView, ItemArgs, Ledger, RepositoryArgs};

use super::views;
use crate::live::{Fault, Registry};
use crate::records::repositories;
use crate::shared::Shared;

/// Registers the records `Ledger` and `History`.
pub(super) fn register(registry: &Registry) {
    registry.record::<Ledger>(ledger);
    registry.record::<History>(history);
}

/// The value of the record `Ledger`, with the status of the decisions check, which its page's
/// "Check decisions" reads.
fn ledger(shared: &Shared, args: RepositoryArgs) -> Result<Ledger, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    let read = api::read_ledger(&repository.path)?;
    let check = api::read_round(&repository.path, DefaultRound::DecisionsCheck)?;
    Ok(Ledger {
        constitution: views::sent(&read.constitution)?,
        decisions: views::sent(&read.decisions)?,
        problems: views::sent(&read.problems)?,
        decisions_check: check.and_then(|file| file.status),
    })
}

/// The value of the record `History`, by the feature's folder.
fn history(shared: &Shared, args: ItemArgs) -> Result<HistoryView, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    views::sent(&api::read_history(&repository.path, &args.id)?)
}
