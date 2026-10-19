//! The editor's commands on drafts, proposals, the priorities, the inbox, and images: each writes
//! on the default branch or the feature's branch, tells the editor which files it wrote, and refuses
//! with a code the plugin reads.

use std::path::{Path, PathBuf};

use serde_json::{Value, json};

use crate::common::*;

const PRIORITIES: &str = "specs/PRIORITIES.md";
const INBOX: &str = "specs/INBOX.md";
const NVIM: &str = "specs/2026-10-13-nvim-plugin";
const BRANCH: &str = "2026-10-13-nvim-plugin";
const LATER: &str =
    "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n- Codex runtime\n\n## Blocked\n";
const DRAFT: &str = "specs/drafts/codex-runtime.md";

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

/// `main` with `specs/` and the priorities `priorities`.
fn with_priorities(priorities: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(PRIORITIES, priorities);
    repo.commit("chore: specs");
    repo
}

/// `main` with the draft `codex-runtime`, linked from Later, committed or only written.
fn with_draft(committed: bool) -> TestRepo {
    let linked = LATER.replace(
        "- Codex runtime",
        "- [Codex runtime](drafts/codex-runtime.md)",
    );
    let repo = with_priorities(if committed { &linked } else { LATER });
    repo.write(DRAFT, "# Codex runtime\n\n## What\n\nA runtime.\n");
    if committed {
        repo.commit("chore: draft Codex runtime");
    } else {
        repo.write(PRIORITIES, &linked);
    }
    repo
}

/// The example's spec on a branch of its own, checked out, with a proposal beside it.
fn feature_checkout() -> (TestRepo, PathBuf) {
    let repo = TestRepo::new();
    write_example(&repo);
    repo.commit("chore: specs");
    repo.switch_new(BRANCH);
    repo.write(&format!("{NVIM}/proposal.md"), &proposal());
    repo.commit("spec(nvim-plugin): spec");
    let path = repo.path().join(NVIM).join("proposal.md");
    (repo, path)
}

#[test]
fn a_priorities_line_becomes_a_draft_and_a_linked_one_opens_its_draft() {
    let repo = with_priorities(LATER);
    let path = repo.path().join(PRIORITIES);
    let mut session = Session::start(repo.path());
    session.open(&path, LATER);
    let line = LATER.lines().position(|l| l == "- Codex runtime").unwrap() + 1;
    let draft = repo.path().join(DRAFT);

    let drafted = session
        .command("uraeda.draft", json!({ "uri": uri(&path), "line": line }))
        .unwrap();

    assert_eq!(drafted["opened"], abs(&draft));
    assert!(repo.exists(DRAFT) && repo.read(PRIORITIES).contains("(drafts/codex-runtime.md)"));
    assert_eq!(repo.hook_runs(), 0, "drafting commits nothing");
    session.change(&path, &repo.read(PRIORITIES));
    let again = session
        .command("uraeda.draft", json!({ "uri": uri(&path), "line": line }))
        .unwrap();
    assert_eq!(
        (again["opened"].clone(), again["written"].clone()),
        (json!(abs(&draft)), json!([])),
        "a linked line opens its draft"
    );
}

#[test]
fn a_line_that_is_no_entry_or_a_file_changed_on_disk_is_refused_and_nothing_is_drafted() {
    let repo = with_priorities(&LATER.replace("- Codex runtime", "- Codex runtime\n  - A detail"));
    let path = repo.path().join(PRIORITIES);
    let text = repo.read(PRIORITIES);
    let mut session = Session::start(repo.path());
    session.open(&path, &text);

    let nested = session
        .command("uraeda.draft", json!({ "uri": uri(&path), "line": 10 }))
        .unwrap_err();
    let outside = session
        .command("uraeda.draft", json!({ "uri": uri(&path), "line": 7 }))
        .unwrap_err();
    repo.write(
        PRIORITIES,
        &text.replace("## Now\n", "## Now\n\n- Elsewhere\n"),
    );
    let stale = session
        .command("uraeda.draft", json!({ "uri": uri(&path), "line": 9 }))
        .unwrap_err();

    assert_eq!(
        (code(&nested), code(&outside)),
        (json!("refused"), json!("refused"))
    );
    assert_eq!(code(&stale), json!("conflict"));
    assert!(!repo.exists("specs/drafts"));
}

