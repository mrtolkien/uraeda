//! Review commands and round submission from the editor: comments quote the committed text, a
//! verdict commits on the feature's branch through the user's hook, and a verdict or a round is
//! refused when the open text is not the one on disk.

use std::path::{Path, PathBuf};

use serde_json::{Value, json};

use crate::common::*;

const NVIM: &str = "specs/2026-10-13-nvim-plugin";
const BRANCH: &str = "2026-10-13-nvim-plugin";

fn uri(path: &Path) -> String {
    Session::uri(path).as_str().to_string()
}

fn abs(path: &Path) -> String {
    path.to_str().unwrap().to_string()
}

fn code(error: &lsp_server::ResponseError) -> Value {
    error
        .data
        .clone()
        .map_or(Value::Null, |data| data["code"].clone())
}

/// The example's spec on `BRANCH`, checked out, with `status` and `files` beside it.
fn feature_with(status: &str, files: &[(&str, &str)]) -> (TestRepo, PathBuf) {
    let repo = TestRepo::new();
    write_example(&repo);
    repo.commit("chore: specs");
    repo.switch_new(BRANCH);
    let spec = std::fs::read_to_string(example().join(FEATURE).join("spec.md")).unwrap();
    repo.write(&format!("{NVIM}/proposal.md"), &proposal());
    let spec = if status == "approved" {
        spec
    } else {
        spec.replace("status: approved", &format!("status: {status}"))
            .replace(
                "> [!NOTE]\n>\n> Approved on 2026-10-09.",
                "> [!IMPORTANT]\n>\n> Spec to review, about 20 minutes.",
            )
    };
    repo.write(&format!("{NVIM}/spec.md"), &spec);
    for (name, text) in files {
        repo.write(&format!("{NVIM}/{name}"), text);
    }
    repo.commit("spec(nvim-plugin): spec");
    let path = repo.path().join(NVIM).join("spec.md");
    (repo, path)
}

fn comment(
    session: &mut Session,
    path: &Path,
    text: &str,
) -> Result<Value, lsp_server::ResponseError> {
    session.command(
        "uraeda.comment",
        json!({ "uri": uri(path), "line": 75, "endLine": 77, "text": text }),
    )
}

#[test]
fn comments_quote_the_committed_lines_are_edited_and_removed_with_the_last_one() {
    let (repo, path) = feature_with("awaiting-human", &[]);
    let mut session = Session::start(repo.path());
    session.open(&path, &std::fs::read_to_string(&path).unwrap());
    let review = repo.path().join(NVIM).join("spec-review.md");
    let commits = repo.subjects(BRANCH).len();

    let commented = comment(&mut session, &path, "Rename this field").unwrap();

    assert_eq!(commented, json!({ "written": [abs(&review)] }));
    let text = repo.read(&format!("{NVIM}/spec-review.md"));
    assert!(
        text.contains("verdict: pending") && text.contains("Rename this field"),
        "{text}"
    );
    assert!(
        text.contains("> Completing a repeating task"),
        "the lines are quoted: {text}"
    );
    assert_eq!(
        (repo.subjects(BRANCH).len(), repo.hook_runs()),
        (commits, 0),
        "a comment is not a commit"
    );

    session
        .command(
            "uraeda.editComment",
            json!({ "uri": uri(&path), "number": 1, "text": "Rename it to tier" }),
        )
        .unwrap();
    assert!(
        repo.read(&format!("{NVIM}/spec-review.md"))
            .contains("Rename it to tier")
    );
    session
        .command(
            "uraeda.editComment",
            json!({ "uri": uri(&path), "number": 1, "text": "  \n" }),
        )
        .unwrap();
    assert!(!review.exists(), "the review goes with its last comment");
}

