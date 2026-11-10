//! Sign-in: who reaches a server that runs code as its owner. A browser's session, from the access
//! key or a one-time link; a paired device's token; the routes open without either; and what the
//! sign-in file holds.

mod support;

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use support::{TestClient, TestResponse, TestServer};
use uraeda_protocol::{
    ClientMessage, Device, DevicesRename, DevicesRevoke, ErrorCode, PROTOCOL, Refusal,
    ServerMessage, SignIn, apply,
};
use uraeda_server::secret::Hashed;
use uraeda_server::sign_in::{self, devices};
use uraeda_server::{NotStarted, Server};

const MINUTE: Duration = Duration::from_secs(60);
const HOUR: Duration = Duration::from_secs(60 * 60);
const DAY: Duration = Duration::from_secs(24 * 60 * 60);

/// A host name the owner allowed, as a tailnet's, behind HTTPS.
const TAILNET: &str = "mac.tail1234.ts.net";

/// When a test's server starts, as the sign-in file writes it.
const START: &str = "2026-11-10T09:00:00Z";

/// What a request without a session is answered.
const SIGN_IN: &str = "Sign in to Uraeda.";

/// What clears a browser's cookie on the server's own address.
const CLEARED: &str = "uraeda=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax";

/// A secret as the sign-in file stores it: its SHA-256, in base64url.
fn hashed(secret: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(secret.as_bytes()))
}

/// Whether a text is `bytes` random bytes in base64url.
fn random(text: &str, bytes: usize) -> bool {
    let letters = text
        .chars()
        .all(|letter| letter.is_ascii_alphanumeric() || letter == '-' || letter == '_');
    letters && text.len() == (bytes * 4).div_ceil(3)
}

/// The status of `GET /session`: 204 for a request that is signed in, 401 for any other.
async fn signed_in(server: &TestServer, cookie: Option<&str>, token: Option<&str>) -> u16 {
    let mut request = server.get("/session");
    if let Some(cookie) = cookie {
        request = request.cookie(cookie);
    }
    if let Some(token) = token {
        request = request.bearer(token);
    }
    request.send().await.status
}

/// Whether an answer is the refusal of a request without a session.
fn asks_to_sign_in(answer: &TestResponse) -> bool {
    answer.status == 401
        && answer.json() == json!({ "error": SIGN_IN })
        && answer.header("cache-control") == Some("no-store")
}

/// A `hello` the server turns down as not signed in, then closes the connection of.
async fn refused(server: &TestServer, sign_in: SignIn) {
    let mut client = server.socket().await;
    client.sign_in(sign_in.clone());

    let answer = client.say_hello().await;

    let not_signed_in = ServerMessage::Refused {
        reason: Refusal::NotSignedIn,
        protocol: PROTOCOL,
    };
    assert_eq!(answer, not_signed_in, "{sign_in:?}");
    client.closed().await;
}

/// The record `Devices` as a client holds it, under the subscription 1: its value, and the number
/// of the last change applied.
struct Listed {
    value: Value,
    seq: u64,
}

impl Listed {
    /// Subscribes a welcomed client to `Devices`, and takes the whole value.
    async fn open(client: &mut TestClient) -> Listed {
        let record = "Devices".to_owned();
        let args = Value::Null;
        client
            .send(&ClientMessage::Sub {
                id: 1,
                record,
                args,
            })
            .await;
        match client.next().await {
            ServerMessage::Data { id: 1, seq, value } => Listed { value, seq },
            other => panic!("a sub to `Devices` is answered with its value, not {other:?}"),
        }
    }

    /// Takes the client's next message, the list's next change, and gives the devices after it.
    async fn changed(&mut self, client: &mut TestClient) -> &Value {
        match client.next().await {
            ServerMessage::Change { id: 1, seq, ops } if seq == self.seq + 1 => {
                apply(&mut self.value, &ops).expect("a change applies to the value held");
                self.seq = seq;
            }
            other => panic!("expected the next change of `Devices`, got {other:?}"),
        }
        &self.value["devices"]
    }
}

/// A `call` of an action on a device.
fn call(id: u32, action: &str, input: Value) -> ClientMessage {
    ClientMessage::Call {
        id,
        action: action.to_owned(),
        input,
    }
}

