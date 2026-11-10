//! The files a client reads and sends as bytes: a repository's raw files, mockups, and images,
//! the chat's images of the data folder, and the uploads.

mod support;

use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::PathBuf;

use serde_json::{Value, json};
use support::{TestRepo, TestResponse, TestServer};
use uraeda_core::api;

/// A single proposal file, on the default branch.
const PROPOSAL: &str = "specs/proposals/login-banner.md";
/// What the file outside the repository holds, which no answer may carry.
const SECRET: &str = "the secret outside the repository";

/// A server whose list holds one repository, `todo-app`, and a signed-in browser.
struct Served {
    server: TestServer,
    repo: TestRepo,
    cookie: String,
}

impl Served {
    /// A `GET` of a path under the repository's prefix, signed in.
    async fn get(&self, path: &str) -> TestResponse {
        self.request("GET", path).send().await
    }

    /// A request of a path under the repository's prefix, signed in.
    fn request(&self, method: &str, path: &str) -> support::TestRequest {
        let path = format!("/r/todo-app{path}");
        self.server.request(method, &path).cookie(&self.cookie)
    }

    /// Posts a multipart body to a path under the repository's prefix, signed in.
    async fn upload(&self, path: &str, parts: &[Part<'_>]) -> TestResponse {
        let (kind, body) = multipart(parts);
        let request = self.request("POST", path).header("content-type", &kind);
        request.body(body).send().await
    }
}

/// A repository with `specs/`, a document, and a proposal file, listed by a started server.
async fn served() -> Served {
    let repo = TestRepo::named("todo-app");
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n");
    repo.write("specs/INBOX.md", "# Inbox\n\n## UI\n\n- A first note\n");
    repo.write(PROPOSAL, "# Login banner\n\nA banner.\n");
    repo.write("docs/guide.md", "# Guide\n");
    repo.commit("chore: specs");
    let server = support::setup().folder(repo.path()).start().await;
    let cookie = server.sign_in().await;
    Served {
        server,
        repo,
        cookie,
    }
}

/// An image of the fixtures.
fn image(name: &str) -> Vec<u8> {
    let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/images");
    fs::read(fixtures.join(name)).expect("a fixture image")
}

/// A part of a multipart body: a field's text, or a file of the field `file`, with its name.
enum Part<'a> {
    Text(&'a str, &'a str),
    File(&'a str, &'a [u8]),
}

/// A multipart body, as a browser's form sends it: its content type, and its bytes.
fn multipart(parts: &[Part]) -> (String, Vec<u8>) {
    let boundary = "----uraeda-test-boundary";
    let mut body = Vec::new();
    for part in parts {
        body.extend(format!("--{boundary}\r\n").bytes());
        match part {
            Part::Text(name, text) => {
                let head = format!("Content-Disposition: form-data; name=\"{name}\"\r\n\r\n");
                body.extend(head.bytes());
                body.extend(text.bytes());
            }
            Part::File(name, bytes) => {
                let head = format!(
                    "Content-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\n\
                     Content-Type: application/octet-stream\r\n\r\n"
                );
                body.extend(head.bytes());
                body.extend(*bytes);
            }
        }
        body.extend(b"\r\n");
    }
    body.extend(format!("--{boundary}--\r\n").bytes());
    (format!("multipart/form-data; boundary={boundary}"), body)
}

/// The refusal an upload was answered: 400, with `{ error }`.
fn refusal(answer: &TestResponse) -> String {
    assert_eq!(answer.status, 400, "{}", answer.text());
    answer.json()["error"]
        .as_str()
        .expect("an error")
        .to_owned()
}

