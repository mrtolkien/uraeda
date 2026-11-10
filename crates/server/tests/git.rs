//! Git's records and actions, over the real protocol, on temporary repositories: each record
//! answers its shape, and each write shows in a later read. A remote is a bare repository beside
//! the test's own, never a real one.

mod support;
#[path = "../../core/tests/common/texts.rs"]
mod texts;

use std::fs;

use serde_json::{Value, json};
use support::repo::{run_git, without_user_git_config};
use support::{TestClient, TestRepo, TestServer};
use uraeda_core::actions::place;
use uraeda_core::files::document::hash;
use uraeda_core::git::Git;
use uraeda_protocol::{ClientMessage, ErrorCode, ServerMessage, apply};

/// The name the tests' repository has in the server's list: its folder's.
const REPO: &str = "repo";

/// The file both sides change in `TestRepo::stopped_merge`.
const PRIORITIES: &str = "specs/PRIORITIES.md";

/// A merged feature's folder, and its worktree.
const FEATURE: &str = "2026-10-11-web-ui";
const WORKTREE: &str = ".worktrees/2026-10-11-web-ui";

/// A client of the Git page: it reads records and calls actions, as the page does.
struct Page {
    client: TestClient,
    /// The id of the next `sub` or `call`.
    next: u32,
}

/// What a failed read or call answers: the error's code and its message.
type Refused = (ErrorCode, String);

/// A record a client holds: its subscription, its value, and the number of its last change.
struct Held {
    id: u32,
    value: Value,
    seq: u64,
}

/// A server whose list holds `repo`, and a signed-in client of its Git page.
async fn serving(repo: &TestRepo) -> (TestServer, Page) {
    without_user_git_config();
    let server = support::setup().folder(repo.path()).start().await;
    let client = server.connect().await;
    (server, Page { client, next: 1 })
}

impl Page {
    fn id(&mut self) -> u32 {
        self.next += 1;
        self.next
    }

    /// Subscribes to a record, and holds its value.
    async fn hold(&mut self, record: &str, args: Value) -> Result<Held, Refused> {
        let id = self.id();
        let record = record.to_owned();
        self.client
            .send(&ClientMessage::Sub { id, record, args })
            .await;
        loop {
            match self.client.next().await {
                ServerMessage::Data {
                    id: of, seq, value, ..
                } if of == id => return Ok(Held { id, value, seq }),
                ServerMessage::Error {
                    id: Some(of),
                    code,
                    message,
                } if of == id => return Err((code, message)),
                _ => {}
            }
        }
    }

    /// Applies the changes of a held record as they come, until its value is as `done` says.
    async fn follow(&mut self, held: &mut Held, done: impl Fn(&Value) -> bool) {
        while !done(&held.value) {
            match self.client.next().await {
                ServerMessage::Data { id, seq, value } if id == held.id => {
                    (held.value, held.seq) = (value, seq);
                }
                ServerMessage::Change { id, seq, ops } if id == held.id => {
                    assert_eq!(seq, held.seq + 1, "a change is numbered one more");
                    apply(&mut held.value, &ops).expect("a change applies to the value held");
                    held.seq = seq;
                }
                _ => {}
            }
        }
    }

    /// Reads a record once, as a page that opens does.
    async fn try_read(&mut self, record: &str, args: Value) -> Result<Value, Refused> {
        let held = self.hold(record, args).await?;
        self.client
            .send(&ClientMessage::Unsub { id: held.id })
            .await;
        Ok(held.value)
    }

    /// Reads a record of the tests' repository once: `args` are its arguments besides `repo`.
    async fn read(&mut self, record: &str, args: Value) -> Value {
        let read = self.try_read(record, in_repo(args)).await;
        read.unwrap_or_else(|(code, message)| panic!("{record} is not read: {code:?}: {message}"))
    }

    /// Calls an action, and gives its output or its error.
    async fn try_call(&mut self, action: &str, input: Value) -> Result<Value, Refused> {
        let id = self.id();
        let action = action.to_owned();
        self.client
            .send(&ClientMessage::Call { id, action, input })
            .await;
        loop {
            match self.client.next().await {
                ServerMessage::Result { id: of, output } if of == id => return Ok(output),
                ServerMessage::Error {
                    id: Some(of),
                    code,
                    message,
                } if of == id => return Err((code, message)),
                _ => {}
            }
        }
    }

