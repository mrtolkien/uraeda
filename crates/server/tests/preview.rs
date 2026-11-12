//! Previews: a checkout's preview command, started by a read and stopped with the server, its
//! records, and the proxy that shows it to a sandboxed frame, under the frame secret.
//!
//! The preview command of these tests is the fake Storybook of `fixtures/preview/serve.mjs`, a
//! small script: no test runs a real Storybook, or a package manager.

mod support;

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;

use futures_util::StreamExt;
use serde_json::{Value, json};
use support::{Live, TestRepo, TestResponse, TestServer, fixture, gone, group_members};
use tempfile::TempDir;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use uraeda_server::preview;

/// The stories file of the tests' projects, from the repository's top level.
const STORIES: &str = "packages/web/src/SidebarHandle.stories.tsx";

/// The tests' feature, whose files are `fixtures/preview/feature/`.
const FEATURE: &str = "2026-10-20-sidebar-resize";

/// How long a test waits for a process to go: a killed one goes at once.
const PATIENCE: Duration = Duration::from_secs(10);

const MINUTE: Duration = Duration::from_secs(60);

/// A repository whose main checkout has a stories file and an active preview decision, running
/// the fake Storybook in `packages/web`, with the log of its starts.
struct Project {
    repo: TestRepo,
    log: PathBuf,
    _logs: TempDir,
}

/// A project named `name` in the server's list, whose fake Storybook behaves as `mode` says:
/// see the script's header.
fn project(name: &str, mode: &str) -> Project {
    let logs = TempDir::new().unwrap();
    let log = logs.path().join("starts.log");
    let repo = TestRepo::named(name);
    repo.write(
        STORIES,
        "export default {};\n\nexport const Dragging = {};\n",
    );
    // The command ends in `&& true`, so its shell waits for the fake, as `pnpm exec` waits for
    // Storybook: only a signal to the whole process group stops both.
    let command = format!(
        "node {} --port {{port}} --mode {mode} --log {} && true",
        fixture("preview/serve.mjs").display(),
        log.display()
    );
    let decision = format!(
        "---\nstatus: active\napproved-by: Test\npreview-folder: packages/web\n\
         preview-command: {command}\n---\n\n# Preview\n\nThe tests' fake Storybook.\n"
    );
    repo.write("specs/decisions/preview.md", &decision);
    repo.commit("chore: a preview");
    Project {
        repo,
        log,
        _logs: logs,
    }
}

impl Drop for Project {
    /// Stops the previews a failed test left running.
    fn drop(&mut self) {
        for start in 0..self.starts().len() {
            kill_group(self.pid(start));
        }
    }
}

/// Kills the process group of a process, if it still runs.
fn kill_group(pid: u32) {
    let listed = Command::new("ps")
        .args(["-o", "pgid=", "-p", &pid.to_string()])
        .output();
    let group = listed
        .ok()
        .and_then(|listed| String::from_utf8(listed.stdout).ok());
    if let Some(group) = group.filter(|group| !group.trim().is_empty()) {
        let _ = Command::new("kill")
            .args(["-KILL", "--", &format!("-{}", group.trim())])
            .output();
    }
}

/// A process group a test started by hand, killed and reaped with it.
struct Group(std::process::Child);

impl Drop for Group {
    fn drop(&mut self) {
        kill_group(self.0.id());
        let _ = self.0.wait();
    }
}

impl Project {
    /// Each start the fake logged: its `base`, its `cwd`, its `pid`, and its `port`.
    fn starts(&self) -> Vec<Value> {
        let log = fs::read_to_string(&self.log).unwrap_or_default();
        log.lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    /// The process of the fake's `nth` start.
    fn pid(&self, nth: usize) -> u32 {
        u32::try_from(self.starts()[nth]["pid"].as_u64().unwrap()).unwrap()
    }
}

/// A server whose list holds the project's repository.
async fn serving(project: &Project) -> TestServer {
    support::setup().folder(project.repo.path()).start().await
}

/// Adds a repository to a running server's list, as a second start of `ura serve` does.
async fn listed(server: &TestServer, repo: &TestRepo) {
    let folder = json!({ "folder": repo.path() });
    let answer = server.post("/open").bearer(&server.host_token());
    assert_eq!(answer.json(&folder).send().await.status, 200);
}

/// A client's records: each subscription's value, kept as its changes come, under the number
/// the test gives it.
struct Records {
    live: Live,
    /// The subscription of each number the test gave.
    subs: HashMap<u32, u32>,
}

impl Records {
    async fn of(server: &TestServer) -> Records {
        Records {
            live: Live::of(server).await,
            subs: HashMap::new(),
        }
    }

