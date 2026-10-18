//! A decision's text cut into parts: each paragraph, list item at any depth, table row, code block,
//! or quoted paragraph, with its lines joined, grouped by section.

use crate::files::document::{Block, BlockKind, Document, LineRange, parse, plain};

/// A paragraph or list item of one version.
pub(super) struct Part {
    pub(super) text: String,
    pub(super) item: bool,
    pub(super) lines: LineRange,
}

/// One version of a decision: its title, and its parts by section, in file order.
#[derive(Default)]
pub(super) struct Version {
    pub(super) title: Option<String>,
    pub(super) sections: Vec<(String, Vec<Part>)>,
}

impl Version {
    pub(super) fn parts(&self, title: &str) -> &[Part] {
        self.sections
            .iter()
            .find(|(name, _)| name == title)
            .map_or(&[], |(_, parts)| parts.as_slice())
    }

    pub(super) fn section(&mut self, title: &str) -> &mut Vec<Part> {
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

/// The parts of a decision's text, its frontmatter left out.
pub(super) fn version(text: &str) -> Version {
    let document = parse(text, "");
    let mut version = Version::default();
    let mut section = String::new();
    for block in document
        .blocks
        .iter()
        .filter(|block| block.parent.is_none())
    {
        match block.kind {
            BlockKind::Heading if block.level == Some(1) && version.title.is_none() => {
                version.title = Some(plain(&block.spans));
                section.clear();
            }
            BlockKind::Heading if block.level == Some(2) => section = plain(&block.spans),
            _ => {
                let mut parts = Vec::new();
                collect(&document, block, &mut parts);
                version.section(&section).extend(parts);
            }
        }
    }
    version
}

/// The parts of a block, in file order: a paragraph, a list item at any depth, a table row, a
/// code or HTML block, each with its text; a quote or a callout holds its children's.
fn collect(document: &Document, block: &Block, parts: &mut Vec<Part>) {
    let lines = LineRange {
        start: block.start_line,
        end: block.end_line,
    };
    let part = |text: String, item: bool| Part { text, item, lines };
    match block.kind {
        BlockKind::Paragraph => parts.push(part(joined(&plain(&block.spans)), false)),
        BlockKind::Item => {
            parts.push(part(joined(&plain(&block.spans)), true));
            for child in document.children(block.id) {
                collect(document, child, parts);
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
                collect(document, child, parts);
            }
        }
        BlockKind::List | BlockKind::Quote | BlockKind::Table => {
            for child in document.children(block.id) {
                collect(document, child, parts);
            }
        }
        BlockKind::Heading | BlockKind::Cell | BlockKind::Rule => {}
    }
}

/// Text with every run of whitespace made one space.
fn joined(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}
