//! One client's side of the engine: the records it subscribed to, the calls it made, and the
//! messages that wait for it. No socket is here: the WebSocket's loop is in `socket.rs`.

use std::collections::{BTreeSet, HashMap, VecDeque};
use std::sync::{Arc, Mutex};

use serde_json::Value;
use tokio::sync::Notify;
use uraeda_protocol::{ClientMessage, ErrorCode, ServerMessage};

use super::bus::{Bus, Engine};
use super::locked;
use super::registry::{Call, blocking};
use super::topic::{News, Topic};
use crate::shared::Shared;
use crate::sign_in::Identity;

/// What waits for a connection: the subscriptions that have news, and the answers to its calls.
/// The engine only leaves a note here: a client that reads slowly holds nobody up, and what it
/// is sent is worked out when it reads, from where it is.
#[derive(Default)]
pub(super) struct Mailbox {
    waiting: Mutex<Waiting>,
    bell: Notify,
}

#[derive(Default)]
struct Waiting {
    news: BTreeSet<u32>,
    answers: VecDeque<ServerMessage>,
}

impl Mailbox {
    /// Leaves the answer to a call.
    fn answer(&self, answer: ServerMessage) {
        locked(&self.waiting).answers.push_back(answer);
        self.bell.notify_one();
    }

    /// Takes everything that waits.
    fn take(&self) -> Waiting {
        std::mem::take(&mut *locked(&self.waiting))
    }
}

/// One subscription of one connection, as a record knows it.
#[derive(Clone)]
pub(super) struct Subscriber {
    mailbox: Arc<Mailbox>,
    id: u32,
}

impl Subscriber {
    /// Says the subscription has news: its connection asks the record what, when it next reads.
    pub(super) fn tell(&self) {
        locked(&self.mailbox.waiting).news.insert(self.id);
        self.mailbox.bell.notify_one();
    }

    /// Whether both are the same subscription of the same connection.
    pub(super) fn is(&self, other: &Subscriber) -> bool {
        self.id == other.id && Arc::ptr_eq(&self.mailbox, &other.mailbox)
    }
}

/// A subscription, as its connection knows it.
struct Sub {
    topic: Arc<Topic>,
    /// The number of the last change sent, or none before the whole value was.
    sent: Option<u64>,
    /// What the record's `join` gave: the whole value is sent once a read holds that much.
    need: u64,
}

/// One client's connection to the engine, after its `hello` was welcomed: it takes the client's
/// messages, and gives the server's, in order. Dropping it ends its subscriptions; the calls it
/// made still run to their end.
pub struct Connection {
    engine: Arc<Engine>,
    shared: Shared,
    caller: Arc<Identity>,
    mailbox: Arc<Mailbox>,
    subs: HashMap<u32, Sub>,
    /// The messages ready to send, the next one first.
    out: VecDeque<ServerMessage>,
}

impl Connection {
    /// A connection of `caller`, the identity sign-in checked.
    pub fn open(shared: &Shared, caller: Identity) -> Connection {
        Connection {
            engine: shared.get::<Bus>().0.clone(),
            shared: shared.clone(),
            caller: Arc::new(caller),
            mailbox: Arc::default(),
            subs: HashMap::new(),
            out: VecDeque::new(),
        }
    }

    /// Takes one message of the client, as a text frame holds it.
    pub(super) fn read(&mut self, text: &str) {
        match serde_json::from_str(text) {
            Ok(message) => self.receive(message),
            Err(problem) => self.refuse(None, ErrorCode::BadMessage, problem.to_string()),
        }
    }

    /// Takes one message of the client. It never waits: a read or a call runs on its own task.
    pub fn receive(&mut self, message: ClientMessage) {
        match message {
            ClientMessage::Hello { .. } => {
                let why = "`hello` is the first message of a connection only";
                self.refuse(None, ErrorCode::BadMessage, why.to_owned());
            }
            ClientMessage::Sub { id, record, args } => self.subscribe(id, &record, args, None),
            ClientMessage::Resume {
                id,
                record,
                args,
                epoch,
                seq,
            } => {
                // A number means something under the epoch it was given in only.
                let sent = (epoch == self.shared.epoch()).then_some(seq);
                self.subscribe(id, &record, args, sent);
            }
            ClientMessage::Unsub { id } => self.unsubscribe(id),
            ClientMessage::Call { id, action, input } => self.call(id, &action, input),
        }
    }

    /// The next message for the client: it waits until there is one. Dropping the wait loses
    /// nothing.
    pub async fn next(&mut self) -> ServerMessage {
        loop {
            if let Some(message) = self.out.pop_front() {
                return message;
            }
            let Waiting { news, answers } = self.mailbox.take();
            self.out.extend(answers);
            news.into_iter().for_each(|id| self.report(id));
            if self.out.is_empty() {
                self.mailbox.bell.notified().await;
            }
        }
    }

    fn refuse(&mut self, id: Option<u32>, code: ErrorCode, message: String) {
        self.out
            .push_back(ServerMessage::Error { id, code, message });
    }

    fn subscriber(&self, id: u32) -> Subscriber {
        Subscriber {
            mailbox: self.mailbox.clone(),
            id,
        }
    }

    /// Opens a subscription under `id`, in place of the one open there: from the whole value,
    /// or, for a `resume`, from the change `sent`.
    fn subscribe(&mut self, id: u32, record: &str, args: Value, sent: Option<u64>) {
        self.unsubscribe(id);
        match self.engine.join(record, args, self.subscriber(id)) {
            Ok((topic, need)) => {
                self.subs.insert(id, Sub { topic, sent, need });
            }
            Err(fault) => self.out.push_back(fault.answer(id)),
        }
    }

    fn unsubscribe(&mut self, id: u32) {
        if let Some(sub) = self.subs.remove(&id) {
            sub.topic.leave(&self.subscriber(id));
            locked(&self.mailbox.waiting).news.remove(&id);
        }
    }

    /// Runs an action on its own task, and leaves its answer in the mailbox.
    fn call(&mut self, id: u32, action: &str, input: Value) {
        let run = match self.engine.registry.runner(action) {
            Ok(run) => run,
            Err(fault) => return self.out.push_back(fault.answer(id)),
        };
        let call = Call {
            shared: self.shared.clone(),
            bus: Bus(self.engine.clone()),
            caller: self.caller.clone(),
        };
        let mailbox = self.mailbox.clone();
        self.engine.runtime.spawn(async move {
            let answer = match blocking(move || run(&call, input)).await {
                Ok(output) => ServerMessage::Result { id, output },
                Err(fault) => fault.answer(id),
            };
            mailbox.answer(answer);
        });
    }

    /// Makes the messages of a subscription that has news, from where its client is.
    fn report(&mut self, id: u32) {
        let Some(sub) = self.subs.get_mut(&id) else {
            return;
        };
        match sub.topic.news(sub.sent, sub.need) {
            News::Nothing => {}
            News::Whole { seq, value } => {
                sub.sent = Some(seq);
                self.out.push_back(ServerMessage::Data { id, seq, value });
            }
            News::Changes { first, changes } => {
                for (seq, ops) in (first..).zip(changes) {
                    sub.sent = Some(seq);
                    self.out.push_back(ServerMessage::Change { id, seq, ops });
                }
            }
            News::Ended(fault) => {
                self.subs.remove(&id);
                self.out.push_back(fault.answer(id));
            }
        }
    }
}

impl Drop for Connection {
    fn drop(&mut self) {
        let ids: Vec<u32> = self.subs.keys().copied().collect();
        ids.into_iter().for_each(|id| self.unsubscribe(id));
    }
}
