mod common;

use std::path::{Path, PathBuf};
use std::sync::Once;

use common::*;
use serde_json::{Value, json};

/// The feature the review tests comment on, on its own branch.
const NVIM: &str = "specs/2026-10-13-nvim-plugin";
const BRANCH: &str = "2026-10-13-nvim-plugin";
const PRIORITIES: &str = "specs/PRIORITIES.md";

/// Today for every test of this file, set once before any git or server runs: the core reads it
/// from the process's environment, which every test shares.
fn on_2026_10_14() {
    static TODAY: Once = Once::new();
    // SAFETY: every test calls this through `new_repo` or `start` before it spawns git or a server,
    // and `call_once` makes the other threads wait until the variable is set, so no thread reads the
    // environment while it is written.
    TODAY.call_once(|| unsafe { std::env::set_var("URA_TODAY", "2026-10-14") });
}

/// A new repository, today set first, since creating it spawns git.
fn new_repo() -> TestRepo {
    on_2026_10_14();
    TestRepo::new()
}

fn start(root: &Path) -> Session {
    on_2026_10_14();
    Session::start(root)
}

fn uri(path: &Path) -> String {
    Session::uri(path).as_str().to_string()
}

fn abs(path: &Path) -> String {
    path.to_str().unwrap().to_string()
}

/// A repository on `main` with `specs/` and the priorities `priorities`, committed.
fn with_priorities(priorities: &str) -> TestRepo {
    let repo = new_repo();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(PRIORITIES, priorities);
    repo.commit("chore: specs");
    repo
}

const LATER: &str =
    "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n- Codex runtime\n\n## Blocked\n";

/// US2.1
#[test]
fn a_line_becomes_a_draft() {
    let repo = with_priorities(LATER);
    let path = repo.path().join(PRIORITIES);
    let mut session = start(repo.path());
    session.open(&path, LATER);

    let result = session
        .command("uraeda.draft", json!({ "uri": uri(&path), "line": 9 }))
        .unwrap();

    let draft = repo.path().join("specs/drafts/codex-runtime.md");
    assert_eq!(
        result,
        json!({ "opened": abs(&draft), "written": [abs(&draft), abs(&path)] })
    );
    assert!(
        repo.read("specs/drafts/codex-runtime.md")
            .contains("# Codex runtime")
    );
    assert!(
        repo.read(PRIORITIES)
            .contains("\n- [Codex runtime](drafts/codex-runtime.md)\n")
    );
    assert_eq!(repo.subjects("main"), ["chore: specs", "chore: start"]);
    assert_eq!(repo.hook_runs(), 0);
}

/// US2.2
#[test]
fn a_linked_line_opens_its_draft() {
    let priorities = LATER.replace(
        "- Codex runtime",
        "- [Codex runtime](drafts/codex-runtime.md)",
    );
    let repo = with_priorities(&priorities);
    repo.write("specs/drafts/codex-runtime.md", "# Codex runtime\n");
    let path = repo.path().join(PRIORITIES);
    let mut session = start(repo.path());
    session.open(&path, &priorities);

    let result = session
        .command("uraeda.draft", json!({ "uri": uri(&path), "line": 9 }))
        .unwrap();

    let draft = repo.path().join("specs/drafts/codex-runtime.md");
    assert_eq!(result, json!({ "opened": abs(&draft), "written": [] }));
    assert_eq!(repo.read(PRIORITIES), priorities);
}

/// Review focus 2: a wrapped entry is drafted from its second line.
#[test]
fn the_second_line_of_a_wrapped_entry_drafts_it() {
    let priorities = LATER.replace("- Codex runtime", "- Codex runtime\n  for agents");
    let repo = with_priorities(&priorities);
    let path = repo.path().join(PRIORITIES);
    let mut session = start(repo.path());
    session.open(&path, &priorities);

    let result = session
        .command("uraeda.draft", json!({ "uri": uri(&path), "line": 10 }))
        .unwrap();

    let draft = repo.path().join("specs/drafts/codex-runtime-for-agents.md");
    assert_eq!(result["opened"], abs(&draft));
    assert!(draft.exists());
}

/// Review focus 2: a nested sub-item, or a line in no entry, is not drafted.
#[test]
fn a_nested_line_is_not_an_entry() {
    let priorities = LATER.replace("- Codex runtime", "- Codex runtime\n  - A detail");
    let repo = with_priorities(&priorities);
    let path = repo.path().join(PRIORITIES);
    let mut session = start(repo.path());
    session.open(&path, &priorities);

    for line in [10, 7] {
        let error = session
            .command("uraeda.draft", json!({ "uri": uri(&path), "line": line }))
            .unwrap_err();
        assert_eq!(
            error.message, "This line is not a priorities entry.",
            "line {line}"
        );
        assert_eq!(error.data, Some(json!({ "code": "refused" })));
    }
    assert!(!repo.exists("specs/drafts"));
}

/// Edge case: the priorities changed on disk since they were opened.
#[test]
fn priorities_changed_on_disk_refuse_the_draft() {
    let repo = with_priorities(LATER);
    let path = repo.path().join(PRIORITIES);
    let mut session = start(repo.path());
    session.open(&path, LATER);
    repo.write(
        PRIORITIES,
        &LATER.replace("## Now\n", "## Now\n\n- Elsewhere\n"),
    );

    let error = session
        .command("uraeda.draft", json!({ "uri": uri(&path), "line": 9 }))
        .unwrap_err();

    assert_eq!(
        error.message,
        "PRIORITIES.md changed on disk. Nothing was drafted."
    );
    assert_eq!(error.data, Some(json!({ "code": "conflict" })));
    assert!(!repo.exists("specs/drafts"));
}

