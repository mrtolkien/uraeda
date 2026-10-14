//! Document symbols: the file's headings nested by level, with its questions, stories, tasks, and
//! comments named by their ids, from the core's outline.

use lsp_types::{
    DocumentSymbol, DocumentSymbolParams, DocumentSymbolResponse, Position, Range, SymbolKind,
};
use uraeda_core::files::outline::{self, OutlineEntry, OutlineKind};

use crate::documents::{self, Documents};

pub(crate) fn symbols(
    documents: &Documents,
    params: DocumentSymbolParams,
) -> Option<DocumentSymbolResponse> {
    let uri = params.text_document.uri;
    let text = documents.text(&uri)?;
    let path = documents
        .path(&uri)
        .filter(|path| documents.in_specs(path))?;
    let name = path.file_name()?.to_string_lossy();
    let entries = outline::outline(&name, text);
    Some(DocumentSymbolResponse::Nested(nest(text, &entries)))
}

/// The entries as a tree: each heading holds the deeper ones after it, up to the next heading of
/// its level or above.
fn nest(text: &str, entries: &[OutlineEntry]) -> Vec<DocumentSymbol> {
    // The open headings, outermost first, each with its level.
    let mut stack: Vec<(u8, DocumentSymbol)> = Vec::new();
    let mut roots = Vec::new();
    for entry in entries {
        close(&mut stack, &mut roots, entry.level);
        stack.push((entry.level, symbol(text, entry)));
    }
    close(&mut stack, &mut roots, 0);
    roots
}

/// Closes every open heading of `level` or deeper, into its parent, or into the roots.
fn close(stack: &mut Vec<(u8, DocumentSymbol)>, roots: &mut Vec<DocumentSymbol>, level: u8) {
    while stack.last().is_some_and(|(open, _)| *open >= level) {
        let (_, symbol) = stack.pop().expect("an open heading");
        match stack.last_mut() {
            Some((_, parent)) => parent.children.get_or_insert_with(Vec::new).push(symbol),
            None => roots.push(symbol),
        }
    }
}

#[allow(
    deprecated,
    reason = "`DocumentSymbol` still requires its deprecated field"
)]
fn symbol(text: &str, entry: &OutlineEntry) -> DocumentSymbol {
    let line = to_u32(entry.line.saturating_sub(1));
    let end = to_u32(entry.end_line.saturating_sub(1));
    let width = |line: u32| documents::line(text, line).map_or(0, documents::utf16_len);
    DocumentSymbol {
        name: if entry.name.trim().is_empty() {
            "#".repeat(usize::from(entry.level))
        } else {
            entry.name.clone()
        },
        detail: entry.detail.clone(),
        kind: match entry.kind {
            OutlineKind::Heading => SymbolKind::NAMESPACE,
            OutlineKind::Question | OutlineKind::Comment => SymbolKind::STRING,
            OutlineKind::Story => SymbolKind::EVENT,
            OutlineKind::Task => SymbolKind::FUNCTION,
        },
        tags: None,
        deprecated: None,
        range: Range::new(Position::new(line, 0), Position::new(end, width(end))),
        selection_range: Range::new(Position::new(line, 0), Position::new(line, width(line))),
        children: None,
    }
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}