// US5, with the edge case of a token revoked while its device is connected, and review focus 4:
// nothing the device sends holds a time.
#[tokio::test]
async fn a_paired_device_signs_in_until_it_is_revoked() {
    let server = support::server().await;
    let changes = Arc::new(Mutex::new(0));
    let counted = changes.clone();
    devices::on_change(server.shared(), move || *counted.lock().unwrap() += 1);

    // A code works once, from a device whose clock is a year ahead.
    let code = server.pairing_code().await;
    let pair = |code: &str| {
        server
            .post("/pair")
            .header("date", "Wed, 10 Nov 2027 09:00:00 GMT")
            .json(&json!({ "code": code, "name": " Phone " }))
            .send()
    };
    // As a person types it: in small letters, without its dashes.
    let paired = pair(&code.replace('-', " ").to_lowercase()).await;
    let again = pair(&code).await;
    assert_eq!(paired.status, 200, "{}", paired.text());
    assert_eq!(paired.header("cache-control"), Some("no-store"));
    let token = paired.json()["token"].as_str().unwrap().to_owned();
    let (id, secret) = token.split_once('.').unwrap();
    assert!(random(id, 16) && random(secret, 32), "{token}");
    assert_eq!(paired.json()["id"], id);
    assert_eq!(again.status, 401);
    assert_eq!(again.header("set-cookie"), None);

    // A code is refused once its 10 minutes passed, by the server's clock alone.
    let late = server.pairing_code().await;
    server.clock().advance(10 * MINUTE + Duration::from_secs(1));
    assert_eq!(pair(&late).await.status, 401);

    // The token signs in over the WebSocket, and on a route.
    let mut device = server.socket().await;
    device.sign_in(SignIn::Token(token.clone()));
    device.hello().await;
    assert_eq!(signed_in(&server, None, Some(&token)).await, 204);
    // It holds a record open, as an app does: the list of devices, itself in it.
    let mut held = Listed::open(&mut device).await;
    assert_eq!(held.value["devices"][0]["name"], "Phone");
    // No other sign-in is welcomed: none, an unknown token, another secret, a browser's cookie.
    let cookie = server.sign_in().await;
    let session = cookie.split_once('=').unwrap().1;
    refused(&server, SignIn::Cookie).await;
    for wrong in ["", "unknown", &format!("{id}.wrong"), session] {
        refused(&server, SignIn::Token(wrong.to_owned())).await;
    }

    // The owner sees the device, and renames it.
    let listed = Device {
        id: id.to_owned(),
        name: "Phone".to_owned(),
        created: START.to_owned(),
        used: START.to_owned(),
    };
    assert_eq!(devices::list(server.shared()).devices, [listed.clone()][..]);
    let rename = |id: &str, name: &str| {
        let input = DevicesRename {
            id: id.to_owned(),
            name: name.to_owned(),
        };
        devices::rename(server.shared(), &input).map_err(|fault| fault.code())
    };
    assert_eq!(rename(id, " Pixel\n"), Ok(()));
    assert_eq!(rename(id, "  "), Err(ErrorCode::BadInput));
    assert_eq!(rename("unknown", "Tablet"), Err(ErrorCode::Refused));
    let renamed = Device {
        name: "Pixel".to_owned(),
        ..listed
    };
    assert_eq!(devices::list(server.shared()).devices, [renamed]);
    assert_eq!(held.changed(&mut device).await[0]["name"], "Pixel");

    // Revoked, its open connection closes, with the record it holds, before any change of that
    // record reaches it, and its token signs in nowhere.
    let revoke = DevicesRevoke { id: id.to_owned() };
    assert!(devices::revoke(server.shared(), &revoke).is_ok());
    device.closed().await;
    refused(&server, SignIn::Token(token.clone())).await;
    assert_eq!(signed_in(&server, None, Some(&token)).await, 401);
    assert_eq!(devices::list(server.shared()).devices, []);
    let gone = devices::revoke(server.shared(), &revoke).map_err(|fault| fault.code());
    assert_eq!(gone, Err(ErrorCode::Refused));
    // Whoever shows the devices heard each change: paired, renamed, revoked.
    assert_eq!(*changes.lock().unwrap(), 3);
}

