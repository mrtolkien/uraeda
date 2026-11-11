//! Extension pages, through the real server: each test's server builds the page of the fixture
//! extension `hello`, of `fixtures/pages/`, from a temporary config folder, signs it, and
//! serves it.
//!
//! A client runs what the server signs, so the costly rules to lose are here: a page is
//! verified with the key the server serves, as a client verifies it, with NSH's own
//! verification; a build's number only grows; a build that fails keeps the last package; the
//! key that signs stays in the data folder; and a page is built from its own folder only.

mod support;

use std::fs;
use std::os::unix::fs::PermissionsExt as _;
use std::path::Path;

use base64::Engine as _;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use nsh_package::{Error, PublicKey, SecretKey, TrustStore, VerifiedPackage};
use serde_json::{Value, json};
use support::{Held, Setup, TestResponse, TestServer, fixture, fixture_repo};

/// The extension every test's server builds the page of.
const NAME: &str = "hello";

/// The repository every test's server lists.
const REPO: &str = "todo-app";

/// A start with the fixture extension in its config folder, and the stand-ins of
/// `fixtures/pages/modules/` for the modules of the app a page gets built in.
fn with_page(setup: Setup) -> Setup {
    let modules = fixture("pages/modules");
    let setup = setup.env("URAEDA_PAGE_MODULES", &modules.to_string_lossy());
    copied(
        setup,
        &fixture("pages").join(NAME),
        &format!("extensions/{NAME}"),
    )
}

/// Copies a fixture folder's files into the config folder, folder by folder.
fn copied(mut setup: Setup, from: &Path, to: &str) -> Setup {
    for entry in fs::read_dir(from).expect("a fixture's folder") {
        let entry = entry.expect("a fixture's file");
        let name = entry.file_name().into_string().expect("a name");
        let target = format!("{to}/{name}");
        setup = match entry.path().is_dir() {
            true => copied(setup, &entry.path(), &target),
            false => setup.config(&target, &fs::read_to_string(entry.path()).unwrap()),
        };
    }
    setup
}

/// Writes a file of the extension, as its owner saves it.
fn save(server: &TestServer, file: &str, text: &str) {
    let path = server.config_dir().join("extensions").join(NAME).join(file);
    fs::write(path, text).expect("a saved file");
}

/// The extension's row of a value of `Extensions`.
fn row(extensions: &Value) -> &Value {
    let rows = extensions["extensions"].as_array().expect("rows");
    let found = rows.iter().find(|row| row["name"] == NAME);
    found.unwrap_or(&Value::Null)
}

/// The record `Extensions`, held, as a client holds it to know when a page changed.
async fn extensions(server: &TestServer) -> Held {
    Held::open(server, "Extensions", json!({ "repo": null })).await
}

/// Waits until the extension's row passes: the row.
async fn until(held: &mut Held, what: &str, passes: impl Fn(&Value) -> bool) -> Value {
    let reached = held.until(what, |all| passes(row(all))).await;
    row(reached).clone()
}

/// Waits for a version of the page after `after`: the version.
async fn version_after(held: &mut Held, after: u64) -> u64 {
    let newer = |row: &Value| row["pageVersion"].as_u64().is_some_and(|now| now > after);
    let row = until(held, &format!("a page after version {after}"), newer).await;
    row["pageVersion"].as_u64().expect("a version")
}

/// A signed-in client of the pages' routes, with the trust a client keeps: the key the server
/// gave it, and the builds it ran.
struct Client<'a> {
    server: &'a TestServer,
    cookie: String,
    trust: TrustStore,
}

