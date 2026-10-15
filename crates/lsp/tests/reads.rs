mod common;

use std::path::{Path, PathBuf};

use common::*;
use lsp_types::request::InlayHintRequest;
use lsp_types::{
    InlayHintLabel, InlayHintParams, Position, Range, TextDocumentIdentifier,
    WorkDoneProgressParams,
};
use serde_json::{Value, json};

const NVIM: &str = "specs/2026-10-13-nvim-plugin";

/// A round whose `## Q1` heading is on line 12, `### Q1.A` on line 18, and `## Q2` on line 24.
const ROUND: &str = "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: X\n\n\
                     ## Context\n\nSome context.\nMore context.\n\n## Q1: First?\n\n\
                     **Answer:**\n\nA line.\n\n### Q1.A: Follow-up?\n\n**Answer:**\n\n\
                     A line.\n\n## Q2: Second?\n\n**Answer:**\n";

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

/// A repository with the example's `specs/`, and `specs/2026-10-13-nvim-plugin/` holding the
/// example's spec waiting for the human, with `review` as its review; returns the spec's path.
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

/// US8.2
#[test]
fn a_round_lists_its_questions_in_order() {
    let (repo, _, _) = feature_with_spec();
    let path = repo.path().join(FEATURE).join("clarifications-02.md");
    let mut session = Session::start(repo.path());
    session.open(&path, ROUND);

    assert_eq!(
        request(&mut session, "uraeda/items", &path),
        json!([
            { "kind": "question", "label": "Q1", "line": 12, "endLine": 16 },
            { "kind": "question", "label": "Q1.A", "line": 18, "endLine": 22 },
            { "kind": "question", "label": "Q2", "line": 24, "endLine": 26 },
        ])
    );
}

/// US8.3
#[test]
fn a_spec_lists_its_comments_in_order() {
    let (repo, path) = spec_under_review(Some(REVIEW));
    let mut session = Session::start(repo.path());

    assert_eq!(
        request(&mut session, "uraeda/items", &path),
        json!([
            { "kind": "comment", "label": "C3", "line": 12, "endLine": 12 },
            { "kind": "comment", "label": "C1", "line": 50, "endLine": 52 },
        ])
    );
}

#[test]
fn an_approved_review_has_no_items() {
    let review = REVIEW.replace("verdict: pending", "verdict: approved");
    let (repo, path) = spec_under_review(Some(&review));
    let mut session = Session::start(repo.path());

    assert_eq!(request(&mut session, "uraeda/items", &path), json!([]));
    assert_eq!(request(&mut session, "uraeda/comments", &path), json!([]));
}

/// US9.1
#[test]
fn comments_come_with_their_lines_and_text() {
    let (repo, path) = spec_under_review(Some(REVIEW));
    let mut session = Session::start(repo.path());

    assert_eq!(
        request(&mut session, "uraeda/comments", &path),
        json!([
            { "number": 1, "line": 50, "endLine": 52, "text": "Rename this field" },
            { "number": 2, "text": "A general comment." },
            { "number": 3, "line": 12, "endLine": 12, "text": "Another." },
        ])
    );
}

#[test]
fn an_open_review_is_read_from_its_text() {
    let (repo, path) = spec_under_review(Some(REVIEW));
    let review = repo.path().join(NVIM).join("spec-review.md");
    let mut session = Session::start(repo.path());
    session.open(&review, &REVIEW.replace("Rename this field", "Rename it"));

    let comments = request(&mut session, "uraeda/comments", &path);

    assert_eq!(comments[0]["text"], "Rename it");
}

/// US6.1
#[test]
fn a_spec_verdict_names_its_commits() {
    let review = REVIEW
        .split("\n\n## C2")
        .next()
        .map(|review| format!("{review}\n"))
        .unwrap();
    let (repo, path) = spec_under_review(Some(&review));
    let mut session = Session::start(repo.path());

    assert_eq!(
        request(&mut session, "uraeda/verdict", &path),
        json!({
            "file": "spec.md",
            "kind": "review",
            "approve": "spec(nvim-plugin): approve",
            "requestChanges": "spec(nvim-plugin): request changes",
            "comments": 1,
            "riskTier": "high",
            "planReview": true,
            "tiers": [
                { "value": "low", "planReview": false },
                { "value": "medium", "planReview": false },
                { "value": "high", "planReview": true },
            ],
            "blank": [],
            "waiting": true,
        })
    );
}

#[test]
fn a_spec_without_a_review_has_no_comments() {
    let (repo, path) = spec_under_review(None);
    let mut session = Session::start(repo.path());

    let verdict = request(&mut session, "uraeda/verdict", &path);

    assert_eq!(verdict["comments"], 0);
    assert_eq!(request(&mut session, "uraeda/comments", &path), json!([]));
}

#[test]
fn an_approved_spec_is_not_waiting() {
    let (repo, path, _) = feature_with_spec();
    let mut session = Session::start(repo.path());

    let verdict = request(&mut session, "uraeda/verdict", &path);

    assert_eq!(verdict["waiting"], false);
    assert_eq!(verdict["approve"], "spec(recurring-tasks): approve");
}

