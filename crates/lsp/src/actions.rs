//! Code actions: on a frontmatter field's line, `Set <field> to <value>` for each of its other
//! values, each an edit of that line in the open document only. Values the human sets by an action,
//! like approving, are left to the commands: an action never commits or writes another file.

use std::collections::HashMap;

use lsp_types::{
    CodeAction, CodeActionKind, CodeActionOrCommand, CodeActionParams, CodeActionResponse,
    Position, Range, TextEdit, WorkspaceEdit,
};
use uraeda_core::files::frontmatter;

use crate::documents::{self, Documents};
use crate::requests;

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
    let line = documents::line(text, index)?;
    let range = Range::new(
        Position::new(index, 0),
        Position::new(index, documents::utf16_len(line)),
    );
    let actions = field
        .values
        .iter()
        .filter(|choice| choice.action.is_none() && Some(&choice.value) != field.value.as_ref())
        .filter_map(|choice| {
            let edited = frontmatter::set(text, &field.name, &choice.value);
            let new_line = documents::line(&edited, index)?.to_string();
            let edit = WorkspaceEdit {
                changes: Some(HashMap::from([(
                    uri.clone(),
                    vec![TextEdit::new(range, new_line)],
                )])),
                ..WorkspaceEdit::default()
            };
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
