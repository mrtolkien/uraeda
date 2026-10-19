//! The frontmatter fields an editor shows and sets: read from the open text, set as an edit of the
//! open document that keeps the human's comment and line endings, and never written to disk.

use lsp_types::request::CodeActionRequest;
use lsp_types::{
    CodeActionContext, CodeActionOrCommand, CodeActionParams, PartialResultParams, Position, Range,
    TextDocumentIdentifier, TextEdit, WorkDoneProgressParams,
};
use serde_json::{Value, json};

use crate::common::*;

fn fields(session: &mut Session, path: &std::path::Path) -> Value {
    session
        .raw("uraeda/fields", json!({ "uri": Session::uri(path) }))
        .unwrap()
}

/// The edits of the code actions on a line, each the new text of that line.
fn offered(session: &mut Session, path: &std::path::Path, line: u32) -> Vec<TextEdit> {
    let actions = session
        .request::<CodeActionRequest>(CodeActionParams {
            text_document: TextDocumentIdentifier::new(Session::uri(path)),
            range: Range::new(Position::new(line, 0), Position::new(line, 0)),
            context: CodeActionContext::default(),
            work_done_progress_params: WorkDoneProgressParams::default(),
            partial_result_params: PartialResultParams::default(),
        })
        .unwrap_or_default();
    actions
        .into_iter()
        .flat_map(|action| match action {
            CodeActionOrCommand::CodeAction(action) => action
                .edit
                .into_iter()
                .flat_map(|e| e.changes.into_iter().flatten().flat_map(|(_, edits)| edits))
                .collect(),
            CodeActionOrCommand::Command(_) => Vec::new(),
        })
        .collect()
}

#[test]
fn fields_come_from_the_open_text_or_from_the_disk_and_never_from_outside_specs() {
    let (repo, spec, _) = feature_with_spec();
    let proposal = repo.path().join(FEATURE).join("proposal.md");
    let text = repo.read(&format!("{FEATURE}/proposal.md"));
    let mut session = Session::start(repo.path());

    let closed = fields(&mut session, &spec);
    assert_eq!(closed[0]["name"], "status");
    assert_eq!(closed[0]["value"], "approved");
    assert!(
        closed[0]["values"]
            .as_array()
            .unwrap()
            .iter()
            .any(|choice| choice["action"].is_string()),
        "a value a verdict sets names its action"
    );

    session.open(
        &proposal,
        &text.replace("discovery: high", "discovery: low"),
    );
    let open = fields(&mut session, &proposal);
    assert_eq!(open[0]["name"], "discovery");
    assert_eq!(
        open[0]["value"], "low",
        "the unsaved text is read, not the disk"
    );
    assert!(open[0]["line"].is_u64());

    let outside = repo.path().join("proposal.md");
    session.open(&outside, "---\ndiscovery: high\n---\n");
    assert_eq!(fields(&mut session, &outside), json!([]));
    assert!(offered(&mut session, &outside, 1).is_empty());
}

#[test]
fn a_value_offered_as_an_edit_keeps_the_comment_and_the_line_endings() {
    let (repo, _, _) = feature_with_spec();
    let proposal = repo.path().join(FEATURE).join("proposal.md");
    let line = "discovery: high # low, medium, or high";
    let text = format!("---\r\n{line}\r\n---\r\n\r\n# Recurring tasks\r\n");
    let mut session = Session::start(repo.path());
    session.open(&proposal, &text);

    let edits = offered(&mut session, &proposal, 1);

    let new_text: Vec<&str> = edits.iter().map(|edit| edit.new_text.as_str()).collect();
    assert_eq!(
        new_text,
        [
            "discovery: low # low, medium, or high",
            "discovery: medium # low, medium, or high"
        ]
    );
    for edit in &edits {
        assert_eq!(
            edit.range,
            Range::new(Position::new(1, 0), Position::new(1, line.len() as u32)),
            "the line, without its CRLF"
        );
    }
}

#[test]
fn a_typed_value_is_an_edit_of_the_open_document_and_a_verdict_is_not_one() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    let uri = Session::uri(&path);
    session.open(&path, &spec_text);
    let set = |session: &mut Session, name: &str, value: &str| {
        session.raw(
            "uraeda/setField",
            json!({ "uri": uri, "name": name, "value": value }),
        )
    };

    let edit = set(&mut session, "revision", "2").unwrap();

    let edits = &edit["changes"][uri.as_str()];
    assert_eq!(edits[0]["newText"], "revision: 2");
    assert_eq!(edits[0]["range"]["start"]["character"], 0);
    assert_eq!(repo.porcelain(), "", "the disk is untouched");
    for (name, value) in [
        ("status", "approved"),
        ("owner", "me"),
        ("revision", "2\nstatus: approved"),
    ] {
        assert!(set(&mut session, name, value).is_err(), "{name}: {value:?}");
    }
    session.close(&path);
    assert!(
        set(&mut session, "revision", "2").is_err(),
        "a file that is not open has no edit"
    );
}
