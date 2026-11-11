//! The agents' MCP endpoint, `/mcp`: who may call it, the protocol it speaks, and how a call of a
//! tool runs, reports progress, and stops.

mod support;

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use hyper::client::conn::http1::SendRequest;
use hyper::{Request, Response};
use hyper_util::rt::TokioIo;
use serde_json::{Value, json};
use support::{TestResponse, TestServer};
use tokio::net::TcpStream;
use tokio::sync::{oneshot, watch};
use uraeda_server::mcp::{Answer, Mcp, Review, RunAgent, Runner};

/// How long a test waits for what must come: a server that answers does so at once.
const PATIENCE: Duration = Duration::from_secs(10);

/// How long a test waits for a stream's next event: longer than the 30 seconds the endpoint lets
/// pass between two of them, which a paused clock jumps over.
const SILENCE: Duration = Duration::from_secs(45);

/// The arguments of a `run_agent` that is well formed.
fn task() -> Value {
    json!({ "task": "Task 4", "prompt": "Build it.", "worktree": "/tmp/task-4" })
}

/// A `tools/call` of `run_agent`, with the id 7.
fn call(arguments: Value) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": 7,
        "method": "tools/call",
        "params": { "name": "run_agent", "arguments": arguments },
    })
}

/// A JSON-RPC message posted to `/mcp` with a process's token, answered whole.
async fn post(server: &TestServer, token: &str, message: &Value) -> TestResponse {
    server.post("/mcp").bearer(token).json(message).send().await
}

/// The sessions' side of the tools, held by the test: each `run_agent` waits for the answer the
/// test gives, and says when it was dropped.
struct Held {
    calls: AtomicUsize,
    asked: Mutex<Vec<(String, RunAgent)>>,
    answer: Mutex<Option<oneshot::Receiver<Result<String, String>>>>,
    stopped: watch::Sender<bool>,
}

/// The test's end of a held tool: what answers its call, and whether its call was dropped.
struct Holding {
    held: Arc<Held>,
    answer: oneshot::Sender<Result<String, String>>,
    stopped: watch::Receiver<bool>,
}

impl Holding {
    /// Waits until the tool's call was dropped, before it answered.
    async fn stopped(&mut self) {
        let dropped = self.stopped.wait_for(|stopped| *stopped);
        let dropped = tokio::time::timeout(PATIENCE, dropped).await;
        dropped.expect("the tool's call stops").unwrap();
    }
}

/// Says a call ended without its answer, when dropped before.
struct Stops(watch::Sender<bool>, bool);

impl Stops {
    /// The call answered: its end is no stop.
    fn answered(mut self) {
        self.1 = true;
    }
}

impl Drop for Stops {
    fn drop(&mut self) {
        if !self.1 {
            self.0.send_replace(true);
        }
    }
}

impl Runner for Held {
    fn run_agent(&self, session: &str, input: RunAgent) -> Answer {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.asked.lock().unwrap().push((session.to_owned(), input));
        let answer = self.answer.lock().unwrap().take();
        let stops = Stops(self.stopped.clone(), false);
        Box::pin(async move {
            // A call the test holds no answer for is refused, never left waiting.
            let Some(answer) = answer else {
                return Err("The test holds one call.".to_owned());
            };
            let answer = answer.await;
            stops.answered();
            answer.expect("the test answers")
        })
    }

    fn review(&self, _: &str, input: Review) -> Answer {
        Box::pin(async move { Ok(format!("reviewed {}", input.reviewed)) })
    }
}

/// Fills the server's tools with ones the test holds.
fn hold(server: &TestServer) -> Holding {
    let (answer, waits) = oneshot::channel();
    let (stops, stopped) = watch::channel(false);
    let held = Arc::new(Held {
        calls: AtomicUsize::new(0),
        asked: Mutex::default(),
        answer: Mutex::new(Some(waits)),
        stopped: stops,
    });
    server.shared().get::<Mcp>().serve(held.clone());
    Holding {
        held,
        answer,
        stopped,
    }
}

