//! What the tests of writing start from: a server over a copy of the fixture repository, a client
//! that keeps what it subscribed to, and a pre-commit hook the test holds.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::{Value, json};
use uraeda_protocol::{ClientMessage, ErrorCode, ServerMessage, apply};

use crate::support::{self, TestClient, TestRepo, TestServer};

/// The fixture repository's name in the server's list: its folder's.
pub const REPO: &str = "todo";

/// What a call fails with: the error's code, and its message.
pub type Refused = (ErrorCode, String);

/// A server over a copy of the fixture repository, and one signed-in client.
pub struct Fixture {
    pub repo: TestRepo,
    server: TestServer,
    client: TestClient,
    next: u32,
    /// The value of each open subscription, as the changes left it.
    values: HashMap<u32, Value>,
    /// The answers that came for calls nobody asked about yet.
    answers: HashMap<u32, Result<Value, Refused>>,
}

impl Fixture {
    /// Starts a server in a copy of the fixture repository, which joins its list as `todo`.
    pub async fn start() -> Fixture {
        Fixture::over(fixture_repo()).await
    }

    /// Starts a server in a repository the test prepared.
    pub async fn over(repo: TestRepo) -> Fixture {
        let server = support::setup().folder(repo.path()).start().await;
        let client = server.connect().await;
        Fixture {
            repo,
            server,
            client,
            next: 0,
            values: HashMap::new(),
            answers: HashMap::new(),
        }
    }

    /// Calls an action of the repository, and gives its output.
    pub async fn call(&mut self, action: &str, input: Value) -> Value {
        match self.try_call(action, input).await {
            Ok(output) => output,
            Err((code, message)) => panic!("{action} failed: {code:?}: {message}"),
        }
    }

    /// Calls an action of the repository that fails, and gives its error.
    pub async fn refused(&mut self, action: &str, input: Value) -> Refused {
        match self.try_call(action, input).await {
            Ok(output) => panic!("{action} answered {output}"),
            Err(refused) => refused,
        }
    }

    /// Calls an action of the repository, and gives its answer.
    pub async fn try_call(&mut self, action: &str, input: Value) -> Result<Value, Refused> {
        let id = self.send(action, input).await;
        self.answer(id).await
    }

    /// Sends a call of the repository without waiting for its answer: its id.
    pub async fn send(&mut self, action: &str, input: Value) -> u32 {
        let id = self.id();
        let call = ClientMessage::Call {
            id,
            action: action.to_owned(),
            input: in_repo(input),
        };
        self.client.send(&call).await;
        id
    }

    /// The answer to a call sent, once it comes.
    pub async fn answer(&mut self, id: u32) -> Result<Value, Refused> {
        loop {
            if let Some(answer) = self.answers.remove(&id) {
                return answer;
            }
            self.take().await;
        }
    }

    /// Whether a call sent was answered yet, after every message that came within `patience`.
    pub async fn answered_within(&mut self, id: u32, patience: Duration) -> bool {
        let waited = tokio::time::timeout(patience, async {
            while !self.answers.contains_key(&id) {
                self.take().await;
            }
        });
        waited.await.is_ok()
    }

    /// Subscribes to a record of the repository, and waits for its whole value: the
    /// subscription's id.
    pub async fn watch(&mut self, record: &str, args: Value) -> u32 {
        match self.try_watch(record, args).await {
            Ok(id) => id,
            Err((code, message)) => panic!("{record} cannot be read: {code:?}: {message}"),
        }
    }

    /// Subscribes to a record of the repository: the subscription's id once its whole value
    /// came, or why it cannot be read.
    pub async fn try_watch(&mut self, record: &str, args: Value) -> Result<u32, Refused> {
        let id = self.id();
        let sub = ClientMessage::Sub {
            id,
            record: record.to_owned(),
            args: in_repo(args),
        };
        self.client.send(&sub).await;
        while !self.values.contains_key(&id) {
            if let Some(Err(refused)) = self.answers.remove(&id) {
                return Err(refused);
            }
            self.take().await;
        }
        Ok(id)
    }

