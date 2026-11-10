//! A feature's workflow files and the default branch's rounds, with the core's document tree as
//! it is; a proposal file in its editor; the proposal template's guidance; and a decision as a
//! feature's branch has it.

use uraeda_core::actions::default_round::DefaultRound;
use uraeda_core::api;
use uraeda_protocol::{
    BranchDecision, FileView, ItemArgs, ProposalFile, ProposalFileView, ProposalHints, WorkflowFile,
};

use super::{repository, views};
use crate::live::{Fault, Registry};
use crate::shared::Shared;

/// Registers the records `WorkflowFile`, `ProposalFile`, `ProposalHints`, and `BranchDecision`.
pub(super) fn register(registry: &Registry) {
    registry.record::<WorkflowFile>(file);
    registry.record::<ProposalFile>(proposal_file);
    registry.record::<ProposalHints>(|_, ()| {
        let hints = views::sent(&api::proposal_hints()?)?;
        Ok(ProposalHints { hints })
    });
    registry.record::<BranchDecision>(decision);
}

/// The two parts of an id `<folder>/<name>`: an id without a `/` names a folder alone.
fn parts(id: &str) -> (&str, &str) {
    id.split_once('/').unwrap_or((id, ""))
}

/// The value of the record `WorkflowFile`: a round of the default branch by its id, or a
/// feature's file by `<folder>/<name>`. None for a file that is not there.
fn file(shared: &Shared, args: ItemArgs) -> Result<Option<FileView>, Fault> {
    let repository = repository::find(shared, &args.repo)?;
    let read = match DefaultRound::from_id(&args.id) {
        // A round on the default branch has no feature: none until an agent writes it.
        Some(round) => api::read_round(&repository.path, round)?,
        None => {
            let (folder, name) = parts(&args.id);
            views::found(api::read_file(&repository.path, folder, name))?
        }
    };
    read.as_ref().map(views::sent).transpose()
}

/// The value of the record `ProposalFile`, by the file's path from the top level.
fn proposal_file(shared: &Shared, args: ItemArgs) -> Result<ProposalFileView, Fault> {
    let repository = repository::find(shared, &args.repo)?;
    views::sent(&api::read_text(&repository.path, &args.id)?)
}

/// The value of the record `BranchDecision`, by `<folder>/<name>`: none for a decision the
/// branch does not have, and for a folder that is no feature's.
fn decision(shared: &Shared, args: ItemArgs) -> Result<Option<BranchDecision>, Fault> {
    let repository = repository::find(shared, &args.repo)?;
    let (folder, name) = parts(&args.id);
    let read = views::found(api::read_decision(&repository.path, folder, name))?;
    read.as_ref().map(views::sent).transpose()
}