    /// Calls an action on the tests' repository, which lands: `input` is its input besides
    /// `repo`.
    async fn call(&mut self, action: &str, input: Value) -> Value {
        let called = self.try_call(action, in_repo(input)).await;
        called.unwrap_or_else(|(code, message)| panic!("{action} failed: {code:?}: {message}"))
    }

    /// Calls an action on the tests' repository, which is refused: its code and its message.
    async fn refused(&mut self, action: &str, input: Value) -> Refused {
        let called = self.try_call(action, in_repo(input)).await;
        called.expect_err("the action is refused")
    }

    /// The Git page of the tests' repository, read once.
    async fn page(&mut self) -> Value {
        self.read("GitPage", json!({})).await
    }
}

/// An object's fields, with the tests' repository as `repo`.
fn in_repo(mut fields: Value) -> Value {
    fields["repo"] = REPO.into();
    fields
}

/// The main checkout's changed files, as the page lists them: each path, state, and staging.
fn files(page: &Value) -> Vec<(&str, &str, &str)> {
    files_of(&page["groups"][0])
}

/// A group's changed files: each path, state, and staging.
fn files_of(group: &Value) -> Vec<(&str, &str, &str)> {
    let files = group["files"].as_array().expect("a group's files").iter();
    files
        .map(|file| {
            (
                text(file, "path"),
                text(file, "state"),
                text(file, "staged"),
            )
        })
        .collect()
}

/// A field that is a text.
fn text<'a>(of: &'a Value, field: &str) -> &'a str {
    of[field].as_str().expect("a text")
}

/// The subjects of the page's history, the newest first.
fn subjects(page: &Value) -> Vec<&str> {
    let history = page["history"].as_array().expect("a history").iter();
    history.map(|commit| text(commit, "subject")).collect()
}

/// The commit `HEAD` names in the repository.
fn head(repo: &TestRepo) -> String {
    repo.git(&["rev-parse", "HEAD"]).trim().to_owned()
}

/// Commits a file to `origin/main` from another clone, without fetching it here: what only a
/// fetch brings. The clone is made by a first commit, which is fetched here.
fn pushed_elsewhere(repo: &TestRepo, path: &str) {
    let upstream = repo.parent().join("upstream");
    if !upstream.exists() {
        repo.upstream_commit("elsewhere.md", "elsewhere\n", "chore: elsewhere");
    }
    fs::write(upstream.join(path), "later\n").unwrap();
    run_git(&upstream, &["add", "--all"]);
    let commit = ["commit", "--quiet", "--no-verify", "--message"];
    run_git(&upstream, &[&commit[..], &["chore: later"]].concat());
    run_git(&upstream, &["push", "--quiet", "origin", "HEAD:main"]);
}

/// A merged feature whose branch stays checked out in its worktree, as `ura clean` finds it.
fn merged_feature() -> TestRepo {
    let repo = TestRepo::new();
    repo.switch_new(FEATURE);
    repo.write(&format!("specs/{FEATURE}/proposal.md"), &texts::proposal());
    repo.commit("chore: proposal");
    repo.git(&["rm", "-r", "--quiet", &format!("specs/{FEATURE}")]);
    let record = texts::record("feature", "Web UI");
    repo.write(&format!("specs/done/{FEATURE}.md"), &record);
    repo.commit("finish: web UI");
    repo.switch("main");
    repo.git(&["merge", "--quiet", "--ff-only", FEATURE]);
    place::reach(&Git::discover(repo.path()).unwrap(), FEATURE).unwrap();
    repo
}

