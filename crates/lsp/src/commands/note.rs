//! `uraeda.note`: adds a note to the inbox, on the default branch, without committing.

use lsp_server::ResponseError;
use serde::Deserialize;
use uraeda_core::api;

use super::{Done, Outcome, absolute, core};
use crate::documents::Documents;

/// The inbox, from the root.
pub(super) const INBOX: &str = "specs/INBOX.md";

#[derive(Deserialize)]
pub(super) struct NoteArgs {
    text: String,
    category: Option<String>,
}

/// `uraeda.note { text, category? }`: adds the note at the end of `category`, created when no
/// heading has that name, or of the notes without one, in the default branch's `INBOX.md` as it
/// is, from any checkout, and answers with the file to open at the line the core put the note on.
pub(super) fn note(documents: &Documents, args: NoteArgs) -> Result<Done, ResponseError> {
    let root = &documents.root;
    let (_, line) = core(api::add_note_at(root, args.category, None, &args.text))?;
    let inbox = absolute(core(api::default_root(root))?.join(INBOX));
    Ok(Done {
        outcome: Outcome {
            opened: Some(inbox.clone()),
            written: vec![inbox],
            line: Some(line),
        },
        message: Some("Added to the inbox, not committed".to_string()),
        link: None,
    })
}
