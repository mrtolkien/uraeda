//! What the editors of whole files ask of Rust, so their TSX parses nothing: the conflicts git
//! wrote into a file, each block with its two sides, and a block replaced by the side taken; the
//! patch between the text typed and the file on disk; and a Markdown file's outline.
//!
//! A conflict's block runs from its `<<<<<<< ` line to its `>>>>>>> ` line, its two sides between,
//! the base section `diff3` adds after `||||||| ` dropped. A side's own line that looks like a
//! marker is taken for one, as git's markers cannot tell them apart: a quoted `<<<<<<< ` line opens
//! the block at it, and a Markdown heading's `=======` underline in the first side parts the sides
//! there. The text stays editable for those, as the React UI's `conflicts.ts` had it.

#[cfg(test)]
mod tests;

use nsh_core::prelude::*;
use uraeda_core::files::document::{self, BlockKind};

/// A conflict's block, as the editor's bar names it.
#[derive(Clone, Debug, Default, PartialEq, Eq, JsObject)]
pub struct ConflictBlock {
    /// The line of its `<<<<<<< ` marker, from 0.
    pub line: u32,
    /// The lines of git's stage 2, `ours`.
    pub ours: u32,
    /// The lines of git's stage 3, `theirs`.
    pub theirs: u32,
}

/// A heading of a Markdown file, as its outline lists it.
#[derive(Clone, Debug, Default, PartialEq, Eq, JsObject)]
pub struct OutlineHeading {
    /// From 1, `#`, to 6.
    pub level: u32,
    /// Its words, without their marks.
    pub title: String,
    /// Its line, from 0.
    pub line: u32,
}

/// The editors' parsing: conflicts, patches, and outlines.
#[module]
pub(crate) struct Editing;

#[module(flat)]
impl Editing {
    /// The conflicts git wrote into `text`, in order: none when it has no complete block.
    pub(crate) fn conflict_blocks(text: String) -> Vec<ConflictBlock> {
        blocks(&text)
            .iter()
            .map(|block| ConflictBlock {
                line: count(block.open),
                ours: count(block.base.unwrap_or(block.middle) - block.open - 1),
                theirs: count(block.close - block.middle - 1),
            })
            .collect()
    }

    /// `text` with its `index`th conflict replaced by `side`, `ours`, `theirs`, or `both`, ours
    /// first, its line endings kept: `text` itself when there is no such block or side.
    pub(crate) fn take_conflict(text: String, index: u32, side: String) -> String {
        take(&text, index as usize, &side).unwrap_or(text)
    }

    /// The unified patch from `before` to `after`, the file at `path`: `Diff` draws it.
    pub(crate) fn text_patch(path: String, before: String, after: String) -> String {
        uraeda_core::git::text_patch(&path, &before, &after)
    }

    /// The headings of the Markdown text `text`, in order, as the document's reader finds them:
    /// none in a code block or in the frontmatter.
    pub(crate) fn outline(text: String) -> Vec<OutlineHeading> {
        document::parse(&text, "")
            .blocks
            .into_iter()
            .filter(|block| block.kind == BlockKind::Heading)
            .map(|block| OutlineHeading {
                level: block.level.unwrap_or(1),
                title: block.spans.iter().map(|span| span.text.as_str()).collect(),
                // The reader counts lines from 1.
                line: block.start_line.saturating_sub(1),
            })
            .collect()
    }
}

/// A line count or index as TSX reads it: a file has fewer than four billion lines.
fn count(lines: usize) -> u32 {
    u32::try_from(lines).unwrap_or(u32::MAX)
}

/// A block, by the indexes of its lines: its opening marker, the one that parts its sides, the
/// base's marker if any, and its closing one.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Block {
    open: usize,
    base: Option<usize>,
    middle: usize,
    close: usize,
}

/// The lines of `text`, each with its line break.
fn lines(text: &str) -> Vec<&str> {
    text.split_inclusive('\n').collect()
}

/// A line's content, without its line break.
fn content(line: &str) -> &str {
    line.trim_end_matches('\n').trim_end_matches('\r')
}

/// Whether `line` is the marker `mark`, seven of one character, alone or before a space.
fn is_marker(line: &str, mark: &str) -> bool {
    let line = content(line);
    line == mark
        || line
            .strip_prefix(mark)
            .is_some_and(|rest| rest.starts_with(' '))
}

/// The complete blocks of `text`, in order.
fn blocks(text: &str) -> Vec<Block> {
    let all = lines(text);
    let mut found = Vec::new();
    let mut at = 0;
    while at < all.len() {
        match is_marker(all[at], "<<<<<<<")
            .then(|| block_at(&all, at))
            .flatten()
        {
            Some(block) => {
                at = block.close + 1;
                found.push(block);
            }
            None => at += 1,
        }
    }
    found
}

/// The block opened at line `open`, or none when another opens or none closes before the end.
fn block_at(all: &[&str], open: usize) -> Option<Block> {
    let (mut base, mut middle) = (None, None);
    for (at, line) in all.iter().enumerate().skip(open + 1) {
        if is_marker(line, "<<<<<<<") {
            return None;
        }
        match middle {
            None if base.is_none() && is_marker(line, "|||||||") => base = Some(at),
            None if content(line) == "=======" => middle = Some(at),
            Some(middle) if is_marker(line, ">>>>>>>") => {
                return Some(Block {
                    open,
                    base,
                    middle,
                    close: at,
                });
            }
            _ => {}
        }
    }
    None
}

/// `text` with block `index` replaced by `side`, or none when there is no such block or side.
fn take(text: &str, index: usize, side: &str) -> Option<String> {
    let all = lines(text);
    let block = *blocks(text).get(index)?;
    let ours = all[block.open + 1..block.base.unwrap_or(block.middle)].concat();
    let theirs = all[block.middle + 1..block.close].concat();
    let mut taken = match side {
        "ours" => ours,
        "theirs" => theirs,
        "both" => ours + &theirs,
        _ => return None,
    };
    let after = all[block.close + 1..].concat();
    // A block that ends the file without a line break leaves none after the side taken.
    if after.is_empty() && !text.ends_with('\n') {
        let kept = taken.trim_end_matches('\n').trim_end_matches('\r').len();
        taken.truncate(kept);
    }
    Some(all[..block.open].concat() + &taken + &after)
}