// The security of the raw route: nothing outside the repository, hidden, or behind a link is
// served, however the path is written.
#[tokio::test]
async fn a_raw_path_cannot_leave_its_repository() {
    let served = served().await;
    let outside = served.repo.parent().join("secret.txt");
    fs::write(&outside, SECRET).unwrap();
    // Committed links: to a file outside, and to the folder that holds it.
    symlink(&outside, served.repo.path().join("link.txt")).unwrap();
    symlink(served.repo.parent(), served.repo.path().join("linked")).unwrap();
    served.repo.commit("chore: links");
    let absolute = outside.to_str().unwrap();
    let encoded = absolute.replace('/', "%2F");

    let rows = [
        ("..", "../secret.txt".to_owned()),
        ("..", "docs/../../secret.txt".to_owned()),
        ("an absolute path", absolute.to_owned()),
        ("an absolute path", encoded),
        ("an encoded %2e%2e", "%2e%2e/secret.txt".to_owned()),
        ("an encoded %2e%2e", "%2E%2E%2Fsecret.txt".to_owned()),
        (
            "an encoded %2e%2e",
            "docs%2F..%2F..%2Fsecret.txt".to_owned(),
        ),
        ("a symlink pointing outside", "link.txt".to_owned()),
        ("a symlink pointing outside", "linked/secret.txt".to_owned()),
        ("a path into .git", ".git/config".to_owned()),
        ("a path into .git", "docs/../.git/HEAD".to_owned()),
    ];
    // Every row is asked, so a failure names each way out that is open.
    let mut served_rows = Vec::new();
    for (row, path) in rows {
        let answer = served.get(&format!("/raw/{path}")).await;
        if (answer.status, answer.text().as_str()) != (404, "Not found") {
            served_rows.push(format!("{row}: {path} answered {}", answer.status));
        }
    }
    assert!(served_rows.is_empty(), "{served_rows:#?}");

    // A tracked file of the repository is served, as text.
    let guide = served.get("/raw/docs/guide.md").await;
    assert_eq!(guide.status, 200);
    assert_eq!(guide.text(), "# Guide\n");
    assert_eq!(
        guide.header("content-type"),
        Some("text/plain; charset=utf-8")
    );
}

// The routes are a repository's: a name the list does not hold, or whose folder is gone, has
// none, so the core never looks for a repository above a missing folder.
#[tokio::test]
async fn a_repository_that_is_not_listed_or_is_gone_serves_no_file() {
    let served = served().await;
    let unknown = served.server.get("/r/missing/raw/docs/guide.md");
    let unknown = unknown.cookie(&served.cookie).send().await;
    assert_eq!(unknown.status, 404);
    assert_eq!(unknown.text(), "No repository named “missing”");

    let gone = served.repo.parent().join("gone");
    fs::rename(served.repo.path(), &gone).unwrap();
    for path in ["/raw/docs/guide.md", "/images/specs/x.webp"] {
        let answer = served.get(path).await;
        assert_eq!(answer.status, 404, "{path}");
        assert!(answer.text().contains(" is no longer at "), "{path}");
    }
    let upload = served
        .upload(
            "/attach?chat=1",
            &[Part::File("a.png", &image("phone.png"))],
        )
        .await;
    assert_eq!(upload.status, 404);
}

// The preview decision: a mockup is an HTML page of a `mockups/` folder. It is served sandboxed,
// so its scripts run outside Uraeda's origin, and nothing else of the repository is served so.
#[tokio::test]
async fn a_mockup_is_served_sandboxed_and_only_from_a_mockups_folder() {
    let served = served().await;
    let folder = "specs/2026-10-11-web-ui";
    let repo = &served.repo;
    repo.write(&format!("{folder}/mockups/ui.html"), "<p>UI</p>");
    repo.write(&format!("{folder}/mockups/assets/ui.css"), "p {}");
    repo.write(&format!("{folder}/page.html"), "<p>Page</p>");
    repo.commit("chore: mockups");

    let page = served
        .get(&format!("/mockups/{folder}/mockups/ui.html"))
        .await;
    assert_eq!(page.status, 200);
    assert_eq!(page.text(), "<p>UI</p>");
    assert_eq!(
        page.header("content-security-policy"),
        Some("sandbox allow-scripts")
    );
    assert_eq!(page.header("referrer-policy"), Some("no-referrer"));
    assert_eq!(
        page.header("content-type"),
        Some("text/html; charset=utf-8")
    );
    let style = served
        .get(&format!("/mockups/{folder}/mockups/assets/ui.css"))
        .await;
    assert_eq!(
        style.header("content-type"),
        Some("text/css; charset=utf-8")
    );

    for path in [
        "specs/PRIORITIES.md".to_owned(),
        format!("{folder}/page.html"),
        format!("{folder}/mockups"),
        format!("{folder}/mockups/..%2F..%2FPRIORITIES.md"),
        "specs%2F2026-10-11-web-ui%2Fmockups%2F..%2F..%2FPRIORITIES.md".to_owned(),
        "mockups/..%2Fspecs%2FPRIORITIES.md".to_owned(),
        format!("{folder}/mockups/missing.html"),
    ] {
        let answer = served.get(&format!("/mockups/{path}")).await;
        assert_eq!(answer.status, 404, "{path}");
    }
}