impl<'a> Client<'a> {
    /// Signs in, and trusts the key the server serves, and no other.
    async fn of(server: &'a TestServer) -> Client<'a> {
        let cookie = server.sign_in().await;
        let mut client = Client {
            server,
            cookie,
            trust: TrustStore::new(),
        };
        let key = client.get("/extensions/key").await;
        assert_eq!(key.status, 200, "{}", key.text());
        let key = PublicKey::from_base64(&key.text()).expect("the served key is a public key");
        client.trust.add_root(key);
        client
    }

    async fn get(&self, path: &str) -> TestResponse {
        self.server.get(path).cookie(&self.cookie).send().await
    }

    /// The page's package, as served: its version, and its bytes.
    async fn fetch(&self) -> (u64, Vec<u8>) {
        let answer = self.get(&format!("/extensions/{NAME}/page")).await;
        assert_eq!(answer.status, 200, "{}", answer.text());
        let version = answer.header("x-uraeda-page-version").expect("a version");
        (version.parse().expect("a number"), answer.body)
    }

    /// Verifies a package as a client does before it runs it, with NSH's own verification.
    fn verify(&self, package: &[u8]) -> Result<VerifiedPackage, Error> {
        self.trust.verify(package, "")
    }

    /// Fetches the page, verifies it, and keeps its build as run: older ones are refused from
    /// now on.
    async fn load(&mut self) -> VerifiedPackage {
        let (version, bytes) = self.fetch().await;
        let package = self.verify(&bytes).expect("the served page verifies");
        assert_eq!(package.app.build, version, "the build is the version");
        self.trust.accept(&package).expect("the build is kept");
        package
    }
}

// The plan's first test, and the spec's US3: a client runs a page only when it is signed under
// the key the server gave it, and loads it again when its version changes.
#[tokio::test]
async fn a_saved_page_gets_a_new_version_and_a_valid_signature() {
    let server = with_page(support::setup()).start().await;
    let mut held = extensions(&server).await;
    let first = version_after(&mut held, 0).await;
    let mut client = Client::of(&server).await;

    // The page verifies with the served key, and is the extension's, at the record's version.
    let (served, bytes) = client.fetch().await;
    assert_eq!(served, first);
    let package = client.load().await;
    assert_eq!(package.app.id, "dev.uraeda.extension.hello");
    assert_eq!(package.app.name, "Hello");
    assert_eq!(package.app.version, "0.1.0");
    // Its rights are the host's functions of the page API, and nothing of the machine.
    let rights = json!({ "host": ["start", "record", "call", "navigate"] });
    assert_eq!(package.capabilities, Some(rights));
    assert!(package.assets.is_empty() && package.bytecode().is_none());

    // The page's first statement posts `start`, before any of its code: ruling R23.
    let source = &package.source;
    let start = source.find("host.post(\"start\")").expect(source);
    let own = source.find("Hello from a page").expect(source);
    assert!(start < own, "{source}");
    // The app's modules are built in, and only NSH's stay imports, which the engine serves.
    assert!(source.contains("a stand-in badge"), "{source}");
    let imports = source.lines().filter(|line| line.contains(" from \""));
    for import in imports {
        let native = ["\"nsh\"", "\"nsh:rt\"", "\"nsh/base\""];
        assert!(native.iter().any(|name| import.contains(name)), "{import}");
    }

    // Anything else is refused: the same bytes signed by no one, or changed by one byte.
    let mut unsigned = bytes.clone();
    let signature = unsigned.len() - 64;
    unsigned[signature..].fill(0);
    assert_eq!(client.verify(&unsigned).unwrap_err(), Error::BadSignature);
    let mut changed = bytes.clone();
    changed[signature - 1] ^= 1;
    assert_eq!(client.verify(&changed).unwrap_err(), Error::BadSignature);

    // A client that holds the version is told so, and gets no bytes.
    let page = format!("/extensions/{NAME}/page");
    let held_version = server.get(&page).cookie(&client.cookie);
    let same = held_version
        .header("if-none-match", &format!("\"{first}\""))
        .send()
        .await;
    assert_eq!((same.status, same.body.len()), (304, 0));

    // A save builds it again: a new version in the record, and a new package that verifies.
    save(
        &server,
        "lib/greeting.ts",
        "export const greeting = \"Saved\";\n",
    );
    let second = version_after(&mut held, first).await;
    let saved = client.load().await;
    assert_eq!(saved.app.build, second);
    assert!(saved.source.contains("Saved"), "{}", saved.source);
    // The page before it is refused from then on: why a build's number only grows.
    let rollback = client.verify(&bytes).unwrap_err();
    assert!(matches!(rollback, Error::Rollback { .. }), "{rollback}");

    // No one gets a page or the key without a sign-in.
    for path in [page.as_str(), "/extensions/key"] {
        assert_eq!(server.get(path).send().await.status, 401, "{path}");
    }
    server.stop().await;
}

// The plan's second test: a page that does not build never replaces one that runs.
#[tokio::test]
async fn a_page_that_does_not_compile_keeps_the_last_one_and_says_why() {
    let server = with_page(support::setup()).start().await;
    let mut held = extensions(&server).await;
    let first = version_after(&mut held, 0).await;
    let mut client = Client::of(&server).await;
    let running = client.load().await;

    // A save that does not compile: the problem is said, where it is, and the page stays.
    let good = fs::read_to_string(fixture("pages/hello/page.tsx")).unwrap();
    save(&server, "page.tsx", "export const broken = ;\n");
    let broken = |row: &Value| row["problems"] != json!([]);
    let row = until(&mut held, "the page's problem", broken).await;
    assert_eq!(row["pageVersion"], first, "{row}");
    assert_eq!(row["problems"][0]["file"], "page.tsx", "{row}");
    let message = row["problems"][0]["message"].as_str().expect("a message");
    assert!(message.starts_with("page.tsx\n"), "{message}");
    assert!(message.contains("broken = ;"), "{message}");
    let (version, bytes) = client.fetch().await;
    assert_eq!(version, first);
    assert_eq!(
        client.verify(&bytes).expect("it verifies").source,
        running.source
    );

    // An import that is no file of the page says so too, and still keeps the page.
    save(&server, "page.tsx", "import \"./lib/missing\";\n");
    let missing = |row: &Value| {
        let message = row["problems"][0]["message"].as_str();
        message.is_some_and(|message| message.contains("./lib/missing"))
    };
    let row = until(&mut held, "the missing import's problem", missing).await;
    assert_eq!(row["pageVersion"], first, "{row}");
    // Its files are named from the extension's folder, not from where the server built it.
    let message = row["problems"][0]["message"].as_str().expect("a message");
    let config = server.config_dir().to_string_lossy().into_owned();
    assert!(
        !message.contains("../") && !message.contains(&config),
        "{message}"
    );

    // The fix builds a new version, and the problem goes.
    save(&server, "page.tsx", &good.replace("a page", "a fixed page"));
    let second = version_after(&mut held, first).await;
    let row = until(&mut held, "no problem", |row| row["problems"] == json!([])).await;
    assert_eq!(row["pageVersion"], second);
    assert!(client.load().await.source.contains("a fixed page"));
    server.stop().await;
}

// What tasks 26 to 34 build on: `uraeda/ui` and `uraeda/page` are built into a page from the
// server's modules folder, `extensions/modules/` of the data folder, laid out as `app/` is.
#[tokio::test]
async fn a_page_gets_the_apps_modules_from_the_data_folder() {
    let setup = copied(
        support::setup(),
        &fixture("pages").join(NAME),
        &format!("extensions/{NAME}"),
    );
    let server = setup.start().await;
    let mut held = extensions(&server).await;

    // A server that holds no such module yet says so, and builds no page.
    let unheld = |row: &Value| row["problems"] != json!([]);
    let row = until(&mut held, "the unheld module's problem", unheld).await;
    let message = row["problems"][0]["message"].as_str().expect("a message");
    let expected = "cannot be imported: this server holds no such module yet";
    assert!(
        message.starts_with("uraeda/") && message.ends_with(expected),
        "{message}"
    );
    assert_eq!(row["pageVersion"], Value::Null, "{row}");

    // With `ui/index.ts` and `extensions/page.tsx` there, the next save builds the page.
    let modules = server.data_dir().join("extensions/modules");
    for file in ["ui/index.ts", "ui/Badge.tsx", "extensions/page.tsx"] {
        let to = modules.join(file);
        fs::create_dir_all(to.parent().unwrap()).unwrap();
        fs::copy(fixture("pages/modules").join(file), to).unwrap();
    }
    save(
        &server,
        "lib/greeting.ts",
        "export const greeting = \"Saved\";\n",
    );
    version_after(&mut held, 0).await;
    let client = Client::of(&server).await;
    let (_, bytes) = client.fetch().await;
    let source = client.verify(&bytes).expect("it verifies").source;
    assert!(source.contains("a stand-in badge"), "{source}");
    server.stop().await;
}

// The extensions decision: an extension loads only from the config folder. A page is built
// from its extension's folder, and no file elsewhere, whatever its files say.
#[tokio::test]
async fn a_page_is_built_from_its_extensions_folder_only() {
    let page = "import { greeting } from \"../outside\";\nconsole.log(greeting);\n";
    let outside = "export const greeting = \"from outside the folder\";\n";
    let setup = with_page(support::setup())
        .config("extensions/outside.ts", outside)
        .config(&format!("extensions/{NAME}/page.tsx"), page);
    let server = setup.start().await;
    let mut held = extensions(&server).await;

    // A file beside the extension's folder: no page is built, and the problem names the file.
    let refused = |row: &Value| row["problems"] != json!([]);
    let row = until(&mut held, "the outside import's problem", refused).await;
    let message = row["problems"][0]["message"].as_str().expect("a message");
    assert!(
        message.contains("outside the extension's folder"),
        "{message}"
    );
    assert_eq!(row["pageVersion"], Value::Null, "{row}");
    let client = Client::of(&server).await;
    let none = client.get(&format!("/extensions/{NAME}/page")).await;
    assert_eq!(
        (none.status, none.text().as_str()),
        (404, "hello has no page")
    );

    // The same file through a link of the folder is refused the same.
    let folder = server.config_dir().join("extensions").join(NAME);
    let link = folder.join("lib/linked.ts");
    std::os::unix::fs::symlink(server.config_dir().join("extensions/outside.ts"), link).unwrap();
    let linked = "import { greeting } from \"./lib/linked\";\nconsole.log(greeting);\n";
    save(&server, "page.tsx", linked);
    let through = |row: &Value| {
        let message = row["problems"][0]["message"].as_str();
        message.is_some_and(|message| message.contains("outside.ts is outside"))
    };
    let row = until(&mut held, "the link's problem", through).await;
    assert_eq!(row["pageVersion"], Value::Null, "{row}");

    // The extension's own `nsh.json` does not say where a module is: the server's does.
    let evil = server.config_dir().join("extensions/evil.ts");
    fs::write(&evil, "export const Badge = \"from outside the folder\";\n").unwrap();
    let alias = json!({ "resolve": { "alias": { "uraeda/ui": evil } } });
    save(&server, "nsh.json", &alias.to_string());
    save(
        &server,
        "page.tsx",
        &fs::read_to_string(fixture("pages/hello/page.tsx")).unwrap(),
    );
    version_after(&mut held, 0).await;
    let (_, bytes) = client.fetch().await;
    let source = client.verify(&bytes).expect("it verifies").source;
    assert!(source.contains("a stand-in badge"), "{source}");
    assert!(!source.contains("from outside the folder"), "{source}");
    server.stop().await;
}

// Ruling R22: a client refuses a build older than one it ran, so a restart, which builds every
// page again, must number it after every build before it.
#[tokio::test]
async fn a_build_number_never_goes_back_across_a_restart() {
    let server = with_page(support::setup()).start().await;
    let mut held = extensions(&server).await;
    let first = version_after(&mut held, 0).await;
    save(
        &server,
        "lib/greeting.ts",
        "export const greeting = \"Saved\";\n",
    );
    let second = version_after(&mut held, first).await;
    let mut client = Client::of(&server).await;
    let before = client.load().await;
    assert_eq!(before.app.build, second);
    let key = client.get("/extensions/key").await.text();
    let trust = client.trust;
    drop(held);

    let server = server.restart().await;
    let mut held = extensions(&server).await;
    let third = version_after(&mut held, 0).await;
    assert!(third > second, "{third} after {second}");
    // The same key signs, so the client that ran the build before the restart runs this one.
    let cookie = server.sign_in().await;
    let mut client = Client {
        server: &server,
        cookie,
        trust,
    };
    assert_eq!(client.get("/extensions/key").await.text(), key);
    let after = client.load().await;
    assert_eq!(after.app.build, third);
    assert_eq!(after.source, before.source);
    server.stop().await;
}

/// The forms a key's 32 bytes are written in.
fn forms(key: &[u8]) -> Vec<Vec<u8>> {
    let hex: String = key.iter().map(|byte| format!("{byte:02x}")).collect();
    let texts = [STANDARD.encode(key), URL_SAFE_NO_PAD.encode(key), hex];
    let texts = texts.into_iter().map(String::into_bytes);
    std::iter::once(key.to_vec()).chain(texts).collect()
}

/// Whether an answer holds the key, in any of its forms, in its body or a header.
fn holds(answer: &[u8], forms: &[Vec<u8>]) -> bool {
    let within = |form: &Vec<u8>| answer.windows(form.len()).any(|window| window == form);
    forms.iter().any(within)
}

/// A route's path with something in each of its parts, the fixture's names where they fit.
fn concrete(route: &str) -> String {
    let parts = route.split('/').map(|part| match part {
        "{name}" if route.starts_with("/r/") => REPO,
        "{name}" | "{extension}" => NAME,
        part if part.starts_with('{') => "x",
        part => part,
    });
    parts.collect::<Vec<&str>>().join("/")
}

// The plan's third test: the key that signs is what a client's trust rests on, so nothing the
// server answers holds it. Only its public half is served.
#[tokio::test]
async fn the_signing_key_never_leaves_the_data_folder() {
    let repo = fixture_repo(REPO);
    let server = with_page(support::setup().folder(repo.path()))
        .start()
        .await;
    let mut held = extensions(&server).await;
    version_after(&mut held, 0).await;

    // The key is a file of the data folder, which only its owner reads.
    let file = server.data_dir().join("extensions/signing.key");
    let mode = fs::metadata(&file)
        .expect("the key's file")
        .permissions()
        .mode();
    assert_eq!(mode & 0o777, 0o600);
    let folder = fs::metadata(file.parent().unwrap()).unwrap().permissions();
    assert_eq!(folder.mode() & 0o777, 0o700);
    let written = fs::read_to_string(&file).unwrap();
    let key = SecretKey::from_base64(&written).expect("a key");
    let forms = forms(&STANDARD.decode(written.trim()).unwrap());

    // What is served is its public half, and it signed the page.
    let client = Client::of(&server).await;
    let served = client.get("/extensions/key").await.text();
    assert_eq!(served, key.public().to_base64());
    let (_, package) = client.fetch().await;
    client.verify(&package).expect("the page verifies under it");

    // No route answers it: every route, asked by a signed-in client, and by the host. The
    // host's new access key is left out: it would sign this client out, and the rest would
    // answer nothing.
    let host = server.host_token();
    for route in server.routes() {
        let path = concrete(route);
        for method in ["GET", "POST"] {
            if (method, route) == ("POST", "/session/key") {
                continue;
            }
            let asked = server.request(method, &path).json(&json!({}));
            let answers = [
                asked.cookie(&client.cookie).send().await,
                server.request(method, &path).bearer(&host).send().await,
            ];
            for answer in answers {
                let headers = format!("{:?}", answer.headers);
                assert!(
                    !holds(&answer.body, &forms),
                    "{method} {route} answers the key"
                );
                assert!(
                    !holds(headers.as_bytes(), &forms),
                    "{method} {route}: a header"
                );
            }
        }
    }
    // The walk was a signed-in client's to its end: the routes answered it what they hold.
    assert_eq!(client.get("/extensions/key").await.status, 200);

    // No record holds it: every record of the protocol, asked for the repository, for none,
    // and with no argument. One that refuses says why, and that is read too.
    let catalog = uraeda_protocol::catalog();
    let records: Vec<&str> = catalog.records().collect();
    assert!(records.contains(&"Extensions"), "{records:?}");
    for record in records {
        for args in [json!({ "repo": REPO }), json!({ "repo": null }), json!({})] {
            let answer = match Held::asked(&server, record, args).await {
                Ok(held) => held.value.to_string(),
                Err((_, message)) => message,
            };
            assert!(!holds(answer.as_bytes(), &forms), "{record} holds the key");
        }
    }

    // Nor does a file outside the data folder: the config folder, where the extensions are.
    let mut folders = vec![server.config_dir().to_owned()];
    while let Some(folder) = folders.pop() {
        for entry in fs::read_dir(folder).unwrap() {
            let path = entry.unwrap().path();
            match path.is_dir() {
                true => folders.push(path),
                false => assert!(!holds(&fs::read(&path).unwrap(), &forms), "{path:?}"),
            }
        }
    }
    server.stop().await;
}
