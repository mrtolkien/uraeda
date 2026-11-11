//! Extension pages in the app: each page of `fixtures/extensions/` built and signed as the server
//! does it, served by a stand-in of the server's routes, and shown by the app's own
//! `ExtensionPlace` (`app/extensions/__checks__/place.tsx`) in `uraeda.extension`, on GTK. The
//! app's side runs over stand-ins of the client store, which say what the page asked of them.
//!
//! Each test runs in a GTK window of its own, on a hidden display of its own: NSH's headless
//! runner draws no native component.
#![cfg(target_os = "linux")]

#[allow(
    dead_code,
    reason = "the outside checks' pages: this file builds the app's only"
)]
#[path = "outside/pages.rs"]
mod checks;
#[path = "outside/display.rs"]
mod display;
#[path = "extensions/pages.rs"]
mod pages;
#[path = "extensions/served.rs"]
mod served;
#[allow(
    dead_code,
    reason = "the outside checks' window: this file uses part of it"
)]
#[path = "outside/stage.rs"]
mod stage;

use std::fs;
use std::sync::mpsc::Receiver;

use display::on_hidden_display;
use nsh_platform_linux::{AppOptions, Bundle};
use pages::{Signer, fixture};
use serde_json::{Value, json};
use served::{Served, TOKEN};
use stage::{Stage, wait_for};

/// The app, showing one place of each extension named, side by side.
struct App {
    stage: Stage,
    ready: Receiver<Value>,
    called: Receiver<Value>,
    problems: Receiver<Value>,
}