// US5: the owner's list of devices is live, and its actions are called over `/live`.
#[tokio::test]
async fn a_devices_list_follows_a_pairing_and_a_revocation() {
    let server = support::server().await;
    let cookie = server.sign_in().await;
    let mut owner = server.browser_socket(&cookie).await;
    owner.hello().await;
    let mut listed = Listed::open(&mut owner).await;
    assert_eq!(listed.value, json!({ "devices": [] }));

    // A device pairs: the list gains it.
    let token = server.pair("Phone").await;
    let id = token.split_once('.').unwrap().0;
    let device = |name: &str| json!({ "id": id, "name": name, "created": START, "used": START });
    assert_eq!(*listed.changed(&mut owner).await, json!([device("Phone")]));

    // Another connection renames it, then revokes it: each action is answered there, and the
    // list follows here.
    let mut other = server.browser_socket(&cookie).await;
    other.hello().await;
    let done = |id| ServerMessage::Result {
        id,
        output: Value::Null,
    };
    let rename = json!({ "id": id, "name": " Pixel " });
    other.send(&call(1, "devices.rename", rename)).await;
    assert_eq!(other.next().await, done(1));
    assert_eq!(*listed.changed(&mut owner).await, json!([device("Pixel")]));
    other
        .send(&call(2, "devices.revoke", json!({ "id": id })))
        .await;
    assert_eq!(other.next().await, done(2));
    assert_eq!(*listed.changed(&mut owner).await, json!([]));

    // An action that does nothing says why, with the code of its `error`.
    let blank = json!({ "id": id, "name": " " });
    let named = json!({ "id": id, "name": "Tablet" });
    let nothing = [
        ("devices.rename", blank, ErrorCode::BadInput),
        ("devices.rename", named, ErrorCode::Refused),
        ("devices.revoke", json!({ "id": id }), ErrorCode::Refused),
    ];
    for (action, input, expected) in nothing {
        other.send(&call(3, action, input.clone())).await;
        let ServerMessage::Error { id, code, .. } = other.next().await else {
            panic!("{action} of {input} is answered with an error");
        };
        assert_eq!((id, code), (Some(3), expected), "{action} of {input}");
    }
}

/// A route's path as a request asks for it: `x` for each of its parameters.
fn concrete(route: &str) -> String {
    let segments = route.split('/');
    let segments = segments.map(|segment| {
        if segment.starts_with('{') {
            "x"
        } else {
            segment
        }
    });
    segments.collect::<Vec<_>>().join("/")
}

// The sign-in decision: every request carries a valid session or device token, except the
// sign-in and pairing routes. A route a later task mounts is one of the server's routes, so it
// is closed here until it is listed below, and in the decision.
#[tokio::test]
async fn every_route_but_the_open_ones_refuses_a_request_without_a_session() {
    let server = support::server().await;
    // Open to anyone the guard lets through: each checks what it is given. `/live` checks its
    // `hello`.
    let open = ["/live", "/session", "/session/{token}", "/pair", "/mcp"];
    // Open to the host's own `ura` and app, with the host token of the status file.
    let host = ["/open", "/session/key", "/pair/code"];
    let cookie = server.sign_in().await;
    let token = server.pair("Phone").await;
    let host_token = server.host_token();

    let mut closed = Vec::new();
    for route in server.routes() {
        if open.contains(&route) {
            continue;
        }
        let path = concrete(route);
        let ask = |method: &str| server.request(method, &path).json(&json!({}));
        for method in ["GET", "POST", "PUT", "PATCH", "DELETE"] {
            let answer = ask(method).send().await;
            assert!(asks_to_sign_in(&answer), "{method} {route}: {answer:?}");
        }
        if host.contains(&route) {
            // The host token opens the host's routes, and nothing else does: another token, the
            // token sent twice, or a sign-in.
            let twice = format!("Bearer {host_token}, Bearer {host_token}");
            let others = [
                ask("POST").bearer("another-token"),
                ask("POST").header("authorization", &twice),
                ask("POST").cookie(&cookie),
                ask("POST").bearer(&token),
            ];
            for other in others {
                assert!(asks_to_sign_in(&other.send().await), "POST {route}");
            }
            // A new key would sign this test out: its own test shows the host gets one.
            if route != "/session/key" {
                let own = ask("POST").bearer(&host_token).send().await;
                assert_ne!(own.status, 401, "POST {route}, from the host");
            }
        } else {
            // The host token opens no other route.
            let hosted = ask("GET").bearer(&host_token).send().await;
            assert!(asks_to_sign_in(&hosted), "GET {route}, from the host");
            closed.push(route);
        }
    }

    // A session's cookie and a device's token both open a closed route: here, signing out.
    assert!(closed.contains(&"/sessions"), "{closed:?}");
    let device = server.request("DELETE", "/sessions").bearer(&token);
    assert_eq!(device.send().await.status, 204);
    let cookie = server.sign_in().await;
    let browser = server.request("DELETE", "/sessions").cookie(&cookie);
    assert_eq!(browser.send().await.status, 204);
    // A path that is no route is the client's own files: nothing of the owner's is there.
    assert_eq!(server.get("/nothing").send().await.status, 404);
}