/// A repository on `main` with the draft `specs/drafts/codex-runtime.md` linked from Later.
fn with_draft(committed: bool) -> TestRepo {
    let priorities = LATER.replace(
        "- Codex runtime",
        "- [Codex runtime](drafts/codex-runtime.md)",
    );
    let repo = with_priorities(if committed { &priorities } else { LATER });
    if committed {
        repo.write(
            "specs/drafts/codex-runtime.md",
            "# Codex runtime\n\n## What\n\nA runtime.\n",
        );
        repo.commit("chore: draft Codex runtime");
    } else {
        repo.write(PRIORITIES, &priorities);
        repo.write(
            "specs/drafts/codex-runtime.md",
            "# Codex runtime\n\n## What\n\nA runtime.\n",
        );
    }
    repo
}

/// US3.1, and the progress every command reports.
#[test]
fn a_draft_starts_a_feature() {
    let repo = with_draft(true);
    let path = repo.path().join("specs/drafts/codex-runtime.md");
    let mut session = start(repo.path());

    let result = session
        .command("uraeda.start", json!({ "uri": uri(&path) }))
        .unwrap();

    let folder = "2026-10-14-codex-runtime";
    let proposal = repo
        .path()
        .join(format!(".worktrees/{folder}/specs/{folder}/proposal.md"));
    assert_eq!(
        result,
        json!({
            "opened": abs(&proposal),
            "written": [abs(&repo.path().join(PRIORITIES)), abs(&path)],
        })
    );
    assert!(proposal.exists());
    assert_eq!(
        repo.subjects("main")[0],
        "chore(codex-runtime): start Codex runtime"
    );
    assert_eq!(repo.subjects(folder)[0], "chore(codex-runtime): proposal");
    assert_eq!(repo.hook_runs(), 2);

    let created = session.server_requests("window/workDoneProgress/create");
    assert_eq!(created.len(), 1);
    let token = &created[0]["token"];
    let progress: Vec<Value> = session
        .notifications("$/progress")
        .into_iter()
        .filter(|params| &params["token"] == token)
        .map(|params| params["value"].clone())
        .collect();
    assert_eq!(
        progress,
        [
            json!({ "kind": "begin", "title": "Starting Codex runtime…" }),
            json!({ "kind": "end", "message": format!("Started {folder}") }),
        ]
    );
}

/// US3.2
#[test]
fn a_spec_cannot_be_started() {
    let (repo, path) = feature("awaiting-human");
    let mut session = start(repo.path());

    let error = session
        .command("uraeda.start", json!({ "uri": uri(&path) }))
        .unwrap_err();

    assert_eq!(
        error.message,
        "Only a draft or a backlog file can be started."
    );
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
    assert_eq!(repo.porcelain(), "");
}

/// A repository whose branch `2026-10-13-nvim-plugin`, checked out, holds the example's spec with
/// `status`, its block waiting for the human unless approved, and a proposal, committed; returns it
/// and the spec's path.
fn feature(status: &str) -> (TestRepo, PathBuf) {
    feature_with(status, &[])
}

