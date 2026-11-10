//! A note's moves out of the inbox: into the priorities, as a line, a nested line, or a proposal
//! file, and into a proposal file. And an image taken out of a note's file.

use uraeda_core::api::{self, undo as scopes};
use uraeda_protocol::{
    FileWritten, InboxIntoProposal, InboxIntoProposalLine, InboxRemoveImage, InboxToProposal,
    InboxToProposalFile, InboxUnderProposal, ListWritten, NoteMoved,
};

use super::{changed, lists, turn, undo};
use crate::live::{Call, Fault, Registry};
use crate::records::repositories;

/// Registers the actions that move a note out of the inbox.
pub(super) fn register(registry: &Registry) {
    registry.action::<InboxToProposal>(to_proposal);
    registry.action::<InboxUnderProposal>(under_proposal);
    registry.action::<InboxToProposalFile>(to_proposal_file);
    registry.action::<InboxIntoProposal>(into_proposal);
    registry.action::<InboxIntoProposalLine>(into_proposal_line);
    registry.action::<InboxRemoveImage>(remove_image);
}

/// The action `inbox.toProposal`: a note to the end of a section, as a line.
fn to_proposal(call: &Call, input: InboxToProposal) -> Result<NoteMoved, Fault> {
    let InboxToProposal {
        note,
        section,
        hash,
        priorities_hash,
        ..
    } = &input;
    let write = |repo: &_| api::note_to_proposal(repo, note, section, hash, priorities_hash);
    lists::moved(
        call,
        &input.repo,
        scopes::RELINKING_PROMOTION,
        Box::new(write),
    )
}

/// The action `inbox.underProposal`: a note under a proposal, as a nested line.
fn under_proposal(call: &Call, input: InboxUnderProposal) -> Result<NoteMoved, Fault> {
    let InboxUnderProposal {
        note,
        proposal,
        hash,
        priorities_hash,
        ..
    } = &input;
    let write = |repo: &_| api::note_under_proposal(repo, note, proposal, hash, priorities_hash);
    lists::moved(call, &input.repo, scopes::PROMOTION, Box::new(write))
}

/// The action `inbox.toProposalFile`: a note to the end of a section, as a proposal file.
fn to_proposal_file(call: &Call, input: InboxToProposalFile) -> Result<FileWritten, Fault> {
    let InboxToProposalFile {
        note,
        section,
        hash,
        priorities_hash,
        ..
    } = &input;
    let write = |repo: &_| api::note_to_proposal_file(repo, note, section, hash, priorities_hash);
    lists::filed(
        call,
        &input.repo,
        scopes::RELINKING_PROMOTION,
        Box::new(write),
    )
}

/// The action `inbox.intoProposal`: a note into a proposal file, which moves when it becomes a
/// folder for the note's images.
fn into_proposal(call: &Call, input: InboxIntoProposal) -> Result<FileWritten, Fault> {
    let write = |repo: &_| api::note_into_proposal(repo, &input.note, &input.file, &input.hash);
    lists::filed(
        call,
        &input.repo,
        scopes::RELINKING_PROMOTION,
        Box::new(write),
    )
}

/// The action `inbox.intoProposalLine`: a note with a note file into a line of the priorities,
/// which gets its proposal file first.
fn into_proposal_line(call: &Call, input: InboxIntoProposalLine) -> Result<FileWritten, Fault> {
    let InboxIntoProposalLine {
        note,
        proposal,
        hash,
        priorities_hash,
        ..
    } = &input;
    let write =
        |repo: &_| api::note_into_proposal_line(repo, note, proposal, hash, priorities_hash);
    lists::filed(
        call,
        &input.repo,
        scopes::RELINKING_PROMOTION,
        Box::new(write),
    )
}

/// The action `inbox.removeImage`: the lines linking an image leave a note file or a proposal
/// file. The image is kept with the change: the next commit deletes it unlinked, and the undo
/// writes it back.
fn remove_image(call: &Call, input: InboxRemoveImage) -> Result<ListWritten, Fault> {
    let repository = repositories::find(call.shared(), &input.repo)?;
    let root = &repository.path;
    let scope = scopes::note_image(&input.file);
    let kept = [input.image.clone()];
    // JOIN(wave 6): write queue
    let (inbox, change) = turn::in_turn(call.shared(), root, || {
        undo::recorded_keeping(root, &scope, &kept, || {
            api::remove_note_image(root, &input.file, &input.image, &input.hash)
        })
    })?;
    changed::lists(call.bus(), &input.repo);
    changed::proposal_file(call.bus(), &input.repo, &input.file);
    Ok(ListWritten {
        hash: inbox.hash,
        change,
    })
}