// The break it catches: a field of the page renamed, dropped, or left out when it is none, with
// the client still reading the old one.
#[tokio::test]
async fn git_page_answers_its_shape() {
    let repo = TestRepo::with_origin();
    repo.write("README.md", "# Test\n\nMore.\n");
    repo.git(&["add", "README.md"]);
    repo.write("notes.txt", "a note\n");
    repo.git(&["worktree", "add", "--quiet", "-b", "spike", "../repo-spike"]);
    let (_server, mut git) = serving(&repo).await;

    let page = git.page().await;

    let head = head(&repo);
    let expected = json!({
        "agentWorking": false,
        "branch": "main",
        "detached": null,
        "hasRemote": true,
        "ahead": 0,
        "behind": 0,
        "fetchedAt": page["fetchedAt"],
        "fetchFailure": null,
        "stopped": null,
        "groups": [{
            "id": ".",
            "folder": null,
            "name": "main",
            "files": [
                {
                    "id": "README.md",
                    "path": "README.md",
                    "state": "modified",
                    "staged": "yes",
                    "added": 2,
                    "removed": 0,
                },
                {
                    "id": "notes.txt",
                    "path": "notes.txt",
                    "state": "new",
                    "staged": "no",
                    "added": 1,
                    "removed": 0,
                },
            ],
            "defaultMessage": "chore: add More.",
            "isWorking": false,
        }],
        "conflicts": [],
        "history": [{
            "id": head,
            "short": head[..7],
            "subject": "chore: start",
            "authored": page["history"][0]["authored"],
            "mark": "",
        }],
        "hasMoreHistory": false,
        "worktrees": [{
            "id": "../repo-spike",
            "path": "../repo-spike",
            "name": "repo-spike",
            "branch": "spike",
            "folder": null,
            "state": "clean",
            "isWorking": false,
        }],
        "branches": ["spike", "origin/main"],
    });
    assert_eq!(page, expected);
    assert!(page["fetchedAt"].is_i64(), "the last fetch has a time");
    assert!(page["history"][0]["authored"].is_i64());
}

#[tokio::test]
async fn git_summary_answers_its_shape() {
    let repo = TestRepo::with_origin();
    repo.upstream_commit("upstream.md", "upstream\n", "chore: upstream");
    repo.write("README.md", "# Changed\n");
    repo.write("notes.txt", "a note\n");
    let (_server, mut git) = serving(&repo).await;

    let summary = git.read("GitSummary", json!({})).await;

    assert_eq!(summary, json!({ "changes": 2, "behind": 1 }));
}

#[tokio::test]
async fn git_diff_answers_its_shape() {
    let repo = TestRepo::new();
    repo.write("README.md", "# Test\n\nMore.\n");
    repo.commit("docs: more");
    repo.write("README.md", "# Test\n\nMore.\nAnd more.\n");
    repo.write_bytes("logo.bin", &[0, 159, 146, 150]);
    let (_server, mut git) = serving(&repo).await;

    // A working tree's file, a commit's, and a binary one.
    let working = git.read("GitDiff", json!({ "path": "README.md" })).await;
    let commit = json!({ "path": "README.md", "commit": head(&repo), "whole": true });
    let committed = git.read("GitDiff", commit).await;
    let binary = git.read("GitDiff", json!({ "path": "logo.bin" })).await;

    let text = working["text"].as_str().expect("a text file's diff");
    assert!(text.contains("\n+And more.\n"), "{text}");
    let expected = json!({
        "path": "README.md",
        "text": text,
        "binaryBefore": null,
        "binaryAfter": null,
        "added": 1,
        "removed": 0,
        "isCapped": false,
    });
    assert_eq!(working, expected);
    let text = committed["text"].as_str().expect("a commit's diff");
    assert!(
        text.contains("\n+More.\n") && !text.contains("And more"),
        "{text}"
    );
    assert_eq!(committed["added"], 2);
    let expected = json!({
        "path": "logo.bin",
        "text": null,
        "binaryBefore": 0,
        "binaryAfter": 4,
        "added": 0,
        "removed": 0,
        "isCapped": false,
    });
    assert_eq!(binary, expected);
}

#[tokio::test]
async fn git_commit_answers_its_shape() {
    let repo = TestRepo::new();
    repo.write("notes.txt", "a note\n");
    repo.commit("docs: notes\n\nWhy they are kept.");
    let (_server, mut git) = serving(&repo).await;
    let head = head(&repo);

    // By its short id, as a link names it.
    let commit = git.read("GitCommit", json!({ "id": head[..7] })).await;

    let expected = json!({
        "id": head,
        "subject": "docs: notes",
        "body": "Why they are kept.",
        "authored": commit["authored"],
        "files": [{ "path": "notes.txt", "added": 1, "removed": 0 }],
    });
    assert_eq!(commit, expected);
    assert!(commit["authored"].is_i64());
}