/// US6.4
#[test]
fn a_round_verdict_lists_its_blank_questions() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    let path = repo.path().join(NVIM).join("clarifications-01.md");
    let round = clarifications("awaiting-human", "5 questions.", &["A", "B", "", "A", ""]);
    repo.write(&format!("{NVIM}/clarifications-01.md"), &round);
    let mut session = Session::start(repo.path());

    assert_eq!(
        request(&mut session, "uraeda/verdict", &path),
        json!({
            "file": "clarifications-01.md",
            "kind": "round",
            "approve": "discovery(nvim-plugin): answer round 01",
            "comments": 0,
            "blank": ["Q3", "Q5"],
            "waiting": true,
        })
    );
    session.open(
        &path,
        &round.replace("**Answer:**\n\n## Settled", "**Answer:** A\n\n## Settled"),
    );
    assert_eq!(
        request(&mut session, "uraeda/verdict", &path)["blank"],
        json!(["Q3"]),
        "the open text is read"
    );
}

#[test]
fn a_proposal_has_no_verdict() {
    let (repo, _, _) = feature_with_spec();
    let path = repo.path().join(FEATURE).join("proposal.md");
    let mut session = Session::start(repo.path());

    let error = session
        .raw("uraeda/verdict", json!({ "uri": Session::uri(&path) }))
        .unwrap_err();

    assert_eq!(
        error.message,
        "Only a spec, a plan, or a round of questions gets a verdict."
    );
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
}

/// A repository with `specs/` on `main`, and the feature `2026-10-14-codex-runtime` on its branch,
/// with a committed proposal and `files` beside it.
fn with_codex_runtime(files: &[(&str, &str)]) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n1. [Codex runtime](2026-10-14-codex-runtime/proposal.md)\n\n\
         ## Next\n\n1. [Gemini runtime](drafts/gemini-runtime.md)\n   Wrapped.\n2. Plain line\n\
         \n## Later\n\n## Blocked\n",
    );
    repo.write("specs/drafts/gemini-runtime.md", "# Gemini runtime\n");
    repo.commit("chore: specs");
    repo.switch_new("2026-10-14-codex-runtime");
    repo.write("specs/2026-10-14-codex-runtime/proposal.md", &proposal());
    for (name, text) in files {
        repo.write(&format!("specs/2026-10-14-codex-runtime/{name}"), text);
    }
    repo.commit("proposal(codex-runtime): proposal");
    repo.switch("main");
    repo
}

/// US8.1
#[test]
fn waiting_lists_files_of_every_checkout() {
    let round = clarifications(
        "awaiting-human",
        "7 questions, about 25 minutes.",
        &["", ""],
    );
    let repo = with_codex_runtime(&[("clarifications-01.md", &round)]);
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

    let path = worktree.join("specs/2026-10-14-codex-runtime/clarifications-01.md");
    assert_eq!(
        waiting,
        json!([{
            "feature": "codex-runtime",
            "file": "clarifications-01.md",
            "path": path.to_str().unwrap(),
            "line": 7,
            "text": "7 questions, about 25 minutes.",
        }])
    );
}

#[test]
fn nothing_waits_in_a_branch_checked_out_nowhere() {
    let round = clarifications(
        "awaiting-human",
        "7 questions, about 25 minutes.",
        &["", ""],
    );
    let repo = with_codex_runtime(&[("clarifications-01.md", &round)]);
    let mut session = Session::start(repo.path());

    assert_eq!(session.raw("uraeda/waiting", json!({})).unwrap(), json!([]));
}

fn hints(session: &mut Session, path: &Path) -> Vec<(u32, u32, String)> {
    session
        .request::<InlayHintRequest>(InlayHintParams {
            work_done_progress_params: WorkDoneProgressParams::default(),
            text_document: TextDocumentIdentifier::new(Session::uri(path)),
            range: Range::new(Position::new(0, 0), Position::new(100, 0)),
        })
        .unwrap_or_default()
        .into_iter()
        .map(|hint| {
            let label = match hint.label {
                InlayHintLabel::String(label) => label,
                InlayHintLabel::LabelParts(parts) => {
                    parts.into_iter().map(|part| part.value).collect()
                }
            };
            (hint.position.line, hint.position.character, label)
        })
        .collect()
}

/// C1 of the spec's review.
#[test]
fn priorities_entries_hint_their_step() {
    let repo = with_codex_runtime(&[]);
    let path = repo.path().join("specs/PRIORITIES.md");
    let text = repo.read("specs/PRIORITIES.md");
    let mut session = Session::start(repo.path());
    session.open(&path, &text);

    let first = "1. [Codex runtime](2026-10-14-codex-runtime/proposal.md)";
    let drafted = "1. [Gemini runtime](drafts/gemini-runtime.md)";
    assert_eq!(
        hints(&mut session, &path),
        [
            (
                4,
                first.len() as u32,
                "discovery · waits on agent".to_string()
            ),
            (8, drafted.len() as u32, "draft".to_string()),
        ]
    );

    session.change(
        &path,
        &text.replace("## Now\n\n", "## Now\n\n1. New line\n"),
    );
    assert_eq!(
        hints(&mut session, &path)
            .into_iter()
            .map(|(line, _, _)| line)
            .collect::<Vec<_>>(),
        [5, 9],
        "hints follow the open text"
    );
}

#[test]
fn other_files_have_no_hints() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    session.open(&path, &spec_text);

    assert_eq!(hints(&mut session, &path), []);
}