fn feature_with(status: &str, files: &[(&str, &str)]) -> (TestRepo, PathBuf) {
    let repo = new_repo();
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

/// US4.1
#[test]
fn a_comment_quotes_its_lines() {
    let (repo, path) = feature("awaiting-human");
    let mut session = start(repo.path());
    session.open(&path, &std::fs::read_to_string(&path).unwrap());

    let result = comment(&mut session, &path, "Rename this field").unwrap();

    let review_path = repo.path().join(NVIM).join("spec-review.md");
    assert_eq!(result, json!({ "written": [abs(&review_path)] }));
    let review = repo.read(&format!("{NVIM}/spec-review.md"));
    assert!(review.contains("verdict: pending"), "{review}");
    assert!(
        review.contains("## C1: Lines 75–77, under \"US2: Complete a repeating task (P1)\""),
        "{review}"
    );
    assert!(
        review.contains("> Completing a repeating task moves it"),
        "{review}"
    );
    assert!(review.contains("\nRename this field\n"), "{review}");
    assert_eq!(repo.subjects(BRANCH)[0], "spec(nvim-plugin): spec");
    assert_eq!(repo.hook_runs(), 0);
}

/// US4.2, US4.3
#[test]
fn a_comment_is_edited_then_removed() {
    let (repo, path) = feature("awaiting-human");
    let mut session = start(repo.path());
    comment(&mut session, &path, "Rename this field").unwrap();
    let review_path = repo.path().join(NVIM).join("spec-review.md");

    let edited = session
        .command(
            "uraeda.editComment",
            json!({ "uri": uri(&path), "number": 1, "text": "Rename it to tier" }),
        )
        .unwrap();

    assert_eq!(edited, json!({ "written": [abs(&review_path)] }));
    let review = repo.read(&format!("{NVIM}/spec-review.md"));
    assert!(review.contains("\nRename it to tier\n"), "{review}");
    assert!(!review.contains("Rename this field"), "{review}");

    let removed = session
        .command(
            "uraeda.editComment",
            json!({ "uri": uri(&path), "number": 1, "text": "  \n" }),
        )
        .unwrap();

    assert_eq!(removed, json!({ "written": [abs(&review_path)] }));
    assert!(
        !review_path.exists(),
        "the review goes with its last comment"
    );
}

/// US4.4
#[test]
fn an_uncommitted_spec_refuses_comments() {
    let (repo, path) = feature("awaiting-human");
    let text = std::fs::read_to_string(&path).unwrap();
    let mut session = start(repo.path());
    session.open(&path, &format!("{text}An unsaved line.\n"));

    let error = comment(&mut session, &path, "Rename this field").unwrap_err();

    assert_eq!(
        error.message,
        "spec.md differs from its last commit: comments point at the committed version. \
         Commit or undo the change first."
    );
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
    assert!(!repo.exists(&format!("{NVIM}/spec-review.md")));
}

/// US4.5
#[test]
fn an_approved_spec_refuses_comments() {
    let (repo, path) = feature("approved");
    let mut session = start(repo.path());

    let error = comment(&mut session, &path, "Rename this field").unwrap_err();

    assert_eq!(error.message, "spec.md is not waiting for a review.");
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
}

/// US4.4, US4.5: the editor asks before it opens its comment window, and writes nothing.
#[test]
fn can_comment_refuses_like_a_comment() {
    let (repo, path) = feature("awaiting-human");
    let text = std::fs::read_to_string(&path).unwrap();
    let mut session = start(repo.path());
    session.open(&path, &text);

    let allowed = session.raw("uraeda/canComment", json!({ "uri": uri(&path) }));

    assert_eq!(allowed.map_err(|error| error.message), Ok(Value::Null));
    session.change(&path, &format!("{text}An unsaved line.\n"));
    let error = session
        .raw("uraeda/canComment", json!({ "uri": uri(&path) }))
        .unwrap_err();
    assert_eq!(
        error.message,
        "spec.md differs from its last commit: comments point at the committed version. \
         Commit or undo the change first."
    );
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
    assert!(!repo.exists(&format!("{NVIM}/spec-review.md")));

    let (repo, path) = feature("approved");
    let mut session = start(repo.path());
    let error = session
        .raw("uraeda/canComment", json!({ "uri": uri(&path) }))
        .unwrap_err();
    assert_eq!(error.message, "spec.md is not waiting for a review.");
}

/// US6.1
#[test]
fn approving_records_the_block_and_commits() {
    let (repo, path) = feature("awaiting-human");
    let mut session = start(repo.path());
    comment(&mut session, &path, "Rename this field").unwrap();

    let result = session
        .command(
            "uraeda.approve",
            json!({ "uri": uri(&path), "riskTier": "medium" }),
        )
        .unwrap();

    let review_path = repo.path().join(NVIM).join("spec-review.md");
    assert_eq!(
        result,
        json!({ "written": [abs(&path), abs(&review_path)] })
    );
    let spec = repo.read(&format!("{NVIM}/spec.md"));
    assert!(spec.contains("status: approved\n"), "{spec}");
    assert!(spec.contains("risk-tier: medium\n"), "{spec}");
    assert!(spec.contains("plan-review: false\n"), "{spec}");
    assert!(spec.contains("Approved on 2026-10-14."), "{spec}");
    assert!(
        repo.read(&format!("{NVIM}/spec-review.md"))
            .contains("verdict: approved")
    );
    assert_eq!(repo.subjects(BRANCH)[0], "spec(nvim-plugin): approve");
    assert_eq!(repo.hook_runs(), 1);
    assert_eq!(repo.porcelain(), "");
}

/// Final review: a verdict is refused when the open spec is not the one on disk, as when another
/// process committed a revised spec behind the buffer: the human never saw what would be approved.
#[test]
fn a_verdict_is_refused_on_a_version_not_open() {
    let (repo, path) = feature("awaiting-human");
    let opened = std::fs::read_to_string(&path).unwrap();
    let mut session = start(repo.path());
    session.open(&path, &opened);
    repo.write(
        &format!("{NVIM}/spec.md"),
        &opened.replace("## Edge cases", "## Edge cases, revised"),
    );
    repo.commit("spec(nvim-plugin): revise the spec");

    for (command, args) in [
        (
            "uraeda.approve",
            json!({ "uri": uri(&path), "riskTier": "medium" }),
        ),
        ("uraeda.requestChanges", json!({ "uri": uri(&path) })),
    ] {
        let error = session.command(command, args).unwrap_err();
        assert_eq!(
            error.message,
            "spec.md changed since it was opened: reload it and review it again."
        );
        assert_eq!(error.data, Some(json!({ "code": "refused" })));
    }
    assert_eq!(
        repo.subjects(BRANCH)[0],
        "spec(nvim-plugin): revise the spec"
    );

    // Once the buffer has the disk's text, the verdict goes through.
    session.change(&path, &std::fs::read_to_string(&path).unwrap());
    session
        .command(
            "uraeda.approve",
            json!({ "uri": uri(&path), "riskTier": "medium" }),
        )
        .unwrap();
    assert_eq!(repo.subjects(BRANCH)[0], "spec(nvim-plugin): approve");
}

/// Final review: a round is not submitted when its open text is not the one on disk.
#[test]
fn a_round_is_refused_on_a_version_not_open() {
    let round = clarifications("awaiting-human", "2 questions.", &["A", "B"]);
    let (repo, _) = feature_with("awaiting-human", &[("clarifications-01.md", &round)]);
    let path = repo.path().join(NVIM).join("clarifications-01.md");
    let mut session = start(repo.path());
    session.open(&path, &round);
    repo.write(
        &format!("{NVIM}/clarifications-01.md"),
        &clarifications("awaiting-human", "2 questions.", &["A", "C"]),
    );

    let error = session
        .command("uraeda.submit", json!({ "uri": uri(&path) }))
        .unwrap_err();

    assert_eq!(
        error.message,
        "clarifications-01.md changed since it was opened: reload it and check its answers again."
    );
    assert_eq!(repo.subjects(BRANCH)[0], "spec(nvim-plugin): spec");
}

/// US6.2
#[test]
fn changes_need_a_comment() {
    let (repo, path) = feature("awaiting-human");
    let mut session = start(repo.path());

    let error = session
        .command("uraeda.requestChanges", json!({ "uri": uri(&path) }))
        .unwrap_err();

    assert_eq!(
        error.message,
        "Requesting changes needs at least one comment."
    );
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
    assert_eq!(repo.subjects(BRANCH)[0], "spec(nvim-plugin): spec");

    comment(&mut session, &path, "Rename this field").unwrap();
    let result = session
        .command(
            "uraeda.requestChanges",
            json!({ "uri": uri(&path), "summary": "Rename one field." }),
        )
        .unwrap();
    assert_eq!(result["written"][0], abs(&path));
    assert_eq!(
        repo.subjects(BRANCH)[0],
        "spec(nvim-plugin): request changes"
    );
    assert!(
        repo.read(&format!("{NVIM}/spec.md"))
            .contains("Changes requested on 2026-10-14: Rename one field.")
    );
}

/// US6.3
#[test]
fn a_round_is_submitted() {
    let round = clarifications("awaiting-human", "2 questions.", &["A", "B"]);
    let (repo, _) = feature_with("awaiting-human", &[("clarifications-01.md", &round)]);
    let path = repo.path().join(NVIM).join("clarifications-01.md");
    let mut session = start(repo.path());

    let result = session
        .command("uraeda.submit", json!({ "uri": uri(&path) }))
        .unwrap();

    assert_eq!(result, json!({ "written": [abs(&path)] }));
    let submitted = repo.read(&format!("{NVIM}/clarifications-01.md"));
    assert!(submitted.contains("status: answered\n"), "{submitted}");
    assert!(submitted.contains("Answered on 2026-10-14."), "{submitted}");
    assert_eq!(
        repo.subjects(BRANCH)[0],
        "discovery(nvim-plugin): answer round 01"
    );
    assert_eq!(repo.hook_runs(), 1);
}

/// Final review: only the round in the buffer is submitted, when it waits and is the latest; an
/// answered round never submits the next one.
#[test]
fn only_the_waiting_latest_round_is_submitted() {
    let answered = clarifications("answered", "Answered on 2026-10-13.", &["A", "B"]);
    let waiting = clarifications("awaiting-human", "2 questions.", &["A", "B"]);
    let (repo, _) = feature_with(
        "awaiting-human",
        &[
            ("clarifications-01.md", &answered),
            ("clarifications-02.md", &waiting),
        ],
    );
    let first = repo.path().join(NVIM).join("clarifications-01.md");
    let mut session = start(repo.path());

    let error = session
        .command("uraeda.submit", json!({ "uri": uri(&first) }))
        .unwrap_err();

    assert_eq!(
        error.message,
        "clarifications-01.md is not waiting for answers."
    );
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
    assert_eq!(repo.subjects(BRANCH)[0], "spec(nvim-plugin): spec");

    let (repo, _) = feature_with(
        "awaiting-human",
        &[
            ("clarifications-01.md", &waiting),
            ("clarifications-02.md", &waiting),
        ],
    );
    let first = repo.path().join(NVIM).join("clarifications-01.md");
    let mut session = start(repo.path());
    let error = session
        .command("uraeda.submit", json!({ "uri": uri(&first) }))
        .unwrap_err();
    assert_eq!(
        error.message,
        "clarifications-01.md is not the latest round: clarifications-02.md is"
    );
    assert_eq!(repo.subjects(BRANCH)[0], "spec(nvim-plugin): spec");
}

/// US7.1, US7.2
#[test]
fn drafts_proposals_and_priorities_are_committed() {
    let repo = with_draft(false);
    let draft = repo.path().join("specs/drafts/codex-runtime.md");
    let mut session = start(repo.path());

    let result = session
        .command("uraeda.commit", json!({ "uri": uri(&draft) }))
        .unwrap();

    assert_eq!(result, json!({ "written": [] }));
    assert_eq!(repo.subjects("main")[0], "chore: draft Codex runtime");
    assert_eq!(
        repo.changed_in("HEAD"),
        [PRIORITIES, "specs/drafts/codex-runtime.md"]
    );

    repo.write(
        PRIORITIES,
        &repo
            .read(PRIORITIES)
            .replace("## Now\n", "## Now\n\n- A new line\n"),
    );
    let priorities = repo.path().join(PRIORITIES);
    session
        .command("uraeda.commit", json!({ "uri": uri(&priorities) }))
        .unwrap();
    assert_eq!(repo.changed_in("HEAD"), [PRIORITIES]);
    assert_eq!(repo.porcelain(), "");
    assert_eq!(repo.hook_runs(), 2);

    let (repo, _) = feature("awaiting-human");
    repo.write(
        &format!("{NVIM}/proposal.md"),
        &format!("{}\nMore.\n", proposal()),
    );
    let path = repo.path().join(NVIM).join("proposal.md");
    let mut session = start(repo.path());
    session
        .command("uraeda.commit", json!({ "uri": uri(&path) }))
        .unwrap();
    assert_eq!(
        repo.subjects(BRANCH)[0],
        "chore(nvim-plugin): edit the proposal"
    );
}

/// Drafts and the priorities are written on `main`, from its checkout: in a feature's worktree,
/// their copies stand for `main`'s only while they hold the same text. Edited copies are refused,
/// pointing at `main`'s checkout, and an unchanged one starts its feature.
#[test]
fn a_worktree_acts_on_mains_drafts_and_priorities() {
    let repo = with_draft(true);
    repo.write("specs/backlog/benchmarks.md", "# Benchmarks\n");
    repo.commit("chore: backlog");
    let worktree = repo.path().join(".worktrees/feat");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        "-b",
        "feat",
        worktree.to_str().unwrap(),
    ]);
    let priorities = worktree.join(PRIORITIES);
    let edited = std::fs::read_to_string(&priorities)
        .unwrap()
        .replace("## Now\n", "## Now\n\n- A new line\n");
    std::fs::write(&priorities, &edited).unwrap();
    let draft = worktree.join("specs/drafts/codex-runtime.md");
    std::fs::write(&draft, "# Codex runtime\n\n## What\n\nEdited here.\n").unwrap();
    let backlog = worktree.join("specs/backlog/benchmarks.md");
    let mut session = start(&worktree);
    session.open(&priorities, &edited);
    let main = abs(repo.path());

    let refusals = [
        (
            "uraeda.draft",
            json!({ "uri": uri(&priorities), "line": 5 }),
        ),
        ("uraeda.commit", json!({ "uri": uri(&priorities) })),
        ("uraeda.commit", json!({ "uri": uri(&draft) })),
        ("uraeda.start", json!({ "uri": uri(&draft) })),
    ];
    for (command, args) in refusals {
        let error = session.command(command, args.clone()).unwrap_err();
        let name = if args["uri"] == uri(&priorities) {
            "PRIORITIES.md"
        } else {
            "codex-runtime.md"
        };
        assert_eq!(
            error.message,
            format!("{name} here differs from main's: open it from main's checkout, {main}."),
            "{command} {args}"
        );
        assert_eq!(error.data, Some(json!({ "code": "refused" })));
    }
    assert_eq!(repo.subjects("main")[0], "chore: backlog");
    assert_eq!(repo.git(&["status", "--porcelain", "--", "specs"]), "");
    assert!(!repo.exists("specs/drafts/a-new-line.md"));

    let result = session
        .command("uraeda.start", json!({ "uri": uri(&backlog) }))
        .unwrap();

    let folder = "2026-10-14-benchmarks";
    assert_eq!(
        result["opened"],
        json!(abs(&repo.path().join(format!(
            ".worktrees/{folder}/specs/{folder}/proposal.md"
        ))))
    );
    assert_eq!(
        result["written"],
        json!([
            abs(&repo.path().join(PRIORITIES)),
            abs(&repo.path().join("specs/backlog/benchmarks.md")),
        ])
    );
    assert!(
        repo.subjects("main")[0].starts_with("chore(benchmarks): start"),
        "{:?}",
        repo.subjects("main")
    );
    assert_eq!(repo.subjects("feat")[0], "chore: backlog");
}

