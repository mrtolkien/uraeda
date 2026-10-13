mod common;

use std::path::Path;

use common::*;
use lsp_types::request::{CodeActionRequest, Completion, DocumentSymbolRequest};
use lsp_types::{
    CodeAction, CodeActionContext, CodeActionOrCommand, CodeActionParams, CompletionParams,
    CompletionResponse, DocumentSymbol, DocumentSymbolParams, DocumentSymbolResponse,
    PartialResultParams, Position, Range, SymbolKind, TextDocumentIdentifier,
    TextDocumentPositionParams, TextEdit, WorkDoneProgressParams,
};
use serde_json::json;

fn completion(session: &mut Session, path: &Path, line: u32, character: u32) -> Vec<String> {
    let response = session.request::<Completion>(CompletionParams {
        text_document_position: TextDocumentPositionParams::new(
            TextDocumentIdentifier::new(Session::uri(path)),
            Position::new(line, character),
        ),
        work_done_progress_params: WorkDoneProgressParams::default(),
        partial_result_params: PartialResultParams::default(),
        context: None,
    });
    let items = match response {
        Some(CompletionResponse::Array(items)) => items,
        Some(CompletionResponse::List(list)) => list.items,
        None => Vec::new(),
    };
    items.into_iter().map(|item| item.label).collect()
}

fn symbols(session: &mut Session, path: &Path) -> Vec<DocumentSymbol> {
    let response = session.request::<DocumentSymbolRequest>(DocumentSymbolParams {
        text_document: TextDocumentIdentifier::new(Session::uri(path)),
        work_done_progress_params: WorkDoneProgressParams::default(),
        partial_result_params: PartialResultParams::default(),
    });
    match response {
        Some(DocumentSymbolResponse::Nested(symbols)) => symbols,
        other => panic!("expected nested symbols, got {other:?}"),
    }
}

/// Every symbol of a tree, depth first, with its parent's name.
fn flatten<'a>(
    symbols: &'a [DocumentSymbol],
    parent: &'a str,
    into: &mut Vec<(&'a str, &'a DocumentSymbol)>,
) {
    for symbol in symbols {
        into.push((parent, symbol));
        flatten(
            symbol.children.as_deref().unwrap_or_default(),
            &symbol.name,
            into,
        );
    }
}

fn actions(session: &mut Session, path: &Path, line: u32) -> Vec<CodeActionOrCommand> {
    session
        .request::<CodeActionRequest>(CodeActionParams {
            text_document: TextDocumentIdentifier::new(Session::uri(path)),
            range: Range::new(Position::new(line, 0), Position::new(line, 0)),
            context: CodeActionContext::default(),
            work_done_progress_params: WorkDoneProgressParams::default(),
            partial_result_params: PartialResultParams::default(),
        })
        .unwrap_or_default()
}

fn titles(actions: &[CodeActionOrCommand]) -> Vec<String> {
    actions
        .iter()
        .map(|action| match action {
            CodeActionOrCommand::CodeAction(action) => action.title.clone(),
            CodeActionOrCommand::Command(command) => command.title.clone(),
        })
        .collect()
}

fn code_action<'a>(actions: &'a [CodeActionOrCommand], title: &str) -> &'a CodeAction {
    actions
        .iter()
        .find_map(|action| match action {
            CodeActionOrCommand::CodeAction(action) if action.title == title => Some(action),
            _ => None,
        })
        .unwrap_or_else(|| panic!("no action {title:?} in {:?}", titles(actions)))
}

/// The edits of an action, all on `path`.
fn edits(action: &CodeAction, path: &Path) -> Vec<TextEdit> {
    let edit = action.edit.as_ref().expect("an edit");
    assert_eq!(edit.document_changes, None);
    let changes: Vec<_> = edit.changes.iter().flatten().collect();
    assert_eq!(changes.len(), 1, "{}", action.title);
    assert_eq!(changes[0].0, &Session::uri(path), "{}", action.title);
    changes[0].1.clone()
}

/// US1.2
#[test]
fn risk_tier_completes_from_its_values() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    session.open(&path, &spec_text.replace("risk-tier: high", "risk-tier: "));

    assert_eq!(
        completion(&mut session, &path, 4, 11),
        ["low", "medium", "high"]
    );
    assert_eq!(
        completion(&mut session, &path, 8, 3),
        Vec::<String>::new(),
        "the title is no frontmatter line"
    );
}

