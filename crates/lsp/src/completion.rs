//! Completion: on a frontmatter field's line, after its `key:`, the field's allowed values, each
//! replacing the whole value.

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
    // The value runs to a ` #` comment, or the line's end, without its trailing spaces; a
    // completion replaces all of it, wherever the cursor is in it, and none of a comment.
    let comment = line[start..]
        .char_indices()
        .find(|&(index, char)| {
            char == '#' && (index == 0 || line[start..][..index].ends_with([' ', '\t']))
        })
        .map_or(line.len(), |(index, _)| start + index);
    if cursor > comment {
        return None;
    }
    let end = (start + line[start..comment].trim_end().len()).max(cursor);
    let range = Range::new(
        Position::new(position.line, documents::utf16_len(&line[..start])),
        Position::new(position.line, documents::utf16_len(&line[..end])),
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