    /// Subscribes to a record under `id`, and gives its first value.
    async fn sub(&mut self, id: u32, record: &str, args: Value) -> Value {
        let sub = self.live.watch(record, args).await;
        self.subs.insert(id, sub);
        self.live.value(sub).clone()
    }

    /// Reads the server's messages until the record `id` has a value that `done` accepts.
    async fn until(&mut self, id: u32, done: impl Fn(&Value) -> bool) -> Value {
        self.live.until(self.subs[&id], done).await
    }

    /// Calls an action, and gives its output.
    async fn call(&mut self, action: &str, input: Value) -> Value {
        self.live.call(action, input).await
    }
}

/// The arguments of a checkout's `Preview`.
fn preview_of(repository: &str, folder: &str) -> Value {
    json!({ "repo": repository, "folder": folder })
}

/// Subscribes to the main checkout's preview of `repo`, under `id`, and waits until it is ready:
/// its base.
async fn ready(records: &mut Records, id: u32) -> String {
    records.sub(id, "Preview", preview_of("repo", "main")).await;
    let preview = records
        .until(id, |preview| preview["state"] != "starting")
        .await;
    assert_eq!(preview["state"], "ready", "{preview}");
    preview["base"].as_str().unwrap().to_owned()
}

/// The process group of a process.
fn group_of(pid: u32) -> u32 {
    let listed = Command::new("ps")
        .args(["-o", "pgid=", "-p", &pid.to_string()])
        .output()
        .unwrap();
    let listed = String::from_utf8(listed.stdout).unwrap();
    listed.trim().parse().expect("a running process's group")
}

/// A frame's read: a sandboxed frame sends `Origin: null`, and no cookie.
async fn framed(server: &TestServer, path: &str) -> TestResponse {
    server.get(path).header("origin", "null").send().await
}

/// A WebSocket's upgrade, as a request: its answer says whether the server would switch.
fn upgrade(server: &TestServer, path: &str) -> support::TestRequest {
    server
        .get(path)
        .header("connection", "Upgrade")
        .header("upgrade", "websocket")
        .header("sec-websocket-version", "13")
        .header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==")
}

/// Opens a WebSocket to a path of the server as a sandboxed frame does, with the protocol it
/// asks for if any, and gives the first message it gets, as JSON.
async fn first_message(server: &TestServer, path: &str, protocol: Option<&str>) -> Value {
    let mut request = format!("ws://{}{path}", server.host())
        .into_client_request()
        .unwrap();
    let headers = request.headers_mut();
    headers.insert("origin", "null".parse().unwrap());
    headers.insert("cookie", "uraeda=a.secret".parse().unwrap());
    if let Some(protocol) = protocol {
        headers.insert("sec-websocket-protocol", protocol.parse().unwrap());
    }
    let (mut socket, _) = tokio_tungstenite::connect_async(request)
        .await
        .expect("the socket opens");
    let message = tokio::time::timeout(PATIENCE, socket.next()).await;
    match message.expect("a message comes") {
        Some(Ok(Message::Text(text))) => serde_json::from_str(&text).unwrap(),
        other => panic!("expected a text message, got {other:?}"),
    }
}

// The stack decision: the server MUST stop every preview command it runs when it stops. The
// command's shell, the preview it runs, and the child that one started are one process group:
// all three go.
#[tokio::test]
async fn the_server_stops_every_preview_command_when_it_stops() {
    let project = project("repo", "child");
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    ready(&mut records, 1).await;
    let group = group_of(project.pid(0));
    let running = group_members(group);
    assert!(
        running.len() >= 3,
        "a shell, a preview, its child: {running:?}"
    );

    server.stop().await;

    assert_eq!(gone(group).await, Vec::<u32>::new(), "left running");
}

// The sign-in decision: every request carries a session, except the preview paths that carry the
// current frame secret, which changes whenever a session ends.
#[tokio::test]
async fn a_preview_path_without_its_secret_is_refused() {
    let project = project("repo", "ok");
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    let base = ready(&mut records, 1).await;
    let cookie = server.sign_in().await;

    // With the secret, a frame reads it without a cookie, and opens its socket.
    assert_eq!(framed(&server, &format!("{base}__echo")).await.status, 200);
    let channel = format!("{base}storybook-server-channel");
    let socket = upgrade(&server, &channel).header("origin", "null");
    assert_eq!(socket.send().await.status, 101);

    // Without it, or with another, the address does not exist for a frame, asks anyone else to
    // sign in, and holds nothing for who is signed in.
    for other in ["/r/repo/preview/main/", "/r/repo/preview/another/main/"] {
        for path in [
            format!("{other}__echo"),
            format!("{other}storybook-server-channel"),
        ] {
            assert_eq!(framed(&server, &path).await.status, 404, "{path}");
            assert_eq!(server.get(&path).send().await.status, 401, "{path}");
            let signed_in = server.get(&path).cookie(&cookie).send().await;
            assert_eq!(signed_in.status, 404, "{path}");
            let socket = upgrade(&server, &path);
            assert_eq!(socket.send().await.status, 401, "{path}, a socket");
            let socket = upgrade(&server, &path).header("origin", "null");
            assert_eq!(socket.send().await.status, 404, "{path}, a frame's socket");
        }
    }

    // A session ends: the secret changes, the old address is gone, and the record names the new
    // one, where the preview started again.
    let signed_out = server.request("DELETE", "/session").cookie(&cookie);
    assert_eq!(signed_out.send().await.status, 204);

    let moved = |preview: &Value| preview["state"] == "ready" && preview["base"] != base.as_str();
    let renewed = records.until(1, moved).await;
    assert_eq!(framed(&server, &format!("{base}__echo")).await.status, 404);
    assert_eq!(
        server.get(&format!("{base}__echo")).send().await.status,
        401
    );
    let new = renewed["base"].as_str().unwrap();
    assert_eq!(framed(&server, &format!("{new}__echo")).await.status, 200);
    server.stop().await;
}

// The sign-in decision: a process the server runs never receives Uraeda's credentials, and a
// preview runs in a sandbox apart from Uraeda's pages.
#[tokio::test]
async fn a_read_reaches_the_preview_without_credentials_and_comes_back_sandboxed() {
    let project = project("repo", "ok");
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    let base = ready(&mut records, 1).await;
    let cookie = server.sign_in().await;
    let port = project.starts()[0]["port"].as_u64().unwrap();

    // The preview gets the path without its base, its own `Host`, and no credential.
    let asked = server.get(&format!("{base}__echo?a=1")).cookie(&cookie);
    let echo = asked
        .bearer(&server.pair("Phone").await)
        .send()
        .await
        .json();
    assert_eq!(echo["path"], "/__echo?a=1");
    assert_eq!(echo["host"], format!("127.0.0.1:{port}"));
    assert_eq!(echo["headers"]["cookie"], Value::Null);
    assert_eq!(echo["headers"]["authorization"], Value::Null);

    // Every answer is sandboxed, readable from a sandboxed frame, and sends no referrer: the
    // preview's own policy, its cookies, and what its `Connection` names stay out.
    let sandboxed = |answer: &TestResponse, what: &str| {
        let header = |name| answer.header(name).map(str::to_owned);
        let policy = header("content-security-policy");
        assert_eq!(
            policy.as_deref(),
            Some("sandbox allow-scripts allow-popups"),
            "{what}"
        );
        assert_eq!(
            header("access-control-allow-origin").as_deref(),
            Some("*"),
            "{what}"
        );
        assert_eq!(
            header("referrer-policy").as_deref(),
            Some("no-referrer"),
            "{what}"
        );
    };
    let story = framed(
        &server,
        &format!("{base}iframe.html?id=sidebarhandle--dragging"),
    )
    .await;
    assert!(
        story.text().contains("<h1>Dragging</h1>"),
        "{}",
        story.text()
    );
    sandboxed(&story, "a story");
    let headers = framed(&server, &format!("{base}__headers")).await;
    assert_eq!(headers.text(), "headers");
    for name in ["set-cookie", "clear-site-data", "x-custom"] {
        assert_eq!(headers.header(name), None, "{name}");
    }

    // The proxy's own answers are sandboxed too: a write, the path without its slash, and a
    // preview that does not run.
    let write = server
        .post(&format!("{base}__echo"))
        .cookie(&cookie)
        .send()
        .await;
    assert_eq!(
        (write.status, write.header("allow")),
        (405, Some("GET, HEAD"))
    );
    sandboxed(&write, "a write");
    let bare = framed(&server, &format!("{}?a=1", base.trim_end_matches('/'))).await;
    assert_eq!(bare.status, 301);
    assert_eq!(
        bare.header("location"),
        Some(format!("{base}?a=1").as_str())
    );
    sandboxed(&bare, "a redirect");
    let secret = base.split('/').nth(4).unwrap();
    let stopped = framed(&server, &format!("/r/repo/preview/{secret}/{FEATURE}/")).await;
    assert_eq!(stopped.status, 503);
    assert_eq!(stopped.text(), "Storybook is not running for this branch.");
    sandboxed(&stopped, "no preview");
    server.stop().await;
}

// Hot reload: the preview's sockets are piped to it. Storybook gives a manager's channel, or one
// without a page or an `Origin`, the right to write files in the worktree: a channel is only ever
// opened as a preview's.
#[tokio::test]
async fn a_frames_socket_reaches_the_preview_as_a_previews_channel() {
    let project = project("repo", "ok");
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    let base = ready(&mut records, 1).await;
    let port = project.starts()[0]["port"].as_u64().unwrap();

    // The fake refuses a channel whose `Origin` is `null`: the proxy sends none.
    let channel = format!("{base}storybook-server-channel?page=manager&token=abc");
    let echo = first_message(&server, &channel, None).await;
    assert_eq!(
        echo["path"],
        "/storybook-server-channel?page=preview&token=abc"
    );
    assert_eq!(echo["host"], format!("127.0.0.1:{port}"));
    assert_eq!(echo["origin"], Value::Null);
    assert_eq!(echo["headers"]["cookie"], Value::Null);
    let bare = format!("{base}storybook-server-channel");
    let echo = first_message(&server, &bare, None).await;
    assert_eq!(echo["path"], "/storybook-server-channel?page=preview");

    // Vite's own socket keeps the whole path, which Vite serves under its base.
    let echo = first_message(&server, &format!("{base}?token=abc"), Some("vite-hmr")).await;
    assert_eq!(echo["path"], format!("{base}?token=abc"));
    server.stop().await;
}

#[tokio::test]
async fn preview_answers_its_shape() {
    let project = project("repo", "ok");
    let failing = self::project("failing", "fail");
    let plain = TestRepo::named("plain");
    let server = serving(&project).await;
    listed(&server, &failing.repo).await;
    listed(&server, &plain).await;
    let mut records = Records::of(&server).await;

    // A checkout without a preview decision, a folder that is no feature's, and a repository
    // that is not listed have none.
    let none =
        json!({ "state": "none", "base": null, "error": null, "command": null, "folder": null });
    for (id, repository, folder) in [
        (1, "plain", "main"),
        (2, "repo", "nothing"),
        (3, "gone", "main"),
    ] {
        let preview = records
            .sub(id, "Preview", preview_of(repository, folder))
            .await;
        assert_eq!(preview, none, "{repository} {folder}");
    }

    // A read starts the command, in the decision's folder, under the base it is told.
    let first = records.sub(4, "Preview", preview_of("repo", "main")).await;
    // It says what runs, and where, as the decision writes them.
    let command = first["command"].as_str().unwrap().to_owned();
    assert!(command.starts_with("node ") && command.contains("--port {port}"));
    let ran = |state: &str, base: Value, error: Value| json!({ "state": state, "base": base, "error": error, "command": command, "folder": "packages/web" });
    assert_eq!(first, ran("starting", Value::Null, Value::Null));
    let ready = records
        .until(4, |preview| preview["state"] != "starting")
        .await;
    let base = ready["base"].as_str().expect("a ready preview's base");
    let secret = base.split('/').nth(4).unwrap();
    assert_eq!(ready, ran("ready", json!(base), Value::Null));
    assert_eq!(base, format!("/r/repo/preview/{secret}/main/"));
    let starts = project.starts();
    assert_eq!(starts.len(), 1, "{starts:?}");
    assert_eq!(starts[0]["base"], base);
    let folder = project.repo.path().join("packages/web");
    assert_eq!(starts[0]["cwd"], folder.to_str().unwrap());

    // A command that ends says why: its last line naming an error, without Storybook's frame.
    records
        .sub(5, "Preview", preview_of("failing", "main"))
        .await;
    let failed = records
        .until(5, |preview| preview["state"] != "starting")
        .await;
    let error = "Storybook did not start: Error: Cannot find module 'storybook'";
    assert_eq!(
        [&failed["state"], &failed["base"], &failed["error"]],
        [&json!("failed"), &Value::Null, &json!(error)]
    );
    server.stop().await;
}

/// The tests' feature on its branch, checked out in a worktree: the files of
/// `fixtures/preview/feature/`.
fn add_feature(repo: &TestRepo) {
    repo.switch_new(FEATURE);
    let folder = format!("specs/{FEATURE}");
    for entry in fs::read_dir(fixture("preview/feature").join(&folder)).unwrap() {
        let entry = entry.unwrap();
        let name = entry.file_name().into_string().unwrap();
        let text = fs::read_to_string(entry.path()).unwrap();
        repo.write(&format!("{folder}/{name}"), &text);
    }
    repo.commit("docs: a feature");
    repo.switch("main");
    let worktree = format!(".worktrees/{FEATURE}");
    repo.git(&["worktree", "add", "--quiet", &worktree, FEATURE]);
}

#[tokio::test]
async fn story_answers_its_shape() {
    let project = project("repo", "ok");
    add_feature(&project.repo);
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    let story = |id: &str| json!({ "repo": "repo", "id": id });
    let none = json!({ "state": "none", "frame": null, "storybook": null, "error": null });

    // A link that names no story by the core's rule, and a feature that does not exist.
    for (id, link) in [
        (1, "main:README.md#Dragging".to_owned()),
        (2, format!("nothing:{STORIES}#Dragging")),
    ] {
        assert_eq!(records.sub(id, "Story", story(&link)).await, none, "{link}");
    }

    // A feature's story runs in its worktree: starting, then ready once its code compiled.
    let first = records
        .sub(3, "Story", story(&format!("{FEATURE}:{STORIES}#Dragging")))
        .await;
    assert_eq!(first["state"], "starting", "{first}");
    let ready = records.until(3, |story| story["state"] != "starting").await;
    let frame = ready["frame"].as_str().expect("a ready story's frame");
    let secret = frame.split('/').nth(4).unwrap();
    let base = format!("/r/repo/preview/{secret}/{FEATURE}/");
    let shown = json!({
        "state": "ready",
        "frame": format!("{base}iframe.html?id=sidebarhandle--dragging&viewMode=story"),
        "storybook": format!("/f/{FEATURE}/storybook?path=/story/sidebarhandle--dragging"),
        "error": null,
    });
    assert_eq!(ready, shown);
    let cwd = project.starts()[0]["cwd"].as_str().unwrap().to_owned();
    assert!(
        cwd.ends_with(&format!(".worktrees/{FEATURE}/packages/web")),
        "{cwd}"
    );
    assert!(
        framed(&server, frame)
            .await
            .text()
            .contains("<h1>Dragging</h1>")
    );

    // The main checkout's stories run at `main`, and an export its preview does not hold is
    // missing.
    records
        .sub(4, "Story", story(&format!("main:{STORIES}#Dragging")))
        .await;
    let main = records.until(4, |story| story["state"] != "starting").await;
    assert_eq!(main["state"], "ready", "{main}");
    assert_eq!(
        main["storybook"],
        "/storybook?path=/story/sidebarhandle--dragging"
    );
    records
        .sub(5, "Story", story(&format!("main:{STORIES}#Nope")))
        .await;
    let missing = records.until(5, |story| story["state"] != "starting").await;
    let nothing = json!({ "state": "missing", "frame": null, "storybook": null, "error": null });
    assert_eq!(missing, nothing);
    server.stop().await;
}

#[tokio::test]
async fn story_href_answers_its_shape() {
    let server = support::server().await;
    let mut records = Records::of(&server).await;

    let href = format!("/{STORIES}#Dragging");
    let story = records.sub(1, "StoryHref", json!({ "href": href })).await;
    let other = records
        .sub(2, "StoryHref", json!({ "href": "/README.md#Dragging" }))
        .await;

    assert_eq!(story, json!({ "path": STORIES, "export": "Dragging" }));
    assert_eq!(other, json!({ "path": null, "export": null }));
}

// `preview.restart` is the way out of a preview that failed, or went wrong: the command runs
// again, and who reads its records sees it start and get ready.
#[tokio::test]
async fn preview_restart_starts_the_command_again() {
    let project = project("repo", "ok");
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    let base = ready(&mut records, 1).await;
    let story = json!({ "repo": "repo", "id": format!("main:{STORIES}#Dragging") });
    records.sub(2, "Story", story).await;
    records.until(2, |story| story["state"] == "ready").await;
    let first = group_of(project.pid(0));

    let restarted = records
        .call("preview.restart", preview_of("repo", "main"))
        .await;

    assert_eq!(
        [&restarted["state"], &restarted["base"], &restarted["error"]],
        [&json!("starting"), &Value::Null, &Value::Null]
    );
    records
        .until(1, |preview| preview["state"] == "starting")
        .await;
    let ready = records
        .until(1, |preview| preview["state"] == "ready")
        .await;
    assert_eq!(ready["base"], base.as_str());
    records.until(2, |story| story["state"] == "starting").await;
    records.until(2, |story| story["state"] == "ready").await;
    assert_eq!(project.starts().len(), 2);
    assert_eq!(gone(first).await, Vec::<u32>::new(), "the first command");
    server.stop().await;
}

// A preview runs while somebody looks: 30 minutes after its last read, its command stops, with
// its whole group, unless its folder's file waits for the human and embeds a story. A commit
// outside `specs/` starts it again at once, for who still holds it.
#[tokio::test]
async fn a_preview_follows_its_reads_and_its_checkouts_code() {
    let project = project("repo", "ok");
    add_feature(&project.repo);
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    let base = ready(&mut records, 1).await;
    let first = group_of(project.pid(0));

    // A commit under `specs/` keeps it, and one outside starts it again, at the new code.
    project.repo.write("specs/notes.md", "Notes.\n");
    project.repo.commit("docs: notes");
    project
        .repo
        .write("packages/web/.storybook/main.ts", "// changed\n");
    project.repo.commit("chore: the preview's configuration");
    // Nobody says so: the server's watcher sees the commits.
    records
        .until(1, |preview| preview["state"] == "starting")
        .await;
    records
        .until(1, |preview| preview["state"] == "ready")
        .await;
    assert_eq!(project.starts().len(), 2, "{:?}", project.starts());
    assert_eq!(
        gone(first).await,
        Vec::<u32>::new(),
        "the command at the old code"
    );
    let second = group_of(project.pid(1));
    records.sub(2, "Preview", preview_of("repo", FEATURE)).await;
    let waiting = records
        .until(2, |preview| preview["state"] == "ready")
        .await;
    let waiting = waiting["base"].as_str().unwrap();

    // Read within 30 minutes, it runs on.
    server.clock().advance(29 * MINUTE);
    preview::sweep(server.shared());
    assert_eq!(framed(&server, &format!("{base}__echo")).await.status, 200);

    server.clock().advance(31 * MINUTE);
    preview::sweep(server.shared());

    assert_eq!(gone(second).await, Vec::<u32>::new(), "the idle command");
    assert_eq!(framed(&server, &format!("{base}__echo")).await.status, 503);
    // The feature's round waits for the human, with its stories: its preview is kept up.
    let kept = framed(&server, &format!("{waiting}__echo")).await;
    assert_eq!(kept.status, 200);
    server.stop().await;
}

// The break it catches: a repository taken off the list whose preview command runs on, with
// nothing left to stop it but the server's own stop.
#[tokio::test]
async fn a_repository_that_leaves_the_list_stops_its_previews() {
    let project = project("repo", "ok");
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    ready(&mut records, 1).await;
    let group = group_of(project.pid(0));

    records
        .call("repositories.remove", json!({ "name": "repo" }))
        .await;

    assert_eq!(
        gone(group).await,
        Vec::<u32>::new(),
        "the preview's command"
    );
    server.stop().await;
}

// A server that is killed stops nothing: its commands' groups are recorded in its data folder,
// and the next start stops the ones that still run.
#[tokio::test]
async fn a_killed_servers_preview_commands_are_stopped_by_the_next_start() {
    let server = support::server().await;
    let mut left = Command::new("sh");
    left.args(["-c", "sleep 600 & sleep 600"])
        .stdin(Stdio::null());
    std::os::unix::process::CommandExt::process_group(&mut left, 0);
    let left = Group(left.spawn().unwrap());
    let leader = left.0.id();
    // A leader's start time is recorded as `ps` prints it in the C locale, in UTC.
    let started = Command::new("ps")
        .args(["-o", "lstart=", "-p", &leader.to_string()])
        .envs([("LC_ALL", "C"), ("TZ", "UTC")])
        .output()
        .unwrap();
    let started = String::from_utf8(started.stdout).unwrap();
    let record = json!({ "groups": [
        { "pid": leader, "started": started.trim() },
        // A group whose leader is another process by now is left alone: this test's own.
        { "pid": std::process::id(), "started": "Thu Jan  1 00:00:00 1970" },
    ] });
    let file = server.data_dir().join("run/previews.json");
    fs::write(&file, record.to_string()).unwrap();

    let server = server.restart().await;

    assert_eq!(gone(leader).await, Vec::<u32>::new(), "left running");
    assert!(!file.exists(), "the record of a server that runs nothing");
    server.stop().await;
}

// The review watch (ruling R83): a folder whose file waits for the human and embeds a story has
// its preview started as the server starts, and its linked stories compiled ahead, with no page
// read, so the story shows at once when the human arrives. Without it, the first look at a round
// waits for Storybook to start, then for the story to compile.
#[tokio::test]
async fn a_waiting_folders_preview_starts_with_the_server_and_compiles_its_stories() {
    let project = project("repo", "ok");
    add_feature(&project.repo);
    // Its preview folder has its dependencies: without them, nothing starts ahead.
    let modules = format!(".worktrees/{FEATURE}/packages/web/node_modules");
    fs::create_dir_all(project.repo.path().join(modules)).unwrap();
    let server = serving(&project).await;

    // Nothing reads a record: the server starts the preview by itself, in the feature's worktree.
    let deadline = tokio::time::Instant::now() + MINUTE;
    let story = "/iframe.html";
    let requested = loop {
        let requests = project.starts().first().and_then(|start| {
            let port = start["port"].as_u64()?;
            let url = format!("http://127.0.0.1:{port}/__requests");
            let answer = ureq::get(&url)
                .call()
                .ok()?
                .body_mut()
                .read_to_string()
                .ok()?;
            serde_json::from_str::<Vec<String>>(&answer).ok()
        });
        let compiled = requests.as_ref().is_some_and(|paths| {
            paths.iter().any(|path| path.ends_with(story))
                && paths.iter().any(|path| path.ends_with("/story.js"))
        });
        if compiled {
            break requests.unwrap_or_default();
        }
        assert!(
            tokio::time::Instant::now() < deadline,
            "the story was not compiled ahead: {:?} starts, {requests:?}",
            project.starts().len()
        );
        tokio::time::sleep(Duration::from_millis(100)).await;
    };
    let cwd = project.starts()[0]["cwd"].as_str().unwrap().to_owned();
    assert!(
        cwd.ends_with(&format!(".worktrees/{FEATURE}/packages/web")),
        "{cwd}"
    );
    assert_eq!(project.starts().len(), 1, "{requested:?}");
    server.stop().await;
}

// The stack decision: the server stops with everything it started. The look-ahead waits up to
// three minutes for a preview to be ready: a wait on a blocking thread outlives the stop, and the
// runtime then waits for it as it is dropped, so `ura serve` hangs on its signal until the app
// kills it, its other work unstopped. Here the preview never answers its index: the server and
// its runtime are gone within a second all the same.
#[test]
fn a_server_stopped_while_a_preview_warms_ahead_stops_at_once() {
    let project = project("repo", "hang");
    add_feature(&project.repo);
    let modules = format!(".worktrees/{FEATURE}/packages/web/node_modules");
    fs::create_dir_all(project.repo.path().join(modules)).unwrap();
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();
    let stopping = runtime.block_on(async {
        let server = serving(&project).await;
        warming(&project).await;
        let stopping = std::time::Instant::now();
        server.stop().await;
        stopping
    });
    drop(runtime);

    let taken = stopping.elapsed();
    assert!(taken < PATIENCE, "stopped in {taken:?}");
}

// The look-ahead belongs to the server's runtime, and never holds it: a wait of minutes on a
// blocking thread is one the runtime waits for as it is dropped, whatever became of the server,
// as after a test's failed assertion, or a stop that raced the preview's start. Here nothing
// stops the server, and its preview never answers: its runtime is gone at once all the same.
#[test]
fn a_warm_up_does_not_outlive_the_servers_runtime() {
    let project = project("repo", "hang");
    add_feature(&project.repo);
    let modules = format!(".worktrees/{FEATURE}/packages/web/node_modules");
    fs::create_dir_all(project.repo.path().join(modules)).unwrap();
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();
    let server = runtime.block_on(async {
        let server = serving(&project).await;
        warming(&project).await;
        server
    });

    let dropping = std::time::Instant::now();
    drop(runtime);

    let taken = dropping.elapsed();
    assert!(taken < PATIENCE, "dropped in {taken:?}");
    drop(server);
}

/// Waits until the look-ahead started the project's preview: it then waits for it.
async fn warming(project: &Project) {
    let deadline = tokio::time::Instant::now() + MINUTE;
    while project.starts().is_empty() {
        assert!(tokio::time::Instant::now() < deadline, "nothing warmed");
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

// A preview stops 30 minutes after its last view, telling nobody: a client that held its
// records all along still shows it ready. When it shows the page again, the frame's request
// starts it again, its records say so, and the page answers once it is ready. Without it, a
// window left open overnight shows "Storybook is not running" until a restart by hand.
#[tokio::test]
async fn a_preview_that_stopped_restarts_when_it_is_shown() {
    let project = project("repo", "ok");
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    let base = ready(&mut records, 1).await;
    let story = json!({ "repo": "repo", "id": format!("main:{STORIES}#Dragging") });
    records.sub(2, "Story", story).await;
    let frame = records.until(2, |story| story["state"] == "ready").await;
    let frame = frame["frame"].as_str().unwrap().to_owned();
    let first = group_of(project.pid(0));
    server.clock().advance(31 * MINUTE);
    preview::sweep(server.shared());
    assert_eq!(gone(first).await, Vec::<u32>::new(), "the idle command");

    // The story's page, shown again, is the view.
    assert_eq!(framed(&server, &frame).await.status, 503);

    records
        .until(1, |preview| preview["state"] == "starting")
        .await;
    records
        .until(1, |preview| preview["state"] == "ready")
        .await;
    records.until(2, |story| story["state"] == "ready").await;
    assert_eq!(project.starts().len(), 2);
    assert_eq!(framed(&server, &format!("{base}__echo")).await.status, 200);
    server.stop().await;
}

/// A frame's request for a stopped preview, with the fetch metadata a browser sends: whether
/// it woke the preview, which the answer's `Retry-After` says.
async fn woke(server: &TestServer, path: &str, metadata: &[(&str, &str)]) -> bool {
    let mut asked = server.get(path).header("origin", "null");
    for (name, value) in metadata {
        asked = asked.header(name, value);
    }
    let answer = asked.send().await;
    assert_eq!(answer.status, 503, "{path}");
    answer.header("retry-after").is_some()
}

// Only a page shown again starts a preview that stopped (ruling T88.4). A frame left open asks
// on by itself, for a script, a ping of its hot reload, a page fetched ahead: answered as a
// view, each started the preview the idle sweep had just stopped, all night. And a preview that
// goes again right after it was woken is not started in a loop, nor one whose repository left.
#[tokio::test]
async fn a_stale_frame_starts_no_preview() {
    let project = project("repo", "ok");
    let server = serving(&project).await;
    let mut records = Records::of(&server).await;
    let base = ready(&mut records, 1).await;
    let page = format!("{base}iframe.html?id=sidebar--dragging");
    let navigation = [("sec-fetch-dest", "iframe"), ("sec-fetch-mode", "navigate")];
    server.clock().advance(31 * MINUTE);
    preview::sweep(server.shared());
    assert_eq!(gone(group_of(project.pid(0))).await, Vec::<u32>::new());

    // What an open frame asks for by itself wakes nothing.
    let script = [("sec-fetch-dest", "script"), ("sec-fetch-mode", "no-cors")];
    assert!(!woke(&server, &format!("{base}story.js"), &script).await);
    let ping = [("sec-fetch-dest", "empty"), ("sec-fetch-mode", "no-cors")];
    assert!(!woke(&server, &base, &ping).await, "a hot reload's ping");
    let ahead = [navigation[0], navigation[1], ("sec-purpose", "prefetch")];
    assert!(!woke(&server, &page, &ahead).await, "a page fetched ahead");
    // Without fetch metadata, only the page itself is one.
    assert!(!woke(&server, &format!("{base}story.js"), &[]).await);

    // The page shown again does, and its records follow.
    assert!(woke(&server, &page, &navigation).await);
    records
        .until(1, |preview| preview["state"] == "starting")
        .await;
    records
        .until(1, |preview| preview["state"] == "ready")
        .await;
    assert_eq!(project.starts().len(), 2);

    // Gone again within the minute, it is left: a preview that does not stay is not started
    // again by each look at it.
    preview::repository_removed(server.shared(), "repo");
    assert_eq!(gone(group_of(project.pid(1))).await, Vec::<u32>::new());
    assert!(!woke(&server, &page, &navigation).await, "a second wake");
    server.clock().advance(2 * MINUTE);
    assert!(woke(&server, &page, &navigation).await, "a minute later");
    records
        .until(1, |preview| preview["state"] == "starting")
        .await;
    records
        .until(1, |preview| preview["state"] == "ready")
        .await;

    // Its repository gone from the list, nothing is left to start.
    records
        .call("repositories.remove", json!({ "name": "repo" }))
        .await;
    assert_eq!(gone(group_of(project.pid(2))).await, Vec::<u32>::new());
    server.clock().advance(2 * MINUTE);
    assert!(!woke(&server, &page, &navigation).await, "no repository");
    assert_eq!(project.starts().len(), 3);
    server.stop().await;
}

// A mockup's page is shown in a web view, which sends no cookie: its record gives its address
// with the frame secret, which opens it, and none for a file that is not a mockup's.
#[tokio::test]
async fn mockup_answers_its_shape() {
    let repo = TestRepo::named("repo");
    repo.write("specs/2026-10-20-a/mockups/My page.html", "<p>Mockup</p>\n");
    repo.write("specs/2026-10-20-a/notes.html", "<p>Notes</p>\n");
    repo.commit("docs: mockups");
    let server = support::setup().folder(repo.path()).start().await;
    let mut records = Records::of(&server).await;
    let mockup = |path: &str| json!({ "repo": "repo", "path": path });

    let found = records
        .sub(
            1,
            "Mockup",
            mockup("specs/2026-10-20-a/mockups/My page.html"),
        )
        .await;
    let frame = found["frame"].as_str().unwrap();
    let secret = frame.split('/').nth(4).unwrap();
    assert_eq!(
        frame,
        format!("/r/repo/mockups/{secret}/specs/2026-10-20-a/mockups/My%20page.html")
    );
    let page = framed(&server, frame).await;
    assert_eq!(
        (page.status, page.text()),
        (200, "<p>Mockup</p>\n".to_owned())
    );

    for (id, path) in [
        (2, "specs/2026-10-20-a/notes.html"),
        (3, "specs/2026-10-20-a/mockups/gone.html"),
    ] {
        let none = records.sub(id, "Mockup", mockup(path)).await;
        assert_eq!(none, json!({ "frame": null }), "{path}");
    }
    server.stop().await;
}
