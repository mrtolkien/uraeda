//! The features' records and actions, over `/live`: a feature and its workflow files, the
//! proposal files, the priorities, the inbox, the ledger, a feature's history and its branch's
//! changes, and the workflow's messages, each read in its shape; and each action that writes git
//! or a stored file, on what a later read and the files show.

mod support;

#[path = "features/inbox.rs"]
mod inbox;
#[path = "features/life.rs"]
mod life;
#[path = "features/priorities.rs"]
mod priorities;
#[path = "features/records.rs"]
mod records;

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};
use support::{TestClient, TestRepo, TestServer};
use uraeda_protocol::{ClientMessage, ErrorCode, ServerMessage, apply};

/// The name of the tests' repository in the server's list: its folder's.
const REPO: &str = "todo-app";

/// The fixture's feature that waits on the human: its questions are not answered.
const HUMAN: &str = "2026-10-11-web-ui";

/// The fixture's feature that waits on the agent: its spec is approved, and its plan not written.
const AGENT: &str = "2026-10-12-cli-tuis";

// JOIN(wave 6): the helpers below are those of `tests/workspace.rs` (task 7): `fixture`,
// `files_under`, `fixture_repo`, `serving`, `Held`, `read`, and `call` move to `tests/support/`.

/// A path of `fixtures/`.
fn fixture(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures")
        .join(path)
}

/// The files under a folder, each as its path from the folder and its text.
fn files_under(folder: &Path) -> Vec<(String, String)> {
    let mut files = Vec::new();
    let mut folders = vec![folder.to_owned()];
    while let Some(next) = folders.pop() {
        for entry in fs::read_dir(next).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                folders.push(path);
            } else {
                let name = path.strip_prefix(folder).unwrap().to_string_lossy();
                files.push((name.into_owned(), fs::read_to_string(&path).unwrap()));
            }
        }
    }
    files.sort();
    files
}

/// A git repository built from `fixtures/repo/`: `main/` committed on `main`, then each folder of
/// `branches/` on a branch of its name. The checkout is left on `main`.
fn fixture_repo() -> TestRepo {
    let repo = TestRepo::named(REPO);
    for (path, text) in files_under(&fixture("repo/main")) {
        repo.write(&path, &text);
    }
    repo.commit("chore: specs");
    let mut branches: Vec<_> = fs::read_dir(fixture("repo/branches"))
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .collect();
    branches.sort();
    for branch in branches {
        repo.switch_new(&branch.file_name().unwrap().to_string_lossy());
        for (path, text) in files_under(&branch) {
            repo.write(&path, &text);
        }
        repo.commit("feat: a feature");
        repo.switch("main");
    }
    repo
}

/// A server whose list holds the repository, by its folder's name.
async fn serving(repo: &TestRepo) -> TestServer {
    support::setup().folder(repo.path()).start().await
}

/// The fixture's repository, and a server that lists it.
async fn served() -> (TestRepo, TestServer) {
    let repo = fixture_repo();
    let server = serving(&repo).await;
    (repo, server)
}

/// A record a client holds: its value, kept as the changes it gets say.
struct Held {
    client: TestClient,
    value: Value,
    seq: u64,
}

impl Held {
    /// Subscribes a new client to a record, and takes its whole value.
    async fn open(server: &TestServer, record: &str, args: Value) -> Held {
        match Held::asked(server, record, args).await {
            Ok(held) => held,
            Err((code, message)) => panic!("`{record}` is not read: {code:?}: {message}"),
        }
    }

    /// Subscribes a new client to a record: its value, or the error that ended the subscription.
    async fn asked(
        server: &TestServer,
        record: &str,
        args: Value,
    ) -> Result<Held, (ErrorCode, String)> {
        let mut client = server.connect().await;
        let record = record.to_owned();
        client
            .send(&ClientMessage::Sub {
                id: 1,
                record,
                args,
            })
            .await;
        match client.next().await {
            ServerMessage::Data { id: 1, seq, value } => Ok(Held { client, value, seq }),
            ServerMessage::Error { code, message, .. } => Err((code, message)),
            other => panic!("a sub is answered with a value or an error, not {other:?}"),
        }
    }

    /// Takes the record's changes until its value passes: fails when none comes that does.
    async fn until(&mut self, what: &str, passes: impl Fn(&Value) -> bool) -> &Value {
        while !passes(&self.value) {
            match self.client.next().await {
                ServerMessage::Change { id: 1, seq, ops } if seq == self.seq + 1 => {
                    apply(&mut self.value, &ops).expect("a change applies to the value held");
                    self.seq = seq;
                }
                ServerMessage::Data { id: 1, seq, value } => {
                    self.value = value;
                    self.seq = seq;
                }
                other => panic!("waiting for {what}, got {other:?}"),
            }
        }
        &self.value
    }
}

/// A record's value, read once.
async fn read(server: &TestServer, record: &str, args: Value) -> Value {
    Held::open(server, record, args).await.value
}

/// A record of the tests' repository, read once.
async fn of_repo(server: &TestServer, record: &str) -> Value {
    read(server, record, json!({ "repo": REPO })).await
}

/// A record of one thing of the tests' repository, read once.
async fn of_item(server: &TestServer, record: &str, id: &str) -> Value {
    read(server, record, json!({ "repo": REPO, "id": id })).await
}

/// Calls an action from a new client: its output, or its error's code and message.
async fn call(
    server: &TestServer,
    action: &str,
    input: Value,
) -> Result<Value, (ErrorCode, String)> {
    let mut client = server.connect().await;
    let action = action.to_owned();
    client
        .send(&ClientMessage::Call {
            id: 7,
            action,
            input,
        })
        .await;
    match client.next().await {
        ServerMessage::Result { id: 7, output } => Ok(output),
        ServerMessage::Error {
            id: Some(7),
            code,
            message,
        } => Err((code, message)),
        other => panic!("a call is answered with a result or an error, not {other:?}"),
    }
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
