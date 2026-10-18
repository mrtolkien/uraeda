//! A spec's own rules: its edge cases' importance, at any status, and, while it waits for the
//! human, the length of its reviewed part and the items of its block, as warnings.

use std::collections::HashSet;

use super::File;
use super::writing::{check_block_items, is_word};
use crate::files::document::Span;
use crate::files::document::{Block, BlockKind, Document, parse};
use crate::files::items::SpecItems;
use crate::files::spec::items;
use crate::workspace::Problem;

/// The most words a waiting spec's reviewed part holds before `spec.length` warns.
pub const SPEC_WORDS: usize = 2_500;

/// The importances an edge case may have, compared lowercased.
const IMPORTANCES: [&str; 3] = ["high", "normal", "niche"];

/// The words of a spec's reviewed part: every heading, paragraph, item, and cell after the title,
/// tables included, without the block, code, the stories' "More scenarios" lists, and
/// `## History`. A link's text counts, as a decision's title in its item is read; code spans and
/// images count for nothing.
pub fn reviewed_words(text: &str) -> usize {
    let document = parse(text, "");
    let spec = items(&document);
    let left_out = left_out(&document, &spec);
    let title = document
        .blocks
        .iter()
        .find(|b| b.parent.is_none() && b.kind == BlockKind::Heading && b.level == Some(1))
        .map(|b| b.id);
    document
        .blocks
        .iter()
        .filter(|b| title.is_none_or(|title| top_level(&document, b).id > title))
        .filter(|b| is_reviewed(&document, &left_out, b))
        .map(|b| {
            reviewed_text(&b.spans)
                .split_whitespace()
                .filter(|w| is_word(w))
                .count()
        })
        .sum()
}

/// The text of spans a reviewer reads: all but code spans and images.
fn reviewed_text(spans: &[Span]) -> String {
    spans
        .iter()
        .map(|span| {
            if span.code || span.image.is_some() {
                " "
            } else {
                span.text.as_str()
            }
        })
        .collect()
}

/// The blocks left out of the reviewed part, with all they hold: the block, the "More scenarios"
/// lists, and `## History`, its heading included.
fn left_out(document: &Document, spec: &SpecItems) -> HashSet<u32> {
    let mut left_out: HashSet<u32> = spec.block.into_iter().collect();
    for story in &spec.stories {
        left_out.extend(
            story
                .more
                .iter()
                .filter_map(|scenario| document.blocks[scenario.block as usize].parent),
        );
    }
    for part in spec.parts.iter().filter(|part| part.title == "History") {
        left_out.insert(part.heading);
        left_out.extend(&part.blocks);
    }
    left_out
}

/// Whether a block's text is read by default: a heading, a paragraph, an item, or a cell, outside
/// code, HTML, and the blocks left out.
fn is_reviewed(document: &Document, left_out: &HashSet<u32>, block: &Block) -> bool {
    if !matches!(
        block.kind,
        BlockKind::Heading | BlockKind::Paragraph | BlockKind::Item | BlockKind::Cell
    ) {
        return false;
    }
    let mut current = Some(block);
    while let Some(block) = current {
        if left_out.contains(&block.id) || matches!(block.kind, BlockKind::Code | BlockKind::Html) {
            return false;
        }
        current = block.parent.and_then(|id| document.blocks.get(id as usize));
    }
    true
}

/// The top-level block holding a block.
fn top_level<'a>(document: &'a Document, block: &'a Block) -> &'a Block {
    let mut current = block;
    while let Some(parent) = current
        .parent
        .and_then(|id| document.blocks.get(id as usize))
    {
        current = parent;
    }
    current
}

/// Reports an edge case of unknown importance (`edges.importance`), and, on a waiting spec, warns
/// on a reviewed part past `SPEC_WORDS` words (`spec.length`) and a block past its items
/// (`block.items`).
pub(super) fn check_spec(file: &File<'_>, waiting: bool, problems: &mut Vec<Problem>) {
    let document = parse(file.text, "");
    let spec = items(&document);
    for edge in &spec.edges {
        if !IMPORTANCES.contains(&edge.importance.as_str()) {
            let line = document.blocks[edge.row as usize].start_line as usize;
            problems.push(file.problem(
                Some(line),
                "edges.importance",
                "importance is high, normal, or niche",
            ));
        }
    }
    if !waiting {
        return;
    }
    let words = reviewed_words(file.text);
    if words > SPEC_WORDS {
        problems.push(file.warning(
            None,
            "spec.length",
            format!(
                "the spec's reviewed part is {} words: aim at 2,000",
                thousands(words)
            ),
        ));
    }
    if let Some(block) = spec.block {
        check_block_items(file, &document, block, problems);
    }
}

/// A number with a comma between its thousands, `3,100`.
fn thousands(number: usize) -> String {
    let digits = number.to_string();
    let mut written = String::new();
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            written.push(',');
        }
        written.push(digit);
    }
    written
}
