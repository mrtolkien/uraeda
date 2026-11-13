//! The runtime contract: the fake runtime playing its scripts, the stream of a process's events,
//! the registry the server keeps its runtimes in, and, in `runtimes/child.rs`, the process a
//! runtime runs its agent in.
//!
//! The fake's tests run on tokio's paused clock: a script's waits take their time on it, and
//! none of the test's.

#[path = "runtimes/child.rs"]
mod child;
use crate::support;

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use serde_json::{Value, json};
use tokio::time::Instant;
use uraeda_server::runner::{Denial, Event};
use uraeda_server::runtimes::fake::{Fake, Script, Step};
use uraeda_server::runtimes::{
    self, Events, Options, Outgoing, Runtime, RuntimeError, Runtimes, Signal, Status, Tools, When,
};

/// How a session's process opens, in `/work`.
fn options(native_id: &str) -> Options {
    Options {
        cwd: PathBuf::from("/work"),
        native_id: native_id.to_owned(),
        resume: false,
        model: None,
        effort: None,
        account: None,
        allowed: Vec::new(),
        skills: Vec::new(),
        tools: Tools::Own,
    }
}

/// A message sent to an agent.
fn message(id: &str, text: &str) -> Outgoing {
    Outgoing {
        id: id.to_owned(),
        text: text.to_owned(),
        images: Vec::new(),
        when: When::Queue,
        review: false,
    }
}

/// A script, from the JSON a sample is written in.
fn script(steps: Value) -> Script {
    serde_json::from_value(steps).expect("a script")
}

/// An event, from its JSON.
fn event(json: Value) -> Event {
    serde_json::from_value(json).expect("an event")
}

/// The next events of a process, as JSON.
async fn read(events: &mut Events, count: usize) -> Vec<Value> {
    let mut read = Vec::new();
    for _ in 0..count {
        let next = events.next().await.expect("the stream goes on");
        read.push(serde_json::to_value(next).unwrap());
    }
    read
}

/// Every event left, until the stream ends.
async fn rest(events: &mut Events) -> Vec<Event> {
    let mut read = Vec::new();
    while let Some(next) = events.next().await {
        read.push(next);
    }
    read
}

/// The result a turn ends with when nothing went wrong.
fn done() -> Value {
    json!({ "type": "result", "denials": [], "errors": [], "interrupted": false, "ok": true })
}

/// The result of a turn that an interrupt ended.
fn interrupted() -> Value {
    json!({ "type": "result", "denials": [], "errors": [], "interrupted": true, "ok": false })
}

#[tokio::test(start_paused = true)]
async fn the_fake_runtime_plays_its_script_and_stops_when_told() {
    let fake = Fake::new();
    let read_me = json!({
        "type": "toolStart", "id": "t1", "input": { "file_path": "README.md" },
        "kind": "read", "name": "Read", "target": "README.md",
    });
    fake.script(script(json!([
        { "type": "textDelta", "text": "Reading " },
        { "wait": 400 },
        read_me,
        { "wait": 600 },
        { "type": "toolEnd", "id": "t1", "isError": false, "output": "# Todo" },
        { "type": "textDelta", "text": "the README." },
        { "type": "text", "text": "Reading the README." },
    ])));
    fake.script(script(json!([
        { "type": "textDelta", "text": "Thinking" },
        { "wait": 60_000 },
        { "type": "text", "text": "never said" },
    ])));
    let mut process = fake.open(options("native-1"));
    let mut events = process.events();
    let started = Instant::now();

    process.send(message("m1", "What does the README say?"));
    assert_eq!(
        read(&mut events, 8).await,
        [
            json!({ "type": "init", "sessionId": "native-1" }),
            json!({ "type": "accepted", "id": "m1" }),
            json!({ "type": "textDelta", "text": "Reading " }),
            read_me,
            json!({ "type": "toolEnd", "id": "t1", "isError": false, "output": "# Todo" }),
            json!({ "type": "textDelta", "text": "the README." }),
            json!({ "type": "text", "text": "Reading the README." }),
            done(),
        ],
        "a scripted turn is its message read, its steps in order, then a result of its own"
    );
    assert_eq!(started.elapsed(), Duration::from_secs(1), "the waits");

    process.send(message("m2", "And the plan?"));
    assert_eq!(
        read(&mut events, 2).await,
        [
            json!({ "type": "accepted", "id": "m2" }),
            json!({ "type": "textDelta", "text": "Thinking" }),
        ]
    );
    process.interrupt();
    assert_eq!(read(&mut events, 1).await, [interrupted()]);
    assert_eq!(fake.running(), 1, "an interrupt keeps the process");

    process.close();
    assert_eq!(
        rest(&mut events).await,
        [event(json!({ "type": "exit", "code": 0, "stderr": "" }))],
        "the steps an interrupt dropped never come, and a close ends the stream with an exit"
    );
    assert_eq!(fake.running(), 0);
    assert_eq!(started.elapsed(), Duration::from_secs(1), "the cut wait");
    let sent: Vec<String> = fake.sent().into_iter().map(|sent| sent.id).collect();
    assert_eq!(sent, ["m1", "m2"]);
    assert_eq!(fake.opens(), [options("native-1")]);
    assert_eq!((fake.interrupts(), fake.closes()), (1, 1));
}