    /// The value a subscription holds now.
    pub fn value(&self, id: u32) -> &Value {
        &self.values[&id]
    }

    /// Waits until a subscription's value is as `wanted` says, and gives it.
    pub async fn until(&mut self, id: u32, wanted: impl Fn(&Value) -> bool) -> Value {
        while !wanted(&self.values[&id]) {
            self.take().await;
        }
        self.values[&id].clone()
    }

    /// Reads a record of the repository once.
    pub async fn read(&mut self, record: &str, args: Value) -> Value {
        let id = self.watch(record, args).await;
        self.client.send(&ClientMessage::Unsub { id }).await;
        self.values.remove(&id).expect("a value")
    }

    /// The text of a Markdown file of `specs/`, as its branch has it: the record `Buffer`.
    pub async fn text(&mut self, path: &str) -> String {
        let text = self.try_text(path).await;
        text.unwrap_or_else(|| panic!("{path} cannot be read"))
    }

    /// The text of a Markdown file of `specs/`, or none when its branch has no such file.
    pub async fn try_text(&mut self, path: &str) -> Option<String> {
        let id = self
            .try_watch("Buffer", json!({ "path": path }))
            .await
            .ok()?;
        self.client.send(&ClientMessage::Unsub { id }).await;
        let buffer = self.values.remove(&id).expect("a value");
        Some(buffer["text"].as_str().expect("a buffer's text").to_owned())
    }

    /// The write queue's writes as a subscription holds them, each as `<label> <state>`.
    pub fn writes(&self, queue: u32) -> Vec<String> {
        names(self.values[&queue]["writes"].as_array().expect("writes"))
    }

    /// Waits until the write queue has no write landing or waiting, and gives the refused ones
    /// left in it. It subscribes anew: a `data` holds everything said before its `sub`, so the
    /// writes of the calls answered so far are in it.
    pub async fn idle(&mut self) -> Vec<Value> {
        let queue = self.watch("WriteQueue", json!({})).await;
        let settled = |value: &Value| {
            let writes = value["writes"].as_array().expect("writes");
            writes.iter().all(|write| write["state"] == "refused")
        };
        self.until(queue, settled).await;
        self.client.send(&ClientMessage::Unsub { id: queue }).await;
        let left = self.values.remove(&queue).expect("a value");
        left["writes"].as_array().expect("writes").clone()
    }

    /// Stops the server, as `ura serve` does on a signal, and gives the repository back.
    pub async fn stop(self) -> TestRepo {
        self.server.stop().await;
        self.repo
    }

    fn id(&mut self) -> u32 {
        self.next += 1;
        self.next
    }

    /// Takes the server's next message: a subscription's value or change, or a call's answer.
    async fn take(&mut self) {
        match self.client.next().await {
            ServerMessage::Data { id, value, .. } => {
                self.values.insert(id, value);
            }
            ServerMessage::Change { id, ops, .. } => {
                if let Some(value) = self.values.get_mut(&id) {
                    apply(value, &ops).expect("a change applies to the value held");
                }
            }
            ServerMessage::Result { id, output } => {
                self.answers.insert(id, Ok(output));
            }
            ServerMessage::Error { id, code, message } => {
                let id = id.unwrap_or_else(|| panic!("the server could not read: {message}"));
                self.answers.insert(id, Err((code, message)));
            }
            other => panic!("unexpected message: {other:?}"),
        }
    }
}

/// Writes of the queue, each as `<label> <state>`.
pub fn names(writes: &[Value]) -> Vec<String> {
    let named = |write: &Value| {
        let text = |field: &str| write[field].as_str().unwrap_or_default().to_owned();
        format!("{} {}", text("label"), text("state"))
    };
    writes.iter().map(named).collect()
}