/// US7.3
#[test]
fn a_spec_is_not_committed() {
    let (repo, path) = feature("awaiting-human");
    let mut session = start(repo.path());

    let error = session
        .command("uraeda.commit", json!({ "uri": uri(&path) }))
        .unwrap_err();

    assert_eq!(
        error.message,
        "Only drafts, backlog files, proposals, PRIORITIES.md, and INBOX.md are committed from the editor."
    );
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
}

/// Edge case: a hook refuses the commit; its output comes with the error, and the files stay.
#[test]
fn a_failing_hook_reports_its_output() {
    let repo = with_draft(false);
    repo.set_hook("echo 'lint: draft too short' >&2\nexit 1");
    let draft = repo.path().join("specs/drafts/codex-runtime.md");
    let mut session = start(repo.path());

    let error = session
        .command("uraeda.commit", json!({ "uri": uri(&draft) }))
        .unwrap_err();

    assert!(
        error.message.starts_with("git commit failed"),
        "{}",
        error.message
    );
    let data = error.data.unwrap();
    assert_eq!(data["code"], "hook");
    assert!(
        data["output"]
            .as_str()
            .unwrap()
            .contains("lint: draft too short"),
        "{data}"
    );
    assert!(draft.exists());
    assert_eq!(repo.subjects("main")[0], "chore: specs");
}

