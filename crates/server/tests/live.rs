//! The live engine: a record arrives whole once, then as numbered changes; actions answer; a
//! resume gets what was missed; and updates are paced.
//!
//! The tests' record is `Counter`, registered on a running server and declared nowhere else: a
//! count, changed by the action `counter.add`, and a tape, a text that grows.

mod support;

use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use hyper::HeaderMap;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use support::{TestClient, TestServer};
use tokio::sync::oneshot;
use tokio::time::Instant;
use ts_rs::TS;
use uraeda_core::actions::ActionError;
use uraeda_protocol::{Action, ClientMessage, ErrorCode, Op, Record, ServerMessage, SignIn, apply};
use uraeda_server::live::{self, Bus, Connection, Fault, Registry};
use uraeda_server::sign_in::{self, Identity};

/// Which counter.
#[derive(Clone, Serialize, Deserialize, TS)]
struct CounterArgs {
    id: String,
}

/// A counter: its count, and its tape, a text that only grows.
#[derive(Clone, Default, Serialize, Deserialize, TS)]
struct Counter {
    id: String,
    count: u64,
    tape: String,
}

impl Record for Counter {
    const NAME: &'static str = "Counter";
    type Args = CounterArgs;
    type Value = Self;
}

/// What `counter.add` takes: the counter, and how much to add.
#[derive(Serialize, Deserialize, TS)]
struct CounterAddInput {
    id: String,
    by: u64,
}

/// Adds to a counter, and gives its count after.
struct CounterAdd;

impl Action for CounterAdd {
    const NAME: &'static str = "counter.add";
    type Input = CounterAddInput;
    type Output = u64;
}

/// Fails as its input says: one of the core's refusals, or a panic.
struct CounterFail;

impl Action for CounterFail {
    const NAME: &'static str = "counter.fail";
    type Input = String;
    type Output = ();
}

/// Says who calls it: the kind and the id of the caller's sign-in.
struct CounterWho;

impl Action for CounterWho {
    const NAME: &'static str = "counter.who";
    type Input = ();
    type Output = String;
}

/// The tests' domain: the counters it stores, and the bus it reports their changes on.
#[derive(Clone)]
struct Counters {
    stored: Arc<Mutex<HashMap<String, Counter>>>,
    bus: Bus,
    held: Arc<Mutex<Option<Hold>>>,
    /// The turn a call takes before it writes, as a domain's write queue gives.
    turn: Arc<tokio::sync::Mutex<()>>,
}

/// A read to hold once it has its value: it says it started, then waits to be let go.
struct Hold {
    started: oneshot::Sender<()>,
    let_go: mpsc::Receiver<()>,
}

impl Counters {
    /// Registers the domain on a running server, as a domain of the server does when it mounts.
    fn on(server: &TestServer) -> Counters {
        let registry = server.shared().get::<Registry>();
        let counters = Counters {
            stored: Arc::default(),
            bus: Bus::clone(&server.shared().get::<Bus>()),
            held: Arc::default(),
            turn: Arc::default(),
        };
        let domain = counters.clone();
        registry.record::<Counter>(move |_, args| match args.id.as_str() {
            "broken" => Err(Fault::refused("the counter `broken` cannot be read")),
            id => Ok(domain.read(id)),
        });
        let domain = counters.clone();
        registry.action::<CounterAdd>(move |_, input| {
            // A handler cannot await: it waits for its turn from its blocking thread.
            let _turn = live::wait(domain.turn.lock());
            Ok(domain.add(&input.id, input.by))
        });
        registry.action::<CounterFail>(|_, kind| Err(failure(&kind)));
        registry.action::<CounterWho>(|call, ()| {
            let caller = call.caller();
            Ok(format!("{:?} {}", caller.kind(), caller.id()))
        });
        counters
    }

    /// A counter as it is stored: at zero, with an empty tape, until something changes it.
    fn stored(&self, id: &str) -> Counter {
        self.change(id, |counter| counter.clone())
    }

