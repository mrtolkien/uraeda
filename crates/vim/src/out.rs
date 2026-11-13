//! What one key does to the editor, gathered while the key runs: at most one replacement of the
//! text, and the effects only the caller can carry out.

use crate::Edit;
use crate::text::{Change, Doc, Patched, Pos};

pub(crate) struct Out<'a> {
    /// The text as it is before the key.
    pub doc: Doc<'a>,
    pub change: Option<Change>,
    pub effects: Vec<Edit>,
}

impl<'a> Out<'a> {
    pub fn new(doc: Doc<'a>) -> Out<'a> {
        Out {
            doc,
            change: None,
            effects: Vec::new(),
        }
    }

    /// Replaces what lies from `start` to `end`, places of the text as it is, with `text`. A key
    /// replaces once: what it types after that goes in with `insert`.
    pub fn replace(&mut self, start: Pos, end: Pos, text: impl Into<String>) {
        debug_assert!(self.change.is_none(), "one key replaces the text once");
        self.change = Some(Change {
            start,
            end,
            text: text.into(),
        });
    }

    /// Puts `text` at `at`, a place of the text after the replacement, inside what it put or
    /// where nothing was replaced.
    pub fn insert(&mut self, at: Pos, text: &str) {
        match &mut self.change {
            None => self.replace(at, at, text),
            Some(change) => {
                let offset = offset_in(&change.text, change.start, at);
                change.text.insert_str(offset, text);
            }
        }
    }

    /// The text as it is after the replacement.
    pub fn after(&self) -> After<'_> {
        After {
            patched: self
                .change
                .as_ref()
                .map(|change| Patched::new(self.doc, change)),
            base: self.doc,
        }
    }
}

/// The byte of `text`, put at `start`, that the place `at` falls on.
fn offset_in(text: &str, start: Pos, at: Pos) -> usize {
    let mut offset = 0;
    for _ in start.line..at.line {
        offset += text[offset..]
            .find('\n')
            .map_or(text.len() - offset, |line_break| line_break + 1);
    }
    let col = if at.line == start.line {
        at.col.saturating_sub(start.col)
    } else {
        at.col
    };
    (offset + col).min(text.len())
}

pub(crate) struct After<'a> {
    patched: Option<Patched<'a>>,
    base: Doc<'a>,
}

impl After<'_> {
    pub fn doc(&self) -> Doc<'_> {
        match &self.patched {
            Some(patched) => Doc::new(patched),
            None => self.base,
        }
    }
}