/// Final review: a hook refusing a verdict, a round, or a start leaves files written; the error
/// lists them, so the editor reloads them.
#[test]
fn a_failing_hook_lists_the_files_written() {
    const FAIL: &str = "echo 'lint: no' >&2\nexit 1";
    let (repo, path) = feature("awaiting-human");
    repo.set_hook(FAIL);
    let mut session = start(repo.path());
    comment(&mut session, &path, "Rename this field").unwrap();
    let error = session
        .command(
            "uraeda.approve",
            json!({ "uri": uri(&path), "riskTier": "medium" }),
        )
        .unwrap_err();
    let review = repo.path().join(NVIM).join("spec-review.md");
    let data = error.data.unwrap();
    assert_eq!(data["code"], "hook");
    assert_eq!(data["written"], json!([abs(&path), abs(&review)]));
    assert!(
        repo.read(&format!("{NVIM}/spec.md"))
            .contains("status: approved\n")
    );

    let round = clarifications("awaiting-human", "2 questions.", &["A", "B"]);
    let (repo, _) = feature_with("awaiting-human", &[("clarifications-01.md", &round)]);
    repo.set_hook(FAIL);
    let path = repo.path().join(NVIM).join("clarifications-01.md");
    let mut session = start(repo.path());
    let error = session
        .command("uraeda.submit", json!({ "uri": uri(&path) }))
        .unwrap_err();
    assert_eq!(error.data.unwrap()["written"], json!([abs(&path)]));

    let repo = with_draft(true);
    repo.set_hook(FAIL);
    let path = repo.path().join("specs/drafts/codex-runtime.md");
    let mut session = start(repo.path());
    let error = session
        .command("uraeda.start", json!({ "uri": uri(&path) }))
        .unwrap_err();
    // The start commit failed: the priorities are written, the draft is where it was.
    assert_eq!(
        error.data.unwrap()["written"],
        json!([abs(&repo.path().join(PRIORITIES))])
    );
    assert!(path.exists());
}

