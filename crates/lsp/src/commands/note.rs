//! `uraeda.note`: adds a note to the inbox, on the default branch, without committing.

use lsp_server::ResponseError;
use serde::Deserialize;
use uraeda_core::api;
use uraeda_core::files::inbox::Inbox;

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
/// heading has that name, or of the notes without one, in the default branch's `INBOX.md`, from
/// any checkout, and answers with the file to open at the note's line.
pub(super) fn note(documents: &Documents, args: NoteArgs) -> Result<Done, ResponseError> {
    let root = &documents.root;
    let before = core(api::read_inbox(root))?;
    let after = core(api::add_note(
        root,
        args.category,
        None,
        &args.text,
        &before.hash,
    ))?;
    let inbox = absolute(core(api::default_root(root))?.join(INBOX));
    Ok(Done {
        outcome: Outcome {
            opened: Some(inbox.clone()),
            written: vec![inbox],
            line: added_line(&before, &after),
        },
        message: Some("Added to the inbox, not committed".to_string()),
        link: None,
    })
}

/// The first line of the one note `after` holds and `before` does not. The notes before it keep
/// their lines and texts, and every note after it moves down, so it is the first note, in file
/// order, that differs.
fn added_line(before: &Inbox, after: &Inbox) -> Option<u32> {
    let notes = |inbox: &Inbox| {
        let mut notes: Vec<(u32, Vec<String>)> = inbox
            .categories
            .iter()
            .flat_map(|category| &category.notes)
            .map(|note| (note.start_line, note.lines.clone()))
            .collect();
        notes.sort();
        notes
    };
    let before = notes(before);
    notes(after)
        .into_iter()
        .enumerate()
        .find(|(index, note)| before.get(*index) != Some(note))
        .map(|(_, (line, _))| line)
}
