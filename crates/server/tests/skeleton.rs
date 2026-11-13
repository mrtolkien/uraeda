//! The server's skeleton: the handshake at `/live`, the guard every request passes, the second
//! start's handoff, and where secrets come from.

use crate::support;

use std::fs;
use std::net::TcpListener;
use std::path::Path;
use std::sync::{Arc, Mutex};

use serde_json::{Value, json};
use support::{TestRepo, TestServer};
use uraeda_protocol::{ClientMessage, ErrorCode, PROTOCOL, Refusal, ServerMessage, SignIn};
use uraeda_server::guard::{self, Asked, Rules};
use uraeda_server::{Holder, NotStarted, Options, Server, status};

/// A `hello` at a version.
fn hello(protocol: u32) -> ClientMessage {
    ClientMessage::Hello {
        protocol,
        sign_in: SignIn::Cookie,
    }
}

#[tokio::test]
async fn an_older_client_is_refused_with_the_side_to_update() {
    let server = support::server().await;

    let mut older = server.socket().await;
    older.send(&hello(PROTOCOL - 1)).await;

    assert_eq!(
        older.next().await,
        ServerMessage::Refused {
            reason: Refusal::ClientTooOld,
            protocol: PROTOCOL
        }
    );
    older.closed().await;

    // A newer client names the other side, and anything but a `hello` is turned away too.
    let mut newer = server.socket().await;
    newer.send(&hello(PROTOCOL + 1)).await;
    assert_eq!(
        newer.next().await,
        ServerMessage::Refused {
            reason: Refusal::ServerTooOld,
            protocol: PROTOCOL
        }
    );
    newer.closed().await;
    let mut silent = server.socket().await;
    silent.send(&ClientMessage::Unsub { id: 1 }).await;
    assert!(matches!(
        silent.next().await,
        ServerMessage::Error {
            id: None,
            code: ErrorCode::NotSignedIn,
            ..
        }
    ));
    silent.closed().await;

    // A client of this version is welcomed, under the epoch of this start of the server.
    let mut client = server.connect().await;
    assert!(!client.epoch().is_empty());
    assert_eq!(server.connect().await.epoch(), client.epoch());

    // A message that cannot be read is answered with no id: the live engine's tests have the
    // messages that can.
    client.send_text("not json").await;
    assert!(matches!(
        client.next().await,
        ServerMessage::Error {
            id: None,
            code: ErrorCode::BadMessage,
            ..
        }
    ));
}

/// A host name the owner allowed, as a tailnet's.
const TAILNET: &str = "mac.tail1234.ts.net";

/// What a web page could send to the local server, and what the server's own clients do: a
/// request's name, its `Host`, its other headers, and the guard's refusal, if any. `{port}` stands
/// for the server's port.
const GUARD_ROWS: &str = "
the server's address                 | 127.0.0.1:{port}           |                                                        |
localhost                            | localhost:{port}           |                                                        |
another host                         | evil.com:{port}            |                                                        | Forbidden host
a host without its port              | 127.0.0.1                  |                                                        | Forbidden host
the server's origin                  | localhost:{port}           | origin=http://localhost:{port}                         |
an allowed origin                    | 127.0.0.1:{port}           | origin=http://localhost:5173                           |
another origin                       | 127.0.0.1:{port}           | origin=https://evil.com                                | Forbidden origin
an allowed host, from its own origin | mac.tail1234.ts.net        | origin=https://mac.tail1234.ts.net                     |
an allowed host, with the port       | mac.tail1234.ts.net:{port} |                                                        |
an allowed host, in capitals         | MAC.tail1234.ts.net        |                                                        |
a host not listed                    | evil.example               |                                                        | Forbidden host
an origin not listed                 | mac.tail1234.ts.net        | origin=https://evil.example                            | Forbidden origin
another site, without an origin      | 127.0.0.1:{port}           | sec-fetch-site=cross-site                              | Forbidden site
a sibling site, without an origin    | 127.0.0.1:{port}           | sec-fetch-site=same-site                               | Forbidden site
its own page, without an origin      | 127.0.0.1:{port}           | sec-fetch-site=same-origin                             |
a typed address, without an origin   | 127.0.0.1:{port}           | sec-fetch-site=none                                    |
an allowed origin, from another site | 127.0.0.1:{port}           | origin=http://localhost:5173 sec-fetch-site=same-site  |
an extension page's host, writing    | wiki.localhost:{port}      |                                                        | Forbidden host
";