/// A refusal before any write lists nothing.
#[test]
fn a_refusal_lists_no_files() {
    let (repo, path) = feature("approved");
    let mut session = start(repo.path());
    let error = session
        .command("uraeda.approve", json!({ "uri": uri(&path) }))
        .unwrap_err();
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
}

/// Creates the file `go` when dropped, which the hook of
/// `requests_are_answered_while_a_command_runs` waits for: dropped on a failed assertion too, so the
/// hook never outlives the test. A test killed before, by a timeout, removes nothing: the hook also
/// stops once its repository is gone.
struct Go(PathBuf);

impl Drop for Go {
    fn drop(&mut self) {
        std::fs::write(&self.0, "").unwrap();
    }
}

/// Edge case: the loop answers requests while a command runs.
#[test]
fn requests_are_answered_while_a_command_runs() {
    let repo = with_draft(false);
    repo.set_hook(
        "until [ -e \"$(git rev-parse --git-common-dir)/go\" ] || [ ! -e .git ]; do sleep 0.01; done\n\
         echo run >> \"$(git rev-parse --git-common-dir)/hook-runs\"",
    );
    let draft = repo.path().join("specs/drafts/codex-runtime.md");
    let mut session = start(repo.path());
    let go = Go(repo.path().join(".git/go"));

    let command = session.start_command("uraeda.commit", json!({ "uri": uri(&draft) }));
    let fields = session.raw("uraeda/fields", json!({ "uri": uri(&draft) }));

    assert!(fields.is_ok());
    assert!(!session.answered(&command), "the command still runs");
    drop(go);
    session.response(&command).unwrap();
    assert_eq!(repo.subjects("main")[0], "chore: draft Codex runtime");
    assert_eq!(repo.hook_runs(), 1);
}

#[test]
fn an_unknown_command_is_refused() {
    let repo = with_priorities(LATER);
    let mut session = start(repo.path());

    let error = session.command("uraeda.dance", json!({})).unwrap_err();

    assert_eq!(error.message, "unknown command uraeda.dance");
}

/// A fixture image's path.
fn fixture_image(name: &str) -> String {
    abs(&repository().join("fixtures/images").join(name))
}

/// US5.2: the file is re-encoded next to the proposal, and its link returned; nothing is committed.
#[test]
fn an_image_is_attached_to_the_open_proposal() {
    let (repo, _) = feature("awaiting-human");
    let path = repo.path().join(NVIM).join("proposal.md");
    let mut session = start(repo.path());
    session.open(&path, &std::fs::read_to_string(&path).unwrap());

    let result = session
        .command(
            "uraeda.attachImage",
            json!({ "uri": uri(&path), "path": fixture_image("desktop.png"), "name": "desktop.png" }),
        )
        .unwrap();

    let image = repo.path().join(NVIM).join("images/desktop.webp");
    assert_eq!(
        result,
        json!({ "written": [abs(&image)], "link": "![desktop](images/desktop.webp)" })
    );
    assert_eq!(&std::fs::read(&image).unwrap()[8..12], b"WEBP");
    assert_eq!(repo.subjects(BRANCH)[0], "spec(nvim-plugin): spec");
    assert_eq!(repo.hook_runs(), 0);
}

/// US5.3: a single-file draft becomes a folder, which the editor opens.
#[test]
fn a_draft_moved_into_a_folder_is_opened() {
    let repo = with_draft(false);
    let draft = repo.path().join("specs/drafts/codex-runtime.md");
    let mut session = start(repo.path());
    session.open(&draft, &std::fs::read_to_string(&draft).unwrap());

    let result = session
        .command(
            "uraeda.attachImage",
            json!({ "uri": uri(&draft), "path": fixture_image("still.gif"), "name": "login.png" }),
        )
        .unwrap();

    let proposal = repo.path().join("specs/drafts/codex-runtime/proposal.md");
    let image = repo
        .path()
        .join("specs/drafts/codex-runtime/images/login.webp");
    assert_eq!(
        result,
        json!({
            "opened": abs(&proposal),
            "written": [abs(&image), abs(&proposal), abs(&repo.path().join(PRIORITIES))],
            "link": "![login](images/login.webp)",
        })
    );
    assert!(!draft.exists());
    assert!(image.exists());
    assert!(
        repo.read(PRIORITIES)
            .contains("(drafts/codex-runtime/proposal.md)")
    );
}

/// The core's refusals pass as they are, and nothing is written.
#[test]
fn an_attached_file_that_is_no_image_is_refused() {
    let (repo, _) = feature("awaiting-human");
    let path = repo.path().join(NVIM).join("proposal.md");
    let mut session = start(repo.path());

    let error = session
        .command(
            "uraeda.attachImage",
            json!({ "uri": uri(&path), "path": fixture_image("drawing.svg"), "name": "drawing.svg" }),
        )
        .unwrap_err();

    assert_eq!(
        error.message,
        "Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one."
    );
    assert!(!repo.exists(&format!("{NVIM}/images")));
}

