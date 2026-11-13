//! The features' records and actions, over `/live`: a feature and its workflow files, the
//! proposal files, the priorities, the inbox, the ledger, a feature's history and its branch's
//! changes, and the workflow's messages, each read in its shape; and each action that writes git
//! or a stored file, on what a later read and the files show.

use crate::support;

#[path = "features/inbox.rs"]
mod inbox;
#[path = "features/life.rs"]
mod life;
#[path = "features/priorities.rs"]
mod priorities;
#[path = "features/records.rs"]
mod records;
#[path = "features/status.rs"]
mod status;

use serde_json::{Value, json};
use support::{Held, Hook, TestRepo, TestServer, call, fixture, fixture_repo, idle, read, writes};

/// The name of the tests' repository in the server's list: its folder's.
const REPO: &str = "todo-app";

/// The fixture's feature that waits on the human: its questions are not answered.
const HUMAN: &str = "2026-10-11-web-ui";

/// The fixture's feature that waits on the agent: its spec is approved, and its plan not written.
const AGENT: &str = "2026-10-12-cli-tuis";

/// A server whose list holds the repository, by its folder's name.
async fn serving(repo: &TestRepo) -> TestServer {
    support::setup().folder(repo.path()).start().await
}

/// The fixture's repository, and a server that lists it.
async fn served() -> (TestRepo, TestServer) {
    let repo = fixture_repo(REPO);
    let server = serving(&repo).await;
    (repo, server)
}

/// A record of the tests' repository, read once.
async fn of_repo(server: &TestServer, record: &str) -> Value {
    read(server, record, json!({ "repo": REPO })).await
}

/// A record of one thing of the tests' repository, read once.
async fn of_item(server: &TestServer, record: &str, id: &str) -> Value {
    read(server, record, json!({ "repo": REPO, "id": id })).await
}

/// Calls an action on the tests' repository, which answers: its output. `input` is the action's
/// input without its `repo`.
async fn done(server: &TestServer, action: &str, mut input: Value) -> Value {
    input["repo"] = json!(REPO);
    match call(server, action, input).await {
        Ok(output) => output,
        Err((code, message)) => panic!("`{action}` is refused: {code:?}: {message}"),
    }
}

/// The hash of a list of the tests' repository, `Inbox` or `Priorities`, as read now.
async fn hash_of(server: &TestServer, record: &str) -> String {
    let list = of_repo(server, record).await;
    list["hash"].as_str().expect("a hash").to_owned()
}

/// The subjects of the commits of a branch, the latest first.
fn subjects(repo: &TestRepo, branch: &str) -> Vec<String> {
    let log = repo.git(&["log", "--format=%s", branch]);
    log.lines().map(str::to_owned).collect()
}