#[test]
fn a_draft_starts_a_feature_in_its_own_worktree_and_reports_progress() {
    let repo = with_draft(true);
    let path = repo.path().join(DRAFT);
    let mut session = Session::start(repo.path());

    let result = session
        .command("uraeda.start", json!({ "uri": uri(&path) }))
        .unwrap();

    let folder = result["opened"].as_str().unwrap();
    assert!(
        folder.contains(".worktrees/") && Path::new(folder).exists(),
        "{folder}"
    );
    assert_eq!(result["written"].as_array().unwrap().len(), 2);
    assert_eq!(repo.current_branch(), "main");
    assert_eq!(repo.hook_runs(), 2);
    let created = session.server_requests("window/workDoneProgress/create");
    assert_eq!(created.len(), 1, "the editor shows the command's progress");
    let token = &created[0]["token"];
    let kinds: Vec<Value> = session
        .notifications("$/progress")
        .into_iter()
        .filter(|params| &params["token"] == token)
        .map(|params| params["value"]["kind"].clone())
        .collect();
    assert_eq!(kinds, [json!("begin"), json!("end")]);
}

#[test]
fn only_a_draft_or_backlog_file_starts_and_only_what_the_editor_owns_is_committed() {
    let (repo, spec) = feature_checkout();
    let spec = spec.parent().unwrap().join("spec.md");
    repo.write(
        &format!("{NVIM}/spec.md"),
        "---\nstatus: awaiting-human\n---\n\n# Spec\n",
    );
    repo.commit("spec");
    let mut session = Session::start(repo.path());

    let start = session
        .command("uraeda.start", json!({ "uri": uri(&spec) }))
        .unwrap_err();
    let commit = session
        .command("uraeda.commit", json!({ "uri": uri(&spec) }))
        .unwrap_err();
    let unknown = session.command("uraeda.dance", json!({}));

    assert_eq!(
        (code(&start), code(&commit)),
        (json!("refused"), json!("refused"))
    );
    assert!(unknown.is_err());
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn drafts_proposals_the_priorities_and_the_inbox_are_committed_alone() {
    let repo = with_draft(false);
    let draft = repo.path().join(DRAFT);
    let mut session = Session::start(repo.path());

    session
        .command("uraeda.commit", json!({ "uri": uri(&draft) }))
        .unwrap();

    let mut committed = repo.changed_in("HEAD");
    committed.sort();
    assert_eq!(
        committed,
        [PRIORITIES, DRAFT],
        "a draft is committed with its line"
    );

    repo.write(
        PRIORITIES,
        &repo
            .read(PRIORITIES)
            .replace("## Now\n", "## Now\n\n- A new line\n"),
    );
    session
        .command(
            "uraeda.commit",
            json!({ "uri": uri(&repo.path().join(PRIORITIES)) }),
        )
        .unwrap();
    assert_eq!(repo.changed_in("HEAD"), [PRIORITIES]);
    assert_eq!((repo.porcelain().as_str(), repo.hook_runs()), ("", 2));

    let (repo, proposal) = feature_checkout();
    repo.write(
        &format!("{NVIM}/proposal.md"),
        &format!("{}\nMore.\n", proposal_text()),
    );
    let mut session = Session::start(repo.path());
    session
        .command("uraeda.commit", json!({ "uri": uri(&proposal) }))
        .unwrap();
    assert_eq!(repo.changed_in(BRANCH), [format!("{NVIM}/proposal.md")]);
}

fn proposal_text() -> String {
    proposal()
}

#[test]
fn a_hook_that_refuses_a_commit_comes_with_its_output_and_the_files_stay() {
    let repo = with_draft(false);
    repo.set_hook("echo 'lint: draft too short' >&2\nexit 1");
    let draft = repo.path().join(DRAFT);
    let mut session = Session::start(repo.path());

    let error = session
        .command("uraeda.commit", json!({ "uri": uri(&draft) }))
        .unwrap_err();

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
    assert_eq!(repo.subjects("main").len(), 2, "nothing was committed");
}

#[test]
fn from_a_worktree_the_default_branchs_files_are_acted_on_in_its_checkout_or_refused_when_edited() {
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
    let draft = worktree.join(DRAFT);
    std::fs::write(&draft, "# Codex runtime\n\nEdited here.\n").unwrap();
    let mut session = Session::start(&worktree);
    session.open(&priorities, &edited);

    for (command, args) in [
        (
            "uraeda.draft",
            json!({ "uri": uri(&priorities), "line": 5 }),
        ),
        ("uraeda.commit", json!({ "uri": uri(&priorities) })),
        ("uraeda.commit", json!({ "uri": uri(&draft) })),
        ("uraeda.start", json!({ "uri": uri(&draft) })),
    ] {
        let error = session.command(command, args).unwrap_err();
        assert_eq!(code(&error), json!("refused"), "{command}");
    }
    assert_eq!(
        repo.git(&["status", "--porcelain", "--", "specs"]),
        "",
        "main's checkout is untouched"
    );

    let started = session
        .command(
            "uraeda.start",
            json!({ "uri": uri(&worktree.join("specs/backlog/benchmarks.md")) }),
        )
        .unwrap();

    assert_eq!(
        started["written"][0],
        abs(&repo.path().join(PRIORITIES)),
        "the start is written in main's checkout"
    );
}

fn fixture_image(name: &str) -> String {
    abs(&repository().join("fixtures/images").join(name))
}

#[test]
fn an_image_is_re_encoded_beside_the_open_proposal_and_its_link_returned_uncommitted() {
    let (repo, path) = feature_checkout();
    let mut session = Session::start(repo.path());
    session.open(&path, &std::fs::read_to_string(&path).unwrap());
    let commits = repo.subjects(BRANCH).len();

    let result = session
        .command("uraeda.attachImage", json!({ "uri": uri(&path), "path": fixture_image("desktop.png"), "name": "desktop.png" }))
        .unwrap();

    let image = repo.path().join(NVIM).join("images/desktop.webp");
    assert_eq!(result["written"], json!([abs(&image)]));
    assert!(
        result["link"]
            .as_str()
            .unwrap()
            .contains("](images/desktop.webp)")
    );
    assert_eq!(&std::fs::read(&image).unwrap()[8..12], b"WEBP");
    assert_eq!(
        (repo.subjects(BRANCH).len(), repo.hook_runs()),
        (commits, 0)
    );
}

#[test]
fn a_draft_that_takes_an_image_becomes_a_folder_the_editor_opens_and_a_refused_file_writes_nothing()
{
    let repo = with_draft(false);
    let draft = repo.path().join(DRAFT);
    let mut session = Session::start(repo.path());
    session.open(&draft, &std::fs::read_to_string(&draft).unwrap());

    let result = session
        .command(
            "uraeda.attachImage",
            json!({ "uri": uri(&draft), "path": fixture_image("still.gif"), "name": "login.png" }),
        )
        .unwrap();

    let proposal = repo.path().join("specs/drafts/codex-runtime/proposal.md");
    assert_eq!(result["opened"], abs(&proposal));
    assert!(!draft.exists() && proposal.exists());
    assert!(
        repo.read(PRIORITIES)
            .contains("(drafts/codex-runtime/proposal.md)")
    );

    let (repo, path) = feature_checkout();
    repo.switch("main");
    let mut session = Session::start(repo.path());
    let missing = repo.path().join("missing.png");
    let big = repo.path().join("big.png");
    std::fs::File::create(&big)
        .unwrap()
        .set_len(uraeda_core::images::MAX_BYTES as u64 + 1)
        .unwrap();
    for (file, name) in [
        (fixture_image("drawing.svg"), "drawing.svg"),
        (abs(&missing), "missing.png"),
        (abs(&big), "big.png"),
    ] {
        let error = session
            .command(
                "uraeda.attachImage",
                json!({ "uri": uri(&path), "path": file, "name": name }),
            )
            .unwrap_err();
        assert!(error.data.is_some(), "{name}");
    }
    assert!(
        !repo.exists(".worktrees"),
        "a refused image makes no worktree"
    );
    assert!(!repo.exists(&format!("{NVIM}/images")));
}

fn with_inbox() -> TestRepo {
    let repo = with_priorities(LATER);
    repo.write(
        INBOX,
        &std::fs::read_to_string(repository().join("fixtures/repo/main/specs/INBOX.md")).unwrap(),
    );
    repo.commit("chore: inbox");
    repo
}

#[test]
fn a_note_is_added_on_mains_inbox_opened_at_its_line_and_committed_from_its_file() {
    let repo = with_inbox();
    let mut session = Session::start(repo.path());
    assert_eq!(
        session.raw("uraeda/inboxCategories", json!({})).unwrap(),
        json!(["UI", "CLI"])
    );

    let first = session
        .command(
            "uraeda.note",
            json!({ "text": "Hints flicker on save", "category": "UI" }),
        )
        .unwrap();
    let at = |note: &Value| {
        repo.read(INBOX)
            .lines()
            .nth(note["line"].as_u64().unwrap() as usize - 1)
            .unwrap()
            .to_string()
    };
    assert_eq!(
        at(&first),
        "- Hints flicker on save",
        "the note is opened at its own line"
    );
    let uncategorized = session
        .command("uraeda.note", json!({ "text": "No heading" }))
        .unwrap();
    assert_eq!(at(&uncategorized), "- No heading");
    assert_eq!(first["opened"], abs(&repo.path().join(INBOX)));
    assert_eq!(
        repo.subjects("main").len(),
        3,
        "a note is not committed by adding it"
    );
    assert!(
        session
            .command("uraeda.note", json!({ "text": "  " }))
            .is_err(),
        "a blank note is refused"
    );

    session
        .command(
            "uraeda.commit",
            json!({ "uri": uri(&repo.path().join(INBOX)) }),
        )
        .unwrap();
    assert_eq!(repo.changed_in("main"), [INBOX]);
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn from_a_worktree_a_note_goes_to_mains_inbox_and_its_categories_are_mains() {
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
    let mut session = Session::start(&worktree);

    let categories = session.raw("uraeda/inboxCategories", json!({})).unwrap();
    let result = session
        .command(
            "uraeda.note",
            json!({ "text": "Hints flicker on save", "category": "CLI" }),
        )
        .unwrap();

    assert_eq!(categories, json!(["UI", "CLI"]));
    assert_eq!(result["opened"], abs(&repo.path().join(INBOX)));
    assert!(repo.read(INBOX).contains("Hints flicker on save"));
    assert_eq!(
        std::fs::read_to_string(worktree.join(INBOX)).unwrap(),
        "# Inbox\n\n## Feat\n",
        "the worktree's copy is left alone"
    );
}

/// Creates the file the hook of the test below waits for, when dropped: a failed assertion never
/// leaves the hook running.
struct Go(PathBuf);

impl Drop for Go {
    fn drop(&mut self) {
        let _ = std::fs::write(&self.0, "");
    }
}

#[test]
fn a_command_does_not_block_the_requests_of_the_editor() {
    let repo = with_draft(false);
    repo.set_hook(
        "until [ -e \"$(git rev-parse --git-common-dir)/go\" ] || [ ! -e .git ]; do sleep 0.01; done\necho run >> \"$(git rev-parse --git-common-dir)/hook-runs\"",
    );
    let draft = repo.path().join(DRAFT);
    let mut session = Session::start(repo.path());
    let go = Go(repo.path().join(".git/go"));

    let command = session.start_command("uraeda.commit", json!({ "uri": uri(&draft) }));
    let fields = session.raw("uraeda/fields", json!({ "uri": uri(&draft) }));

    assert!(fields.is_ok(), "a read is answered while the command runs");
    assert!(!session.answered(&command));
    drop(go);
    session.response(&command).unwrap();
    assert_eq!(repo.hook_runs(), 1);
}