/// A call whose answer is read as it comes: an event stream.
struct Stream {
    response: Response<Incoming>,
    read: Vec<u8>,
    // The connection lives as long as the stream: dropping it drops the call.
    _sender: SendRequest<Full<Bytes>>,
}

impl Stream {
    /// Posts a message with a process's token, and reads the answer's head.
    async fn open(server: &TestServer, token: &str, message: &Value) -> Stream {
        let stream = TcpStream::connect(("127.0.0.1", server.port())).await;
        let io = TokioIo::new(stream.expect("the server accepts a connection"));
        let (mut sender, connection) = hyper::client::conn::http1::handshake(io).await.unwrap();
        tokio::spawn(connection);
        let request = Request::post("/mcp")
            .header("host", server.host())
            .header("authorization", format!("Bearer {token}"))
            .header("accept", "application/json, text/event-stream")
            .header("content-type", "application/json")
            .body(Full::new(Bytes::from(message.to_string())))
            .unwrap();
        let response = sender.send_request(request).await.expect("an answer");
        assert_eq!(response.status(), 200);
        let kind = response.headers()["content-type"].to_str().unwrap();
        assert_eq!(kind, "text/event-stream");
        Stream {
            response,
            read: Vec::new(),
            _sender: sender,
        }
    }

    /// The stream's next event, as text, or none once the stream ended.
    async fn event(&mut self) -> Option<String> {
        loop {
            if let Some(end) = self.read.windows(2).position(|pair| pair == b"\n\n") {
                let event: Vec<u8> = self.read.drain(..end + 2).collect();
                return Some(String::from_utf8(event).unwrap());
            }
            let frame = tokio::time::timeout(SILENCE, self.response.body_mut().frame());
            let frame = frame.await.expect("the stream goes on or ends")?;
            if let Ok(data) = frame.expect("a frame").into_data() {
                self.read.extend(data);
            }
        }
    }

    /// The stream's next JSON-RPC message, or none once the stream ended.
    async fn message(&mut self) -> Option<Value> {
        let event = self.event().await?;
        let data = event.lines().find_map(|line| line.strip_prefix("data: "));
        Some(serde_json::from_str(data.expect("a message")).unwrap())
    }
}

// The sign-in decision and the agents decision: `/mcp` takes no session. Its only sign-in is the
// token of an agent's process, which the server issued, and which ends with that process.
#[tokio::test]
async fn the_mcp_endpoint_refuses_a_wrong_token() {
    let server = support::server().await;
    let holding = hold(&server);
    let tools = server.shared().get::<Mcp>();
    let revoked = tools.issue("session-1");
    tools.revoke(&revoked);
    // The session's earlier process: its next one takes a new token.
    let earlier = tools.issue("session-2");
    let current = tools.issue("session-2");
    let (cookie, device) = (server.sign_in().await, server.pair("Phone").await);
    let ask = || server.post("/mcp").json(&call(task()));

    let twice = format!("Bearer {current}, Bearer {current}");
    let rows = [
        ("no token", ask()),
        ("a revoked token", ask().bearer(&revoked)),
        ("another process's token", ask().bearer(&earlier)),
        ("a token never issued", ask().bearer("not-a-token")),
        ("an empty token", ask().header("authorization", "Bearer ")),
        ("another scheme", ask().header("authorization", &current)),
        ("the token twice", ask().header("authorization", &twice)),
        ("a browser's session", ask().cookie(&cookie)),
        ("a paired device's token", ask().bearer(&device)),
        ("the host token", ask().bearer(&server.host_token())),
    ];
    // Every row is asked, so a failure names each token that opens the endpoint. A call that got
    // through would end at once, with the answer held for it.
    holding.answer.send(Ok("done".to_owned())).unwrap();
    let mut let_in = Vec::new();
    for (row, request) in rows {
        let answer = request.send().await;
        if (answer.status, answer.body.as_slice()) != (401, b"Unauthorized") {
            let_in.push(format!("{row} answered {}", answer.status));
        }
    }
    assert!(let_in.is_empty(), "{let_in:#?}");
    assert_eq!(holding.held.calls.load(Ordering::SeqCst), 0);
    // Any other method is refused the same way, before it is told the method is not allowed.
    assert_eq!(server.get("/mcp").send().await.status, 401);

    // The process's own token passes, and its call runs for its session.
    let own = post(&server, &current, &json!({ "id": 1, "method": "ping" })).await;
    assert_eq!(own.status, 200);
    let holding = hold(&server);
    let mut stream = Stream::open(&server, &current, &call(task())).await;
    holding.answer.send(Ok("done".to_owned())).unwrap();
    assert!(stream.message().await.is_some());
    let asked = holding.held.asked.lock().unwrap();
    assert_eq!(asked[0].0, "session-2");
}