    /// Reads a counter, as the record's handler does: a read the test holds keeps the value it
    /// took until it is let go.
    fn read(&self, id: &str) -> Counter {
        let counter = self.stored(id);
        if let Some(hold) = self.held.lock().unwrap().take() {
            let _ = hold.started.send(());
            let _ = hold.let_go.recv();
        }
        counter
    }

    /// Holds the next read: the first half tells when it has its value, and sending on the second
    /// lets it go.
    fn hold(&self) -> (oneshot::Receiver<()>, mpsc::Sender<()>) {
        let (started, has_started) = oneshot::channel();
        let (let_go, held) = mpsc::channel();
        let hold = Hold {
            started,
            let_go: held,
        };
        *self.held.lock().unwrap() = Some(hold);
        (has_started, let_go)
    }

    /// Changes a stored counter, and gives what the change gives.
    fn change<T>(&self, id: &str, change: impl FnOnce(&mut Counter) -> T) -> T {
        let mut stored = self.stored.lock().unwrap();
        let counter = stored.entry(id.to_owned()).or_insert_with(|| Counter {
            id: id.to_owned(),
            ..Counter::default()
        });
        change(counter)
    }

    /// Adds to a counter, says it changed, and gives its count.
    fn add(&self, id: &str, by: u64) -> u64 {
        let count = self.change(id, |counter| {
            counter.count += by;
            counter.count
        });
        self.bus.changed::<Counter>(&args(id));
        count
    }

    /// Writes on a counter's tape, then says where the tape grew, and by what.
    fn say(&self, id: &str, text: &str) {
        let at = self.write(id, text);
        self.bus.append::<Counter>(&args(id), &["tape"], at, text);
    }

    /// Writes on a counter's tape without saying so, and gives the tape's length before.
    fn write(&self, id: &str, text: &str) -> usize {
        self.change(id, |counter| {
            let at = counter.tape.len();
            counter.tape.push_str(text);
            at
        })
    }
}

/// What `counter.fail` fails with.
fn failure(kind: &str) -> Fault {
    match kind {
        "refused" => ActionError::Refused("the tape is full".to_owned()).into(),
        "conflict" => ActionError::changed("specs/PRIORITIES.md").into(),
        "hook" => ActionError::Hook {
            message: "exit code 1".to_owned(),
            output: "lint: 2 problems".to_owned(),
        }
        .into(),
        other => panic!("counter.fail was asked to panic: {other}"),
    }
}

fn args(id: &str) -> CounterArgs {
    CounterArgs { id: id.to_owned() }
}

/// A `sub` to a counter.
fn sub(id: u32, counter: &str) -> ClientMessage {
    ClientMessage::Sub {
        id,
        record: "Counter".to_owned(),
        args: json!({ "id": counter }),
    }
}

/// A `call` of `counter.add`.
fn add(id: u32, counter: &str, by: u64) -> ClientMessage {
    ClientMessage::Call {
        id,
        action: "counter.add".to_owned(),
        input: json!({ "id": counter, "by": by }),
    }
}

/// One operation that sets a counter's count.
fn count_set(count: u64) -> Vec<Op> {
    vec![Op::Set {
        path: vec!["count".to_owned()],
        value: json!(count),
    }]
}

/// What a client holds of one subscription: its value, the number of the last change it applied,
/// and what it was sent, as a client's store keeps them.
struct Held {
    id: u32,
    value: Value,
    seq: u64,
    /// How many times the whole value came.
    wholes: usize,
    /// Every operation applied, in order.
    ops: Vec<Op>,
    /// The outputs of the calls answered meanwhile.
    outputs: Vec<Value>,
}

impl Held {
    /// A subscription that holds nothing yet.
    fn new(id: u32) -> Held {
        Held {
            id,
            value: Value::Null,
            seq: 0,
            wholes: 0,
            ops: Vec::new(),
            outputs: Vec::new(),
        }
    }