#[test]
fn a_comment_is_refused_on_a_spec_that_is_not_the_committed_one_or_not_waiting() {
    let (repo, path) = feature_with("awaiting-human", &[]);
    let text = std::fs::read_to_string(&path).unwrap();
    let mut session = Session::start(repo.path());
    session.open(&path, &format!("{text}An unsaved line.\n"));

    let unsaved = comment(&mut session, &path, "Rename this field").unwrap_err();
    let can = session
        .raw("uraeda/canComment", json!({ "uri": uri(&path) }))
        .unwrap_err();

    assert_eq!(
        (code(&unsaved), code(&can)),
        (json!("refused"), json!("refused"))
    );
    assert!(!repo.exists(&format!("{NVIM}/spec-review.md")));
    session.change(&path, &text);
    assert!(
        session
            .raw("uraeda/canComment", json!({ "uri": uri(&path) }))
            .is_ok(),
        "the committed text may be commented"
    );

    let (repo, path) = feature_with("approved", &[]);
    let mut session = Session::start(repo.path());
    assert_eq!(
        code(&comment(&mut session, &path, "Too late").unwrap_err()),
        json!("refused")
    );
    assert!(
        session
            .raw("uraeda/canComment", json!({ "uri": uri(&path) }))
            .is_err()
    );
}

#[test]
fn approving_commits_the_status_the_tier_and_the_review_on_the_features_branch_through_the_hook() {
    let (repo, path) = feature_with("awaiting-human", &[]);
    let mut session = Session::start(repo.path());
    comment(&mut session, &path, "Rename this field").unwrap();
    let commits = repo.subjects(BRANCH).len();

    let result = session
        .command(
            "uraeda.approve",
            json!({ "uri": uri(&path), "riskTier": "medium" }),
        )
        .unwrap();

    let review = repo.path().join(NVIM).join("spec-review.md");
    assert_eq!(result, json!({ "written": [abs(&path), abs(&review)] }));
    let spec = repo.read(&format!("{NVIM}/spec.md"));
    assert!(
        spec.contains("status: approved\n")
            && spec.contains("risk-tier: medium\n")
            && spec.contains("plan-review: false\n"),
        "{spec}"
    );
    assert!(
        repo.read(&format!("{NVIM}/spec-review.md"))
            .contains("verdict: approved")
    );
    assert_eq!(repo.subjects(BRANCH).len(), commits + 1);
    assert_eq!((repo.hook_runs(), repo.porcelain().as_str()), (1, ""));
}

#[test]
fn changes_need_a_comment_and_are_then_requested_with_a_summary() {
    let (repo, path) = feature_with("awaiting-human", &[]);
    let mut session = Session::start(repo.path());

    let none = session
        .command("uraeda.requestChanges", json!({ "uri": uri(&path) }))
        .unwrap_err();
    assert_eq!(code(&none), json!("refused"));
    comment(&mut session, &path, "Rename this field").unwrap();
    let commits = repo.subjects(BRANCH).len();

    let result = session
        .command(
            "uraeda.requestChanges",
            json!({ "uri": uri(&path), "summary": "Rename one field." }),
        )
        .unwrap();

    assert_eq!(result["written"][0], abs(&path));
    assert_eq!(repo.subjects(BRANCH).len(), commits + 1);
    let spec = repo.read(&format!("{NVIM}/spec.md"));
    assert!(
        spec.contains("status: changes-requested\n") && spec.contains("Rename one field."),
        "{spec}"
    );
}

#[test]
fn a_verdict_or_a_round_is_refused_when_the_open_text_is_not_the_one_on_disk() {
    let (repo, path) = feature_with("awaiting-human", &[]);
    let opened = std::fs::read_to_string(&path).unwrap();
    let mut session = Session::start(repo.path());
    session.open(&path, &opened);
    repo.write(
        &format!("{NVIM}/spec.md"),
        &opened.replace("## Edge cases", "## Edge cases, revised"),
    );
    repo.commit("spec(nvim-plugin): revise the spec");
    let commits = repo.subjects(BRANCH).len();

    for (command, args) in [
        (
            "uraeda.approve",
            json!({ "uri": uri(&path), "riskTier": "medium" }),
        ),
        ("uraeda.requestChanges", json!({ "uri": uri(&path) })),
    ] {
        assert_eq!(
            code(&session.command(command, args).unwrap_err()),
            json!("refused"),
            "{command}"
        );
    }
    assert_eq!(repo.subjects(BRANCH).len(), commits);
    session.change(&path, &std::fs::read_to_string(&path).unwrap());
    session
        .command(
            "uraeda.approve",
            json!({ "uri": uri(&path), "riskTier": "medium" }),
        )
        .unwrap();
    assert_eq!(
        repo.subjects(BRANCH).len(),
        commits + 1,
        "once the buffer has the disk's text, it goes through"
    );

    let round = clarifications("awaiting-human", "2 questions.", &["A", "B"]);
    let (repo, _) = feature_with("awaiting-human", &[("clarifications-01.md", &round)]);
    let path = repo.path().join(NVIM).join("clarifications-01.md");
    let mut session = Session::start(repo.path());
    session.open(&path, &round);
    repo.write(
        &format!("{NVIM}/clarifications-01.md"),
        &clarifications("awaiting-human", "2 questions.", &["A", "C"]),
    );
    let stale = session
        .command("uraeda.submit", json!({ "uri": uri(&path) }))
        .unwrap_err();
    assert_eq!(code(&stale), json!("refused"));
}

