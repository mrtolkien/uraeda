//! The lines of the priorities: their edits, outlines, and drops, each written on the default
//! branch over the priorities read at the input's hash.

use uraeda_core::api::{self, DropAt, undo};
use uraeda_protocol::{
    FileWritten, ListWritten, ProposalsAdd, ProposalsDrop, ProposalsEdit, ProposalsExpand,
    ProposalsMove, ProposalsOutline, ProposalsRemove,
};

use super::lists;
use crate::live::{Call, Fault, Registry};

/// Registers the actions `proposals.*`.
pub(super) fn register(registry: &Registry) {
    registry.action::<ProposalsAdd>(add);
    registry.action::<ProposalsEdit>(edit);
    registry.action::<ProposalsMove>(place);
    registry.action::<ProposalsOutline>(outline);
    registry.action::<ProposalsDrop>(drop);
    registry.action::<ProposalsRemove>(remove);
    registry.action::<ProposalsExpand>(expand);
}

/// The action `proposals.add`: a line at the end of a section.
fn add(call: &Call, input: ProposalsAdd) -> Result<ListWritten, Fault> {
    let write = |repo: &_| api::add_proposal(repo, &input.section, &input.text, &input.hash);
    lists::written(call, &input.repo, undo::PRIORITIES, Box::new(write))
}

/// The action `proposals.edit`: a proposal's text.
fn edit(call: &Call, input: ProposalsEdit) -> Result<ListWritten, Fault> {
    let write = |repo: &_| api::edit_proposal(repo, &input.proposal, &input.text, &input.hash);
    lists::written(call, &input.repo, undo::PRIORITIES, Box::new(write))
}

/// The action `proposals.move`: a proposal before the line at an index of a section.
fn place(call: &Call, input: ProposalsMove) -> Result<ListWritten, Fault> {
    let ProposalsMove {
        proposal,
        section,
        index,
        hash,
        ..
    } = &input;
    let write = |repo: &_| api::move_proposal(repo, proposal, section, *index, hash);
    lists::written(call, &input.repo, undo::PRIORITIES, Box::new(write))
}

/// The action `proposals.outline`: an edit of a proposal's line, or of one of its nested items.
fn outline(call: &Call, input: ProposalsOutline) -> Result<ListWritten, Fault> {
    let ProposalsOutline {
        proposal,
        at,
        kind,
        text,
        hash,
        ..
    } = &input;
    let write = |repo: &_| api::outline_proposal(repo, proposal, *at, kind, text.as_deref(), hash);
    lists::written(call, &input.repo, undo::PRIORITIES, Box::new(write))
}

/// The action `proposals.drop`: what a drag's drop writes.
fn drop(call: &Call, input: ProposalsDrop) -> Result<ListWritten, Fault> {
    let to = DropAt {
        list: input.section.clone(),
        under: input.under.clone(),
        under_at: input.under_at,
        index: input.index,
    };
    let write = |repo: &_| api::drop_proposal(repo, &input.proposal, input.at, &to, &input.hash);
    lists::written(call, &input.repo, undo::PRIORITIES, Box::new(write))
}

/// The action `proposals.remove`: a proposal and its nested lines.
fn remove(call: &Call, input: ProposalsRemove) -> Result<ListWritten, Fault> {
    let write = |repo: &_| api::remove_proposal(repo, &input.proposal, &input.hash);
    lists::written(call, &input.repo, undo::PRIORITIES, Box::new(write))
}

/// The action `proposals.expand`: a proposal becomes a proposal file, which its line links.
fn expand(call: &Call, input: ProposalsExpand) -> Result<FileWritten, Fault> {
    let write = |repo: &_| {
        let file = api::expand_proposal(repo, &input.proposal, &input.hash)?;
        Ok(file.path)
    };
    lists::filed(call, &input.repo, undo::EXPAND, Box::new(write))
}
