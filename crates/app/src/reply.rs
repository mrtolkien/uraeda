//! An agent's reply, which is Markdown text and grows by appends, split into blocks in Rust, so
//! TSX never scans it: `ReplySplitter` reads each appended piece once, says which blocks it
//! finished, as the core's document tree, and what the last, growing one holds. A finished block
//! is read by the core's parser, the one that reads workflow files, once.

mod lines;
mod split;
#[cfg(test)]
mod tests;

use nsh_core::prelude::*;

use split::{Growing, Splitter};

/// The core's document tree of `text`, as JSON, in the shape of the protocol's `Document`. Links
/// are read from the repository's top level.
pub(crate) fn tree(text: &str) -> String {
    let document = uraeda_core::files::document::parse(text, "");
    serde_json::to_string(&document).expect("a document is JSON")
}

/// What a piece of a reply changed.
#[derive(Clone, Debug, PartialEq, Eq, JsObject)]
pub struct ReplySplit {
    /// Each block the piece finished, in order: the JSON of the core's document tree of its
    /// text, a `Document`, drawn once.
    pub finished: Vec<String>,
    /// The block still being written, as plain text, or its code while a fence is open.
    pub growing: String,
    /// Whether `growing` is the code of a fence still open.
    pub code: bool,
    /// The open fence's language, or empty.
    pub language: String,
}

/// A streamed reply, split at its blocks' boundaries as it grows: `push` each appended piece, then
/// `end` once the reply is whole. It keeps only the block being written.
#[class]
pub struct ReplySplitter {
    splitter: Splitter,
}

#[class]
impl ReplySplitter {
    /// A splitter for a reply that has no text yet.
    pub fn new() -> Self {
        ReplySplitter {
            splitter: Splitter::default(),
        }
    }

    /// Reads `piece`, the text appended to the reply, and says which blocks it finished, and
    /// what the growing one holds now.
    pub fn push(&mut self, piece: String) -> ReplySplit {
        let finished = self.splitter.push(piece.as_bytes());
        self.split(&finished)
    }

    /// The reply is whole: its last block is finished too, a fence left open included.
    pub fn end(&mut self) -> ReplySplit {
        let finished = self.splitter.end();
        self.split(&finished)
    }
}

impl ReplySplitter {
    fn split(&self, finished: &[String]) -> ReplySplit {
        let finished = finished.iter().map(|text| tree(text)).collect();
        match self.splitter.growing() {
            Growing::Text(growing) => ReplySplit {
                finished,
                growing,
                code: false,
                language: String::new(),
            },
            Growing::Code { language, text } => ReplySplit {
                finished,
                growing: text,
                code: true,
                language,
            },
        }
    }
}

/// Reading Markdown the client holds.
#[module]
pub(crate) struct Markdown;

#[module(flat)]
impl Markdown {
    /// The core's document tree of `text`, as the JSON of a `Document`: for a Markdown text the
    /// client holds whole, as a message once sent. A workflow file's tree comes from the server.
    pub(crate) fn markdown_tree(text: String) -> String {
        tree(&text)
    }
}