// The break it catches: a tool listed without `readOnlyHint`, which Claude Code runs one call
// at a time, so a wave's implementers ran one after another. No tool changes the caller's own
// checkout: an implementer works in its task's worktree, and a review changes nothing there.
#[tokio::test]
async fn the_tools_say_they_change_nothing() {
    let server = support::server().await;
    let token = server.shared().get::<Mcp>().issue("session-1");

    let listed = post(&server, &token, &json!({ "id": 1, "method": "tools/list" })).await;

    let listed = listed.json();
    let tools = listed["result"]["tools"].as_array().expect("tools");
    assert_eq!(tools.len(), 2);
    for tool in tools {
        assert_eq!(
            tool["annotations"],
            json!({ "readOnlyHint": true }),
            "{tool}"
        );
    }
}

// The contract with the agents' MCP clients: the streamable HTTP transport, stateless, for the
// four messages a client of tools sends.
#[tokio::test]
async fn the_endpoint_speaks_mcp_for_a_client_of_tools() {
    let server = support::server().await;
    let token = server.shared().get::<Mcp>().issue("session-1");
    let ask = async |message: Value| post(&server, &token, &message).await;

    let started = ask(json!({
        "id": 1,
        "method": "initialize",
        "params": { "protocolVersion": "2025-06-18" },
    }));
    let started = started.await.json();
    assert_eq!(started["id"], 1);
    assert_eq!(started["jsonrpc"], "2.0");
    assert_eq!(started["result"]["protocolVersion"], "2025-06-18");
    assert_eq!(started["result"]["capabilities"], json!({ "tools": {} }));
    assert_eq!(started["result"]["serverInfo"]["name"], "uraeda");
    // A version the endpoint does not speak is answered its latest.
    let newer = ask(json!({
        "id": "a",
        "method": "initialize",
        "params": { "protocolVersion": "2099-01-01" },
    }));
    let newer = newer.await.json();
    assert_eq!(newer["id"], "a");
    assert_eq!(newer["result"]["protocolVersion"], "2025-11-25");

    let ping = ask(json!({ "id": 2, "method": "ping" })).await.json();
    assert_eq!(ping, json!({ "id": 2, "jsonrpc": "2.0", "result": {} }));

    let listed = ask(json!({ "id": 3, "method": "tools/list" })).await.json();
    let tools = listed["result"]["tools"].as_array().expect("tools");
    let names: Vec<_> = tools.iter().map(|tool| tool["name"].clone()).collect();
    assert_eq!(names, ["run_agent", "review"]);
    for tool in tools {
        assert!(tool["description"].is_string(), "{tool}");
        assert_eq!(tool["inputSchema"]["type"], "object", "{tool}");
    }
    let required = &tools[0]["inputSchema"]["required"];
    assert_eq!(required, &json!(["task", "prompt", "worktree"]));

    // What is not a request the endpoint answers.
    let unknown = ask(json!({ "id": 4, "method": "resources/list" })).await;
    let error = json!({ "code": -32601, "message": "Unknown method: resources/list" });
    assert_eq!(unknown.json()["error"], error);
    let params = ask(json!({ "id": 5, "method": "tools/call", "params": null })).await;
    assert_eq!(
        (params.status, &params.json()["error"]["code"]),
        (200, &json!(-32602))
    );
    let named = json!({ "id": 6, "method": "tools/call", "params": { "name": "rm" } });
    let message = &ask(named).await.json()["error"]["message"];
    assert_eq!(message, "Unknown tool: rm");
    let notified = ask(json!({ "method": "notifications/initialized" })).await;
    assert_eq!((notified.status, notified.body.len()), (202, 0));
    let batch = ask(json!([{ "id": 7, "method": "ping" }])).await;
    assert_eq!(
        (batch.status, &batch.json()["error"]["code"]),
        (400, &json!(-32600))
    );
    let broken = server.post("/mcp").bearer(&token).body("{").send().await;
    assert_eq!(
        (broken.status, &broken.json()["error"]["code"]),
        (400, &json!(-32700))
    );
    let stream = server.get("/mcp").bearer(&token).send().await;
    assert_eq!((stream.status, stream.header("allow")), (405, Some("POST")));
    let large = vec![b' '; 1024 * 1024 + 1];
    let large = server.post("/mcp").bearer(&token).body(large).send().await;
    assert_eq!(large.status, 413);
}