#[test]
fn only_the_waiting_latest_round_is_submitted_and_a_submit_commits_it() {
    let answered = clarifications("answered", "Answered on 2026-10-13.", &["A", "B"]);
    let waiting = clarifications("awaiting-human", "2 questions.", &["A", "B"]);
    let (repo, _) = feature_with(
        "awaiting-human",
        &[
            ("clarifications-01.md", &answered),
            ("clarifications-02.md", &waiting),
        ],
    );
    let mut session = Session::start(repo.path());
    let first = repo.path().join(NVIM).join("clarifications-01.md");
    let second = repo.path().join(NVIM).join("clarifications-02.md");
    let commits = repo.subjects(BRANCH).len();

    let answered_one = session
        .command("uraeda.submit", json!({ "uri": uri(&first) }))
        .unwrap_err();
    assert_eq!(
        code(&answered_one),
        json!("refused"),
        "an answered round never submits the next"
    );
    assert_eq!(repo.subjects(BRANCH).len(), commits);

    let result = session
        .command("uraeda.submit", json!({ "uri": uri(&second) }))
        .unwrap();

    assert_eq!(result, json!({ "written": [abs(&second)] }));
    assert!(
        repo.read(&format!("{NVIM}/clarifications-02.md"))
            .contains("status: answered\n")
    );
    assert_eq!(
        (repo.subjects(BRANCH).len(), repo.hook_runs()),
        (commits + 1, 1)
    );

    let (repo, _) = feature_with(
        "awaiting-human",
        &[
            ("clarifications-01.md", &waiting),
            ("clarifications-02.md", &waiting),
        ],
    );
    let mut session = Session::start(repo.path());
    let not_latest = session
        .command(
            "uraeda.submit",
            json!({ "uri": uri(&repo.path().join(NVIM).join("clarifications-01.md")) }),
        )
        .unwrap_err();
    assert_eq!(
        code(&not_latest),
        json!("refused"),
        "only the latest round is submitted"
    );
}

#[test]
fn a_hook_that_refuses_a_verdict_a_round_or_a_start_lists_the_files_it_left_written() {
    const FAIL: &str = "echo 'lint: no' >&2\nexit 1";
    let (repo, path) = feature_with("awaiting-human", &[]);
    repo.set_hook(FAIL);
    let mut session = Session::start(repo.path());
    comment(&mut session, &path, "Rename this field").unwrap();

    let error = session
        .command(
            "uraeda.approve",
            json!({ "uri": uri(&path), "riskTier": "medium" }),
        )
        .unwrap_err();

    let data = error.data.unwrap();
    assert_eq!(data["code"], "hook");
    let review = repo.path().join(NVIM).join("spec-review.md");
    assert_eq!(
        data["written"],
        json!([abs(&path), abs(&review)]),
        "the editor reloads what was written"
    );
    assert!(
        repo.read(&format!("{NVIM}/spec.md"))
            .contains("status: approved\n"),
        "the file is kept for the human"
    );

    let round = clarifications("awaiting-human", "2 questions.", &["A", "B"]);
    let (repo, _) = feature_with("awaiting-human", &[("clarifications-01.md", &round)]);
    repo.set_hook(FAIL);
    let path = repo.path().join(NVIM).join("clarifications-01.md");
    let mut session = Session::start(repo.path());
    let error = session
        .command("uraeda.submit", json!({ "uri": uri(&path) }))
        .unwrap_err();
    assert_eq!(error.data.unwrap()["written"], json!([abs(&path)]));
}