/// A sandboxed frame, whose requests carry `Origin: null`, reads only a preview's or a mockup's
/// path with the frame secret, `the-secret`: a request's name, its method, `upgrade` for a
/// WebSocket's, its path, and the guard's refusal, if any.
const FRAME_ROWS: &str = "
a frame's read                      | GET          | /r/repo/preview/the-secret/sidebar-resize/iframe.html        |
a frame's HEAD                      | HEAD         | /r/repo/preview/the-secret/sidebar-resize/iframe.html        |
a mockup's read                     | GET          | /r/repo/mockups/the-secret/specs/tasks/mockups/repeat.html   |
a frame's socket on a preview       | GET upgrade  | /r/repo/preview/the-secret/sidebar-resize/channel            |
a frame's read without the secret   | GET          | /r/repo/preview/sidebar-resize/iframe.html                   | Not found
a frame's read with another secret  | GET          | /r/repo/preview/another/sidebar-resize/iframe.html           | Not found
a mockup's read without the secret  | GET          | /r/repo/mockups/specs/tasks/mockups/repeat.html              | Not found
a frame's socket without the secret | GET upgrade  | /r/repo/preview/sidebar-resize/channel                       | Not found
a mockup's write                    | POST         | /r/repo/mockups/the-secret/specs/tasks/mockups/repeat.html   | Forbidden origin
a frame's write                     | POST         | /r/repo/preview/the-secret/sidebar-resize/iframe.html        | Forbidden origin
a frame's socket that writes        | POST upgrade | /r/repo/preview/the-secret/sidebar-resize/channel            | Forbidden origin
a frame reading a file              | GET          | /r/repo/raw/specs/README.md                                  | Forbidden origin
a frame's socket elsewhere          | GET upgrade  | /live                                                        | Forbidden origin
a preview without a folder          | GET          | /r/repo/preview/the-secret/                                  | Forbidden origin
a preview with an empty folder      | GET          | /r/repo/preview/the-secret//a                                | Forbidden origin
a preview without a secret          | GET          | /r/repo/preview//a                                           | Forbidden origin
a mockup without a path             | GET upgrade  | /r/repo/mockups/the-secret/                                  | Forbidden origin
";

/// The rows of a table: the cells of each line, trimmed.
fn rows(table: &str) -> Vec<Vec<&str>> {
    let lines = table.trim().lines();
    lines
        .map(|line| line.split('|').map(str::trim).collect())
        .collect()
}