#[tokio::test]
async fn git_history_page_answers_its_shape() {
    let repo = TestRepo::new();
    repo.write("notes.txt", "a note\n");
    repo.commit("docs: notes");
    repo.write("notes.txt", "another note\n");
    repo.commit("docs: another");
    let (_server, mut git) = serving(&repo).await;

    let page = git
        .read("GitHistoryPage", json!({ "after": head(&repo) }))
        .await;

    let ids = repo.git(&["log", "--format=%H", "HEAD~1"]);
    let ids: Vec<&str> = ids.lines().collect();
    let row = |id: &str, subject: &str, at: usize| {
        json!({
            "id": id,
            "short": id[..7],
            "subject": subject,
            "authored": page["commits"][at]["authored"],
            "mark": "",
        })
    };
    let expected = json!({
        "commits": [row(ids[0], "docs: notes", 0), row(ids[1], "chore: start", 1)],
        "hasMore": false,
    });
    assert_eq!(page, expected);
}

#[tokio::test]
async fn conflict_file_answers_its_shape() {
    let repo = TestRepo::new();
    repo.stopped_merge();
    let (_server, mut git) = serving(&repo).await;

    let file = git
        .read("ConflictFile", json!({ "path": PRIORITIES }))
        .await;

    let text = repo.read(PRIORITIES);
    assert!(text.contains("<<<<<<<"), "{text}");
    let expected = json!({ "path": PRIORITIES, "text": text, "hash": hash(&text) });
    assert_eq!(file, expected);
    // A file with no conflict is not the editor's to open.
    let args = in_repo(json!({ "path": "README.md" }));
    let refused = git.try_read("ConflictFile", args).await.unwrap_err();
    assert_eq!(
        refused,
        (ErrorCode::Refused, "README.md has no conflict.".to_owned())
    );
}

// The break it catches: a commit made with `--all`, or of every path the page lists, which holds
// a file the human left out of it. The Git page's commit box relies on it.
#[tokio::test]
async fn a_commit_holds_exactly_the_staged_files() {
    let repo = TestRepo::new();
    repo.write("staged.md", "in\n");
    repo.write("left.md", "out\n");
    let (_server, mut git) = serving(&repo).await;

    git.call("git.stage", json!({ "paths": ["staged.md"] }))
        .await;
    git.call("git.commit", json!({ "message": "docs: staged" }))
        .await;

    let page = git.page().await;
    assert_eq!(subjects(&page), ["docs: staged", "chore: start"]);
    assert_eq!(files(&page), [("left.md", "new", "no")]);
    let id = page["history"][0]["id"].clone();
    let commit = git.read("GitCommit", json!({ "id": id })).await;
    let file = json!({ "path": "staged.md", "added": 1, "removed": 0 });
    assert_eq!(commit["files"], json!([file]));
    assert_eq!(repo.changed_in("HEAD"), ["staged.md"]);
    // It went through the repository's hook, as a commit made by hand.
    assert_eq!(repo.hook_runs(), 1);

    // A hook's refusal is the error `hook`, with its output, and leaves the file staged.
    repo.set_hook("echo 'lint: 1 problem'\nexit 1");
    git.call("git.stage", json!({ "paths": ["left.md"] })).await;
    let (code, message) = git
        .refused("git.commit", json!({ "message": "docs: left" }))
        .await;
    assert_eq!(code, ErrorCode::Hook);
    assert!(message.contains("lint: 1 problem"), "{message}");
    let page = git.page().await;
    assert_eq!(subjects(&page), ["docs: staged", "chore: start"]);
    assert_eq!(files(&page), [("left.md", "new", "yes")]);
}