// The sign-in decision: a failed sign-in costs a guesser time, and never locks the owner out.
#[tokio::test]
async fn a_wrong_key_is_slowed_never_locked_out() {
    let server = support::server().await;
    let key = |key: &str| server.post("/session").json(&json!({ "key": key })).send();
    let code = |code: &str| server.post("/pair").json(&json!({ "code": code })).send();

    // Wrong keys and wrong codes at once: each waits its second.
    let started = Instant::now();
    let wrong = tokio::join!(
        key("ura_wrong"),
        key(""),
        server.post("/session").body("not json").send(),
        code("AAAA-AAAA-AAAA"),
        server.post("/pair").json(&json!({})).send(),
    );
    let waited = started.elapsed();

    let (wrong_key, .., wrong_code, _) = &wrong;
    let not_the_key = json!({ "error": "This is not Uraeda's access key." });
    assert_eq!(wrong_key.json(), not_the_key);
    let not_a_code = "This pairing code is not valid: run `ura pair` again for a new one.";
    assert_eq!(wrong_code.json(), json!({ "error": not_a_code }));
    for answer in [&wrong.0, &wrong.1, &wrong.2, &wrong.3, &wrong.4] {
        assert_eq!(answer.status, 401);
        assert_eq!(answer.header("set-cookie"), None);
        assert_eq!(answer.header("cache-control"), Some("no-store"));
    }
    assert!(waited >= Duration::from_secs(1), "waited {waited:?}");

    // Never locked out: after them, the right key signs in, and the right code pairs, at once.
    let pairing = server.pairing_code().await;
    let started = Instant::now();
    let (right_key, right_code) = tokio::join!(key(server.key()), code(&pairing));
    assert_eq!((right_key.status, right_code.status), (204, 200));
    assert!(started.elapsed() < Duration::from_secs(1));

    // A body over 4 KB is refused before any key is checked, and waits for nothing.
    let started = Instant::now();
    let large = key(&format!("ura_{}", "a".repeat(5 * 1024))).await;
    assert_eq!(large.status, 413);
    assert_eq!(large.header("set-cookie"), None);
    assert!(started.elapsed() < Duration::from_secs(1));
}