#[tokio::test]
async fn a_request_with_another_sites_origin_is_refused() {
    let server = support::setup()
        .env("URAEDA_ALLOWED_HOSTS", TAILNET)
        .allow_origin("http://localhost:5173")
        .start()
        .await;
    let port = server.port().to_string();
    let outside = tempfile::TempDir::new().unwrap();
    let folder = json!({ "folder": outside.path() });

    for row in rows(&GUARD_ROWS.replace("{port}", &port)) {
        let [name, host, headers, refusal] = row[..] else {
            panic!("a row has four cells: {row:?}");
        };
        let mut request = server
            .post("/open")
            .bearer(&server.host_token())
            .json(&folder)
            .header("host", host);
        for header in headers.split_whitespace() {
            let (header, value) = header.split_once('=').unwrap();
            request = request.header(header, value);
        }

        let answer = request.send().await;

        let expected = if refusal.is_empty() { 200 } else { 403 };
        assert_eq!(answer.status, expected, "{name}");
        if expected == 403 {
            assert_eq!(answer.text(), refusal, "{name}");
        }
    }

    // The WebSocket is a request like any other: another site's page never opens it.
    let socket = server
        .get("/live")
        .header("origin", "https://evil.com")
        .send()
        .await;
    assert_eq!(
        (socket.status, socket.text().as_str()),
        (403, "Forbidden origin")
    );

    let frame = |path: &str| guard::frame_secret(path) == Some("the-secret");
    let rules = Rules {
        port: 4320,
        hosts: &[],
        origins: &[],
        frame: &frame,
    };
    let asked = |method, path, origin| Asked {
        host: "127.0.0.1:4320",
        method,
        origin: Some(origin),
        path,
        site: None,
        upgrade: false,
    };
    for row in rows(FRAME_ROWS) {
        let [name, method, path, refusal] = row[..] else {
            panic!("a row has four cells: {row:?}");
        };
        let (method, upgrade) = match method.strip_suffix(" upgrade") {
            Some(method) => (method, true),
            None => (method, false),
        };
        let refused = guard::refusal(
            &rules,
            &Asked {
                upgrade,
                ..asked(method, path, "null")
            },
        );
        assert_eq!(refused.map_or("", guard::Refusal::text), refusal, "{name}");
    }
    // An extension page's own host reads, and nothing more: no socket, no other port, no host
    // under it.
    // The frame secret opens a path to a frame, and to no other site.
    let preview = "/r/repo/preview/the-secret/sidebar-resize/iframe.html";
    let evil = guard::refusal(&rules, &asked("GET", preview, "https://evil.com"));
    assert_eq!(evil, Some(guard::Refusal::Origin));
    assert_eq!(guard::Refusal::NotFound.status(), 404);
}

// An extension page's own host, `<extension>.localhost` on the server's port, which a browser
// runs in a process of its own (`app/extensions/host.web.tsx`), reads, and nothing more.
#[test]
fn an_extension_pages_host_only_reads() {
    let frame = |_: &str| false;
    let rules = Rules {
        port: 4320,
        hosts: &[],
        origins: &[],
        frame: &frame,
    };
    let asked = |method, path, origin| Asked {
        host: "127.0.0.1:4320",
        method,
        origin: Some(origin),
        path,
        site: None,
        upgrade: false,
    };
    let own = Asked {
        host: "wiki.localhost:4320",
        ..asked("GET", "/nsh.6daa6f4d35.js", "http://wiki.localhost:4320")
    };
    assert_eq!(
        guard::refusal(&rules, &own),
        None,
        "a page host's own module"
    );
    let other = Asked {
        host: "wiki.localhost:4320",
        ..asked("GET", "/nsh.6daa6f4d35.js", "http://hello.localhost:4320")
    };
    assert_eq!(guard::refusal(&rules, &other), Some(guard::Refusal::Origin));
    for (host, upgrade, passes) in [
        ("wiki.localhost:4320", false, true),
        ("wiki.localhost:4320", true, false),
        ("wiki.localhost:4321", false, false),
        ("a.wiki.localhost:4320", false, false),
    ] {
        let read = Asked {
            host,
            origin: None,
            upgrade,
            ..asked("GET", "/extension.html", "null")
        };
        let refused = guard::refusal(&rules, &read);
        assert_eq!(
            refused.is_none(),
            passes,
            "{host}, upgrade {upgrade}: {refused:?}"
        );
    }
}

/// The names, paths, and opening times of the list of repositories, as stored.
fn listed(data: &Path) -> Vec<(String, String, String)> {
    let Ok(text) = fs::read_to_string(data.join("repositories.json")) else {
        return Vec::new();
    };
    let file: Value = serde_json::from_str(&text).unwrap();
    let text = |entry: &Value, key: &str| entry[key].as_str().unwrap().to_owned();
    file["repositories"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| {
            (
                text(entry, "name"),
                text(entry, "path"),
                text(entry, "openedAt"),
            )
        })
        .collect()
}

/// A second start with these options: where it handed over, or why it did not start.
async fn second_start(options: Options) -> NotStarted {
    match Server::start(options).await {
        Ok(_) => panic!("a second server started"),
        Err(refusal) => refusal,
    }
}

