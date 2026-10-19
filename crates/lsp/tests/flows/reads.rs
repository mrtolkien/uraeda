//! What an editor reads from the server: completion, symbols, code actions, and the `uraeda/`
//! requests of the plugin, from the open text when there is one, from disk when not.

use std::path::{Path, PathBuf};

use lsp_types::request::{CodeActionRequest, Completion, DocumentSymbolRequest, InlayHintRequest};
use lsp_types::{
    CodeActionContext, CodeActionOrCommand, CodeActionParams, CompletionParams, CompletionResponse,
    DocumentSymbolParams, DocumentSymbolResponse, InlayHintParams, PartialResultParams, Position,
    Range, TextDocumentIdentifier, TextDocumentPositionParams, WorkDoneProgressParams,
};
use serde_json::{Value, json};

use crate::common::*;

const NVIM: &str = "specs/2026-10-13-nvim-plugin";

/// A pending review with C1 on lines 50 to 52, C2 general, and C3 on line 12.
const REVIEW: &str = "---\nverdict: pending\ncommit: abc1234\n---\n\n# Review: Spec, X\n\n\
                      ## C1: Lines 50–52, under \"Data\"\n\n> quoted\n\nRename this field\n\n\
                      ## C2: General\n\nA general comment.\n\n\
                      ## C3: Line 12, under \"Spec: X\"\n\n> quoted\n\nAnother.\n";

fn request(session: &mut Session, method: &str, path: &Path) -> Value {
    session
        .raw(method, json!({ "uri": Session::uri(path) }))
        .unwrap_or_else(|error| panic!("{method} failed: {}", error.message))
}

/// The example's spec waiting for the human, on a branch of its own, with `review` beside it.
fn spec_under_review(review: Option<&str>) -> (TestRepo, PathBuf) {
    let repo = TestRepo::new();
    write_example(&repo);
    let spec = std::fs::read_to_string(example().join(FEATURE).join("spec.md")).unwrap();
    repo.write(
        &format!("{NVIM}/spec.md"),
        &spec.replace("status: approved", "status: awaiting-human"),
    );
    if let Some(review) = review {
        repo.write(&format!("{NVIM}/spec-review.md"), review);
    }
    repo.commit("feature");
    let path = repo.path().join(NVIM).join("spec.md");
    (repo, path)
}

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
    match response {
        Some(CompletionResponse::Array(items)) => {
            items.into_iter().map(|item| item.label).collect()
        }
        Some(CompletionResponse::List(list)) => {
            list.items.into_iter().map(|item| item.label).collect()
        }
        None => Vec::new(),
    }
}