#[tokio::test]
async fn the_key_signs_a_browser_in_until_it_signs_out() {
    let server = support::setup()
        .env("URAEDA_ALLOWED_HOSTS", TAILNET)
        .start()
        .await;
    // As pasted: with a blank and a line break around it.
    let key = json!({ "key": format!(" {}\n", server.key()) });
    let sign_in = |host: &str| server.post("/session").header("host", host).json(&key);
    let session = |cookie: &str| server.get("/session").cookie(cookie);

    // The cookie is `Secure` and `__Host-` behind the owner's HTTPS host name, and plain on the
    // machine itself. It lives 30 days from when it is set, whatever the device's clock says.
    let secure = sign_in(TAILNET).send().await;
    let plain = sign_in(&server.host()).send().await;
    assert_eq!((secure.status, plain.status), (204, 204));
    let attributes = |answer: &TestResponse| {
        let set = answer.header("set-cookie").unwrap().to_owned();
        let (cookie, attributes) = set.split_once(';').unwrap();
        let (name, value) = cookie.split_once('=').unwrap();
        let (id, secret) = value.split_once('.').unwrap();
        assert!(random(id, 16) && random(secret, 32), "{set}");
        (name.to_owned(), attributes.to_owned())
    };
    let lasting = " Max-Age=2592000; Path=/; HttpOnly";
    let expected = (
        "__Host-uraeda".to_owned(),
        format!("{lasting}; Secure; SameSite=Lax"),
    );
    assert_eq!(attributes(&secure), expected);
    let expected = ("uraeda".to_owned(), format!("{lasting}; SameSite=Lax"));
    assert_eq!(attributes(&plain), expected);
    // Each name is read on its own kind of host only.
    let (secure, plain) = (secure.cookie().unwrap(), plain.cookie().unwrap());
    assert_eq!(session(&plain).send().await.status, 204);
    assert_eq!(
        session(&secure).header("host", TAILNET).send().await.status,
        204
    );
    assert!(asks_to_sign_in(&session(&secure).send().await));

    // A session used for the first time in a day sets its cookie again, for 30 more days.
    server.clock().advance(DAY + MINUTE);
    let refreshed = session(&plain).send().await;
    server.clock().advance(HOUR);
    let again = session(&plain).send().await;
    let set = format!("{plain};{lasting}; SameSite=Lax");
    assert_eq!(refreshed.header("set-cookie"), Some(set.as_str()));
    assert_eq!((again.status, again.header("set-cookie")), (204, None));

    // Signing in again replaces the browser's session: the old cookie is refused, and cleared.
    let replaced = sign_in(&server.host()).cookie(&plain).send().await;
    let cookie = replaced.cookie().unwrap();
    let old = session(&plain).send().await;
    assert!(asks_to_sign_in(&old));
    assert_eq!(old.header("set-cookie"), Some(CLEARED));
    assert_eq!(session(&cookie).send().await.status, 204);

    // Signing out ends the session, and the connection it opened.
    let mut live = server.browser_socket(&cookie).await;
    live.hello().await;
    let out = server.request("DELETE", "/session").cookie(&cookie);
    let out = out.send().await;
    assert_eq!((out.status, out.header("set-cookie")), (204, Some(CLEARED)));
    assert_eq!(out.header("cache-control"), Some("no-store"));
    live.closed().await;
    assert!(asks_to_sign_in(&session(&cookie).send().await));

    // Signing out everywhere ends every session and every device.
    let (laptop, tablet) = (server.sign_in().await, server.sign_in().await);
    let phone = server.pair("Phone").await;
    let everywhere = server.request("DELETE", "/sessions").cookie(&laptop);
    let everywhere = everywhere.send().await;
    assert_eq!(everywhere.status, 204);
    assert_eq!(everywhere.header("set-cookie"), Some(CLEARED));
    for cookie in [&laptop, &tablet] {
        assert_eq!(signed_in(&server, Some(cookie), None).await, 401);
    }
    assert_eq!(signed_in(&server, None, Some(&phone)).await, 401);
}

// The sign-in decision: a session ends after 30 days without use.
#[tokio::test]
async fn a_sign_in_ends_after_30_days_without_use() {
    let server = support::server().await;
    let ended = Arc::new(Mutex::new(Vec::new()));
    let heard = ended.clone();
    sign_in::on_ended(server.shared(), move |id| {
        heard.lock().unwrap().push(id.to_owned())
    });
    let used = server.sign_in().await;
    let boundary = server.sign_in().await;
    let unused = server.sign_in().await;
    let device = server.pair("Phone").await;

    server.clock().advance(29 * DAY);
    assert_eq!(signed_in(&server, Some(&used), None).await, 204);
    // Exactly 30 days after its last use: not over yet.
    server.clock().advance(DAY);
    assert_eq!(signed_in(&server, Some(&boundary), None).await, 204);
    server.clock().advance(MINUTE);
    assert_eq!(signed_in(&server, Some(&unused), None).await, 401);
    assert_eq!(signed_in(&server, None, Some(&device)).await, 401);
    assert_eq!(signed_in(&server, Some(&used), None).await, 204);
    // Whatever ends with a session, as the frame secret, heard of each that ended.
    let id = |sign_in: &str| {
        let value = sign_in.split_once('=').map_or(sign_in, |(_, value)| value);
        value.split_once('.').unwrap().0.to_owned()
    };
    assert_eq!(*ended.lock().unwrap(), [id(&unused), id(&device)]);

    // The sweep ends what nobody uses, and never what is connected: an open connection is a
    // use.
    let idle = server.sign_in().await;
    let connected = server.pair("Desktop").await;
    let mut open = server.socket().await;
    open.sign_in(SignIn::Token(connected.clone()));
    open.hello().await;
    server.clock().advance(31 * DAY);

    sign_in::sweep(server.shared());

    assert_eq!(signed_in(&server, Some(&idle), None).await, 401);
    assert_eq!(signed_in(&server, None, Some(&connected)).await, 204);
    assert_eq!(devices::list(server.shared()).devices.len(), 1);
}