    /// Takes one message, as the contract says a client does: a change applies only when its
    /// number is the next one.
    fn take(&mut self, message: ServerMessage) {
        match message {
            ServerMessage::Data { id, seq, value } if id == self.id => {
                (self.value, self.seq) = (value, seq);
                self.wholes += 1;
            }
            ServerMessage::Change { id, seq, ops } if id == self.id => {
                assert_eq!(
                    seq,
                    self.seq + 1,
                    "a change is numbered one more than the last"
                );
                apply(&mut self.value, &ops).expect("a change applies to the value held");
                self.seq = seq;
                self.ops.extend(ops);
            }
            ServerMessage::Result { output, .. } => self.outputs.push(output),
            other => panic!("unexpected message: {other:?}"),
        }
    }

    /// Reads a client's messages until the value held and the answers are as `done` says.
    async fn follow(&mut self, client: &mut TestClient, done: impl Fn(&Held) -> bool) {
        while !done(self) {
            self.take(client.next().await);
        }
    }

    fn count(&self) -> u64 {
        self.value["count"].as_u64().expect("a count")
    }

    fn tape(&self) -> &str {
        self.value["tape"].as_str().expect("a tape")
    }
}

#[tokio::test]
async fn a_subscriber_gets_the_value_then_only_changes() {
    let server = support::server().await;
    let counters = Counters::on(&server);
    let mut client = server.connect().await;

    client.send(&sub(1, "a")).await;
    let ServerMessage::Data { id: 1, seq, value } = client.next().await else {
        panic!("a sub is answered with the whole value");
    };
    assert_eq!(value, json!({ "id": "a", "count": 0, "tape": "" }));

    // A change is said from any thread, as the core's watcher says its own.
    let domain = counters.clone();
    let said = std::thread::spawn(move || domain.add("a", 2));
    assert_eq!(said.join().ok(), Some(2));
    let change = |id, seq, count| ServerMessage::Change {
        id,
        seq,
        ops: count_set(count),
    };
    assert_eq!(client.next().await, change(1, seq + 1, 2));

    // Another client's arguments name the same record however they are written: it gets the value
    // as it is now, at the same number, and the next change with the first.
    let mut other = server.connect().await;
    let record = "Counter".to_owned();
    let args = json!({ "more": true, "id": "a" });
    other
        .send(&ClientMessage::Sub {
            id: 9,
            record,
            args,
        })
        .await;
    let whole = |id, seq, count| ServerMessage::Data {
        id,
        seq,
        value: json!({ "id": "a", "count": count, "tape": "" }),
    };
    assert_eq!(other.next().await, whole(9, seq + 1, 2));

    // An `unsub` ends the subscription: the record's next change reaches the other client alone,
    // and a new `sub` under the same id starts from the whole value.
    client.send(&ClientMessage::Unsub { id: 1 }).await;
    client.send(&add(2, "a", 1)).await;
    let result = |id, output| ServerMessage::Result {
        id,
        output: json!(output),
    };
    assert_eq!(client.next().await, result(2, 3));
    assert_eq!(other.next().await, change(9, seq + 2, 3));
    client.send(&sub(1, "a")).await;
    assert_eq!(client.next().await, whole(1, seq + 2, 3));

    // Every record of a name can be said to have changed at once: each one held is read again.
    client.send(&sub(3, "b")).await;
    let ServerMessage::Data { id: 3, seq: b, .. } = client.next().await else {
        panic!("a sub is answered with the whole value");
    };
    for id in ["a", "b"] {
        counters.change(id, |counter| counter.count = 7);
    }
    counters.bus.changed_all::<Counter>();
    let both = [client.next().await, client.next().await];
    assert!(both.contains(&change(1, seq + 3, 7)), "{both:?}");
    assert!(both.contains(&change(3, b + 1, 7)), "{both:?}");
}

