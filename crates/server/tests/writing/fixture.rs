//! What the tests of writing start from: a server over a copy of the fixture repository, a client
//! that keeps what it subscribed to, and a pre-commit hook the test holds.

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use serde_json::{Value, json};

use crate::support::{self, Live, Refused, TestRepo, TestServer};
pub use crate::support::{fixture_repo, fixture_text as fixture};

/// The fixture repository's name in the server's list: its folder's.
pub const REPO: &str = "todo";

/// A server over a copy of the fixture repository, and one signed-in client.
pub struct Fixture {
    pub repo: TestRepo,
    server: TestServer,
    live: Live,
}

impl Fixture {
    /// Starts a server in a copy of the fixture repository, which joins its list as `todo`.
    pub async fn start() -> Fixture {
        Fixture::over(fixture_repo(REPO)).await
    }

    /// Starts a server in a repository the test prepared.
    pub async fn over(repo: TestRepo) -> Fixture {
        let server = support::setup().folder(repo.path()).start().await;
        let live = Live::of(&server).await;
        Fixture { repo, server, live }
    }

    /// Calls an action of the repository, and gives its output.
    pub async fn call(&mut self, action: &str, input: Value) -> Value {
        self.live.call(action, in_repo(input)).await
    }

    /// Calls an action of the repository that fails, and gives its error.
    pub async fn refused(&mut self, action: &str, input: Value) -> Refused {
        self.live.refused(action, in_repo(input)).await
    }

    /// Sends a call of the repository without waiting for its answer: its id.
    pub async fn send(&mut self, action: &str, input: Value) -> u32 {
        self.live.send(action, in_repo(input)).await
    }

    /// The answer to a call sent, once it comes.
    pub async fn answer(&mut self, id: u32) -> Result<Value, Refused> {
        self.live.answer(id).await
    }

    /// Whether a call sent was answered yet, after every message that came within `patience`.
    pub async fn answered_within(&mut self, id: u32, patience: Duration) -> bool {
        self.live.answered_within(id, patience).await
    }

    /// Subscribes to a record of the repository, and waits for its whole value: the
    /// subscription's id.
    pub async fn watch(&mut self, record: &str, args: Value) -> u32 {
        self.live.watch(record, in_repo(args)).await
    }

    /// Subscribes to a record of the repository: the subscription's id once its whole value
    /// came, or why it cannot be read.
    pub async fn try_watch(&mut self, record: &str, args: Value) -> Result<u32, Refused> {
        self.live.try_watch(record, in_repo(args)).await
    }

    /// The value a subscription holds now.
    pub fn value(&self, id: u32) -> &Value {
        self.live.value(id)
    }

    /// Waits until a subscription's value is as `wanted` says, and gives it.
    pub async fn until(&mut self, id: u32, wanted: impl Fn(&Value) -> bool) -> Value {
        self.live.until(id, wanted).await
    }

    /// Reads a record of the repository once.
    pub async fn read(&mut self, record: &str, args: Value) -> Value {
        self.live.read(record, in_repo(args)).await
    }

    /// The text of a Markdown file of `specs/`, as its branch has it: the record `Buffer`.
    pub async fn text(&mut self, path: &str) -> String {
        let text = self.try_text(path).await;
        text.unwrap_or_else(|| panic!("{path} cannot be read"))
    }

    /// The text of a Markdown file of `specs/`, or none when its branch has no such file.
    pub async fn try_text(&mut self, path: &str) -> Option<String> {
        let args = in_repo(json!({ "path": path }));
        let buffer = self.live.try_read("Buffer", args).await.ok()?;
        Some(buffer["text"].as_str().expect("a buffer's text").to_owned())
    }

    /// The write queue's writes as a subscription holds them, each as `<label> <state>`.
    pub fn writes(&self, queue: u32) -> Vec<String> {
        names(self.value(queue)["writes"].as_array().expect("writes"))
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
        let left = self.live.unwatch(queue).await;
        left["writes"].as_array().expect("writes").clone()
    }

    /// Stops the server, as `ura serve` does on a signal, and gives the repository back.
    pub async fn stop(self) -> TestRepo {
        self.server.stop().await;
        self.repo
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