#[tokio::test(start_paused = true)]
async fn an_interrupted_process_plays_its_next_message() {
    let fake = Fake::new();
    fake.script(script(
        json!([{ "wait": 5000 }, { "type": "text", "text": "cut" }]),
    ));
    fake.script(script(json!([{ "type": "text", "text": "second" }])));
    let mut process = fake.open(options("native"));
    let mut events = process.events();

    process.send(message("m1", "first"));
    read(&mut events, 2).await;
    process.interrupt();
    process.send(message("m2", "again"));

    assert_eq!(
        read(&mut events, 4).await,
        [
            interrupted(),
            json!({ "type": "accepted", "id": "m2" }),
            json!({ "type": "text", "text": "second" }),
            done(),
        ]
    );
}

#[tokio::test(start_paused = true)]
async fn a_kill_ends_the_process_with_its_signals_code_and_leaves_no_task() {
    let fake = Fake::new();
    fake.set(|fake| {
        fake.ignore_interrupt = true;
        fake.ignore_term = true;
        fake.ignore_close = true;
    });
    fake.script(script(
        json!([{ "wait": 3_600_000 }, { "type": "text", "text": "never" }]),
    ));
    let mut process = fake.open(options("native"));
    let mut events = process.events();
    process.send(message("m1", "work"));
    read(&mut events, 2).await;

    // A stuck process: nothing but SIGKILL ends it.
    process.interrupt();
    process.kill(Signal::Interrupt);
    process.close();
    process.kill(Signal::Terminate);
    assert_eq!(fake.running(), 1);
    process.kill(Signal::Kill);

    assert_eq!(
        rest(&mut events).await,
        [event(json!({ "type": "exit", "code": 137, "stderr": "" }))]
    );
    assert_eq!(fake.running(), 0, "no task plays a killed process");
    assert_eq!(
        fake.kills(),
        [Signal::Interrupt, Signal::Terminate, Signal::Kill]
    );
    let names = fake.kills().into_iter().map(Signal::name);
    assert_eq!(names.collect::<Vec<_>>(), ["SIGINT", "SIGTERM", "SIGKILL"]);
    // A message to a process that exited is recorded, and plays nothing.
    process.send(message("m2", "anyone?"));
    assert_eq!(fake.sent().len(), 2);

    let codes = [(Signal::Interrupt, 130), (Signal::Terminate, 143)];
    for (signal, code) in codes {
        let fake = Fake::new();
        let mut process = fake.open(options("native"));
        let mut events = process.events();
        process.kill(signal);
        let exit = event(json!({ "type": "exit", "code": code, "stderr": "" }));
        assert_eq!(
            rest(&mut events).await,
            [exit],
            "what it had not said is dropped"
        );
    }
}

