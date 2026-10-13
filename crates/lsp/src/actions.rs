//! Code actions: on a frontmatter field's line, `Set <field> to <value>` for each of its other
//! values, each an edit of that line in the open document only. Values the human sets by an action,
//! like approving, are left to the commands: an action never commits or writes another file.
//! `uraeda/setField` gives the same edit for a value the human types, like a revision.

use std::collections::HashMap;

use lsp_server::{ErrorCode, ResponseError};
use lsp_types::{
    CodeAction, CodeActionKind, CodeActionOrCommand, CodeActionParams, CodeActionResponse,
    Position, Range, TextEdit, Uri, WorkspaceEdit,
};
use serde::Deserialize;
use uraeda_core::files::frontmatter;

use crate::documents::{self, Documents};
use crate::requests;
use crate::server::error;

pub(crate) fn actions(
    documents: &Documents,
    params: CodeActionParams,
) -> Option<CodeActionResponse> {
    let uri = params.text_document.uri;
    let text = documents.text(&uri)?;
    let index = params.range.start.line;
    let field = requests::fields_of(documents, &uri)
        .into_iter()
        .find(|field| field.line == Some(index + 1))?;
    let actions = field
        .values
        .iter()
        .filter(|choice| choice.action.is_none() && Some(&choice.value) != field.value.as_ref())
        .filter_map(|choice| {
            let edit = line_edit(text, &uri, index, &field.name, &choice.value)?;
            Some(CodeActionOrCommand::CodeAction(CodeAction {
                title: format!("Set {} to {}", field.name, choice.value),
                kind: Some(CodeActionKind::REFACTOR_REWRITE),
                edit: Some(edit),
                ..CodeAction::default()
            }))
        })
        .collect();
    Some(actions)
}

/// The edit replacing the field `name` on the 0-based line `index` of `text` with `value`, through
/// `frontmatter::set`, which keeps the line's comment.
fn line_edit(text: &str, uri: &Uri, index: u32, name: &str, value: &str) -> Option<WorkspaceEdit> {
    let line = documents::line(text, index)?;
    let range = Range::new(
        Position::new(index, 0),
        Position::new(index, documents::utf16_len(line)),
    );
    let edited = frontmatter::set(text, name, value);
    let new_line = documents::line(&edited, index)?.to_string();
    Some(WorkspaceEdit {
        changes: Some(HashMap::from([(
            uri.clone(),
            vec![TextEdit::new(range, new_line)],
        )])),
        ..WorkspaceEdit::default()
    })
}

/// `uraeda/setField`.
pub(crate) const SET_FIELD: &str = "uraeda/setField";

#[derive(Deserialize)]
pub(crate) struct SetFieldParams {
    uri: Uri,
    name: String,
    value: String,
}

/// `uraeda/setField { uri, name, value }`: the edit setting a field of the open document to any
/// one-line value, as its code actions do for its allowed values. The disk is never written, and a
/// value set by a verdict is refused.
pub(crate) fn set_field(
    documents: &Documents,
    params: SetFieldParams,
) -> Result<WorkspaceEdit, ResponseError> {
    let SetFieldParams { uri, name, value } = params;
    let refused = |message: String| error(ErrorCode::InvalidParams, message);
    let file = documents
        .path(&uri)
        .and_then(|path| Some(path.file_name()?.to_string_lossy().into_owned()))
        .unwrap_or_else(|| uri.as_str().to_string());
    let text = documents
        .text(&uri)
        .ok_or_else(|| refused(format!("{file} is not open.")))?;
    if value.contains(['\n', '\r']) {
        return Err(refused("A value is one line.".to_string()));
    }
    let field = requests::fields_of(documents, &uri)
        .into_iter()
        .find(|field| field.name == name && field.line.is_some())
        .ok_or_else(|| refused(format!("{file} has no field {name}.")))?;
    if field
        .values
        .iter()
        .any(|choice| choice.value == value && choice.action.is_some())
    {
        return Err(refused(format!(
            "{name}: {value} is set by a verdict, not an edit."
        )));
    }
    let index = field.line.unwrap_or(1) - 1;
    line_edit(text, &uri, index, &name, &value)
        .ok_or_else(|| refused(format!("{file} has no field {name}.")))
}