#[test]
fn a_partly_typed_value_is_replaced() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    session.open(
        &path,
        &spec_text.replace("risk-tier: high", "risk-tier: me"),
    );

    let response = session.request::<Completion>(CompletionParams {
        text_document_position: TextDocumentPositionParams::new(
            TextDocumentIdentifier::new(Session::uri(&path)),
            Position::new(4, 13),
        ),
        work_done_progress_params: WorkDoneProgressParams::default(),
        partial_result_params: PartialResultParams::default(),
        context: None,
    });
    let Some(CompletionResponse::Array(items)) = response else {
        panic!("expected items, got {response:?}");
    };
    let medium = items.iter().find(|item| item.label == "medium").unwrap();

    assert_eq!(
        medium.text_edit,
        Some(lsp_types::CompletionTextEdit::Edit(TextEdit::new(
            Range::new(Position::new(4, 11), Position::new(4, 13)),
            "medium".to_string()
        )))
    );
}

/// Final review: completing inside a value replaces the whole value, up to a comment, so
/// `risk-tier: hi|gh` becomes `medium`, not `mediumgh`.
#[test]
fn a_value_is_replaced_whole() {
    let (repo, path, spec_text) = feature_with_spec();
    for (line, end) in [
        ("risk-tier: high", 15),
        ("risk-tier: high  # set by the agent", 15),
        ("risk-tier: high   ", 15),
    ] {
        let mut session = Session::start(repo.path());
        session.open(&path, &spec_text.replace("risk-tier: high", line));

        let response = session.request::<Completion>(CompletionParams {
            text_document_position: TextDocumentPositionParams::new(
                TextDocumentIdentifier::new(Session::uri(&path)),
                Position::new(4, 13),
            ),
            work_done_progress_params: WorkDoneProgressParams::default(),
            partial_result_params: PartialResultParams::default(),
            context: None,
        });
        let Some(CompletionResponse::Array(items)) = response else {
            panic!("expected items for {line:?}, got {response:?}");
        };
        let medium = items.iter().find(|item| item.label == "medium").unwrap();

        assert_eq!(
            medium.text_edit,
            Some(lsp_types::CompletionTextEdit::Edit(TextEdit::new(
                Range::new(Position::new(4, 11), Position::new(4, end)),
                "medium".to_string()
            ))),
            "{line:?}"
        );
    }

    let mut session = Session::start(repo.path());
    let commented = "risk-tier: high  # set by the agent";
    session.open(&path, &spec_text.replace("risk-tier: high", commented));
    assert_eq!(
        completion(&mut session, &path, 4, 25),
        Vec::<String>::new(),
        "a comment is not completed"
    );
}

/// US1.3
#[test]
fn a_round_lists_its_questions_as_symbols() {
    let (repo, _, _) = feature_with_spec();
    let path = repo.path().join(FEATURE).join("clarifications-01.md");
    let text = "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: X\n\n## Context\n\n\
                Some context.\n\n## Q1: First?\n\n**Answer:**\n\n### Q1.A: Follow-up?\n\n\
                **Answer:**\n\n## Q2: Second?\n\n**Answer:**\n";
    let mut session = Session::start(repo.path());
    session.open(&path, text);

    let tree = symbols(&mut session, &path);
    let mut all = Vec::new();
    flatten(&tree, "", &mut all);

    let questions: Vec<_> = all
        .iter()
        .filter(|(_, symbol)| symbol.kind == SymbolKind::STRING)
        .map(|(parent, symbol)| (*parent, symbol.name.as_str(), symbol.detail.as_deref()))
        .collect();
    assert_eq!(
        questions,
        [
            ("Clarifications, round 01: X", "Q1", Some("First?")),
            ("Q1", "Q1.A", Some("Follow-up?")),
            ("Clarifications, round 01: X", "Q2", Some("Second?")),
        ]
    );
    let q1 = all
        .iter()
        .find(|(_, symbol)| symbol.name == "Q1")
        .unwrap()
        .1;
    assert_eq!(q1.selection_range.start.line, 10);
    assert_eq!(q1.range.start.line, 10);
    assert_eq!(q1.range.end.line, 17, "Q1 ends before Q2");
}

