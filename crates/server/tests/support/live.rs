//! What a test reads and calls over `/live`: a record held by a client of its own, a record
//! read once, an action called once, and a client that holds several records and calls.
//!
//! ```ignore
//! let workspace = support::read(&server, "Workspace", json!({ "repo": "todo-app" })).await;
//! let added = support::call(&server, "inbox.add", input).await?;
//! let mut inbox = Held::open(&server, "Inbox", json!({ "repo": "todo-app" })).await;
//! inbox.until("the note", |inbox| inbox["categories"][0]["notes"] != json!([])).await;
//!
//! let mut live = Live::of(&server).await;
//! let queue = live.watch("WriteQueue", json!({ "repo": "todo-app" })).await;
//! let first = live.send("text.commit", input).await;
//! live.until(queue, |queue| queue["writes"] == json!([])).await;
//! live.answer(first).await?;
//! ```

use std::collections::HashMap;
use std::time::Duration;

use serde_json::Value;
use uraeda_protocol::{ClientMessage, ErrorCode, ServerMessage, apply};

use super::{TestClient, TestServer};

/// What a read or a call fails with: the error's code, and its message.
pub type Refused = (ErrorCode, String);

/// A record a client of its own holds: its value, kept as the changes it gets say.
pub struct Held {
    live: Live,
    id: u32,
    /// The record's value now.
    pub value: Value,
}

impl Held {
    /// Subscribes a new client to a record, and takes its whole value.
    pub async fn open(server: &TestServer, record: &str, args: Value) -> Held {
        match Held::asked(server, record, args).await {
            Ok(held) => held,
            Err((code, message)) => panic!("`{record}` is not read: {code:?}: {message}"),
        }
    }

    /// Subscribes a new client to a record: its value, or the error that ended the subscription.
    pub async fn asked(server: &TestServer, record: &str, args: Value) -> Result<Held, Refused> {
        let mut live = Live::of(server).await;
        let id = live.try_watch(record, args).await?;
        let value = live.value(id).clone();
        Ok(Held { live, id, value })
    }

    /// Takes the record's changes until its value passes: fails when none comes that does.
    pub async fn until(&mut self, what: &str, passes: impl Fn(&Value) -> bool) -> &Value {
        self.live.waiting_for(what);
        self.value = self.live.until(self.id, passes).await;
        &self.value
    }
}

/// A record's value, read once by a new client.
pub async fn read(server: &TestServer, record: &str, args: Value) -> Value {
    Held::open(server, record, args).await.value
}

/// Calls an action from a new client: its output, or its error's code and message.
pub async fn call(server: &TestServer, action: &str, input: Value) -> Result<Value, Refused> {
    Live::of(server).await.try_call(action, input).await
}

/// One signed-in client: the records it holds, each kept as its changes say, and the answers
/// to its calls. A change must be numbered one more than the one before it.
pub struct Live {
    client: TestClient,
    next: u32,
    /// The value of each open subscription, and the number of its last change.
    values: HashMap<u32, (Value, u64)>,
    /// The answers that came for calls and subscriptions nobody asked about yet.
    answers: HashMap<u32, Result<Value, Refused>>,
    /// What the test waits for, said when nothing comes.
    waiting_for: String,
}

impl Live {
    /// A new client of the server, signed in as a paired device.
    pub async fn of(server: &TestServer) -> Live {
        Live {
            client: server.connect().await,
            next: 0,
            values: HashMap::new(),
            answers: HashMap::new(),
            waiting_for: String::new(),
        }
    }

    /// Names what the next wait is for, in the failure of a wait that never ends.
    pub fn waiting_for(&mut self, what: &str) {
        what.clone_into(&mut self.waiting_for);
    }

    /// Calls an action, and gives its output.
    pub async fn call(&mut self, action: &str, input: Value) -> Value {
        match self.try_call(action, input).await {
            Ok(output) => output,
            Err((code, message)) => panic!("{action} failed: {code:?}: {message}"),
        }
    }

    /// Calls an action that fails, and gives its error.
    pub async fn refused(&mut self, action: &str, input: Value) -> Refused {
        match self.try_call(action, input).await {
            Ok(output) => panic!("{action} answered {output}"),
            Err(refused) => refused,
        }
    }

    /// Calls an action, and gives its answer.
    pub async fn try_call(&mut self, action: &str, input: Value) -> Result<Value, Refused> {
        let id = self.send(action, input).await;
        self.answer(id).await
    }

    /// Sends a call without waiting for its answer: its id.
    pub async fn send(&mut self, action: &str, input: Value) -> u32 {
        let id = self.id();
        let action = action.to_owned();
        let call = ClientMessage::Call { id, action, input };
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

    /// Subscribes to a record, and waits for its whole value: the subscription's id.
    pub async fn watch(&mut self, record: &str, args: Value) -> u32 {
        match self.try_watch(record, args).await {
            Ok(id) => id,
            Err((code, message)) => panic!("{record} cannot be read: {code:?}: {message}"),
        }
    }

    /// Subscribes to a record: the subscription's id once its whole value came, or why it
    /// cannot be read.
    pub async fn try_watch(&mut self, record: &str, args: Value) -> Result<u32, Refused> {
        let id = self.id();
        let record = record.to_owned();
        let sub = ClientMessage::Sub { id, record, args };
        self.client.send(&sub).await;
        while !self.values.contains_key(&id) {
            if let Some(Err(refused)) = self.answers.remove(&id) {
                return Err(refused);
            }
            self.take().await;
        }
        Ok(id)
    }

    /// Ends a subscription, and gives the value it held.
    pub async fn unwatch(&mut self, id: u32) -> Value {
        self.client.send(&ClientMessage::Unsub { id }).await;
        self.values.remove(&id).expect("a held record").0
    }

    /// The value a subscription holds now.
    pub fn value(&self, id: u32) -> &Value {
        &self.values[&id].0
    }

    /// Waits until a subscription's value is as `wanted` says, and gives it.
    pub async fn until(&mut self, id: u32, wanted: impl Fn(&Value) -> bool) -> Value {
        while !wanted(self.value(id)) {
            self.take().await;
        }
        self.value(id).clone()
    }

    /// Reads a record once: its value, or why it cannot be read.
    pub async fn try_read(&mut self, record: &str, args: Value) -> Result<Value, Refused> {
        let id = self.try_watch(record, args).await?;
        Ok(self.unwatch(id).await)
    }

    /// Reads a record once.
    pub async fn read(&mut self, record: &str, args: Value) -> Value {
        let id = self.watch(record, args).await;
        self.unwatch(id).await
    }

    fn id(&mut self) -> u32 {
        self.next += 1;
        self.next
    }

    /// Takes the server's next message: a subscription's value or change, or an answer.
    async fn take(&mut self) {
        let message = self.client.next_for(&self.waiting_for).await;
        match message {
            ServerMessage::Data { id, seq, value } => {
                self.values.insert(id, (value, seq));
            }
            ServerMessage::Change { id, seq, ops } => {
                // A change of a subscription that ended meanwhile is dropped.
                if let Some((value, last)) = self.values.get_mut(&id) {
                    assert_eq!(seq, *last + 1, "a change is numbered one more");
                    apply(value, &ops).expect("a change applies to the value held");
                    *last = seq;
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