// The break it catches: a write that lands and tells nobody, so an open page shows the files as
// they were until it is opened again.
#[tokio::test]
async fn staging_and_unstaging_reach_an_open_page() {
    let repo = TestRepo::new();
    repo.write("notes.txt", "a note\n");
    repo.write("docs/guide.md", "# Guide\n");
    let (_server, mut git) = serving(&repo).await;
    let mut page = git.hold("GitPage", in_repo(json!({}))).await.unwrap();
    let both = |staged| [("docs/guide.md", "new", staged), ("notes.txt", "new", "no")];
    assert_eq!(files(&page.value), both("no"));

    // A folder stages what it holds.
    git.call("git.stage", json!({ "paths": ["docs"] })).await;
    git.follow(&mut page, |page| files(page) == both("yes"))
        .await;
    assert_eq!(repo.staged(), ["docs/guide.md"]);

    git.call("git.unstage", json!({ "paths": ["docs/guide.md"] }))
        .await;
    git.follow(&mut page, |page| files(page) == both("no"))
        .await;
    assert!(repo.staged().is_empty());

    // A path outside the checkout is refused, and stages nothing.
    let (code, message) = git
        .refused("git.stage", json!({ "paths": ["/etc/passwd"] }))
        .await;
    assert_eq!(code, ErrorCode::Refused);
    assert_eq!(message, "/etc/passwd is not in this checkout.");
}

#[tokio::test]
async fn a_discard_brings_a_file_back_as_committed() {
    let repo = TestRepo::new();
    repo.write("README.md", "# Changed\n");
    repo.write("notes.txt", "a note\n");
    let (_server, mut git) = serving(&repo).await;

    git.call("git.discard", json!({ "path": "README.md" }))
        .await;

    assert_eq!(files(&git.page().await), [("notes.txt", "new", "no")]);
    assert_eq!(repo.read("README.md"), "# Test\n");
    assert_eq!(repo.read("notes.txt"), "a note\n");
}

#[tokio::test]
async fn a_pull_and_a_push_sync_with_origin() {
    let repo = TestRepo::with_origin();
    repo.upstream_commit("upstream.md", "upstream\n", "chore: upstream");
    let (_server, mut git) = serving(&repo).await;
    assert_eq!(git.page().await["behind"], 1);

    git.call("git.pull", json!({})).await;

    let page = git.page().await;
    assert_eq!((&page["behind"], &page["ahead"]), (&json!(0), &json!(0)));
    assert_eq!(subjects(&page), ["chore: upstream", "chore: start"]);
    assert_eq!(repo.read("upstream.md"), "upstream\n");
    let summary = git.read("GitSummary", json!({})).await;
    assert_eq!(summary, json!({ "changes": 0, "behind": 0 }));

    // A commit of the page's own is one to push, until it is pushed.
    repo.write("notes.txt", "a note\n");
    git.call("git.stage", json!({ "paths": ["notes.txt"] }))
        .await;
    git.call("git.commit", json!({ "message": "docs: notes" }))
        .await;
    let page = git.page().await;
    assert_eq!(page["ahead"], 1);
    assert_eq!(page["history"][0]["mark"], "push");

    git.call("git.push", json!({})).await;

    let page = git.page().await;
    assert_eq!(page["ahead"], 0);
    assert_eq!(page["history"][0]["mark"], "");
    assert_eq!(repo.origin_rev("main").trim(), head(&repo));
}

// The break it catches: a quiet fetch's failure answered as an error, or forgotten, so the page
// shows commits as up to date when nothing could be fetched.
#[tokio::test]
async fn a_fetch_brings_origins_commits_and_a_quiet_one_keeps_why_it_failed() {
    let repo = TestRepo::with_origin();
    pushed_elsewhere(&repo, "later.md");
    let origin = repo.parent().join("origin.git");
    // Before the server starts, which fetches its repositories: nothing reaches `origin`.
    let missing = repo.parent().join("missing.git");
    repo.git(&["remote", "set-url", "origin", missing.to_str().unwrap()]);
    let (_server, mut git) = serving(&repo).await;

    // A person's fetch that fails is theirs to read. The page's own never fails.
    let (code, _) = git.refused("git.fetch", json!({})).await;
    assert_eq!(code, ErrorCode::Refused);
    git.call("git.fetch", json!({ "quiet": true })).await;
    let page = git.page().await;
    assert!(page["fetchFailure"].is_string(), "{}", page["fetchFailure"]);
    assert_eq!(page["behind"], 1);

    repo.git(&["remote", "set-url", "origin", origin.to_str().unwrap()]);
    git.call("git.fetch", json!({ "quiet": true })).await;
    let page = git.page().await;
    assert_eq!(page["fetchFailure"], Value::Null);
    assert_eq!(page["behind"], 2);
    assert_eq!(page["history"][0]["mark"], "pull");

    // And a person's own brings the next one.
    pushed_elsewhere(&repo, "latest.md");
    git.call("git.fetch", json!({})).await;
    assert_eq!(git.page().await["behind"], 3);
}