#[tokio::test]
async fn two_clients_acting_at_once_end_equal() {
    let server = support::server().await;
    let counters = Counters::on(&server);
    let mut clients = [server.connect().await, server.connect().await];
    let mut held = [Held::new(1), Held::new(1)];
    for (client, held) in clients.iter_mut().zip(&mut held) {
        client.send(&sub(1, "shared")).await;
        held.take(client.next().await);
    }

    // Both act while a read of the record is on its way, with the value from before: ten calls
    // each, all sent before any answer is read.
    let (has_value, let_go) = counters.hold();
    counters.add("shared", 5);
    has_value.await.expect("the record is read again");
    for call in 2..12 {
        for (client, by) in clients.iter_mut().zip([1, 100]) {
            client.send(&add(call, "shared", by)).await;
        }
    }
    let [one, two] = &mut clients;
    let [first, second] = &mut held;
    let answered = |held: &Held| held.outputs.len() == 10;
    tokio::join!(first.follow(one, answered), second.follow(two, answered));
    let_go.send(()).expect("the read still waits");
    let settled = |held: &Held| held.count() == 1015;
    tokio::join!(first.follow(one, settled), second.follow(two, settled));

    assert_eq!(first.value, second.value);
    assert_eq!(first.seq, second.seq);
    // Every call was answered, each with a count of its own.
    let outputs: BTreeSet<u64> = held
        .iter()
        .flat_map(|held| held.outputs.iter().filter_map(Value::as_u64))
        .collect();
    assert_eq!(outputs.len(), 20);
    assert_eq!(outputs.last(), Some(&1015));
}

#[tokio::test]
async fn a_resume_after_a_drop_gets_what_it_missed() {
    let server = support::server().await;
    let counters = Counters::on(&server);
    let mut client = server.connect().await;
    let mut held = Held::new(1);
    client.send(&sub(1, "reply")).await;
    held.take(client.next().await);
    counters.say("reply", "Hel");
    held.follow(&mut client, |held| held.tape() == "Hel").await;
    let epoch = client.epoch().to_owned();
    drop(client);

    // The reply goes on, and the record changes, while the connection is down.
    counters.say("reply", "lo");
    counters.add("reply", 1);
    counters.say("reply", ", world");

    let resume = |id, epoch: &str, seq| ClientMessage::Resume {
        id,
        record: "Counter".to_owned(),
        args: json!({ "id": "reply" }),
        epoch: epoch.to_owned(),
        seq,
    };
    let mut back = server.connect().await;
    let (wholes, applied) = (held.wholes, held.ops.len());
    back.send(&resume(1, &epoch, held.seq)).await;
    held.follow(&mut back, |held| {
        held.tape() == "Hello, world" && held.count() == 1
    })
    .await;
    // Only what was missed came: changes after the one last applied, and the tape's new text.
    assert_eq!(held.wholes, wholes, "a resume sends no whole value");
    let missed: String = held.ops[applied..]
        .iter()
        .map(|op| match op {
            Op::Append { path, text } if path == &["tape"] => text.as_str(),
            Op::Set { path, .. } if path == &["count"] => "",
            other => panic!("a resumed reply only grows: {other:?}"),
        })
        .collect();
    assert_eq!(missed, "lo, world");

    // A text a read already brought is not appended a second time when its append is said late.
    let at = counters.write("reply", "!");
    counters.add("reply", 1);
    held.follow(&mut back, |held| held.tape() == "Hello, world!")
        .await;
    counters
        .bus
        .append::<Counter>(&args("reply"), &["tape"], at, "!");
    counters.say("reply", "?");
    held.follow(&mut back, |held| held.tape().ends_with('?'))
        .await;
    assert_eq!(held.tape(), "Hello, world!?");

    // A number of another start of the server means nothing: the whole value comes.
    let mut stale = server.connect().await;
    stale.send(&resume(4, "another-epoch", held.seq)).await;
    let ServerMessage::Data { id: 4, seq, value } = stale.next().await else {
        panic!("a resume under another epoch gets the whole value");
    };
    assert_eq!((seq, &value), (held.seq, &held.value));
}