/// A listener of another program, which hangs up on whoever connects.
fn another_program() -> u16 {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let port = listener.local_addr().unwrap().port();
    std::thread::spawn(move || {
        for connection in listener.incoming() {
            drop(connection);
        }
    });
    port
}

/// What `/open` answers a request with the host token, for a body.
async fn open(server: &TestServer, body: &Value) -> (u16, Value) {
    let answer = server
        .post("/open")
        .bearer(&server.host_token())
        .json(body)
        .send()
        .await;
    (answer.status, answer.json())
}

#[tokio::test]
async fn a_second_start_hands_over_to_the_first() {
    let first = support::server().await;
    let repo = TestRepo::named("todo-app");
    repo.write("src/main.rs", "fn main() {}\n");
    let path = repo.path().display().to_string();
    let in_repo = Options {
        folder: Some(repo.path().join("src")),
        ..first.options()
    };

    let second = second_start(in_repo.clone()).await;

    // The first server got the second's folder, and answered its repository's page.
    assert_eq!(
        second,
        NotStarted::HandedOver {
            address: first.address(),
            url: "/r/todo-app/".to_owned()
        }
    );
    let opened = (
        "todo-app".to_owned(),
        path,
        "2026-11-10T09:00:00Z".to_owned(),
    );
    assert_eq!(listed(first.data_dir()), std::slice::from_ref(&opened));

    // Only the host's own `ura`, which reads the status file, hands a folder over.
    for token in ["", "another-token"] {
        let answer = first
            .post("/open")
            .bearer(token)
            .json(&json!({ "folder": repo.parent() }))
            .send()
            .await;
        assert_eq!(answer.status, 401, "the token {token:?}");
    }
    for body in [
        json!({ "folder": "notes" }),
        json!({ "folder": 3 }),
        json!("not a folder"),
    ] {
        assert_eq!(
            open(&first, &body).await,
            (400, json!({ "error": "folder must be an absolute path" })),
            "{body}"
        );
    }
    // A start in no folder, or in one outside git, opens the server, and adds nothing.
    let version = env!("CARGO_PKG_VERSION");
    for body in [json!({}), json!({ "folder": repo.parent() })] {
        assert_eq!(
            open(&first, &body).await,
            (200, json!({ "uraeda": version, "url": "/" })),
            "{body}"
        );
    }
    assert_eq!(listed(first.data_dir()), [opened]);

    // A port that is not this data folder's server's: another Uraeda, or another program.
    let elsewhere = tempfile::TempDir::new().unwrap();
    let other_data = Options {
        port: Some(first.port()),
        data_dir: elsewhere.path().to_owned(),
        ..first.options()
    };
    let taken = second_start(other_data).await;
    assert_eq!(
        taken,
        NotStarted::PortTaken {
            port: first.port(),
            by: Holder::Uraeda
        }
    );
    assert_eq!(
        taken.to_string(),
        format!(
            "port {} is used by an Uraeda server with another data folder",
            first.port()
        )
    );
    let port = another_program();
    let taken = second_start(Options {
        port: Some(port),
        data_dir: elsewhere.path().to_owned(),
        ..first.options()
    })
    .await;
    assert_eq!(
        taken.to_string(),
        format!("port {port} is used by another program: pass --port to use another one")
    );

    // A stopped server leaves no status file, and the next start is a first start again.
    let data = first.data_dir().to_owned();
    assert!(status::read(&data).is_some());
    first.stop().await;
    assert!(status::read(&data).is_none());
    let again = Server::start(in_repo).await.expect("a first start");
    again.stop().await;
}

#[tokio::test]
async fn stopping_the_server_stops_what_its_domains_registered() {
    let server = support::server().await;
    let shared = server.shared().clone();
    let stopped = Arc::new(Mutex::new(Vec::new()));
    for name in ["first", "second"] {
        let stopped = stopped.clone();
        shared.on_stop(name, async move { stopped.lock().unwrap().push(name) });
    }
    let mut client = server.connect().await;

    server.stop().await;

    // The last registered stops first, an open connection ends, and late work still runs.
    assert_eq!(*stopped.lock().unwrap(), ["second", "first"]);
    client.closed().await;
    let (late, ran) = tokio::sync::oneshot::channel();
    shared.on_stop("late", async move { late.send(()).unwrap() });
    ran.await
        .expect("work registered once the server stopped runs at once");
}