#[tokio::test(start_paused = true)]
async fn a_message_the_agent_has_not_read_is_taken_back() {
    let fake = Fake::new();
    fake.script(script(
        json!([{ "wait": 1000 }, { "type": "text", "text": "first" }]),
    ));
    fake.script(script(json!([{ "type": "text", "text": "second" }])));
    let mut process = fake.open(options("native"));
    let mut events = process.events();
    process.send(message("m1", "one"));
    process.send(message("m2", "two"));
    read(&mut events, 2).await;

    // The first is read already: its take-back changes nothing. The second waits its turn.
    process.take_back("m1");
    process.take_back("m2");

    process.close();
    assert_eq!(
        rest(&mut events).await,
        [
            event(json!({ "type": "cancelled", "id": "m2" })),
            event(json!({ "type": "text", "text": "first" })),
            event(done()),
            event(json!({ "type": "exit", "code": 0, "stderr": "" })),
        ],
        "a close still says what the process wrote, without its waits"
    );
    assert_eq!(fake.taken_back(), ["m1", "m2"]);
}

#[tokio::test(start_paused = true)]
async fn a_blocked_action_is_a_denial_of_its_result_until_its_rule_is_allowed() {
    let fake = Fake::new();
    let fetch = json!({ "tool": "Bash", "input": { "command": "curl example.com" } });
    let denial: Denial = serde_json::from_value(fetch.clone()).unwrap();
    let turn = json!([{ "try": { "id": "t1", "tool": "Bash", "input": fetch["input"] } }]);
    fake.script(script(turn.clone()));
    fake.script(script(turn));
    let start = json!({
        "type": "toolStart", "id": "t1", "input": fetch["input"], "kind": "other",
        "name": "Bash", "target": "curl example.com",
    });

    let mut process = fake.open(options("native"));
    let mut events = process.events();
    process.send(message("m1", "Fetch the page"));
    let blocked = read(&mut events, 5).await;
    assert_eq!(blocked[2], start);
    assert_eq!(blocked[3]["isError"], true);
    assert_eq!(
        blocked[4],
        json!({
            "type": "result", "denials": [fetch], "errors": [], "interrupted": false, "ok": true,
        }),
        "the turn goes on, and its result says what was blocked"
    );

    // The human's yes: the rule of that action alone, and a process opened with it.
    let rule = fake.allow_rule(&denial).expect("a rule for one command");
    assert_eq!(rule, "Bash(curl example.com)");
    let allowed = Options {
        allowed: vec![rule],
        resume: true,
        ..options("native")
    };
    let mut process = fake.open(allowed);
    let mut events = process.events();
    process.send(message("m2", "Try again"));
    let ran = read(&mut events, 5).await;
    assert_eq!((&ran[2], &ran[3]["isError"]), (&start, &json!(false)));
    assert_eq!(ran[4], done());

    let any = json!({ "tool": "Bash", "input": { "command": "rm *" } });
    let any: Denial = serde_json::from_value(any).unwrap();
    assert_eq!(fake.allow_rule(&any), None, "no rule allows that alone");
}

#[tokio::test(start_paused = true)]
async fn a_very_long_reply_streams_in_order_and_whole() {
    let words: Vec<String> = (0..20_000).map(|word| format!("word{word} ")).collect();
    let text = words.concat();
    let fake = Fake::new();
    fake.script(Script::reply(&text, Duration::from_secs(120)));
    let mut process = fake.open(options("native"));
    let mut events = process.events();
    let started = Instant::now();
    process.send(message("m1", "Tell me everything"));
    process.close();

    let all = rest(&mut events).await;
    assert_eq!(
        started.elapsed(),
        Duration::ZERO,
        "a close waits for nothing"
    );
    let pieces: Vec<&str> = all.iter().filter_map(piece).collect();
    assert_eq!(pieces.len(), 20_000);
    assert_eq!(pieces.concat(), text, "every piece, in order");
    assert_eq!(all[all.len() - 3], Event::Text { text });

    // Played to its end, the reply takes the time it was given.
    let fake = Fake::new();
    fake.script(Script::reply("one two three", Duration::from_secs(3)));
    let mut process = fake.open(options("native"));
    let mut events = process.events();
    process.send(message("m1", "Count"));
    read(&mut events, 7).await;
    assert_eq!(started.elapsed(), Duration::from_secs(3));
}

/// The text of a piece of a reply.
fn piece(event: &Event) -> Option<&str> {
    match event {
        Event::TextDelta { text } => Some(text),
        _ => None,
    }
}