/// Who a newly paired device is, as sign-in checks its `hello`.
async fn identity(server: &TestServer) -> Identity {
    let token = server.pair("A test's device").await;
    sign_in::check(server.shared(), &HeaderMap::new(), &SignIn::Token(token))
        .expect("a paired device signs in")
}

/// A connection of `caller` to the engine with no socket, for the tests that set the clock.
fn connection(server: &TestServer, caller: &Identity) -> Connection {
    Connection::open(server.shared(), caller.clone())
}

#[tokio::test(start_paused = true)]
async fn a_burst_of_updates_is_sent_as_one_change() {
    let server = support::server().await;
    let counters = Counters::on(&server);
    let caller = identity(&server).await;
    let mut reader = connection(&server, &caller);
    reader.receive(sub(1, "a"));
    let ServerMessage::Data { seq, .. } = reader.next().await else {
        panic!("a sub is answered with the whole value");
    };
    let change = |seq, count| ServerMessage::Change {
        id: 1,
        seq,
        ops: count_set(count),
    };

    for _ in 0..5 {
        counters.add("a", 1);
    }
    assert_eq!(reader.next().await, change(seq + 1, 5));

    // Updates within 16 ms of the last one sent wait for its end, and go as one: the latest.
    let sent = Instant::now();
    for _ in 0..3 {
        counters.add("a", 1);
        tokio::time::sleep(Duration::from_millis(5)).await;
    }
    assert_eq!(reader.next().await, change(seq + 2, 8));
    assert_eq!(sent.elapsed(), Duration::from_millis(16));

    // A subscriber 1,000 changes behind still gets them, one by one; one change more, and it
    // gets the whole value again.
    let (mut behind, mut lost) = (connection(&server, &caller), connection(&server, &caller));
    for late in [&mut behind, &mut lost] {
        late.receive(sub(1, "a"));
        assert!(matches!(late.next().await, ServerMessage::Data { .. }));
    }
    for count in 9..1009 {
        counters.add("a", 1);
        assert_eq!(reader.next().await, change(seq + count - 6, count));
    }
    assert_eq!(behind.next().await, change(seq + 3, 9));
    counters.add("a", 1);
    assert_eq!(reader.next().await, change(seq + 1003, 1009));
    let ServerMessage::Data { seq: at, value, .. } = lost.next().await else {
        panic!("a subscriber too far behind gets the whole value");
    };
    assert_eq!((at, &value["count"]), (seq + 1003, &json!(1009)));
}

#[tokio::test]
async fn an_action_knows_who_calls() {
    let server = support::server().await;
    Counters::on(&server);
    let who = ClientMessage::Call {
        id: 1,
        action: "counter.who".to_owned(),
        input: Value::Null,
    };
    let said = |caller: String| ServerMessage::Result {
        id: 1,
        output: json!(caller),
    };

    // A paired device, by the token its `hello` gives.
    let token = server.pair("Phone").await;
    let mut device = server.socket().await;
    device.sign_in(SignIn::Token(token.clone()));
    device.hello().await;
    device.send(&who).await;
    let id = token.split_once('.').unwrap().0;
    assert_eq!(device.next().await, said(format!("Device {id}")));

    // A browser, by the cookie of the request that opened its connection.
    let cookie = server.sign_in().await;
    let mut browser = server.browser_socket(&cookie).await;
    browser.hello().await;
    browser.send(&who).await;
    let id = cookie.split_once('=').unwrap().1.split_once('.').unwrap().0;
    assert_eq!(browser.next().await, said(format!("Session {id}")));
}

