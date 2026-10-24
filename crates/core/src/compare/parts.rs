//! A markdown file's text cut into parts: each paragraph, list item at any depth, table row, code
//! block, or quoted paragraph, with its lines joined, grouped by section.

use crate::files::document::{Block, BlockKind, Document, LineRange, parse, plain};

/// A paragraph or list item of one version.
pub(crate) struct Part {
    pub(crate) text: String,
    pub(crate) item: bool,
    pub(crate) lines: LineRange,
    /// The text of the nearest heading above it, at any level; empty before the first.
    pub(crate) heading: String,
}

/// One version of a file: its title, its parts by section, in file order, and each section's
/// `##` heading as a part, the first one of each title.
#[derive(Default)]
pub(crate) struct Version {
    pub(crate) title: Option<String>,
    pub(crate) sections: Vec<(String, Vec<Part>)>,
    pub(crate) heads: Vec<Part>,
}

impl Version {
    pub(crate) fn parts(&self, title: &str) -> &[Part] {
        self.sections
            .iter()
            .find(|(name, _)| name == title)
            .map_or(&[], |(_, parts)| parts.as_slice())
    }

    pub(crate) fn section(&mut self, title: &str) -> &mut Vec<Part> {
        let index = match self.sections.iter().position(|(name, _)| name == title) {
            Some(index) => index,
            None => {
                self.sections.push((title.to_string(), Vec::new()));
                self.sections.len() - 1
            }
        };
        &mut self.sections[index].1
    }
}

/// The parts of a file's text, its frontmatter left out.
pub(crate) fn version(text: &str) -> Version {
    read(text, false)
}

/// The parts of a file's text, its frontmatter left out, each heading of level 3 or deeper a part
/// too.
pub(crate) fn version_with_headings(text: &str) -> Version {
    read(text, true)
}

fn read(text: &str, headings: bool) -> Version {
    let document = parse(text, "");
    let mut version = Version::default();
    let mut section = String::new();
    let mut heading = String::new();
    for block in document
        .blocks
        .iter()
        .filter(|block| block.parent.is_none())
    {
        if block.kind == BlockKind::Heading {
            heading = plain(&block.spans);
        }
        match block.kind {
            BlockKind::Heading if block.level == Some(1) && version.title.is_none() => {
                version.title = Some(plain(&block.spans));
                section.clear();
            }
            BlockKind::Heading if block.level == Some(2) => {
                section = heading.clone();
                if !version.heads.iter().any(|head| head.heading == section) {
                    version.heads.push(part(block, &heading, joined(&heading)));
                }
            }
            BlockKind::Heading if headings && block.level > Some(2) => {
                let part = part(block, &heading, joined(&heading));
                version.section(&section).push(part);
            }
            _ => {
                let mut parts = Vec::new();
                collect(&document, block, &heading, &mut parts);
                version.section(&section).extend(parts);
            }
        }
    }
    version
}

/// The parts of a block, in file order: a paragraph, a list item at any depth, a table row, a
/// code or HTML block, each with its text; a quote or a callout holds its children's.
/// `heading` is the nearest heading above it.
fn collect(document: &Document, block: &Block, heading: &str, parts: &mut Vec<Part>) {
    let part = |text: String, item: bool| Part {
        item,
        ..part(block, heading, text)
    };
    match block.kind {
        BlockKind::Paragraph => parts.push(part(joined(&plain(&block.spans)), false)),
        BlockKind::Item => {
            parts.push(part(joined(&plain(&block.spans)), true));
            for child in document.children(block.id) {
                collect(document, child, heading, parts);
            }
        }
        BlockKind::Row => {
            let cells: Vec<String> = document
                .children(block.id)
                .map(|cell| joined(&plain(&cell.spans)))
                .collect();
            parts.push(part(cells.join(" | "), false));
        }
        BlockKind::Code | BlockKind::Html => {
            parts.push(part(
                joined(block.text.as_deref().unwrap_or_default()),
                false,
            ));
        }
        BlockKind::Callout => {
            let title = joined(&plain(&block.spans));
            if !title.is_empty() {
                parts.push(part(title, false));
            }
            for child in document.children(block.id) {
                collect(document, child, heading, parts);
            }
        }
        BlockKind::List | BlockKind::Quote | BlockKind::Table => {
            for child in document.children(block.id) {
                collect(document, child, heading, parts);
            }
        }
        BlockKind::Heading | BlockKind::Cell | BlockKind::Rule => {}
    }
}

/// A block's part, not an item, under `heading`.
fn part(block: &Block, heading: &str, text: String) -> Part {
    Part {
        text,
        item: false,
        lines: LineRange {
            start: block.start_line,
            end: block.end_line,
        },
        heading: heading.to_string(),
    }
}

/// Text with every run of whitespace made one space.
fn joined(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}