/// C1 of the spec's review.
#[test]
fn priorities_sections_are_symbols() {
    let (repo, _, _) = feature_with_spec();
    let path = repo.path().join("specs/PRIORITIES.md");
    let text = repo.read("specs/PRIORITIES.md");
    let mut session = Session::start(repo.path());
    session.open(&path, &text);

    let tree = symbols(&mut session, &path);

    assert_eq!(tree.len(), 1);
    assert_eq!(tree[0].name, "Priorities");
    let sections: Vec<_> = tree[0]
        .children
        .iter()
        .flatten()
        .map(|symbol| symbol.name.as_str())
        .collect();
    assert_eq!(sections, ["Now", "Next", "Later", "Blocked"]);
}

#[test]
fn stories_tasks_and_comments_are_symbols() {
    let (repo, spec_path, spec_text) = feature_with_spec();
    let plan_path = repo.path().join(FEATURE).join("plan.md");
    let plan_text = repo.read(&format!("{FEATURE}/plan.md"));
    let review_path = repo.path().join(FEATURE).join("spec-review.md");
    let review_text = "---\nverdict: pending\ncommit: abc1234\n---\n\n# Review: Spec, X\n\n\
                       ## C1: Lines 3–4, under \"Spec: X\"\n\n> quoted\n\nA comment.\n\n\
                       ## C2: General\n\nAnother.\n";
    let mut session = Session::start(repo.path());
    session.open(&spec_path, &spec_text);
    session.open(&plan_path, &plan_text);
    session.open(&review_path, review_text);

    let named = |session: &mut Session, path: &Path, kind: SymbolKind| {
        let tree = symbols(session, path);
        let mut all = Vec::new();
        flatten(&tree, "", &mut all);
        all.iter()
            .filter(|(_, symbol)| symbol.kind == kind)
            .map(|(parent, symbol)| {
                (
                    parent.to_string(),
                    symbol.name.clone(),
                    symbol.detail.clone().unwrap_or_default(),
                )
            })
            .collect::<Vec<_>>()
    };

    let stories = named(&mut session, &spec_path, SymbolKind::EVENT);
    assert_eq!(
        stories[0],
        (
            "User stories".to_string(),
            "US1".to_string(),
            "Make a task repeat (P1)".to_string()
        )
    );
    assert_eq!(stories.len(), 4);
    let tasks = named(&mut session, &plan_path, SymbolKind::FUNCTION);
    assert_eq!(
        tasks[0],
        (
            "Plan: Recurring tasks".to_string(),
            "Task 1".to_string(),
            "Calendar-day due dates, and their upgrade".to_string()
        )
    );
    assert_eq!(
        named(&mut session, &review_path, SymbolKind::STRING),
        [
            (
                "Review: Spec, X".to_string(),
                "C1".to_string(),
                "Lines 3–4, under \"Spec: X\"".to_string()
            ),
            (
                "Review: Spec, X".to_string(),
                "C2".to_string(),
                "General".to_string()
            ),
        ]
    );
}

/// US5.4
#[test]
fn a_field_line_offers_its_other_values_as_edits() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    session.open(&path, &spec_text);

    let offered = actions(&mut session, &path, 4);

    assert_eq!(
        titles(&offered),
        ["Set risk-tier to low", "Set risk-tier to medium"]
    );
    assert_eq!(
        edits(code_action(&offered, "Set risk-tier to low"), &path),
        [TextEdit::new(
            Range::new(Position::new(4, 0), Position::new(4, 15)),
            "risk-tier: low".to_string()
        )]
    );
    assert_eq!(
        titles(&actions(&mut session, &path, 1)),
        ["Set status to awaiting-human"],
        "approving and requesting changes are the verdict's, not edits"
    );
    assert_eq!(
        titles(&actions(&mut session, &path, 5)),
        ["Set plan-review to false"]
    );
    assert_eq!(
        titles(&actions(&mut session, &path, 2)),
        Vec::<String>::new()
    );
    assert_eq!(
        titles(&actions(&mut session, &path, 8)),
        Vec::<String>::new()
    );
}

/// US5.4: code actions only edit the open document.
#[test]
fn no_code_action_commits_or_writes_another_file() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    session.open(&path, &spec_text);

    let lines = u32::try_from(spec_text.lines().count()).unwrap();
    let mut count = 0;
    for line in 0..lines {
        for action in actions(&mut session, &path, line) {
            let CodeActionOrCommand::CodeAction(action) = action else {
                panic!("a bare command on line {line}");
            };
            assert_eq!(action.command, None, "{}", action.title);
            edits(&action, &path);
            count += 1;
        }
    }

    assert_eq!(count, 4);
    assert_eq!(repo.read(&format!("{FEATURE}/spec.md")), spec_text);
    assert_eq!(repo.porcelain(), "");
}

