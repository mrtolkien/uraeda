//! `uraeda.draft`: drafts a priorities entry, on the default branch.

use lsp_server::ResponseError;
use lsp_types::Uri;
use serde::Deserialize;
use uraeda_core::api;
use uraeda_core::files::document::hash;
use uraeda_core::files::priorities;

use super::{NOT_AN_ENTRY, Outcome, absolute, core, priorities_path, relative};
use crate::documents::Documents;
use crate::requests::refused;

#[derive(Deserialize)]
pub(super) struct DraftArgs {
    uri: Uri,
    /// 1-based.
    line: u32,
}

/// `uraeda.draft { uri, line }`: drafts the priorities entry whose lines hold `line`, over the open
/// text, or opens the draft it already links.
pub(super) fn draft(documents: &Documents, args: DraftArgs) -> Result<Outcome, ResponseError> {
    let root = &documents.root;
    if relative(documents, &args.uri).as_deref() != Some(priorities_path()) {
        return Err(refused(NOT_AN_ENTRY));
    }
    let text = documents
        .read(&root.join(priorities_path()))
        .ok_or_else(|| refused(NOT_AN_ENTRY))?;
    core(api::on_default_branch(root, priorities_path(), &text))?;
    let entry = priorities::read(&text, None)
        .sections
        .into_iter()
        .flat_map(|section| section.entries)
        .find(|entry| {
            // The entry's own lines: its first, and those its text wraps on, not its sub-items.
            let lines = (entry.lines.len() - entry.nested.len()) as u32;
            (entry.start_line..entry.start_line + lines).contains(&args.line)
        })
        .ok_or_else(|| refused(NOT_AN_ENTRY))?;
    let linked = core(api::priority_links(root, &text))?
        .into_iter()
        .find(|link| link.line == entry.start_line)
        .and_then(|link| link.draft);
    let default = core(api::default_root(root))?;
    if let Some(linked) = linked {
        return Ok(Outcome {
            opened: Some(absolute(default.join(linked))),
            written: Vec::new(),
        });
    }
    let drafted = core(api::create_draft(root, &entry.id, &hash(&text)))?;
    let opened = absolute(default.join(&drafted.path));
    Ok(Outcome {
        opened: Some(opened.clone()),
        written: vec![opened, absolute(default.join(priorities_path()))],
    })
}
