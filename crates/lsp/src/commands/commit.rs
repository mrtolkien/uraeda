//! `uraeda.commit`: commits a file written on the default branch, or a proposal.

use lsp_server::ResponseError;
use uraeda_core::api;
use uraeda_core::target;
use uraeda_core::workspace::FileKind;

use super::note::INBOX;
use super::{FileArgs, Outcome, core, on_default_branch, priorities_path, relative};
use crate::documents::Documents;
use crate::requests::{refused, workflow_file};

/// `uraeda.commit { uri }`: commits a draft, a backlog file, or a proposal, with the priorities
/// when they changed, or `PRIORITIES.md` or `INBOX.md` with the change list of both, as the
/// commit bar does.
pub(super) fn commit(documents: &Documents, args: FileArgs) -> Result<Outcome, ResponseError> {
    const ONLY: &str = "Only drafts, backlog files, proposals, PRIORITIES.md, and INBOX.md are committed from the editor.";
    let root = &documents.root;
    let path = relative(documents, &args.uri).ok_or_else(|| refused(ONLY))?;
    if path == priorities_path() || path == INBOX {
        on_default_branch(documents, &path)?;
        core(api::commit_changes(root))?;
    } else if target::is_draft(&path) {
        on_default_branch(documents, &path)?;
        core(api::commit_text(root, &path))?;
    } else if workflow_file(documents, &args.uri)
        .is_some_and(|file| file.kind == FileKind::Proposal)
    {
        core(api::commit_text(root, &path))?;
    } else {
        return Err(refused(ONLY));
    }
    Ok(Outcome::default())
}