// The attachments decision: an image attached to a workflow file is committed beside it, as one
// small WebP, and served so that a browser cannot run it as a page.
#[tokio::test]
async fn an_upload_comes_back_as_the_image_it_was() {
    let served = served().await;
    let query = format!("/attach?name=desktop.png&path={PROPOSAL}");
    let upload = [Part::File("desktop.png", &image("desktop.png"))];

    let attached = served.upload(&query, &upload).await;

    assert_eq!(attached.status, 200, "{}", attached.text());
    let attached = attached.json();
    // The single proposal file became a folder, which holds the image.
    let path = "specs/proposals/login-banner/images/desktop.webp";
    assert_eq!(attached["path"], path);
    assert_eq!(attached["link"], "![desktop](images/desktop.webp)");
    assert_eq!(
        attached["moved"],
        "specs/proposals/login-banner/proposal.md"
    );
    // The change the write made, which an undo takes back: its files' two sides, in base64.
    let files = attached["change"]["files"].as_array().expect("files");
    let written = files.iter().find(|file| file["path"] == path);
    let written = written.expect("the image is a file of the change");
    assert_eq!(written["before"], Value::Null);
    assert!(written["after"].is_string());
    assert!(attached["change"]["commit"].is_string());

    let read = served.get(&format!("/images/{path}")).await;
    assert_eq!(read.status, 200);
    assert_eq!(read.body, fs::read(served.repo.path().join(path)).unwrap());
    assert_eq!(&read.body[8..12], b"WEBP");
    assert_eq!(read.header("content-type"), Some("image/webp"));
    assert_eq!(read.header("x-content-type-options"), Some("nosniff"));
    assert_eq!(
        read.header("content-security-policy"),
        Some("default-src 'none'")
    );
    assert_eq!(
        read.header("cross-origin-resource-policy"),
        Some("same-origin")
    );
    // A path may get another image later: never cached.
    assert_eq!(read.header("cache-control"), None);
}

// The attachments decision: images attached to a chat stay out of git, in the data folder,
// private to their owner. An id is never given to another image, so its answer is cached.
#[tokio::test]
async fn a_chat_image_is_kept_in_the_data_folder_until_it_is_deleted() {
    let served = served().await;
    let upload = [Part::File("desktop.png", &image("desktop.png"))];

    let saved = served
        .upload("/attach?chat=1&name=desktop.png", &upload)
        .await;

    assert_eq!(saved.status, 200, "{}", saved.text());
    let saved = saved.json();
    assert_eq!(
        (&saved["width"], &saved["height"]),
        (&json!(1440), &json!(900))
    );
    let id = saved["id"].as_str().expect("an id");
    let (uuid, extension) = id.split_once('.').expect("an id with its extension");
    assert_eq!((uuid.len(), extension), (36, "webp"), "{id}");
    let folder = served.server.data_dir().join("images");
    let names = fs::read_dir(&folder).unwrap();
    let names: Vec<_> = names.map(|entry| entry.unwrap().file_name()).collect();
    assert_eq!(names, [id]);
    let mode = |path: &std::path::Path| fs::metadata(path).unwrap().permissions().mode() & 0o777;
    assert_eq!((mode(&folder), mode(&folder.join(id))), (0o700, 0o600));
    assert_eq!(served.repo.porcelain(), "");

    let path = format!("/chat-images/{id}");
    let read = served.get(&path).await;
    assert_eq!(read.status, 200);
    assert_eq!(&read.body[8..12], b"WEBP");
    assert_eq!(read.header("content-type"), Some("image/webp"));
    assert_eq!(read.header("x-content-type-options"), Some("nosniff"));
    assert_eq!(
        read.header("content-security-policy"),
        Some("default-src 'none'")
    );
    assert_eq!(
        read.header("cross-origin-resource-policy"),
        Some("same-origin")
    );
    assert_eq!(
        read.header("cache-control"),
        Some("private, max-age=31536000, immutable")
    );

    let removed = served.request("DELETE", &path).send().await;
    assert_eq!(removed.status, 204);
    assert_eq!(fs::read_dir(&folder).unwrap().count(), 0);
    assert_eq!(served.get(&path).await.status, 404);
}