// The tools that run agents are the sessions', filled as the server starts: a call for a
// session that is no workflow session of a feature says so, as a tool's error, where an agent
// reads it.
#[tokio::test]
async fn a_tool_called_for_no_workflow_session_answers_a_clear_error() {
    let server = support::server().await;
    let token = server.shared().get::<Mcp>().issue("session-1");

    for (name, arguments, does) in [
        ("run_agent", task(), "starts implementers"),
        (
            "review",
            json!({ "reviewed": "branch", "base": "main", "head": "HEAD" }),
            "runs reviews",
        ),
    ] {
        let message = json!({
            "id": 7,
            "method": "tools/call",
            "params": { "name": name, "arguments": arguments },
        });
        let mut stream = Stream::open(&server, &token, &message).await;
        let text = format!("Only a workflow session of a feature {does}.");
        let answer = json!({
            "id": 7,
            "jsonrpc": "2.0",
            "result": { "content": [{ "text": text, "type": "text" }], "isError": true },
        });
        assert_eq!(stream.message().await, Some(answer), "{name}");
        assert_eq!(stream.event().await, None, "{name}");
    }
}

// What a tool refuses reaches the agent as the tool's error: its own refusal, and arguments
// that are not the tool's, which never reach the sessions.
#[tokio::test]
async fn a_tools_refusal_and_wrong_arguments_are_answered_as_its_error() {
    let server = support::server().await;
    let holding = hold(&server);
    let token = server.shared().get::<Mcp>().issue("session-1");
    let error = async |message: Value| {
        let mut stream = Stream::open(&server, &token, &message).await;
        let answer = stream.message().await.expect("an answer");
        assert_eq!(answer["result"]["isError"], true, "{answer}");
        answer["result"]["content"][0]["text"]
            .as_str()
            .unwrap()
            .to_owned()
    };
    let review = |arguments: Value| {
        let params = json!({ "name": "review", "arguments": arguments });
        json!({ "id": 8, "method": "tools/call", "params": params })
    };

    let rows = [
        (
            call(json!({ "task": "Task 4", "prompt": "  ", "worktree": "/tmp/task-4" })),
            "run_agent needs `prompt`, a text.",
        ),
        (
            call(json!({ "prompt": "Build it.", "worktree": 4 })),
            "run_agent needs `task`, a text.",
        ),
        (call(json!("Task 4")), "run_agent needs `prompt`, a text."),
        (
            review(json!({ "reviewed": "branch", "base": "main:file", "head": "HEAD" })),
            "review needs `base`, a commit, one word without a colon.",
        ),
        (
            review(json!({ "reviewed": "branch", "base": "main", "head": "two words" })),
            "review needs `head`, a commit, one word without a colon.",
        ),
        (
            review(json!({ "reviewed": "wave two", "base": "main", "head": "HEAD" })),
            "review needs `reviewed`, `branch` or `wave <N>`.",
        ),
    ];
    for (message, text) in rows {
        assert_eq!(error(message).await, text);
    }
    assert_eq!(holding.held.calls.load(Ordering::SeqCst), 0);

    // Arguments that are the tool's reach it trimmed, and its refusal is its answer.
    let padded = json!({ "task": " Task 4 ", "prompt": "Build it.\n", "worktree": "/tmp/task-4" });
    holding
        .answer
        .send(Err("No such feature.".to_owned()))
        .unwrap();
    assert_eq!(error(call(padded)).await, "No such feature.");
    let asked = holding.held.asked.lock().unwrap();
    let input = RunAgent {
        task: "Task 4".to_owned(),
        prompt: "Build it.".to_owned(),
        worktree: "/tmp/task-4".to_owned(),
    };
    assert_eq!(asked[0], ("session-1".to_owned(), input));
}