impl App {
    fn open(names: &[&str], served: &Served) -> App {
        // As the runner `nsh` generates for the app: its module beside NSH's, and its components.
        nsh_platform_linux::set_ui_sets(vec![nsh_base::registry(), uraeda_app::registry()]);
        nsh_platform_linux::set_components(uraeda_app::__nsh_native_components_linux);
        let stage = Stage::open(AppOptions::default());
        let (ready, called) = (stage.posts("ready"), stage.posts("called"));
        let problems = stage.posts("problem");
        let params = json!({
            "names": names,
            "probe": served.probe(),
            "server": served.address,
            "token": TOKEN,
            "version": 1,
        });
        let Value::Object(params) = params else {
            unreachable!("an object")
        };
        stage.view.host().set_params(params);
        let page = checks::of_the_app("../extensions/__checks__/place.tsx");
        let rights = Some(r#"{ "host": ["ready", "called", "problem"] }"#);
        stage.load(
            Bundle::source(page)
                .with_capabilities_json(rights)
                .expect("rights"),
        );
        App {
            stage,
            ready,
            called,
            problems,
        }
    }

    /// Shows the page's version `version`, as the record `Extensions` gives it.
    fn version(&self, version: u64) {
        let sent = self.stage.view.host().send("version", json!(version));
        sent.expect("the version is sent");
    }

    /// The next page drawn: the extension's name, and what its page declared.
    fn next_ready(&self) -> (String, Value) {
        let ready = wait_for("a page is drawn", 30, || self.ready.try_recv().ok());
        let name = ready["name"].as_str().expect("a name").to_owned();
        (name, ready["declarations"].clone())
    }

    /// The first call of the store the app makes for a page that `passes`, the calls before it
    /// passed over.
    fn called(&self, what: &str, passes: impl Fn(&Value) -> bool) -> Value {
        wait_for(what, 30, || self.called.try_recv().ok().filter(&passes))
    }

    /// The problem the app reported of the extension `name`'s page.
    fn reported(&self, name: &str) -> String {
        let report = self.called(&format!("{name}'s problem is reported"), |call| {
            call["name"] == "extensions.reportPageProblem" && call["input"]["name"] == name
        });
        report["input"]["message"]
            .as_str()
            .expect("a message")
            .to_owned()
    }
}

/// The fixture pages, signed under one server's key, which the stand-in serves at build 1.
fn served(names: &[&str]) -> (Signer, Served) {
    let signer = Signer::made();
    let served = Served::start(signer.key());
    for name in names {
        served.page(name, signer.page(&fixture(name), name, 1));
    }
    (signer, served)
}

/// The title of the first place a page declared.
fn place_title(declarations: &Value) -> &str {
    declarations["places"][0]["title"]
        .as_str()
        .unwrap_or_default()
}

// The spec's US3: a saved page shows without a restart, drawn with the app's components in the
// app's theme.
#[test]
fn a_saved_page_shows_without_a_restart() {
    on_hidden_display("a_saved_page_shows_without_a_restart", || {
        let (signer, served) = served(&["counter"]);
        let app = App::open(&["counter"], &served);
        let (name, declared) = app.next_ready();
        assert_eq!(
            (name.as_str(), place_title(&declared)),
            ("counter", "Counter")
        );
        // Its block is drawn in the colour of examples of the app's theme, the light one, which
        // the page's own tokens would draw otherwise.
        let example = |red, green, blue| (red, green, blue) == (0x11, 0x6a, 0x6f);
        wait_for("the page draws in the app's theme", 30, || {
            let drawn = app
                .stage
                .nodes()
                .map(|_| app.stage.picture().count(example));
            drawn.filter(|pixels| *pixels > 5000)
        });

        // The owner saves the page: the server builds it again, a new version, and the record
        // `Extensions` says so, which the app hands the place.
        let saved = tempfile::tempdir().expect("a folder");
        let page = fs::read_to_string(fixture("counter").join("page.tsx")).expect("the page");
        let page = page.replace("title: \"Counter\"", "title: \"Counter, saved\"");
        fs::write(saved.path().join("page.tsx"), page).expect("the saved page");
        served.page("counter", signer.page(saved.path(), "counter", 2));
        app.version(2);
        let (_, declared) = app.next_ready();
        assert_eq!(place_title(&declared), "Counter, saved");

        // The server's data folder is made again, with a new key: the app trusts it alone, and
        // its builds, though they start again.
        let again = Signer::made();
        served.key(again.key());
        served.page("counter", again.page(&fixture("counter"), "counter", 3));
        app.version(3);
        assert_eq!(place_title(&app.next_ready().1), "Counter");
        served.page("counter", signer.page(saved.path(), "counter", 4));
        app.version(4);
        let untrusted = |problem: &Value| problem["problem"]["kind"] == "untrusted";
        wait_for("a page under the old key is refused", 30, || {
            app.problems.try_recv().ok().filter(untrusted)
        });
        assert!(
            app.ready.try_recv().is_err(),
            "the page refused is never drawn"
        );
    });
}

#[test]
fn a_page_that_throws_at_load_is_named_and_the_app_goes_on() {
    on_hidden_display(
        "a_page_that_throws_at_load_is_named_and_the_app_goes_on",
        || {
            let (_, served) = served(&["crashes", "counter"]);
            let app = App::open(&["crashes", "counter"], &served);
            let said = app.reported("crashes");
            assert!(
                said.starts_with("The page of crashes failed as it loaded: "),
                "{said}"
            );
            assert!(said.ends_with("Error: broken at load"), "{said}");
            // The page beside it loads and draws: the app went on.
            assert_eq!(app.next_ready().0, "counter");
        },
    );
}

#[test]
fn a_page_that_never_stops_is_cut_off_and_named() {
    on_hidden_display("a_page_that_never_stops_is_cut_off_and_named", || {
        let (_, served) = served(&["loops", "counter"]);
        let app = App::open(&["loops", "counter"], &served);
        let said = app.reported("loops");
        assert!(
            said.starts_with("The page of loops held the app: "),
            "{said}"
        );
        assert_eq!(app.next_ready().0, "counter");
    });
}

// A page reaches the app only through its host's functions: its own extension's records and
// actions, never another's, and nothing of the machine.
#[test]
fn a_page_reads_a_record_and_calls_an_action_of_its_extension() {
    on_hidden_display(
        "a_page_reads_a_record_and_calls_an_action_of_its_extension",
        || {
            let (_, served) = served(&["counter"]);
            let app = App::open(&["counter"], &served);
            let act = |action: &'static str| {
                move |call: &Value| {
                    call["name"] == "extensions.act" && call["input"]["name"] == action
                }
            };
            let read = app.called("the page reads its record", |call| call["read"] == true);
            let own = json!({ "extension": "counter", "name": "count", "repo": "todo-app" });
            assert_eq!(read["args"], own);
            let added = app.called("the page calls its action", act("add"));
            let input = json!({ "extension": "counter", "input": { "seen": 3 }, "name": "add", "repo": "todo-app" });
            assert_eq!(added["input"], input);
            // The action's output reaches the page, which says what it got, and how what it has
            // no right to was refused: a host function not granted, and the network.
            let done = app.called("the page got the action's output", act("done"));
            let got = &done["input"]["input"];
            assert_eq!(got["got"], 4);
            assert_eq!(got["outside"], "ERR_ACCESS_DENIED");
            assert_ne!(got["fetched"], "allowed");
            assert_eq!(served.probes(), 0, "the page reached the network");
        },
    );
}