// The chat images' ids are the only names read in the data folder, which also holds the sign-in
// file and the sessions.
#[tokio::test]
async fn a_chat_image_is_read_and_deleted_by_its_id_only() {
    let served = served().await;
    let data = served.server.data_dir();
    fs::create_dir_all(data.join("images")).unwrap();
    fs::write(data.join("images/notes.txt"), "kept").unwrap();

    for id in ["..%2Fsign-in.json", "missing.webp", "notes.txt", "x"] {
        let path = format!("/chat-images/{id}");
        assert_eq!(served.get(&path).await.status, 404, "{id}");
        let removed = served.request("DELETE", &path).send().await;
        assert_eq!(removed.status, 404, "{id}");
    }
    assert!(data.join("sign-in.json").exists());
    assert!(data.join("images/notes.txt").exists());
}

// The attachments decision: the server serves attached images, and committed SVGs, so that a
// browser cannot run them as a page, and nothing that is not an image under `specs/`.
#[tokio::test]
async fn the_image_route_serves_images_under_specs_only() {
    let served = served().await;
    let folder = "specs/2026-10-11-web-ui";
    let script = r#"<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>"#;
    served
        .repo
        .write(&format!("{folder}/mockups/banner.svg"), script);
    // HTML named as a PNG: refused by its first bytes.
    served.repo.write(
        &format!("{folder}/images/page.png"),
        "<html><script></script>",
    );
    served
        .repo
        .write_bytes("fixtures/images/desktop.png", &image("desktop.png"));
    served.repo.commit("chore: images");

    let drawing = served
        .get(&format!("/images/{folder}/mockups/banner.svg"))
        .await;
    assert_eq!(drawing.status, 200);
    assert_eq!(drawing.header("content-type"), Some("image/svg+xml"));
    assert_eq!(drawing.header("x-content-type-options"), Some("nosniff"));
    // Its own styles draw it, opened alone; no script runs, and it loads nothing.
    assert_eq!(
        drawing.header("content-security-policy"),
        Some("default-src 'none'; style-src 'unsafe-inline'; sandbox")
    );

    for path in [
        PROPOSAL.to_owned(),
        format!("{folder}/images/page.png"),
        "..%2F..%2Fetc%2Fpasswd".to_owned(),
        "specs/..%2F..%2Fetc%2Fpasswd".to_owned(),
        "fixtures/images/desktop.png".to_owned(),
    ] {
        let answer = served.get(&format!("/images/{path}")).await;
        assert_eq!(answer.status, 404, "{path}");
    }
}

// The uploads' contract with the UI: a refusal is 400 with `{ error }`, the core's text with its
// code, and a refused upload writes nothing.
#[tokio::test]
async fn a_refused_upload_says_why_and_writes_nothing() {
    let served = served().await;
    let png = image("desktop.png");
    let svg = image("drawing.svg");
    let to_proposal = format!("/attach?name=drawing.svg&path={PROPOSAL}");
    let both = format!("/attach?chat=1&name=desktop.png&path={PROPOSAL}");
    let named = format!("/attach?name=desktop.png&path={PROPOSAL}");

    let rows: [(&str, &[Part], &str); 5] = [
        (
            &to_proposal,
            &[Part::File("drawing.svg", &svg)],
            "refused: Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one.",
        ),
        (
            "/attach?chat=1&name=drawing.svg",
            &[Part::File("drawing.svg", &svg)],
            "refused: Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one.",
        ),
        (
            &both,
            &[Part::File("desktop.png", &png)],
            "refused: Give either a path or chat=1.",
        ),
        (
            "/attach?name=desktop.png",
            &[Part::File("desktop.png", &png)],
            "refused: Give either a path or chat=1.",
        ),
        (
            &named,
            &[Part::Text("text", "not an image")],
            "refused: The body holds no file.",
        ),
    ];
    for (query, parts, error) in rows {
        let answer = served.upload(query, parts).await;
        assert_eq!(refusal(&answer), error, "{query}");
    }

    assert_eq!(served.repo.porcelain(), "");
    assert!(!served.server.data_dir().join("images").exists());
}

