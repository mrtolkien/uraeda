//! A note of the inbox as a typed change's text and images.

use std::fs;
use std::path::Path;

use uraeda_core::api;
use uraeda_core::files::document::{Block, BlockKind};
use uraeda_core::files::inbox::InboxNote;

use crate::live::Fault;

/// A note as a change starts from it.
pub(super) struct NoteChange {
    /// The change's text: its first line is its title.
    pub text: String,
    /// The bytes of the images its note file links.
    pub images: Vec<Vec<u8>>,
}

/// A note as a typed change's text and images, over the inbox read at `hash`: its text, or for
/// a note with a note file its title and the file's body, then its nested lines, and the bytes
/// of the images its note file links. Read before the note leaves the inbox, which takes its
/// note file with it.
///
/// # Errors
///
/// `conflict` when the inbox changed since it was read, and `refused` for a note it lacks.
pub(super) fn as_change(root: &Path, id: &str, hash: &str) -> Result<NoteChange, Fault> {
    let inbox = api::read_inbox(root)?;
    if inbox.hash != hash {
        return Err(Fault::conflict(
            "INBOX.md changed on disk. Your change was not applied.",
        ));
    }
    let mut notes = inbox.categories.iter().flat_map(|category| &category.notes);
    let note = notes.find(|note| note.id == id);
    let note = note.ok_or_else(|| Fault::refused(format!("no note {id}")))?;
    let parts = [title(root, note)?, note.nested.join("\n")];
    let written: Vec<_> = parts
        .iter()
        .filter(|part| !part.is_empty())
        .cloned()
        .collect();
    // An image whose file is gone is left out: the change starts with the others.
    let images = note
        .images
        .iter()
        .filter_map(|path| fs::read(root.join(path)).ok());
    Ok(NoteChange {
        text: written.join("\n\n"),
        images: images.collect(),
    })
}

/// The start of a note's text: the note's own, or for a note with a note file, the file's title
/// and its body.
fn title(root: &Path, note: &InboxNote) -> Result<String, Fault> {
    let Some(file) = &note.file else {
        return Ok(note.text.clone());
    };
    let title = note.file_title.clone().unwrap_or_else(|| note.text.clone());
    let body = file_body(root, file)?;
    let parts = [title, body];
    let written: Vec<_> = parts
        .iter()
        .filter(|part| !part.is_empty())
        .cloned()
        .collect();
    Ok(written.join("\n\n"))
}

/// The body of a note file as a typed change's text holds it: the file as it is on disk, without
/// its title, which the change takes from the note, nor its paragraphs of images alone, which
/// the core links again as it writes the change's images. Cut by the core's document tree, not
/// by a pattern.
fn file_body(root: &Path, path: &str) -> Result<String, Fault> {
    let read = api::read_text(root, path)?;
    let cut: Vec<&Block> = read
        .document
        .blocks
        .iter()
        .filter(|block| left_out(block))
        .collect();
    // The document's lines count from 1, both ends included.
    let kept = read.text.split('\n').zip(1u32..).filter(|(_, line)| {
        !cut.iter()
            .any(|block| (block.start_line..=block.end_line).contains(line))
    });
    let lines: Vec<&str> = kept.map(|(text, _)| text).collect();
    Ok(without_blank_runs(&lines.join("\n")))
}

/// Whether a top-level block of a note file is left out of a change's text: its title, and a
/// paragraph of images alone.
fn left_out(block: &Block) -> bool {
    let images_alone = || {
        let blank = |text: &str| text.trim().is_empty();
        block
            .spans
            .iter()
            .all(|span| span.image.is_some() || blank(&span.text))
    };
    block.parent.is_none()
        && match block.kind {
            BlockKind::Heading => block.level == Some(1),
            BlockKind::Paragraph => images_alone(),
            _ => false,
        }
}

/// A text with each run of blank lines made one, and none at its ends.
fn without_blank_runs(text: &str) -> String {
    let mut lines: Vec<&str> = Vec::new();
    for line in text.trim().split('\n') {
        let blank = line.trim().is_empty();
        if !(blank && lines.last().is_some_and(|last| last.trim().is_empty())) {
            lines.push(line);
        }
    }
    lines.join("\n")
}
