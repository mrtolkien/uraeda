//! The pull requests' refresh: each listed repository's pull requests, asked of `gh` as the
//! server starts, when a repository joins the list, after a branch moves, and every minute
//! while a branch is past its last task, and shown by the workspace's records.
//!
//! No test runs the real `gh`: a shell script stands in for it, first on the `PATH` of the
//! test's server, which answers `gh pr list` with the JSON recorded in its folder, and writes
//! down where it ran and what it was asked.

use crate::support;

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::time::Duration;

use serde_json::{Value, json};
use support::{Held, TestRepo, TestServer, call, fixture_repo};
use tempfile::TempDir;

/// The fixture's feature whose branch has the pull request.
const FOLDER: &str = "2026-10-11-web-ui";

/// The stand-in: `open.json` and `merged.json` of its folder are what `gh pr list` answers for
/// each state. Without the file, it fails as a `gh` that is signed out. With a file `hang`, it
/// writes its process's id in `pid` and never answers.
const GH: &str = r#"#!/bin/sh
bin=${0%/*}
printf '%s\n' "$PWD: $*" >> "$bin/asked"
if [ -f "$bin/hang" ]; then echo $$ > "$bin/pid"; exec sleep 600; fi
state=open
case "$*" in *"--state merged"*) state=merged ;; esac
if [ ! -f "$bin/$state.json" ]; then echo "gh: not signed in" >&2; exit 4; fi
cat "$bin/$state.json"
"#;

/// A folder that holds the stand-in of `gh`, and what it answers.
struct Gh {
    bin: TempDir,
}

impl Gh {
    /// A `gh` that knows no pull request, open or merged.
    fn new() -> Gh {
        let bin = TempDir::new().expect("a temporary folder");
        let command = bin.path().join("gh");
        fs::write(&command, GH).unwrap();
        fs::set_permissions(&command, fs::Permissions::from_mode(0o755)).unwrap();
        let gh = Gh { bin };
        gh.open(&json!([]));
        gh.write("merged.json", "[]");
        gh
    }

    fn write(&self, name: &str, text: &str) {
        fs::write(self.bin.path().join(name), text).unwrap();
    }

    /// Sets the open pull requests `gh` lists from now on.
    fn open(&self, rows: &Value) {
        self.write("open.json", &rows.to_string());
    }

    /// What `gh` was asked so far, a line each: the folder it ran in, then its arguments.
    fn asked(&self) -> Vec<String> {
        let asked = fs::read_to_string(self.bin.path().join("asked")).unwrap_or_default();
        asked.lines().map(str::to_owned).collect()
    }

    /// A server whose `gh` is this one, started in a repository's folder.
    async fn serving(&self, repo: &TestRepo) -> TestServer {
        let setup = support::setup().commands(self.bin.path());
        setup.folder(repo.path()).start().await
    }
}

/// A row of `gh pr list`: the pull request of the fixture's feature, at its branch's tip.
fn row(repo: &TestRepo, number: u32, draft: bool) -> Value {
    json!({
        "headRefName": FOLDER,
        "headRefOid": repo.git(&["rev-parse", FOLDER]).trim(),
        "isDraft": draft,
        "number": number,
        "reviewDecision": "",
        "url": format!("https://github.com/o/r/pull/{number}"),
    })
}

/// The pull request the workspace shows for the fixture's feature.
fn shown(workspace: &Value) -> &Value {
    let features = workspace["features"].as_array().expect("features");
    let found = features.iter().find(|feature| feature["folder"] == FOLDER);
    &found.expect("the feature")["pullRequest"]
}

/// The workspace of the repository, held until it shows a pull request of this number and
/// state.
async fn showing(server: &TestServer, number: u32, state: &str) -> Held {
    let mut workspace = Held::open(server, "Workspace", json!({ "repo": "todo-app" })).await;
    shows(&mut workspace, number, state).await;
    workspace
}

/// Waits until a held workspace shows a pull request of this number and state.
async fn shows(workspace: &mut Held, number: u32, state: &str) {
    let what = format!("pull request {number}, {state}");
    let wanted = |workspace: &Value| {
        let shown = shown(workspace);
        shown["number"] == number && shown["state"] == state
    };
    workspace.until(&what, wanted).await;
}

/// Finishes the fixture's feature on its branch: past its last task, its next step is its pull
/// request's to decide.
fn finish(repo: &TestRepo) {
    let record = "---\nkind: feature\nfinished: 2026-10-11\npull-request: \
                  https://github.com/o/r/pull/31\n---\n\n# Record: Web UI\n\n> [!NOTE]\n>\n> The \
                  record of a merged feature, not instructions to follow.\n\n## What and \
                  why\n\nA thing.\n\n## Behaviour\n\n- It works.\n\n## Design\n\nA \
                  design.\n\n## Questions\n\n### Round 01\n\n#### Q1: Question \
                  1?\n\n**Answer:** A.\n\n#### Q2: Question 2?\n\n**Answer:** B.\n";
    repo.switch(FOLDER);
    repo.git(&["rm", "-r", "--quiet", &format!("specs/{FOLDER}")]);
    repo.write(&format!("specs/done/{FOLDER}.md"), record);
    repo.commit("finish: web ui");
    repo.switch("main");
}

/// Whether a process still runs: one that ended and was not waited for yet does not.
fn runs(pid: &str) -> bool {
    let stat = fs::read_to_string(Path::new("/proc").join(pid).join("stat"));
    // The state follows the command's name, which is between brackets.
    stat.is_ok_and(|stat| {
        !stat
            .rsplit(") ")
            .next()
            .unwrap_or_default()
            .starts_with('Z')
    })
}

/// What `gh` is asked for a repository's pull requests, in its main checkout.
fn lists(root: &Path) -> [String; 2] {
    let asked = |state: &str, fields: &str| {
        let root = root.display();
        format!("{root}: pr list --state {state} --json {fields} --limit 200")
    };
    [
        asked(
            "open",
            "headRefName,headRefOid,number,url,isDraft,reviewDecision",
        ),
        asked("merged", "headRefName,headRefOid,number,url"),
    ]
}

// SC-001 of the Node server's `pulls.test.ts`, its first two moments: `gh` runs as the server
// starts and after a branch moves, and the workspace shows what it answered.
#[tokio::test]
async fn gh_is_asked_at_the_start_and_after_a_branch_moves() {
    let repo = fixture_repo("todo-app");
    let gh = Gh::new();
    gh.open(&json!([row(&repo, 31, true)]));
    let server = gh.serving(&repo).await;

    let mut workspace = showing(&server, 31, "draft").await;

    let head = repo.git(&["rev-parse", FOLDER]);
    let draft = json!({
        "head": head.trim(), "number": 31, "state": "draft",
        "url": "https://github.com/o/r/pull/31",
    });
    assert_eq!(shown(&workspace.value), &draft);
    assert_eq!(
        gh.asked(),
        lists(repo.path()),
        "asked once, in the repository"
    );

    // The pull request is marked ready on GitHub, which no file of the repository says: the
    // workspace shows it once a branch moved.
    gh.open(&json!([row(&repo, 31, false)]));
    repo.add_on_branch(FOLDER, "notes.md", "a note\n");

    shows(&mut workspace, 31, "open").await;
    server.stop().await;
}

// A repository added once the server runs is asked at once, as one listed at its start.
#[tokio::test]
async fn a_repository_that_joins_the_list_is_asked_at_once() {
    let repo = fixture_repo("todo-app");
    let gh = Gh::new();
    gh.open(&json!([row(&repo, 7, false)]));
    let server = support::setup().commands(gh.bin.path()).start().await;
    assert_eq!(gh.asked(), [] as [&str; 0], "no repository, nothing to ask");

    let added = call(
        &server,
        "repositories.add",
        json!({ "folder": repo.path() }),
    )
    .await;
    added.expect("the repository is added");

    showing(&server, 7, "open").await;
    server.stop().await;
}

// SC-001, its third moment: every minute while a branch is past its last task, where a pull
// request's state decides the next step, with no file of the repository changed.
#[tokio::test(start_paused = true)]
async fn gh_is_asked_every_minute_while_a_branch_is_past_its_last_task() {
    let repo = fixture_repo("todo-app");
    finish(&repo);
    let gh = Gh::new();
    gh.open(&json!([row(&repo, 31, true)]));
    let server = gh.serving(&repo).await;
    let mut workspace = showing(&server, 31, "draft").await;

    // Marked ready on GitHub: the clock is this test's, and a minute passes at once.
    gh.open(&json!([row(&repo, 31, false)]));
    tokio::time::sleep(Duration::from_secs(60)).await;

    shows(&mut workspace, 31, "open").await;
    server.stop().await;
}

// The Node server's "no refresh by the minute while no branch is past its last task".
#[tokio::test(start_paused = true)]
async fn gh_is_not_asked_by_the_minute_while_no_branch_is_past_its_last_task() {
    let repo = fixture_repo("todo-app");
    let gh = Gh::new();
    gh.open(&json!([row(&repo, 31, true)]));
    let server = gh.serving(&repo).await;
    showing(&server, 31, "draft").await;

    tokio::time::sleep(Duration::from_secs(3 * 60)).await;

    assert_eq!(gh.asked(), lists(repo.path()), "asked at the start alone");
    server.stop().await;
}

// The Node server's "a stopped refresher runs gh no more": the server's stop ends a `gh` that
// does not answer, and leaves none running.
#[tokio::test]
async fn stopping_the_server_ends_a_gh_that_does_not_answer() {
    let repo = fixture_repo("todo-app");
    let gh = Gh::new();
    gh.write("hang", "");
    let server = gh.serving(&repo).await;
    let pid = gh.bin.path().join("pid");
    while !pid.exists() {
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    let pid = fs::read_to_string(pid).unwrap();
    assert!(runs(pid.trim()), "gh runs");

    server.stop().await;

    let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
    while runs(pid.trim()) && tokio::time::Instant::now() < deadline {
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert!(!runs(pid.trim()), "gh ended with the server");
    assert_eq!(gh.asked().len(), 1, "and was asked no more");
}