/// US5.1
#[test]
fn fields_of_an_unsaved_text_come_from_the_text() {
    let (repo, _, _) = feature_with_spec();
    let proposal = repo.path().join(FEATURE).join("proposal.md");
    let text = repo.read(&format!("{FEATURE}/proposal.md"));
    let mut session = Session::start(repo.path());
    session.open(
        &proposal,
        &text.replace("discovery: high", "discovery: low"),
    );

    let fields = session
        .raw("uraeda/fields", json!({ "uri": Session::uri(&proposal) }))
        .unwrap();

    assert_eq!(
        fields,
        json!([{
            "name": "discovery",
            "line": 2,
            "value": "low",
            "kind": "choice",
            "values": [
                { "value": "low", "action": null },
                { "value": "medium", "action": null },
                { "value": "high", "action": null },
            ],
        }])
    );
}

#[test]
fn fields_of_a_closed_file_come_from_the_disk() {
    let (repo, path, _) = feature_with_spec();
    let mut session = Session::start(repo.path());

    let fields = session
        .raw("uraeda/fields", json!({ "uri": Session::uri(&path) }))
        .unwrap();

    assert_eq!(fields[0]["name"], "status");
    assert_eq!(fields[0]["value"], "approved");
    assert_eq!(fields[0]["values"][1]["action"], "approve");
    assert_eq!(fields[3]["name"], "risk-tier");
    assert_eq!(fields[3]["value"], "high");
}

#[test]
fn a_file_outside_specs_has_no_fields() {
    let (repo, _, _) = feature_with_spec();
    let readme = repo.path().join("proposal.md");
    let mut session = Session::start(repo.path());
    session.open(&readme, "---\ndiscovery: high\n---\n");

    let fields = session
        .raw("uraeda/fields", json!({ "uri": Session::uri(&readme) }))
        .unwrap();

    assert_eq!(fields, json!([]));
    assert_eq!(
        titles(&actions(&mut session, &readme, 1)),
        Vec::<String>::new()
    );
}

/// Review focus 5
#[test]
fn an_edit_keeps_the_comment_and_crlf() {
    let (repo, _, _) = feature_with_spec();
    let proposal = repo.path().join(FEATURE).join("proposal.md");
    let line = "discovery: high # low, medium, or high";
    let text = format!("---\r\n{line}\r\n---\r\n\r\n# Recurring tasks\r\n");
    let mut session = Session::start(repo.path());
    session.open(&proposal, &text);

    let offered = actions(&mut session, &proposal, 1);

    assert_eq!(
        titles(&offered),
        ["Set discovery to low", "Set discovery to medium"]
    );
    assert_eq!(
        edits(code_action(&offered, "Set discovery to low"), &proposal),
        [TextEdit::new(
            Range::new(Position::new(1, 0), Position::new(1, line.len() as u32)),
            "discovery: low # low, medium, or high".to_string()
        )]
    );
}

/// US5.2: a typed value is an edit of the field's line in the open document, never of the disk.
#[test]
fn a_typed_value_is_an_edit_of_the_open_document() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    let uri = Session::uri(&path);
    session.open(&path, &spec_text);

    let edit = session
        .raw(
            "uraeda/setField",
            json!({ "uri": uri, "name": "revision", "value": "2" }),
        )
        .unwrap();

    assert_eq!(
        edit,
        json!({ "changes": { uri.as_str(): [{
            "range": { "start": { "line": 2, "character": 0 }, "end": { "line": 2, "character": 11 } },
            "newText": "revision: 2",
        }] } })
    );
    assert_eq!(repo.porcelain(), "", "the disk is untouched");

    let refused = |session: &mut Session, name: &str, value: &str| {
        session
            .raw(
                "uraeda/setField",
                json!({ "uri": uri, "name": name, "value": value }),
            )
            .unwrap_err()
            .message
    };
    assert_eq!(
        refused(&mut session, "status", "approved"),
        "status: approved is set by a verdict, not an edit."
    );
    assert_eq!(
        refused(&mut session, "owner", "me"),
        "spec.md has no field owner."
    );
    assert_eq!(
        refused(&mut session, "revision", "2\nstatus: approved"),
        "A value is one line."
    );
    session.close(&path);
    assert_eq!(
        refused(&mut session, "revision", "2"),
        "spec.md is not open."
    );
}