/// A message that fails, the code of its `error`, and a part of the error's message.
fn failing_rows() -> Vec<(ClientMessage, ErrorCode, &'static str)> {
    let sub = |record: &str, args| ClientMessage::Sub {
        id: 5,
        record: record.to_owned(),
        args,
    };
    let call = |action: &str, input| ClientMessage::Call {
        id: 5,
        action: action.to_owned(),
        input,
    };
    vec![
        (
            sub("Nothing", Value::Null),
            ErrorCode::UnknownRecord,
            "Nothing",
        ),
        (sub("Counter", json!({})), ErrorCode::BadArgs, "id"),
        (
            sub("Counter", json!({ "id": "broken" })),
            ErrorCode::Refused,
            "cannot be read",
        ),
        (
            call("counter.nothing", Value::Null),
            ErrorCode::UnknownAction,
            "counter.nothing",
        ),
        (
            call("counter.add", json!({ "id": "a" })),
            ErrorCode::BadInput,
            "by",
        ),
        // The core's three refusals keep their codes, and a hook's message is its output.
        (
            call("counter.fail", json!("refused")),
            ErrorCode::Refused,
            "the tape is full",
        ),
        (
            call("counter.fail", json!("conflict")),
            ErrorCode::Conflict,
            "PRIORITIES.md changed on disk",
        ),
        (
            call("counter.fail", json!("hook")),
            ErrorCode::Hook,
            "lint: 2 problems",
        ),
        // A handler that panics fails its own call, and the server goes on.
        (
            call("counter.fail", json!("panic")),
            ErrorCode::Internal,
            "",
        ),
    ]
}

#[tokio::test]
async fn an_error_names_what_it_answers_and_why() {
    let server = support::server().await;
    Counters::on(&server);
    let mut client = server.connect().await;

    for (message, expected, part) in failing_rows() {
        client.send(&message).await;
        let ServerMessage::Error { id, code, message } = client.next().await else {
            panic!("{message:?} is answered with an error");
        };
        assert_eq!((id, code), (Some(5), expected), "{message}");
        assert!(message.contains(part), "`{message}` has no `{part}`");
    }

    // An error ended its subscription and its call: the id is free again.
    client.send(&add(5, "a", 4)).await;
    let output = json!(4);
    assert_eq!(client.next().await, ServerMessage::Result { id: 5, output });
}

/// The records and the actions the protocol declares, and no handler serves yet, each with the
/// task that builds it. A name leaves this list in the commit that registers its handler: the test
/// fails while it is both here and served.
const NOT_BUILT: &[&str] = &[];

#[tokio::test]
async fn every_declared_record_and_action_is_served_and_no_other() {
    let server = support::server().await;
    let registry = server.shared().get::<Registry>();
    let catalog = uraeda_protocol::catalog();

    let mut problems = compared("record", catalog.records(), &registry.records());
    problems.extend(compared("action", catalog.actions(), &registry.actions()));
    let declared: BTreeSet<&str> = catalog.records().chain(catalog.actions()).collect();
    let gone = NOT_BUILT.iter().filter(|name| !declared.contains(*name));
    problems
        .extend(gone.map(|name| format!("`{name}` is in NOT_BUILT and not declared: remove it")));

    assert!(problems.is_empty(), "{}", problems.join("\n"));
}

/// What differs between the names the protocol declares and the names the server serves.
fn compared(
    kind: &str,
    declared: impl Iterator<Item = &'static str>,
    served: &[&'static str],
) -> Vec<String> {
    let declared: BTreeSet<&str> = declared.collect();
    let served: BTreeSet<&str> = served.iter().copied().collect();
    let waiting: BTreeSet<&str> = NOT_BUILT.iter().copied().collect();
    let rows = [
        (
            &(&declared - &served) - &waiting,
            "is declared and has no handler: register it with the server's `Registry`",
        ),
        (
            &served - &declared,
            "has a handler and is not declared: add its line to the protocol's `catalog()`",
        ),
        (&waiting & &served, "is served: remove it from NOT_BUILT"),
    ];
    rows.into_iter()
        .flat_map(|(names, fix)| {
            names
                .into_iter()
                .map(move |name| format!("the {kind} `{name}` {fix}"))
        })
        .collect()
}