fn symbols(session: &mut Session, path: &Path) -> Vec<lsp_types::DocumentSymbol> {
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

fn all_names(symbols: &[lsp_types::DocumentSymbol], into: &mut Vec<String>) {
    for symbol in symbols {
        into.push(symbol.name.clone());
        all_names(symbol.children.as_deref().unwrap_or_default(), into);
    }
}

fn hints(session: &mut Session, path: &Path) -> Vec<u32> {
    session
        .request::<InlayHintRequest>(InlayHintParams {
            work_done_progress_params: WorkDoneProgressParams::default(),
            text_document: TextDocumentIdentifier::new(Session::uri(path)),
            range: Range::new(Position::new(0, 0), Position::new(100, 0)),
        })
        .unwrap_or_default()
        .into_iter()
        .map(|hint| hint.position.line)
        .collect()
}

#[test]
fn a_frontmatter_value_completes_from_its_values_and_is_replaced_whole() {
    let (repo, path, text) = feature_with_spec();
    let line = text
        .lines()
        .position(|l| l.starts_with("risk-tier"))
        .unwrap() as u32;
    let mut session = Session::start(repo.path());
    session.open(&path, &text.replace("risk-tier: high", "risk-tier: "));

    let values = completion(&mut session, &path, line, 11);

    assert_eq!(values, ["low", "medium", "high"]);
    assert!(
        completion(&mut session, &path, line + 4, 3).is_empty(),
        "a title is no frontmatter line"
    );

    session.change(
        &path,
        &text.replace("risk-tier: high", "risk-tier: hi|gh  # set by the agent"),
    );
    let response = session.request::<Completion>(CompletionParams {
        text_document_position: TextDocumentPositionParams::new(
            TextDocumentIdentifier::new(Session::uri(&path)),
            Position::new(line, 13),
        ),
        work_done_progress_params: WorkDoneProgressParams::default(),
        partial_result_params: PartialResultParams::default(),
        context: None,
    });
    let Some(CompletionResponse::Array(items)) = response else {
        panic!("expected items")
    };
    let medium = items.iter().find(|item| item.label == "medium").unwrap();
    let Some(lsp_types::CompletionTextEdit::Edit(edit)) = &medium.text_edit else {
        panic!("an edit")
    };
    assert_eq!(
        edit.range.start.character, 11,
        "the value is replaced from its start"
    );
    assert_eq!(
        edit.range.end.character,
        "risk-tier: hi|gh".len() as u32,
        "to its end, not into the comment"
    );
}

#[test]
fn a_round_a_spec_a_plan_and_the_priorities_are_outlined() {
    let (repo, spec_path, spec_text) = feature_with_spec();
    let round_path = repo.path().join(FEATURE).join("clarifications-01.md");
    let plan_path = repo.path().join(FEATURE).join("plan.md");
    let priorities = repo.path().join("specs/PRIORITIES.md");
    let mut session = Session::start(repo.path());
    session.open(&spec_path, &spec_text);
    session.open(
        &round_path,
        &repo.read(&format!("{FEATURE}/clarifications-01.md")),
    );
    session.open(&plan_path, &repo.read(&format!("{FEATURE}/plan.md")));
    session.open(&priorities, &repo.read("specs/PRIORITIES.md"));

    let outline = |session: &mut Session, path: &Path| {
        let mut names = Vec::new();
        all_names(&symbols(session, path), &mut names);
        names
    };

    let round = outline(&mut session, &round_path);
    assert!(
        (1..=7).all(|n| round.iter().any(|name| name == &format!("Q{n}"))),
        "{round:?}"
    );
    let spec = outline(&mut session, &spec_path);
    assert!(
        spec.iter().any(|name| name == "US1") && spec.iter().any(|name| name == "US2"),
        "{spec:?}"
    );
    let plan = outline(&mut session, &plan_path);
    assert!(
        plan.iter().any(|name| name.starts_with("Task 1")),
        "{plan:?}"
    );
    let lists = outline(&mut session, &priorities);
    for section in ["Now", "Next", "Later", "Blocked"] {
        assert!(lists.iter().any(|name| name == section), "{lists:?}");
    }
}

#[test]
fn a_field_line_offers_its_other_values_as_edits_and_no_action_writes_anything() {
    let (repo, path, text) = feature_with_spec();
    let line = text
        .lines()
        .position(|l| l.starts_with("risk-tier"))
        .unwrap() as u32;
    let mut session = Session::start(repo.path());
    session.open(&path, &text);
    let before = repo.porcelain();

    let actions = session
        .request::<CodeActionRequest>(CodeActionParams {
            text_document: TextDocumentIdentifier::new(Session::uri(&path)),
            range: Range::new(Position::new(line, 0), Position::new(line, 0)),
            context: CodeActionContext::default(),
            work_done_progress_params: WorkDoneProgressParams::default(),
            partial_result_params: PartialResultParams::default(),
        })
        .unwrap_or_default();

    let edits: Vec<_> = actions
        .iter()
        .filter_map(|action| match action {
            CodeActionOrCommand::CodeAction(action) => action.edit.as_ref(),
            CodeActionOrCommand::Command(_) => None,
        })
        .collect();
    assert_eq!(edits.len(), 2, "the two tiers the spec does not have");
    for edit in &edits {
        let changes: Vec<_> = edit.changes.iter().flatten().collect();
        assert_eq!(
            (changes.len(), changes[0].0),
            (1, &Session::uri(&path)),
            "an edit of the open document only"
        );
    }
    assert!(
        actions.iter().all(
            |a| matches!(a, CodeActionOrCommand::CodeAction(action) if action.command.is_none())
        ),
        "no action commits"
    );
    assert_eq!(repo.porcelain(), before);
}

#[test]
fn the_items_and_comments_of_a_pending_review_are_listed_in_the_order_the_editor_walks_them() {
    let (repo, path) = spec_under_review(Some(REVIEW));
    let mut session = Session::start(repo.path());

    let items = request(&mut session, "uraeda/items", &path);
    let comments = request(&mut session, "uraeda/comments", &path);

    assert_eq!(
        items,
        json!([
            { "kind": "comment", "label": "C3", "line": 12, "endLine": 12 },
            { "kind": "comment", "label": "C1", "line": 50, "endLine": 52 },
        ])
    );
    assert_eq!(
        comments,
        json!([
            { "number": 1, "line": 50, "endLine": 52, "text": "Rename this field" },
            { "number": 2, "text": "A general comment." },
            { "number": 3, "line": 12, "endLine": 12, "text": "Another." },
        ])
    );
    let review = repo.path().join(NVIM).join("spec-review.md");
    session.open(&review, &REVIEW.replace("Rename this field", "Rename it"));
    assert_eq!(
        request(&mut session, "uraeda/comments", &path)[0]["text"],
        "Rename it",
        "an open review is read from its text"
    );
    let approved = REVIEW.replace("verdict: pending", "verdict: approved");
    session.change(&review, &approved);
    assert_eq!(
        request(&mut session, "uraeda/comments", &path),
        json!([]),
        "an approved review has none"
    );
}

#[test]
fn a_verdict_names_its_commits_its_blank_questions_and_whether_it_waits() {
    let (repo, path) = spec_under_review(Some(REVIEW));
    let mut session = Session::start(repo.path());

    let spec = request(&mut session, "uraeda/verdict", &path);

    assert_eq!(spec["kind"], "review");
    assert_eq!(spec["waiting"], true);
    assert_eq!(spec["comments"], 3);
    assert!(spec["approve"].is_string() && spec["requestChanges"].is_string());
    assert_eq!(spec["tiers"].as_array().unwrap().len(), 3);

    let round_repo = TestRepo::new();
    round_repo.write("specs/README.md", "# Specs\n");
    let round_path = round_repo.path().join(NVIM).join("clarifications-01.md");
    let round = clarifications("awaiting-human", "5 questions.", &["A", "B", "", "A", ""]);
    round_repo.write(&format!("{NVIM}/clarifications-01.md"), &round);
    let mut session = Session::start(round_repo.path());
    let verdict = request(&mut session, "uraeda/verdict", &round_path);
    assert_eq!(
        (verdict["kind"].as_str(), verdict["blank"].clone()),
        (Some("round"), json!(["Q3", "Q5"]))
    );
    session.open(
        &round_path,
        &round.replace("**Answer:**\n\n## Settled", "**Answer:** A\n\n## Settled"),
    );
    assert_eq!(
        request(&mut session, "uraeda/verdict", &round_path)["blank"],
        json!(["Q3"]),
        "the open text is read"
    );

    let (repo, approved, _) = feature_with_spec();
    let mut session = Session::start(repo.path());
    assert_eq!(
        request(&mut session, "uraeda/verdict", &approved)["waiting"],
        false
    );
    let proposal = repo.path().join(FEATURE).join("proposal.md");
    let error = session
        .raw("uraeda/verdict", json!({ "uri": Session::uri(&proposal) }))
        .unwrap_err();
    assert_eq!(
        error.data,
        Some(json!({ "code": "refused" })),
        "a proposal has no verdict"
    );
}

/// `main` with a priorities list and the feature `2026-10-14-codex-runtime` on its branch.
fn with_codex_runtime(round: Option<&str>) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n1. [Codex runtime](2026-10-14-codex-runtime/proposal.md)\n\n## Next\n\n1. [Gemini runtime](drafts/gemini-runtime.md)\n   Wrapped.\n2. Plain line\n\n## Later\n\n## Blocked\n",
    );
    repo.write("specs/drafts/gemini-runtime.md", "# Gemini runtime\n");
    repo.commit("chore: specs");
    repo.switch_new("2026-10-14-codex-runtime");
    repo.write("specs/2026-10-14-codex-runtime/proposal.md", &proposal());
    if let Some(round) = round {
        repo.write("specs/2026-10-14-codex-runtime/clarifications-01.md", round);
    }
    repo.commit("proposal(codex-runtime): proposal");
    repo.switch("main");
    repo
}