/// Review: a file over the core's 20 MB is refused by its size, with the core's text, before it is
/// read, and before the feature's worktree is made.
#[test]
fn an_image_file_over_20_mb_is_refused_unread() {
    let (repo, _) = feature("awaiting-human");
    repo.switch("main");
    let path = repo.path().join(NVIM).join("proposal.md");
    let mut session = start(repo.path());
    let big = repo.path().join("big.png");
    let size = uraeda_core::images::MAX_BYTES + 1;
    // Sparse, no 20 MB written, and no image: read, its bytes would be refused by their type.
    std::fs::File::create(&big)
        .unwrap()
        .set_len(size as u64)
        .unwrap();

    let error = session
        .command(
            "uraeda.attachImage",
            json!({ "uri": uri(&path), "path": abs(&big), "name": "big.png" }),
        )
        .unwrap_err();

    let expected = uraeda_core::images::ImageError::Size {
        name: "big.png".into(),
        bytes: size,
    };
    assert_eq!(error.message, expected.to_string());
    assert_eq!(error.data, Some(json!({ "code": "refused" })));
    assert!(!repo.exists(".worktrees"));
}

/// A path that cannot be read is said, and nothing is written.
#[test]
fn a_missing_image_file_is_refused() {
    let (repo, _) = feature("awaiting-human");
    let path = repo.path().join(NVIM).join("proposal.md");
    let mut session = start(repo.path());
    let missing = repo.path().join("missing.png");

    let error = session
        .command(
            "uraeda.attachImage",
            json!({ "uri": uri(&path), "path": abs(&missing), "name": "missing.png" }),
        )
        .unwrap_err();

    assert_eq!(
        error.message,
        format!(
            "{} could not be read: No such file or directory.",
            abs(&missing)
        )
    );
    assert!(!repo.exists(&format!("{NVIM}/images")));
}

/// Task 12 review: a file that cannot be read is refused before the feature's worktree is made.
#[test]
fn a_missing_image_file_makes_no_worktree() {
    let (repo, _) = feature("awaiting-human");
    repo.switch("main");
    let path = repo.path().join(NVIM).join("proposal.md");
    let mut session = start(repo.path());
    let missing = repo.path().join("missing.png");

    let error = session
        .command(
            "uraeda.attachImage",
            json!({ "uri": uri(&path), "path": abs(&missing), "name": "missing.png" }),
        )
        .unwrap_err();

    assert!(
        error.message.contains("could not be read"),
        "{}",
        error.message
    );
    assert!(!repo.exists(".worktrees"));
}

/// A worktree of the feature `feat`, beside `main`'s checkout, holding a folder draft committed on
/// `main`.
fn worktree_with_folder_draft() -> (TestRepo, std::path::PathBuf) {
    let repo = with_priorities(LATER);
    repo.write(
        "specs/drafts/codex-runtime/proposal.md",
        "# Codex runtime\n\n## What\n\nA runtime.\n",
    );
    repo.commit("chore: draft Codex runtime");
    let worktree = repo.path().join(".worktrees/feat");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        "-b",
        "feat",
        worktree.to_str().unwrap(),
    ]);
    (repo, worktree)
}

/// Drafts are written on `main` from any checkout (the git decision): from a feature's worktree,
/// an unchanged copy's image goes into `main`'s checkout, whose file opens to take the link.
#[test]
fn an_image_of_a_draft_from_a_worktree_goes_to_mains_checkout() {
    let (repo, worktree) = worktree_with_folder_draft();
    let copy = worktree.join("specs/drafts/codex-runtime/proposal.md");
    let mut session = start(&worktree);
    session.open(&copy, &std::fs::read_to_string(&copy).unwrap());

    let result = session
        .command(
            "uraeda.attachImage",
            json!({ "uri": uri(&copy), "path": fixture_image("still.gif"), "name": "login.png" }),
        )
        .unwrap();

    let folder = repo.path().join("specs/drafts/codex-runtime");
    assert_eq!(
        result,
        json!({
            "opened": abs(&folder.join("proposal.md")),
            "written": [abs(&folder.join("images/login.webp"))],
            "link": "![login](images/login.webp)",
        })
    );
    assert!(folder.join("images/login.webp").exists());
    assert!(!worktree.join("specs/drafts/codex-runtime/images").exists());
}

/// An edited copy of a draft in a feature's worktree is refused, naming `main`'s checkout, and no
/// image is written.
#[test]
fn an_image_of_an_edited_draft_copy_is_refused() {
    let (repo, worktree) = worktree_with_folder_draft();
    let copy = worktree.join("specs/drafts/codex-runtime/proposal.md");
    std::fs::write(&copy, "# Codex runtime\n\n## What\n\nEdited here.\n").unwrap();
    let mut session = start(&worktree);

    let error = session
        .command(
            "uraeda.attachImage",
            json!({ "uri": uri(&copy), "path": fixture_image("still.gif"), "name": "login.png" }),
        )
        .unwrap_err();

    assert_eq!(
        error.message,
        format!(
            "proposal.md here differs from main's: open it from main's checkout, {}.",
            abs(repo.path())
        )
    );
    assert!(!repo.exists("specs/drafts/codex-runtime/images"));
}

const INBOX: &str = "specs/INBOX.md";

/// A repository on `main` with the fixture's `INBOX.md`, under `## UI` and `## CLI`, committed.
fn with_inbox() -> TestRepo {
    let repo = with_priorities(LATER);
    let inbox = std::fs::read_to_string(repository().join("fixtures/repo/main/specs/INBOX.md"));
    repo.write(INBOX, &inbox.unwrap());
    repo.commit("chore: inbox");
    repo
}

/// The progress of the one command a session ran: its title, then its message.
fn progress(session: &mut Session) -> Vec<Value> {
    let created = session.server_requests("window/workDoneProgress/create");
    let token = &created[0]["token"];
    session
        .notifications("$/progress")
        .into_iter()
        .filter(|params| &params["token"] == token)
        .map(|params| params["value"].clone())
        .collect()
}