// A body over the limit is refused by its declared size, with the core's text, naming the file
// from the query string: the server never reads 20 MB to refuse them.
#[tokio::test]
async fn an_upload_over_the_limit_is_refused_without_reading_it() {
    let served = served().await;
    // 22 MiB and one byte: rounded up, as the core rounds.
    let size = 22 * 1024 * 1024 + 1;
    let head = format!(
        "POST /r/todo-app/attach?name=huge.png&path={PROPOSAL} HTTP/1.1\r\n\
         host: {}\r\ncookie: {}\r\ncontent-length: {size}\r\n\
         content-type: multipart/form-data; boundary=x\r\n\r\n",
        served.server.host(),
        served.cookie,
    );
    let port = served.server.port();

    // The head alone is sent: a server that read the body before answering would never answer.
    let answer = tokio::task::spawn_blocking(move || {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        let patience = std::time::Duration::from_secs(10);
        stream.set_read_timeout(Some(patience)).unwrap();
        stream.write_all(head.as_bytes()).unwrap();
        let mut answer = Vec::new();
        let mut buffer = [0; 4096];
        while !answer.ends_with(b"}") {
            match stream.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(read) => answer.extend(&buffer[..read]),
            }
        }
        String::from_utf8(answer).unwrap()
    });
    let answer = answer.await.unwrap();

    assert!(answer.starts_with("HTTP/1.1 400 "), "{answer}");
    let body = answer.split("\r\n\r\n").nth(1).expect("a body");
    let body: Value = serde_json::from_str(body).expect("JSON");
    let error = "refused: This image is over 20 MB: huge.png is 22.1 MB.";
    assert_eq!(body, json!({ "error": error }));
}

// The inbox's contract with the add form: a note and its images are written in one call, all or
// nothing, and the answer names the note file and the change an undo takes back.
#[tokio::test]
async fn a_note_with_images_is_written_as_a_note_file() {
    let served = served().await;
    let hash = api::read_inbox(served.repo.path()).unwrap().hash;
    let phone = image("phone.png");
    let parts = [
        Part::Text("hash", &hash),
        Part::Text("text", "Headings are flat"),
        Part::Text("category", "UI"),
        Part::File("phone.png", &phone),
        Part::File("phone.png", &phone),
    ];

    let added = served
        .upload("/inbox/note-image?name=first.png&name=second.png", &parts)
        .await;

    assert_eq!(added.status, 200, "{}", added.text());
    let added = added.json();
    let file = "specs/notes/headings-are-flat/note.md";
    assert_eq!(added["file"], file);
    let note = served.repo.read(file);
    assert!(note.contains("![first](images/first.webp)"), "{note}");
    assert!(note.contains("![second](images/second.webp)"), "{note}");
    let files = added["change"]["files"].as_array().expect("files");
    let paths: Vec<_> = files.iter().map(|file| &file["path"]).collect();
    assert!(paths.contains(&&json!(file)), "{paths:?}");
    let image = served
        .get("/images/specs/notes/headings-are-flat/images/first.webp")
        .await;
    assert_eq!(image.header("content-type"), Some("image/webp"));

    // The note's own images: added to the note file it has, over the inbox as read now.
    let inbox = api::read_inbox(served.repo.path()).unwrap();
    let notes = inbox.categories.iter().flat_map(|category| &category.notes);
    let id = &notes.clone().find(|note| note.file.is_some()).unwrap().id;
    let parts = [
        Part::Text("hash", &inbox.hash),
        Part::Text("id", id),
        Part::File("phone.png", &phone),
    ];
    let attached = served
        .upload("/inbox/note-image?name=third.png", &parts)
        .await;
    assert_eq!(attached.status, 200, "{}", attached.text());
    assert!(
        served
            .repo
            .read(file)
            .contains("![third](images/third.webp)")
    );

    // What the form must give, and the core's own refusal of an inbox that changed since.
    let incomplete: [&[Part]; 3] = [
        &[Part::Text("text", "A note"), Part::File("a.png", &phone)],
        &[Part::Text("hash", &hash), Part::Text("text", "A note")],
        &[
            Part::Text("hash", &hash),
            Part::Text("text", "A note"),
            Part::Text("id", id),
            Part::File("a.png", &phone),
        ],
    ];
    for parts in incomplete {
        let answer = served.upload("/inbox/note-image", parts).await;
        let error = "refused: Give a hash, a file, and a text or a note id.";
        assert_eq!(refusal(&answer), error);
    }
    let stale = [
        Part::Text("hash", "stale"),
        Part::Text("text", "Another note"),
        Part::File("a.png", &phone),
    ];
    let stale = served.upload("/inbox/note-image", &stale).await;
    assert!(refusal(&stale).starts_with("conflict: "), "{stale:?}");
    assert!(!served.repo.exists("specs/notes/another-note"));
}