// The host's own `ura` and app sign a browser in without the key, as `POST /open` answers a link.
#[tokio::test]
async fn a_one_time_link_signs_in_once_and_never_leaves_the_server() {
    let server = support::server().await;
    // A repository's page, whose name holds a blank: the link carries its path as its `to`.
    let link = sign_in::link(server.shared(), "/r/todo%20app/");
    let (path, to) = link.split_once("?to=").unwrap();
    assert!(
        random(path.strip_prefix("/session/").unwrap(), 32),
        "{link}"
    );
    assert_eq!(to, "/r/todo%2520app/");

    let first = server.get(&link).send().await;
    let second = server.get(&link).send().await;
    let late = sign_in::link(server.shared(), "/r/todo%20app/");
    server.clock().advance(5 * MINUTE + Duration::from_secs(1));
    let expired = server.get(&late).send().await;

    let cookie = first.cookie().expect("the link signs in");
    assert!(cookie.starts_with("uraeda="), "{cookie}");
    assert_eq!(signed_in(&server, Some(&cookie), None).await, 204);
    for answer in [&first, &second, &expired] {
        assert_eq!(answer.status, 303);
        assert_eq!(answer.header("location"), Some("/r/todo%20app/"));
        assert_eq!(answer.header("cache-control"), Some("no-store"));
    }
    assert_eq!((second.cookie(), expired.cookie()), (None, None));

    // A link leads to a path of the server, or to its root: never to another site.
    let elsewhere = [
        "//evil.com",
        "https://evil.com",
        r"/\evil.com",
        "/\t/evil.com",
        "evil.com",
    ];
    for to in elsewhere {
        let link = sign_in::link(server.shared(), to);
        let unknown = format!("/session/unknown?to={}", link.split_once("?to=").unwrap().1);
        for path in [link, unknown] {
            let answer = server.get(&path).send().await;
            assert_eq!(answer.header("location"), Some("/"), "{to:?}");
        }
    }

    // The host's own start asks for one with its folder, and anyone else gets none.
    let open = server.post("/open").bearer(&server.host_token());
    let opened = open.json(&json!({ "signIn": true })).send().await.json();
    let link = opened["signIn"].as_str().expect("a link");
    assert_eq!(link.split_once("?to=").unwrap().1, "/");
    let signed = server.get(link).send().await;
    assert_eq!(signed.header("location"), Some("/"));
    assert!(signed.cookie().is_some());
    let plain = server.post("/open").bearer(&server.host_token());
    assert_eq!(
        plain.json(&json!({})).send().await.json().get("signIn"),
        None
    );
}

// The sign-in decision's consequence: a lost key is replaced from the host's shell, which signs
// every device out.
#[tokio::test]
async fn a_new_key_from_the_host_ends_every_sign_in() {
    let server = support::server().await;
    let cookie = server.sign_in().await;
    let token = server.pair("Phone").await;
    let mut live = server.socket().await;
    live.sign_in(SignIn::Token(token.clone()));
    live.hello().await;

    let answer = server.post("/session/key").bearer(&server.host_token());
    let answer = answer.send().await;

    assert_eq!(answer.status, 200);
    assert_eq!(answer.header("cache-control"), Some("no-store"));
    let key = answer.json()["key"].as_str().unwrap().to_owned();
    assert!(random(key.strip_prefix("ura_").unwrap(), 32), "{key}");
    live.closed().await;
    assert_eq!(signed_in(&server, Some(&cookie), None).await, 401);
    assert_eq!(signed_in(&server, None, Some(&token)).await, 401);
    let sign_in = |key: &str| server.post("/session").json(&json!({ "key": key })).send();
    let (old, new) = tokio::join!(sign_in(server.key()), sign_in(&key));
    assert_eq!((old.status, new.status), (401, 204));
}