#[test]
fn what_waits_for_the_human_is_listed_from_the_checkouts_that_have_it() {
    let round = clarifications(
        "awaiting-human",
        "7 questions, about 25 minutes.",
        &["", ""],
    );
    let repo = with_codex_runtime(Some(&round));
    let mut session = Session::start(repo.path());
    assert_eq!(
        session.raw("uraeda/waiting", json!({})).unwrap(),
        json!([]),
        "a branch checked out nowhere is not listed"
    );
    drop(session);

    let worktree = repo.path().join(".worktrees/2026-10-14-codex-runtime");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        "2026-10-14-codex-runtime",
    ]);
    let mut session = Session::start(repo.path());

    let waiting = session.raw("uraeda/waiting", json!({})).unwrap();

    let file = worktree.join("specs/2026-10-14-codex-runtime/clarifications-01.md");
    assert_eq!(waiting.as_array().unwrap().len(), 1);
    assert_eq!(waiting[0]["feature"], "codex-runtime");
    assert_eq!(waiting[0]["path"], file.to_str().unwrap());
    assert!(waiting[0]["line"].is_u64());
}

#[test]
fn priorities_entries_hint_their_step_only_where_there_is_something_to_say_and_follow_the_open_text()
 {
    let repo = with_codex_runtime(None);
    repo.write("specs/backlog/later/proposal.md", "# Later\n");
    repo.commit("chore: postpone later");
    let path = repo.path().join("specs/PRIORITIES.md");
    let text = repo.read("specs/PRIORITIES.md").replace(
        "## Later\n",
        "## Later\n\n1. [Gone](drafts/gone.md)\n2. [Later](backlog/later/proposal.md)\n",
    );
    let mut session = Session::start(repo.path());
    session.open(&path, &text);

    let lines = hints(&mut session, &path);

    // A running feature, a draft, and a postponed feature have one; a missing draft and a plain line none.
    assert_eq!(lines.len(), 3, "{lines:?}");
    session.change(
        &path,
        &text.replace("## Now\n\n", "## Now\n\n1. New line\n"),
    );
    let moved = hints(&mut session, &path);
    assert_eq!(
        moved,
        lines.iter().map(|line| line + 1).collect::<Vec<_>>(),
        "hints follow the open text"
    );

    let (repo, spec, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    session.open(&spec, &spec_text);
    assert!(
        hints(&mut session, &spec).is_empty(),
        "other files have none"
    );
}