/// A record's arguments or an action's input, of the fixture repository.
fn in_repo(mut fields: Value) -> Value {
    fields["repo"] = json!(REPO);
    fields
}

/// A copy of the fixture repository, `fixtures/repo/`: `main/` committed on `main`, then each
/// folder of `branches/` committed on a branch of its name, from `main`. Its hooks run in every
/// worktree.
// JOIN(wave 6): the fixture repository of the server's tests, as the Node tests' `fixtureRepo`.
pub fn fixture_repo() -> TestRepo {
    support::repo::without_user_git_config();
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures");
    let repo = TestRepo::named(REPO);
    let hooks = repo.path().join(".git/hooks");
    repo.git(&["config", "core.hooksPath", hooks.to_str().expect("a path")]);
    copy(&fixtures.join("repo/main"), repo.path());
    repo.commit("chore: specs");
    let mut branches: Vec<PathBuf> = fs::read_dir(fixtures.join("repo/branches"))
        .expect("the fixture's branches")
        .map(|entry| entry.expect("a branch").path())
        .collect();
    branches.sort();
    for branch in branches {
        let name = branch.file_name().and_then(|name| name.to_str());
        let name = name.expect("a branch's name");
        repo.git(&["switch", "--quiet", "--create", name, "main"]);
        copy(&branch, repo.path());
        repo.commit(&format!("work on {name}"));
        repo.switch("main");
    }
    repo
}

/// Copies a folder's files into another, folder by folder.
fn copy(from: &Path, to: &Path) {
    fs::create_dir_all(to).expect("a folder");
    for entry in fs::read_dir(from).expect("a fixture's folder") {
        let entry = entry.expect("a fixture's file");
        let target = to.join(entry.file_name());
        if entry.path().is_dir() {
            copy(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), target).expect("a copied file");
        }
    }
}

/// A fixture file's text, by its path under `fixtures/`.
pub fn fixture(path: &str) -> String {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures");
    fs::read_to_string(fixtures.join(path)).expect("a fixture")
}

/// The repository's pre-commit hook, held by the test: each commit waits until the test lets
/// the hooks go, is refused while the test says so, and writes in a log when it starts, with
/// the files it commits, and when it ends.
pub struct Hook {
    folder: PathBuf,
}

impl Hook {
    /// Replaces the repository's hook with one that waits.
    pub fn held(repo: &TestRepo) -> Hook {
        let folder = repo.parent().join("hook");
        fs::create_dir_all(&folder).expect("the hook's folder");
        let at = |name: &str| folder.join(name).display().to_string();
        let (gate, refuse, log) = (at("gate"), at("refuse"), at("log"));
        repo.set_hook(&format!(
            "echo \"start $(git diff --cached --name-only | tr '\\n' ' ')\" >> \"{log}\"\n\
             while [ ! -e \"{gate}\" ]; do sleep 0.02; done\n\
             sleep 0.05\n\
             echo end >> \"{log}\"\n\
             if [ -e \"{refuse}\" ]; then echo \"lint: 1 problem\"; exit 1; fi"
        ));
        Hook { folder }
    }

    /// Lets the commits waiting, and every later one, go on.
    pub fn release(&self) {
        fs::write(self.folder.join("gate"), "").expect("the gate");
    }

    /// Refuses the commits that end from now on, or lets them land again.
    pub fn refusing(&self, on: bool) {
        let refuse = self.folder.join("refuse");
        if on {
            fs::write(refuse, "").expect("the refusal");
        } else {
            fs::remove_file(refuse).expect("a refusal to take back");
        }
    }

    /// The log's lines: `start <files>` and `end`, in the order the hooks wrote them.
    pub fn log(&self) -> Vec<String> {
        let log = fs::read_to_string(self.folder.join("log")).unwrap_or_default();
        log.lines().map(|line| line.trim().to_owned()).collect()
    }
}