#[tokio::test(start_paused = true)]
async fn a_failure_and_an_exit_are_scripted_as_the_events_they_are() {
    let fake = Fake::new();
    let failed = json!({
        "type": "result", "denials": [], "errors": ["API error"], "interrupted": false,
        "ok": false,
    });
    let usage = json!({
        "type": "usage",
        "windows": [{ "id": "five_hour", "label": "5h", "resetsAt": "2026-11-10T12:00:00Z", "used": 0.42 }],
    });
    let text = serde_json::to_string(&json!([usage, failed])).unwrap();
    fake.script(Script::parse(&text).expect("a script read from a text, fractions included"));
    fake.script(script(json!([
        { "type": "exit", "code": 1, "stderr": "out of memory" },
        { "type": "text", "text": "never" },
    ])));
    let mut process = fake.open(options("native"));
    let mut events = process.events();

    process.send(message("m1", "fail"));
    assert_eq!(
        read(&mut events, 4).await[2..],
        [usage, failed.clone()],
        "a turn that ends itself gets no second result"
    );
    process.send(message("m2", "die"));
    assert_eq!(
        rest(&mut events).await,
        [
            event(json!({ "type": "accepted", "id": "m2" })),
            event(json!({ "type": "exit", "code": 1, "stderr": "out of memory" })),
        ]
    );
    assert_eq!(fake.running(), 0);

    // A step of the test's own, run in the process's directory: its failure ends the process.
    let fake = Fake::new();
    let ran = Arc::new(AtomicUsize::new(0));
    let counted = ran.clone();
    fake.script(vec![
        Step::run(move |cwd| {
            counted.fetch_add(1, Ordering::SeqCst);
            assert_eq!(cwd, PathBuf::from("/work"));
            Ok(())
        }),
        Step::run(|_| Err("the commit failed".to_owned())),
        Step::Event(event(json!({ "type": "text", "text": "never" }))),
    ]);
    let mut process = fake.open(options("native"));
    let mut events = process.events();
    process.send(message("m1", "work"));
    assert_eq!(
        rest(&mut events).await[2..],
        [event(
            json!({ "type": "exit", "code": 1, "stderr": "the commit failed" })
        )]
    );
    assert_eq!(ran.load(Ordering::SeqCst), 1);

    let unknown = Script::parse(r#"[{ "sleep": 3 }]"#);
    assert!(unknown.is_err(), "a step that is no event is refused");
}

#[tokio::test(start_paused = true)]
async fn a_message_plays_its_script_else_the_fallback_else_what_the_test_emits() {
    let fake = Fake::new();
    let mut process = fake.open(options("native"));
    let mut events = process.events();

    // Nothing scripted: the turn is the test's to play.
    process.send(message("m1", "one"));
    fake.emit(event(json!({ "type": "accepted", "id": "m1" })));
    fake.emit(event(json!({ "type": "text", "text": "by hand" })));
    fake.emit(event(done()));
    assert_eq!(
        read(&mut events, 4).await[1..],
        [
            json!({ "type": "accepted", "id": "m1" }),
            json!({ "type": "text", "text": "by hand" }),
            done(),
        ]
    );

    fake.fallback(|message| {
        let text = format!("You said: {}", message.text);
        Some(Script::from(vec![Event::Text { text }]))
    });
    fake.script(script(json!([{ "type": "text", "text": "scripted" }])));
    process.send(message("m2", "two"));
    process.send(message("m3", "three"));
    assert_eq!(
        read(&mut events, 6).await,
        [
            json!({ "type": "accepted", "id": "m2" }),
            json!({ "type": "text", "text": "scripted" }),
            done(),
            json!({ "type": "accepted", "id": "m3" }),
            json!({ "type": "text", "text": "You said: three" }),
            done(),
        ],
        "a scripted turn comes before the fallback"
    );

    fake.exit(2, "gone");
    assert_eq!(
        rest(&mut events).await,
        [event(
            json!({ "type": "exit", "code": 2, "stderr": "gone" })
        )]
    );
}

#[tokio::test(start_paused = true)]
async fn a_fake_process_says_what_it_runs_on_and_takes_a_new_effort() {
    let fake = Fake::new();
    fake.set(|fake| fake.reports_runs_on = true);
    let picked = Options {
        model: Some("fake-big".to_owned()),
        effort: Some("xhigh".to_owned()),
        ..options("native")
    };
    let mut process = fake.open(picked);
    let mut events = process.events();
    assert!(process.set_effort(None), "the fake changes its effort");
    assert_eq!(
        read(&mut events, 3).await[1..],
        [
            json!({ "type": "runsOn", "model": "Fake Big", "effort": "Extra high" }),
            json!({ "type": "runsOn", "model": "Fake Big", "effort": "Medium" }),
        ],
        "by the names of its model list, the list's default when none is picked"
    );
    assert_eq!(fake.efforts(), [None]);

    fake.set(|fake| fake.sets_effort = false);
    let process = fake.open(options("other"));
    assert!(
        !process.set_effort(Some("low")),
        "a runtime that cannot is reopened"
    );
    assert_eq!(fake.efforts(), [None]);
    assert!(fake.has_session("native", None) && fake.has_session("other", None));
    assert!(!fake.has_session("never-opened", None));
}

#[tokio::test]
async fn a_stream_ends_with_one_exit_whatever_its_runtime_did() {
    // A runtime that went silent, as a VM that was stopped: the stream says it exited.
    let (emitter, mut events) = runtimes::events();
    assert!(emitter.send(Event::Notice {
        text: "started".to_owned()
    }));
    drop(emitter);
    let gone = event(json!({ "type": "exit", "code": null, "stderr": "" }));
    assert_eq!(
        rest(&mut events).await,
        [
            Event::Notice {
                text: "started".to_owned()
            },
            gone.clone()
        ]
    );

    // Nothing follows an exit, and a reader on a blocking thread reads the same stream.
    let (emitter, mut events) = runtimes::events();
    let exit = event(json!({ "type": "exit", "code": 0, "stderr": "" }));
    assert!(emitter.send(exit.clone()));
    assert!(!emitter.send(Event::Skipped), "an exit is the last event");
    assert!(emitter.has_exited());
    let read = tokio::task::spawn_blocking(move || {
        let first = events.blocking_next();
        (first, events.blocking_next())
    });
    assert_eq!(read.await.unwrap(), (Some(exit), None));

    let mut ended = Events::ended();
    assert_eq!(rest(&mut ended).await, [gone]);
}

#[tokio::test]
async fn a_runtime_is_registered_under_one_name_until_it_is_removed() {
    let server = support::server().await;
    let told = Arc::new(AtomicUsize::new(0));
    let listener = told.clone();
    let registry = server.shared().get::<Runtimes>();
    registry.on_change(move || {
        listener.fetch_add(1, Ordering::SeqCst);
    });
    // The names registered since the server started, which registers its built-in runtimes.
    let built_in = registry.names();
    let names = || {
        let mut names = registry.names();
        names.retain(|name| !built_in.contains(name));
        names
    };

    let first = runtimes::register(server.shared(), "fake", Arc::new(Fake::new())).unwrap();
    let other = runtimes::register(server.shared(), "other", Arc::new(Fake::new())).unwrap();
    let again = runtimes::register(server.shared(), "fake", Arc::new(Fake::new()));
    assert_eq!(
        again.err(),
        Some(RuntimeError::Taken("fake".to_owned())),
        "a second runtime of a name is refused"
    );
    assert_eq!(names(), ["fake", "other"]);
    assert_eq!(registry.get("fake").unwrap().kind(), "fake");
    assert!(told.load(Ordering::SeqCst) >= 2);

    first.remove();
    assert_eq!(names(), ["other"]);
    assert!(registry.get("fake").is_none());
    let back = runtimes::register(server.shared(), "fake", Arc::new(Fake::new()));
    assert!(back.is_ok(), "a removed name is free again");
    assert_eq!(
        names(),
        ["fake", "other"],
        "in the order each first registered"
    );
    other.remove();
    server.stop().await;
}

// The Node server's fix: Claude Code's runtime registers again as its settings change, and
// Codex became the default agent. A runtime registered again keeps its place, and with it the
// default.
#[tokio::test]
async fn a_runtime_registered_again_keeps_its_place() {
    let server = support::server().await;
    let registry = server.shared().get::<Runtimes>();
    let built_in = registry.names();
    let first = runtimes::register(server.shared(), "first", Arc::new(Fake::new())).unwrap();
    let second = runtimes::register(server.shared(), "second", Arc::new(Fake::new())).unwrap();
    let ours = || {
        let mut on = registry.on_in(None);
        on.retain(|name| !built_in.contains(name));
        on
    };

    first.remove();
    assert_eq!(ours(), ["second"]);
    let again = runtimes::register(server.shared(), "first", Arc::new(Fake::new())).unwrap();

    assert_eq!(ours(), ["first", "second"]);
    again.remove();
    second.remove();
    server.stop().await;
}

/// Checks the runtimes, then asks `fake` for its models, as a handler does: what the check
/// found.
async fn check(registry: &Arc<Runtimes>) -> runtimes::Checked {
    let asked = registry.clone();
    let checked = tokio::task::spawn_blocking(move || {
        let found = asked.check();
        asked.refresh_models(&["fake"]);
        found
    });
    checked.await.unwrap()
}

#[tokio::test]
async fn a_runtimes_status_and_models_follow_what_it_answers() {
    let server = support::server().await;
    let registry = server.shared().get::<Runtimes>();
    let fake = Fake::new();
    let registered = runtimes::register(server.shared(), "fake", Arc::new(fake.clone())).unwrap();
    let unchecked = Status::default();

    // The sessions check the runtimes too, as the server starts and after a change: what a
    // check finds is read from the status, whoever asked first.
    check(&registry).await;
    let available = Status {
        available: true,
        version: Some("0.0.0 (fake agent)".to_owned()),
    };
    assert_eq!(registry.status("fake"), available);
    let list = registry.models("fake").expect("the fake's models");
    assert_eq!(list.defaults.model.as_deref(), Some("fake-big"));
    assert_eq!(
        fake.model_asks(),
        1,
        "asked once, as it registered or since"
    );

    // A runtime that reloads starts from the status its name had, and asks its models again.
    registered.remove();
    assert_eq!(
        registry.status("fake"),
        unchecked,
        "no runtime of that name"
    );
    let registered = runtimes::register(server.shared(), "fake", Arc::new(fake.clone())).unwrap();
    assert_eq!(registry.status("fake"), available);
    assert!(!check(&registry).await.changed);
    assert_eq!(fake.model_asks(), 2);

    // An agent that is gone: unavailable at its next check, and its last list is kept, asked
    // for at most once a minute.
    fake.set(|fake| {
        fake.installed = false;
        fake.models_fail = true;
    });
    check(&registry).await;
    assert_eq!(registry.status("fake"), unchecked);
    assert_eq!(fake.model_asks(), 2, "asked a moment ago");

    tokio::time::pause();
    tokio::time::advance(Duration::from_secs(61)).await;
    tokio::time::resume();
    check(&registry).await;
    assert_eq!(fake.model_asks(), 3);
    assert_eq!(
        registry.models("fake"),
        Some(list),
        "a failed ask keeps the last list"
    );
    registered.remove();
    server.stop().await;
}

#[tokio::test]
async fn a_built_in_the_owner_turned_off_is_off_where_they_said() {
    let config = "[extensions.fake]\non = [\"todo\"]\n\n[extensions.codex]\non = []\n";
    let server = support::setup().config("config.toml", config).start().await;
    let registry = server.shared().get::<Runtimes>();
    // The server registered its built-in runtimes itself: the others stand in for theirs.
    for name in ["claude", "codex", "fake", "mine"] {
        if registry.get(name).is_none() {
            runtimes::register(server.shared(), name, Arc::new(Fake::new())).unwrap();
        }
    }

    assert_eq!(registry.on_in(Some("todo")), ["claude", "fake", "mine"]);
    assert_eq!(registry.on_in(Some("notes")), ["claude", "mine"]);
    assert!(!registry.is_on("fake", None), "not on in every repository");
    assert!(!registry.is_on("codex", Some("todo")));
    assert_eq!(registry.title("codex"), "Codex", "its extension's title");
    assert_eq!(registry.title("mine"), "mine");
    server.stop().await;
}