// The break it catches: a list's repositories never fetched unless a person asks, so the page
// and the sidebar say nothing is to pull.
#[tokio::test]
async fn a_repository_of_the_list_is_fetched_as_the_server_starts() {
    let repo = TestRepo::with_origin();
    let (server, _) = serving(&repo).await;
    pushed_elsewhere(&repo, "later.md");
    // A start with the repository in its list already.
    let server = server.restart().await;
    let client = server.connect().await;
    let mut git = Page { client, next: 1 };

    // Nobody asks for a fetch: an open page is told what the server's own brought.
    let mut page = git.hold("GitPage", in_repo(json!({}))).await.unwrap();
    git.follow(&mut page, |page| page["behind"] == 2).await;

    assert_eq!(page.value["fetchFailure"], Value::Null);
}

// The break it catches: a save of the editor's text over a file that changed since it was read,
// and a stop the page cannot leave once its files are resolved.
#[tokio::test]
async fn a_merge_that_stops_is_resolved_and_continued() {
    let repo = TestRepo::new();
    let text = |line: &str| format!("# Priorities\n\n## Now\n\n- {line}\n");
    repo.write(PRIORITIES, &text("Base"));
    repo.write("notes.txt", "base\n");
    repo.commit("chore: priorities");
    repo.switch_new("topic");
    repo.write(PRIORITIES, &text("Topic"));
    repo.write("notes.txt", "topic\n");
    repo.commit("chore: topic priorities");
    repo.switch("main");
    repo.write(PRIORITIES, &text("Main"));
    repo.write("notes.txt", "main\n");
    repo.commit("chore: main priorities");
    let (_server, mut git) = serving(&repo).await;

    let (code, message) = git
        .refused("git.merge", json!({ "branch": "HEAD~1" }))
        .await;
    assert_eq!(code, ErrorCode::Refused);
    assert_eq!(message, "HEAD~1 is not a branch to merge.");
    git.call("git.merge", json!({ "branch": "topic" })).await;

    let page = git.page().await;
    assert_eq!(page["stopped"]["kind"], "merge");
    let conflict = |path: &str, resolved: bool| {
        json!({
            "id": path,
            "path": path,
            "kind": "both-changed",
            "isBinary": false,
            "isResolved": resolved,
        })
    };
    let conflicts = json!([conflict("notes.txt", false), conflict(PRIORITIES, false)]);
    assert_eq!(page["conflicts"], conflicts);

    // The editor's text is saved over the file as it was read, and over no other.
    let file = git
        .read("ConflictFile", json!({ "path": PRIORITIES }))
        .await;
    let mine = text("Both");
    let stale = json!({ "path": PRIORITIES, "text": mine, "hash": hash("another text") });
    let (code, _) = git.refused("git.saveConflict", stale).await;
    assert_eq!(code, ErrorCode::Conflict);
    let save = json!({ "path": PRIORITIES, "text": mine, "hash": file["hash"] });
    let saved = git.call("git.saveConflict", save).await;
    let expected = json!({ "path": PRIORITIES, "text": mine, "hash": hash(&mine) });
    assert_eq!(saved, expected);
    assert_eq!(repo.read(PRIORITIES), mine);

    // The other file takes a side whole.
    let theirs = json!({ "path": "notes.txt", "resolution": "theirs" });
    git.call("git.resolve", theirs).await;
    assert_eq!(repo.read("notes.txt"), "topic\n");

    git.call("git.continue", json!({})).await;

    let page = git.page().await;
    assert_eq!(page["stopped"], Value::Null);
    assert_eq!(page["conflicts"], json!([]));
    assert_eq!(subjects(&page)[0], "Merge branch 'topic'");
    assert_eq!(repo.read(PRIORITIES), mine);
    assert!(repo.porcelain().is_empty());
}

