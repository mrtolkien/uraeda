//! `uraeda.expand`: expands a proposal of the priorities into a file, on the default branch.

use lsp_server::ResponseError;
use lsp_types::Uri;
use serde::Deserialize;
use uraeda_core::api;
use uraeda_core::files::document::hash;
use uraeda_core::files::priorities;

use super::{NOT_A_PROPOSAL, Outcome, absolute, core, priorities_path, relative};
use crate::documents::Documents;
use crate::requests::refused;

#[derive(Deserialize)]
pub(super) struct ExpandArgs {
    uri: Uri,
    /// 1-based.
    line: u32,
}

/// `uraeda.expand { uri, line }`: expands the proposal whose lines hold `line` into a file, over
/// the open text, or opens the proposal file it already links.
pub(super) fn expand(documents: &Documents, args: ExpandArgs) -> Result<Outcome, ResponseError> {
    let root = &documents.root;
    if relative(documents, &args.uri).as_deref() != Some(priorities_path()) {
        return Err(refused(NOT_A_PROPOSAL));
    }
    let text = documents
        .read(&root.join(priorities_path()))
        .ok_or_else(|| refused(NOT_A_PROPOSAL))?;
    core(api::on_default_branch(root, priorities_path(), &text))?;
    let proposal = priorities::read(&text, None)
        .sections
        .into_iter()
        .flat_map(|section| section.proposals)
        .find(|proposal| {
            // The proposal's own lines: its first, and those its text wraps on, not its sub-items.
            let lines = (proposal.lines.len() - proposal.nested.len()) as u32;
            (proposal.start_line..proposal.start_line + lines).contains(&args.line)
        })
        .ok_or_else(|| refused(NOT_A_PROPOSAL))?;
    let linked = core(api::proposal_links(root, &text))?
        .into_iter()
        .find(|link| link.line == proposal.start_line)
        .and_then(|link| link.file);
    let default = core(api::default_root(root))?;
    if let Some(linked) = linked {
        return Ok(Outcome {
            opened: Some(absolute(default.join(linked))),
            written: Vec::new(),
            line: None,
        });
    }
    let expanded = core(api::expand_proposal(root, &proposal.id, &hash(&text)))?;
    let opened = absolute(default.join(&expanded.path));
    Ok(Outcome {
        opened: Some(opened.clone()),
        written: vec![opened, absolute(default.join(priorities_path()))],
        line: None,
    })
}