/// What a command the server runs in `folder` prints.
fn run(server: &TestServer, folder: &Path, script: &str) -> String {
    let output = server
        .shared()
        .environment()
        .command("sh")
        .current_dir(folder)
        .args(["-c", script])
        .output()
        .expect("sh runs");
    String::from_utf8(output.stdout).unwrap()
}

#[tokio::test]
async fn secrets_come_from_the_config_folders_env_only() {
    let project = TestRepo::named("todo-app");
    project.write(
        ".env",
        "PROJECT_KEY=from-the-project\nURAEDA_ALLOWED_HOSTS=evil.example\n",
    );

    let server = support::setup()
        .config(
            ".env",
            "# Secrets\nAPI_KEY=from-the-config-folder\nexport QUOTED=\"two words\" # mine\n\
             GIVEN=from-the-file\nEMPTY=from-the-file\nURAEDA_ALLOWED_HOSTS=mac.tail1234.ts.net\n",
        )
        .env("GIVEN", "from-the-environment")
        .env("EMPTY", "")
        .folder(project.path())
        .start()
        .await;

    // A command the server runs, as an agent in a project, gets the config folder's secrets over
    // the server's own environment, and nothing of the project's `.env`.
    assert_eq!(
        run(
            &server,
            project.path(),
            r#"printf '%s|%s|%s|%s|%s' "$API_KEY" "$QUOTED" "$GIVEN" "$EMPTY" "$PROJECT_KEY""#
        ),
        "from-the-config-folder|two words|from-the-environment|from-the-file|"
    );
    // So only the owner's own file widens the host names the server accepts.
    let host = |name: &str| server.get("/nothing").header("host", name).send();
    assert_eq!(host(TAILNET).await.status, 404);
    assert_eq!(host("evil.example").await.status, 403);
}

// The break it catches: git and the hooks the core runs started in the process's environment,
// without the config folder's `.env`, so a hook that pushes or signs with a secret kept there
// fails for the commits the server lands, and passes for the same commit made by hand.
#[tokio::test]
async fn a_hook_of_a_commit_the_server_lands_gets_the_config_folders_secrets() {
    let repo = TestRepo::named("todo-app");
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n\n## Next\n");
    repo.commit("chore: specs");
    let seen = repo.parent().join("seen");
    repo.set_hook(&format!(
        "printf '%s|%s' \"$HOOK_KEY\" \"$PROJECT_KEY\" > '{}'",
        seen.display()
    ));
    repo.write(".env", "PROJECT_KEY=from-the-project\n");
    let server = support::setup()
        .config(".env", "HOOK_KEY=from-the-config-folder\n")
        .folder(repo.path())
        .start()
        .await;
    let mut live = support::Live::of(&server).await;
    let priorities = live.read("Priorities", json!({ "repo": "todo-app" })).await;

    let added = json!({
        "repo": "todo-app", "section": "next", "text": "Pair a phone", "hash": priorities["hash"],
    });
    live.call("proposals.add", added).await;
    live.call("priorities.commit", json!({ "repo": "todo-app" }))
        .await;
    assert_eq!(
        support::idle(&server, "todo-app").await,
        Vec::<String>::new()
    );

    let seen = std::fs::read_to_string(seen).expect("the hook ran");
    assert_eq!(seen, "from-the-config-folder|");
}

// No test's server starts the machine's agents, which use their owner's accounts (ruling
// R118): the built-in runtimes ask stand-ins for their models as the server starts.
#[tokio::test]
async fn a_test_server_runs_no_agent_of_the_machine() {
    let server = support::server().await;

    server.runs_no_agent_of_the_machine().await;
}
