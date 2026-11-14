//! What Uraeda reads in a text alone, with no file system and no git: a Markdown file's document
//! tree, the parts of it the workflow relies on, where its links point, its story links, and the
//! patch between two texts.
//!
//! The core holds it at the paths it always had, `uraeda_core::files::{document, markdown,
//! stories}`, `uraeda_core::workspace::resolve`, and `uraeda_core::git::text_patch`; `ura serve`'s
//! pages draw a file with it.

pub mod document;
pub mod links;
pub mod markdown;
pub mod patch;
pub mod stories;
