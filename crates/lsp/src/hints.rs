//! `textDocument/inlayHint` on `PRIORITIES.md`: each entry linked to a feature ends with its step
//! and who it waits on, each linked to a draft with `draft`, and each linked to a backlog file with
//! `backlog`.

use lsp_types::{InlayHint, InlayHintLabel, InlayHintParams, Position};
use uraeda_core::api;

use crate::documents::{self, Documents};

/// The hints of the open `PRIORITIES.md` within the range asked, from its open text; none for any
/// other file, or when the workspace cannot be read.
pub(crate) fn hints(documents: &Documents, params: InlayHintParams) -> Vec<InlayHint> {
    let Some(path) = documents.path(&params.text_document.uri) else {
        return Vec::new();
    };
    if path != documents.root.join("specs").join("PRIORITIES.md") {
        return Vec::new();
    }
    let Some(text) = documents.read(&path) else {
        return Vec::new();
    };
    let links = api::priority_links(&documents.root, &text).unwrap_or_default();
    let range = params.range.start.line..=params.range.end.line;
    links
        .into_iter()
        .filter_map(|link| {
            let line = link.line.checked_sub(1)?;
            if !range.contains(&line) {
                return None;
            }
            let label = match (&link.step, &link.draft) {
                (Some(step), _) => format!("{} · waits on {}", step.name, who(&step.waits_on)),
                (None, Some(path)) if path.starts_with("specs/backlog/") => "backlog".to_string(),
                (None, Some(_)) => "draft".to_string(),
                (None, None) => return None,
            };
            let character = documents::utf16_len(documents::line(&text, line)?);
            Some(InlayHint {
                position: Position::new(line, character),
                label: InlayHintLabel::String(label),
                kind: None,
                text_edits: None,
                tooltip: None,
                padding_left: Some(true),
                padding_right: None,
                data: None,
            })
        })
        .collect()
}

/// `you` for the human, as the reader of the hint is.
fn who(waits_on: &str) -> &str {
    match waits_on {
        "human" => "you",
        other => other,
    }
}
