//! Completion: on a frontmatter field's line, after its `key:`, the field's allowed values.

use lsp_types::{
    CompletionItem, CompletionItemKind, CompletionParams, CompletionResponse, CompletionTextEdit,
    Position, Range, TextEdit,
};

use crate::documents::{self, Documents};
use crate::requests;

pub(crate) fn complete(
    documents: &Documents,
    params: CompletionParams,
) -> Option<CompletionResponse> {
    let position = params.text_document_position.position;
    let uri = params.text_document_position.text_document.uri;
    let text = documents.text(&uri)?;
    let field = requests::fields_of(documents, &uri)
        .into_iter()
        .find(|field| field.line == Some(position.line + 1))?;
    let line = documents::line(text, position.line)?;
    let cursor = documents::byte_offset(line, position.character);
    let colon = line.find(':')?;
    let spaced = line[colon + 1..].starts_with(' ');
    let start = if spaced { colon + 2 } else { colon + 1 };
    if cursor < start {
        return None;
    }
    let range = Range::new(
        Position::new(position.line, documents::utf16_len(&line[..start])),
        position,
    );
    let items = field
        .values
        .into_iter()
        .map(|choice| CompletionItem {
            label: choice.value.clone(),
            kind: Some(CompletionItemKind::VALUE),
            filter_text: Some(choice.value.clone()),
            text_edit: Some(CompletionTextEdit::Edit(TextEdit::new(
                range,
                if spaced {
                    choice.value
                } else {
                    format!(" {}", choice.value)
                },
            ))),
            ..CompletionItem::default()
        })
        .collect();
    Some(CompletionResponse::Array(items))
}