// An agent drops a call that stays silent for long: a running call reports progress every 30
// seconds, with the client's progress token, until the tool answers.
#[tokio::test(start_paused = true)]
async fn a_long_call_reports_progress_every_30_seconds() {
    let server = support::server().await;
    let holding = hold(&server);
    let token = server.shared().get::<Mcp>().issue("session-1");
    let mut message = call(task());
    message["params"]["_meta"] = json!({ "progressToken": "p1" });
    let started = tokio::time::Instant::now();

    let mut stream = Stream::open(&server, &token, &message).await;
    for progress in 1..=2 {
        let notification = json!({
            "jsonrpc": "2.0",
            "method": "notifications/progress",
            "params": { "progress": progress, "progressToken": "p1" },
        });
        assert_eq!(stream.message().await, Some(notification));
        // The clock stands still but for the endpoint's own waits.
        assert!(started.elapsed() >= Duration::from_secs(30 * progress));
    }
    holding.answer.send(Ok("done".to_owned())).unwrap();
    let mut last = stream.message().await.expect("an answer");
    while last["method"] == "notifications/progress" {
        last = stream.message().await.expect("an answer");
    }

    let result = json!({ "content": [{ "text": "done", "type": "text" }] });
    assert_eq!(last, json!({ "id": 7, "jsonrpc": "2.0", "result": result }));
    assert_eq!(stream.event().await, None);

    // Without a progress token, a comment keeps the connection from going silent.
    let waiting = hold(&server);
    let mut silent = Stream::open(&server, &token, &call(task())).await;
    assert_eq!(silent.event().await.as_deref(), Some(": working\n\n"));
    drop(waiting);
}

// A tool runs an agent for hours: it stops when its client cancels the call, and when the
// client's connection drops, and only then.
#[tokio::test]
async fn a_cancellation_or_a_dropped_connection_stops_the_tool() {
    let server = support::server().await;
    let tools = server.shared().get::<Mcp>();
    let (token, other) = (tools.issue("session-1"), tools.issue("session-2"));
    let cancelled = json!({ "method": "notifications/cancelled", "params": { "requestId": 7 } });

    // Another session's call of the same id is not this one, nor is another id.
    let mut holding = hold(&server);
    let mut stream = Stream::open(&server, &token, &call(task())).await;
    assert_eq!(post(&server, &other, &cancelled).await.status, 202);
    let another = json!({ "method": "notifications/cancelled", "params": { "requestId": 8 } });
    assert_eq!(post(&server, &token, &another).await.status, 202);
    assert!(!*holding.stopped.borrow());

    // The call's stream ends without a result: a cancelled request is never answered.
    assert_eq!(post(&server, &token, &cancelled).await.status, 202);
    holding.stopped().await;
    assert_eq!(stream.event().await, None);

    let mut holding = hold(&server);
    let stream = Stream::open(&server, &token, &call(task())).await;
    assert!(!*holding.stopped.borrow());
    drop(stream);
    holding.stopped().await;
}
