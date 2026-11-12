//! What Uraeda reads in a text alone, with no file system and no git: a Markdown file's document
//! tree, the parts of it the workflow relies on, where its links point, and its story links.
//!
//! The core holds it at the paths it always had, `uraeda_core::files::{document, markdown,
//! stories}` and `uraeda_core::workspace::resolve`. It is a crate of its own for the app's native
//! module, which reads a reply's blocks and a file's outline with it in a browser too: the core
//! holds git and image code that does not build for WebAssembly.

pub mod document;
pub mod links;
pub mod markdown;
pub mod stories;
