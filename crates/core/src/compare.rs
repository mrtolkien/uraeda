//! Two versions of a markdown file compared part by part. Each version is cut into parts, each a
//! paragraph, list item at any depth, table row, code block, or quoted paragraph, with its lines
//! joined, so a rewrap is no change. Two parts are the same part when they sit in the same `##`
//! section and keep at least 60% of the shorter one's words: they compare word by word. Otherwise,
//! one is new and the other removed. A decision's change and a spec's change since its review both
//! read it.

mod matching;
mod parts;

pub use matching::Run;
pub(crate) use matching::{diff, matched, section_titles};
pub(crate) use parts::{Part, Version, version};