/// Review comment C2: the categories a note can go to, read from the default branch's inbox.
#[test]
fn the_inbox_categories_are_mains() {
    let repo = with_inbox();
    let mut session = start(repo.path());

    let categories = session.raw("uraeda/inboxCategories", json!({})).unwrap();

    assert_eq!(categories, json!(["UI", "CLI"]));

    let empty = with_priorities(LATER);
    let mut session = start(empty.path());
    let categories = session.raw("uraeda/inboxCategories", json!({})).unwrap();
    assert_eq!(categories, json!([]));
}

/// US7.1, and C2: a note goes to a new category, uncommitted, and the file opens at its line.
#[test]
fn a_note_is_added_to_the_inbox() {
    let repo = with_inbox();
    let mut session = start(repo.path());
    let inbox = abs(&repo.path().join(INBOX));

    let result = session
        .command(
            "uraeda.note",
            json!({ "text": "Hints flicker on save", "category": "Editor" }),
        )
        .unwrap();

    let text = repo.read(INBOX);
    assert!(
        text.ends_with(
            "- Make sure agents are resumable\n\n## Editor\n\n- Hints flicker on save\n"
        ),
        "{text}"
    );
    let line = text.lines().count();
    assert_eq!(
        result,
        json!({ "opened": inbox, "written": [inbox], "line": line })
    );
    assert_eq!(repo.subjects("main")[0], "chore: inbox");
    assert_eq!(
        progress(&mut session),
        [
            json!({ "kind": "begin", "title": "Adding a note…" }),
            json!({ "kind": "end", "message": "Added to the inbox, not committed" }),
        ]
    );

    // A note in the middle of the file, and one without a category, before the first heading.
    let result = session
        .command(
            "uraeda.note",
            json!({ "text": "Hints flicker on save", "category": "UI" }),
        )
        .unwrap();
    let lines: Vec<String> = repo.read(INBOX).lines().map(String::from).collect();
    let at = result["line"].as_u64().unwrap() as usize;
    assert_eq!(lines[at - 1], "- Hints flicker on save");
    assert_eq!(
        lines[at - 2],
        "- Text input feels laggy on the sessions page"
    );
    let result = session
        .command("uraeda.note", json!({ "text": "No heading" }))
        .unwrap();
    let lines: Vec<String> = repo.read(INBOX).lines().map(String::from).collect();
    let at = result["line"].as_u64().unwrap() as usize;
    assert_eq!(lines[at - 1], "- No heading");
    assert_eq!(lines[at - 2], "- We need a home icon");

    let error = session
        .command("uraeda.note", json!({ "text": "  " }))
        .unwrap_err();
    assert_eq!(error.message, "A note needs text.");
}

/// US7.1: from a feature's worktree, the note is written in main's checkout, and opened there.
#[test]
fn a_note_from_a_worktree_goes_to_mains_inbox() {
    let repo = with_inbox();
    let worktree = repo.path().join(".worktrees/feat");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        "-b",
        "feat",
        worktree.to_str().unwrap(),
    ]);
    std::fs::write(worktree.join(INBOX), "# Inbox\n\n## Feat\n").unwrap();
    let mut session = start(&worktree);

    let categories = session.raw("uraeda/inboxCategories", json!({})).unwrap();
    let result = session
        .command(
            "uraeda.note",
            json!({ "text": "Hints flicker on save", "category": "CLI" }),
        )
        .unwrap();

    assert_eq!(categories, json!(["UI", "CLI"]));
    let inbox = abs(&repo.path().join(INBOX));
    assert_eq!(result["opened"], json!(inbox));
    assert!(repo.read(INBOX).ends_with("- Hints flicker on save\n"));
    assert_eq!(
        std::fs::read_to_string(worktree.join(INBOX)).unwrap(),
        "# Inbox\n\n## Feat\n"
    );
}

/// US7.2: the inbox's changes are committed from its file, with the commit bar's message.
#[test]
fn the_inbox_is_committed() {
    let repo = with_inbox();
    let mut session = start(repo.path());
    session
        .command(
            "uraeda.note",
            json!({ "text": "Hints flicker on save", "category": "Editor" }),
        )
        .unwrap();

    let path = repo.path().join(INBOX);
    let result = session
        .command("uraeda.commit", json!({ "uri": uri(&path) }))
        .unwrap();

    assert_eq!(result, json!({ "written": [] }));
    assert_eq!(
        repo.subjects("main")[0],
        "chore: add \"Hints flicker on save\" to the inbox"
    );
    assert_eq!(repo.changed_in("HEAD"), [INBOX]);
    assert_eq!(repo.porcelain(), "");
}

/// C2: the note's line is where the add put it, in an untitled inbox, whose title moves every line
/// down, and next to a note of the same text.
#[test]
fn a_note_opens_at_its_own_line() {
    let repo = with_priorities(LATER);
    repo.write(INBOX, "## UI\n\n- a\n- Same\n");
    repo.commit("chore: inbox");
    let mut session = start(repo.path());

    let cli = session
        .command("uraeda.note", json!({ "text": "b", "category": "CLI" }))
        .unwrap();
    let same = session
        .command("uraeda.note", json!({ "text": "Same", "category": "UI" }))
        .unwrap();

    let text = repo.read(INBOX);
    assert_eq!(
        text,
        "# Inbox\n\n## UI\n\n- a\n- Same\n- Same\n\n## CLI\n\n- b\n"
    );
    assert_eq!(cli["line"], json!(10));
    assert_eq!(same["line"], json!(7));
}