#[tokio::test]
async fn an_abort_leaves_a_stopped_merge_as_it_was_before() {
    let repo = TestRepo::new();
    repo.stopped_merge();
    let before = head(&repo);
    let (_server, mut git) = serving(&repo).await;
    assert_eq!(git.page().await["stopped"]["kind"], "merge");

    git.call("git.abort", json!({})).await;

    let page = git.page().await;
    assert_eq!(page["stopped"], Value::Null);
    assert_eq!(page["conflicts"], json!([]));
    assert_eq!(head(&repo), before);
    assert!(repo.porcelain().is_empty());
}

// The break it catches: a group's write landing in the main checkout, whatever folder it names.
#[tokio::test]
async fn a_groups_writes_land_in_its_features_worktree() {
    let repo = merged_feature();
    repo.write(&format!("{WORKTREE}/notes.txt"), "a note\n");
    repo.write("notes.txt", "the main checkout's\n");
    let (_server, mut git) = serving(&repo).await;
    let page = git.page().await;
    assert_eq!(page["groups"][1]["id"], FEATURE);
    assert_eq!(page["groups"][1]["folder"], FEATURE);

    let stage = json!({ "folder": FEATURE, "paths": ["notes.txt"] });
    git.call("git.stage", stage).await;

    let page = git.page().await;
    assert_eq!(files(&page), [("notes.txt", "new", "no")]);
    assert_eq!(files_of(&page["groups"][1]), [("notes.txt", "new", "yes")]);

    // A folder that names no feature is refused.
    let nothing = json!({ "folder": "2026-01-01-nothing", "paths": ["notes.txt"] });
    let (code, message) = git.refused("git.stage", nothing).await;
    assert_eq!(code, ErrorCode::Refused);
    assert_eq!(message, "no feature 2026-01-01-nothing");
}

// The break it catches: a removal that forces, which loses the changes of a worktree; and one
// that deletes a branch, which loses its commits.
#[tokio::test]
async fn a_worktree_is_removed_and_a_merged_feature_cleaned_only_when_nothing_is_lost() {
    let repo = merged_feature();
    repo.git(&["worktree", "add", "--quiet", "-b", "spike", "../repo-spike"]);
    fs::write(repo.parent().join("repo-spike/notes.txt"), "mine\n").unwrap();
    let (_server, mut git) = serving(&repo).await;
    let listed = |path: &str, state: &str| (path.to_owned(), state.to_owned());
    let states = |page: &Value| -> Vec<(String, String)> {
        let worktrees = page["worktrees"].as_array().expect("the worktrees").iter();
        worktrees
            .map(|worktree| listed(text(worktree, "path"), text(worktree, "state")))
            .collect()
    };
    let page = git.page().await;
    let both = [
        listed(WORKTREE, "merged"),
        listed("../repo-spike", "changes"),
    ];
    assert_eq!(states(&page), both);

    let spike = json!({ "path": "../repo-spike" });
    let (code, message) = git.refused("git.removeWorktree", spike.clone()).await;
    assert_eq!(code, ErrorCode::Refused);
    assert_eq!(
        message,
        "../repo-spike has changes: commit or discard them first."
    );
    assert!(repo.parent().join("repo-spike/notes.txt").exists());

    fs::remove_file(repo.parent().join("repo-spike/notes.txt")).unwrap();
    git.call("git.removeWorktree", spike).await;

    assert_eq!(states(&git.page().await), [listed(WORKTREE, "merged")]);
    assert!(!repo.parent().join("repo-spike").exists());
    // Its branch stays.
    assert!(repo.try_git(&["rev-parse", "--verify", "--quiet", "spike"]));

    git.call("git.clean", json!({ "folder": FEATURE })).await;

    assert_eq!(states(&git.page().await), []);
    assert!(!repo.exists(WORKTREE));
    assert!(!repo.try_git(&["rev-parse", "--verify", "--quiet", FEATURE]));
}

#[tokio::test]
async fn a_repository_the_list_lacks_is_refused() {
    let repo = TestRepo::new();
    let (_server, mut git) = serving(&repo).await;
    let nowhere = json!({ "repo": "nowhere" });
    let expected = (
        ErrorCode::Refused,
        "No repository named “nowhere”".to_owned(),
    );

    let read = git.try_read("GitPage", nowhere.clone()).await;
    let called = git.try_call("git.pull", nowhere).await;

    assert_eq!(read.unwrap_err(), expected);
    assert_eq!(called.unwrap_err(), expected);
}
