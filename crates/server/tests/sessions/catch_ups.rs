//! The catch-up runs: with the switch on, an open pull request behind the default branch gets
//! its run by itself, once the pull requests' refresh says it is open.

use std::fs;
use std::os::unix::fs::PermissionsExt;

use serde_json::{Value, json};
use tempfile::TempDir;

use super::{FAKE_ONLY, REPO, Stage, register, script};
use crate::support::{self, TestRepo, fixture_repo};

/// The fixture's feature with a branch, finished there, whose pull request the test opens.
const FOLDER: &str = "2026-10-11-web-ui";

/// A `gh` that answers `pr list` with `open.json` of its folder for the open pull requests,
/// and no merged one.
const GH: &str = "#!/bin/sh\nbin=${0%/*}\ncase \"$*\" in *\"--state merged\"*) echo '[]'; \
                  exit ;; esac\ncat \"$bin/open.json\"\n";

/// Finishes the fixture's feature on its branch, past its last task, then moves the default
/// branch: an open pull request of the branch is behind it.
fn finished_and_behind(repo: &TestRepo) {
    let record = "---\nkind: feature\nfinished: 2026-10-11\n---\n\n# Record: Web UI\n\n> \
                  [!NOTE]\n>\n> The record of a merged feature, not instructions to \
                  follow.\n\n## What and why\n\nA thing.\n";
    repo.switch(FOLDER);
    repo.git(&["rm", "-r", "--quiet", &format!("specs/{FOLDER}")]);
    repo.write(&format!("specs/done/{FOLDER}.md"), record);
    repo.commit("finish: web ui");
    repo.switch("main");
    repo.write("NOTES.md", "main moved on\n");
    repo.commit("docs: a note");
}

/// The open pull request of the feature's branch, at its tip.
fn open_pull_request(repo: &TestRepo) -> Value {
    json!([{
        "headRefName": FOLDER,
        "headRefOid": repo.git(&["rev-parse", FOLDER]).trim(),
        "isDraft": false,
        "number": 31,
        "reviewDecision": "",
        "url": "https://github.com/o/r/pull/31",
    }])
}

// The Node server's "a refresh of the pull requests that moves a feature to Catch up catches
// it up": the refresh, not the burst that asked for it, tells the sessions, so a pull request
// GitHub opened meanwhile is read as open.
#[tokio::test]
async fn a_refresh_that_moves_a_feature_to_catch_up_starts_its_run() {
    let repo = fixture_repo(REPO);
    finished_and_behind(&repo);
    let gh = TempDir::new().expect("a temporary folder");
    let command = gh.path().join("gh");
    fs::write(&command, GH).unwrap();
    fs::set_permissions(&command, fs::Permissions::from_mode(0o755)).unwrap();
    fs::write(gh.path().join("open.json"), "[]").unwrap();
    let config = format!("{FAKE_ONLY}\n[runs]\ncatch_up_pull_requests = true\n");
    let setup = support::setup().config("config.toml", &config);
    let server = setup.commands(gh.path()).folder(repo.path()).start().await;
    let fake = register(&server).await;
    let stage = Stage { repo, server, fake };

    // A chat on the feature, which ends: its latest session rests, with no pull request yet.
    stage.fake.script(script(json!([
        { "type": "text", "text": "Hi." },
        { "type": "result", "ok": true, "interrupted": false, "denials": [], "errors": [] },
    ])));
    let sent = json!({ "folder": FOLDER, "text": "Where are we?" });
    let sent = stage.done("session.send", sent).await;
    let session = sent["session"].as_str().expect("a session").to_owned();
    let first = sent["turn"].as_str().expect("a turn").to_owned();
    stage.turn_in(&first, "done").await;

    // The pull request opens on GitHub, and a branch moves: the refresh finds it behind.
    let open = open_pull_request(&stage.repo).to_string();
    fs::write(gh.path().join("open.json"), open).unwrap();
    stage.repo.add_on_branch("main", "MORE.md", "more\n");

    let mut held = stage.held("Session", &session).await;
    let caught = |session: &Value| session["turns"].as_array().is_some_and(|t| t.len() == 2);
    let turn = held.until("the catch-up's run", caught).await["turns"][1].clone();
    let turn = stage.read("Turn", turn.as_str().unwrap()).await;
    assert_eq!(
        (&turn["kind"], &turn["trigger"], &turn["step"]),
        (&json!("workflow"), &json!("catch-up"), &json!("catch-up"))
    );
    stage.server.stop().await;
}