// The sign-in decision: the key, the sessions, and each device's token are stored only as hashes.
#[tokio::test]
async fn the_sign_in_file_holds_only_hashes() {
    let server = support::server().await;
    let path = server.data_dir().join("sign-in.json");
    let cookie = server.sign_in().await;
    let token = server.pair("Phone").await;
    let session = cookie.strip_prefix("uraeda=").unwrap().split_once('.');
    let (session, session_secret) = session.unwrap();
    let (device, device_secret) = token.split_once('.').unwrap();

    let text = fs::read_to_string(&path).unwrap();

    let file: Value = serde_json::from_str(&text).unwrap();
    let stored = json!({
        "version": 1,
        "key": hashed(server.key()),
        "sessions": [{
            "id": session,
            "secret": hashed(session_secret),
            "created": START,
            "used": START,
        }],
        "devices": [{
            "id": device,
            "name": "Phone",
            "secret": hashed(device_secret),
            "created": START,
            "used": START,
        }],
    });
    assert_eq!(file, stored);
    let key = server.key().strip_prefix("ura_").unwrap();
    for secret in [key, session_secret, device_secret] {
        assert!(!text.contains(secret), "the file holds a secret");
    }
    let mode = fs::metadata(&path).unwrap().permissions().mode();
    assert_eq!(mode & 0o777, 0o600);

    // A start that is not the first shows no key, and keeps every sign-in.
    let options = server.options();
    let server = server.restart().await;
    assert_eq!(sign_in::first_key(server.shared()), None);
    assert_eq!(signed_in(&server, Some(&cookie), None).await, 204);
    assert_eq!(signed_in(&server, None, Some(&token)).await, 204);

    // A file this version cannot read stops the start, and is left as it is.
    let session = |date: &str| json!({ "id": "i", "secret": "s", "created": date, "used": START });
    let unreadable = [
        "{ version: 1".to_owned(),
        json!({ "version": 2, "key": "k", "sessions": [] }).to_string(),
        json!({ "version": 1, "sessions": [] }).to_string(),
        json!({ "version": 1, "key": "k", "sessions": [session("never")] }).to_string(),
    ];
    for content in unreadable {
        let folder = tempfile::TempDir::new().unwrap();
        let path = folder.path().join("sign-in.json");
        fs::write(&path, &content).unwrap();
        let mut options = options.clone();
        options.data_dir = folder.path().to_owned();

        let Err(NotStarted::Failed(problem)) = Server::start(options).await else {
            panic!("the server started on {content}");
        };

        let start = format!("cannot read {}: ", path.display());
        let end = ". Fix it, or delete it to make a new access key and sign every device out.";
        assert!(
            problem.starts_with(&start) && problem.ends_with(end),
            "{problem}"
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), content);
    }
}

/// Fails to compile when a type implements a trait: the call names one implementation of
/// `Unless` only while the type has no implementation of the trait.
macro_rules! never_implements {
    ($type:ty: $trait:path) => {{
        trait Unless<Marker> {
            fn holds() {}
        }
        impl<T: ?Sized> Unless<()> for T {}
        struct Implemented;
        impl<T: ?Sized + $trait> Unless<Implemented> for T {}
        <$type as Unless<_>>::holds();
    }};
}

// The break it catches: a key, a session's secret, or a device's token compared with `==`, whose
// time tells a guesser how much of a guess was right. What sign-in stores is a `Hashed`, which has
// no `==` to compare it with: `Hashed::is`, over `secret::same`, is the one way. Given a `==` of
// its own, this test no longer compiles.
#[test]
fn a_stored_secret_is_compared_in_constant_time_only() {
    never_implements!(Hashed: PartialEq);
    never_implements!(Hashed: PartialEq<str>);
    never_implements!(Hashed: PartialEq<String>);
    never_implements!(Hashed: std::hash::Hash);
    never_implements!(Hashed: PartialOrd);
    never_implements!(Hashed: AsRef<str>);
    never_implements!(Hashed: std::fmt::Display);

    let stored = Hashed::of("the-secret");

    assert!(stored.is("the-secret"));
    assert!(!stored.is("the-secreT") && !stored.is(""));
    assert!(!stored.is(&hashed("the-secret")));
    assert_eq!(json!(stored), json!(hashed("the-secret")));
}
