//! What the migration assumes of Native Shell and of the Linux desktop, which the spikes did not
//! verify: each test runs the real library in a GTK window, on a display no screen shows. A test
//! that fails after an upgrade of NSH names an assumption that no longer holds: the rulings R22 to
//! R26 of `specs/2026-11-10-nsh-migration/rulings.md`, and R156 for the fonts, say what was built
//! on each, and R21 how the tests run.
//!
//! Each test's body runs in a process of its own, which `display.rs` starts: GTK keeps the thread
//! that started it, and a check's clicks and keys go to its own display.
#![cfg(target_os = "linux")]

#[path = "outside/diagram.rs"]
mod diagram;
#[path = "outside/display.rs"]
mod display;
#[path = "outside/errors.rs"]
mod errors;
#[path = "outside/fonts.rs"]
mod fonts;
#[path = "outside/notify.rs"]
mod notify;
#[path = "outside/pages.rs"]
mod pages;
#[path = "outside/signing.rs"]
mod signing;
#[path = "outside/stage.rs"]
mod stage;
#[path = "outside/web.rs"]
mod web;

use display::on_hidden_display;
use nsh_package::Error;
use nsh_platform_linux::gtk4::gio;
use nsh_platform_linux::{AppOptions, AssetBase, Bundle, Limits};
use serde_json::{Value, json};
use signing::Keys;
use stage::{Stage, wait_for};

/// Check 1. The server signs an extension's page, and a client that trusts the server's key runs
/// it in a view of its own. The same page signed by no one, or by someone else, is refused, and
/// so is a build older than the one that ran.
#[test]
fn a_signed_package_loads_in_an_embedded_view_and_any_other_is_refused() {
    on_hidden_display(
        "a_signed_package_loads_in_an_embedded_view_and_any_other_is_refused",
        || {
            let keys = Keys::made();
            let source = pages::compiled("signed.tsx");
            let package = keys.package(source.clone(), 2);
            let mut trust = keys.trust();
            let version = nsh_engine::BYTECODE_VERSION;

            let unsigned = signing::unsigned(&package);
            assert_eq!(
                trust.verify(&unsigned, version).err(),
                Some(Error::BadSignature)
            );
            let theirs = Keys::made().sign_again(&package);
            assert!(
                matches!(trust.verify(&theirs, version), Err(Error::UntrustedKey(_))),
                "a package signed under another root is refused"
            );

            let assets = tempfile::tempdir().expect("a temporary folder");
            let loaded = nsh_engine::load_package(&mut trust, &package, assets.path())
                .expect("the server's package is trusted");
            let stage = Stage::open(AppOptions::default());
            let ready = stage.posts("ready");
            stage.load(loaded.bundle);
            let said = wait_for("the signed page tells its host it runs", 30, || {
                ready.try_recv().ok()
            });
            assert_eq!(said, json!({ "page": "signed" }));

            // Loading a package records its build: the same build loads again, an older one not.
            assert!(trust.verify(&package, version).is_ok());
            let older = keys.package(source, 1);
            assert!(
                matches!(trust.verify(&older, version), Err(Error::Rollback { .. })),
                "a build older than the one that ran is refused"
            );
        },
    );
}

/// Check 2. A page that breaks is reported to its host, with what broke, and the host knows
/// which page: NSH's GTK view has no error callback, so the report is the engine's log.
#[test]
fn a_broken_page_is_reported_to_its_host() {
    on_hidden_display("a_broken_page_is_reported_to_its_host", || {
        let reports = errors::listen();
        let page = |name: &str| {
            Bundle::source(pages::compiled(name))
                .with_capabilities_json(Some(r#"{ "host": ["start", "alive"] }"#))
                .expect("the page's capabilities")
        };
        let next = |what: &str| wait_for(what, 30, || reports.try_recv().ok());

        // Two pages at once, each in a view of its own: a report belongs to one of them.
        let broken = Stage::open(AppOptions::default());
        let running = Stage::open(AppOptions {
            limits: Limits {
                memory_bytes: 64 << 20,
                ..Limits::default()
            },
            ..AppOptions::default()
        });
        let (broken_engine, running_engine) = (broken.engines(), running.engines());
        let alive = running.posts("alive");
        running.load(page("breaks.tsx"));
        let running_engine = wait_for("the running page starts", 30, || {
            running_engine.try_recv().ok()
        });
        broken.load(page("throws.tsx"));
        let broken_engine = wait_for("the broken page starts", 30, || {
            broken_engine.try_recv().ok()
        });

        let report = next("a throw at load is reported");
        assert_eq!(report.engine, broken_engine);
        assert!(
            report
                .text
                .starts_with("bundle failed: Error: broken at load"),
            "{report:?}"
        );

        running.send("throw");
        let report = next("a throw in a callback is reported");
        assert_eq!(report.engine, running_engine);
        assert!(
            report
                .text
                .starts_with("uncaught exception: Error: broken in a callback"),
            "{report:?}"
        );

        running.send("loop");
        let report = next("a call that never ends is cut off, and reported");
        assert_eq!(report.engine, running_engine);
        assert!(
            report
                .text
                .starts_with("uncaught exception: the script was interrupted"),
            "{report:?}"
        );

        // The page goes on after both, until it runs out of memory: its engine then stops.
        running.send("ping");
        wait_for("the page still answers", 30, || alive.try_recv().ok());
        running.send("grow");
        let report = next("a page out of memory is stopped, and reported");
        assert_eq!(report.engine, running_engine);
        assert!(
            report
                .text
                .starts_with("uncaught exception: the script ran out of memory"),
            "{report:?}"
        );
        let report = next("an engine that stops says so, once");
        assert_eq!(report.engine, running_engine);
        assert!(report.text.starts_with("stopped: "), "{report:?}");
    });
}

/// A local page with a field: it says when it shows, when its field takes the focus, and each key
/// and each text it gets.
const LOCAL_PAGE: &str = r#"<!doctype html>
<title>A local page</title>
<body style="margin: 0; background: rgb(200, 0, 0)">
<input id="field" style="margin: 250px 300px; width: 200px; height: 100px">
<script>
  const say = (text) => window.nsh.postMessage(text);
  addEventListener("keydown", (event) => say("key:" + event.key));
  field.addEventListener("focus", () => say("focus"));
  field.addEventListener("input", () => say("text:" + field.value));
  say("shown");
</script>
"#;

/// Check 3. A web view shows a page served on loopback, as a preview is, and the page gets the
/// keys pressed on it.
#[test]
fn a_web_view_shows_a_local_page_and_gets_keys() {
    on_hidden_display("a_web_view_shows_a_local_page_and_gets_keys", || {
        let stage = Stage::open(AppOptions::default());
        let (loaded, failed) = (stage.posts("loaded"), stage.posts("failed"));
        let messages = stage.posts("message");
        let address = web::serve(LOCAL_PAGE);
        let mut params = serde_json::Map::new();
        params.insert("src".to_owned(), json!(address));
        stage.view.host().set_params(params);
        let capabilities = r#"{
            "host": ["loaded", "failed", "message"],
            "webview": { "hosts": ["127.0.0.1"] }
        }"#;
        stage.load(
            Bundle::source(pages::compiled("webview.tsx"))
                .with_capabilities_json(Some(capabilities))
                .expect("the page's capabilities"),
        );
        let next = |what: &str| {
            wait_for(what, 30, || {
                assert_eq!(failed.try_recv().ok(), None, "the web view failed");
                messages.try_recv().ok()
            })
        };

        assert_eq!(next("the page's script runs"), json!("shown"));
        let shown = wait_for("the page loads", 30, || loaded.try_recv().ok());
        assert_eq!(shown, json!(address));
        wait_for("the page is drawn", 30, || {
            let red = stage
                .picture()
                .count(|red, green, blue| (red, green, blue) == (200, 0, 0));
            (red > 100_000).then_some(())
        });

        // A click in the field, which is in the middle of the window, then two keys.
        web::input(&["mousemove", "400", "300", "click", "1"]);
        assert_eq!(next("the click reaches the field"), json!("focus"));
        web::input(&["key", "h", "key", "i"]);
        assert_eq!(next("the page gets the first key"), json!("key:h"));
        assert_eq!(next("the field takes it"), json!("text:h"));
        assert_eq!(next("the page gets the second key"), json!("key:i"));
        assert_eq!(next("the field takes it"), json!("text:hi"));
    });
}

/// A diagram with boxes, arrows, and text, in colours no other part of the window has: blue text
/// and green arrows on orange boxes. Their edges blend with what is under them, so a pixel counts
/// by the colour that leads in it.
const DIAGRAM: &str = "flowchart LR\n  A[Proposal] --> B{Questions?}\n  B -- Yes --> C[Round]";
const THEME: diagram::Theme<'static> = &[
    ("primaryTextColor", "#0000ff"),
    ("lineColor", "#00a000"),
    ("primaryColor", "#ffdca0"),
];
fn is_text(red: u8, green: u8, blue: u8) -> bool {
    blue > 150 && red < 120 && green < 120
}
fn is_arrow(red: u8, green: u8, blue: u8) -> bool {
    green > 120 && red < 100 && blue < 100
}
fn is_box(red: u8, green: u8, blue: u8) -> bool {
    (red, green, blue) == (255, 220, 160)
}

/// Check 4. Rust draws a Mermaid diagram with Merman, with no browser and no JavaScript, and NSH
/// shows it, its boxes, its arrows, and its text, once `usvg` has made its text shapes.
#[test]
fn a_diagram_is_drawn_without_a_browser() {
    on_hidden_display("a_diagram_is_drawn_without_a_browser", || {
        let stage = Stage::open(AppOptions::default());
        let (drawn, shown) = (stage.posts("drawn"), stage.posts("shown"));
        let failed = stage.posts("failed");
        let fonts = diagram::fonts();
        stage.answers("picture", move |source| {
            let source = source.as_str().ok_or("a diagram's source is a text")?;
            let picture = diagram::picture(source, THEME, &fonts)?;
            Ok(json!({ "height": picture.height, "src": picture.src, "width": picture.width }))
        });
        let mut params = serde_json::Map::new();
        params.insert("source".to_owned(), json!(DIAGRAM));
        stage.view.host().set_params(params);
        stage.load(
            Bundle::source(pages::compiled("diagram.tsx"))
                .with_capabilities_json(Some(
                    r#"{ "host": ["drawn", "picture", "shown", "failed"] }"#,
                ))
                .expect("the page's capabilities"),
        );
        let next = |what: &str, posts: &std::sync::mpsc::Receiver<Value>| {
            wait_for(what, 30, || {
                assert_eq!(failed.try_recv().ok(), None, "the diagram failed");
                posts.try_recv().ok()
            })
        };

        let size = next("Rust draws the diagram", &drawn);
        assert!(size["width"].as_f64() > Some(200.0), "{size}");
        next("NSH shows the picture", &shown);
        let picture = wait_for("GTK draws the diagram", 30, || {
            let picture = stage.picture();
            (picture.count(is_box) > 0).then_some(picture)
        });
        assert!(picture.count(is_box) > 5000, "the boxes are filled");
        assert!(picture.count(is_arrow) > 50, "the arrows are drawn");
        assert!(picture.count(is_text) > 300, "the text is drawn");
    });
}

/// Check 5. The app sends a notification to the desktop's notification service, over the session
/// bus, and hears the click on it. The service here is the test's, on the hidden display's bus.
#[test]
fn a_system_notification_is_sent_and_its_click_comes_back() {
    on_hidden_display(
        "a_system_notification_is_sent_and_its_click_comes_back",
        || {
            let shown = notify::serve();
            let bus = gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE)
                .expect("the session bus");
            let (_subscription, clicked) = notify::clicks(&bus);
            let (sender, sent) = std::sync::mpsc::channel();
            notify::send(
                &bus,
                "Recurring tasks needs you",
                "1 question, about 3 minutes.",
                move |id| {
                    let _ = sender.send(id);
                },
            );

            let shown = wait_for("the desktop gets the notification", 10, || {
                shown.try_recv().ok()
            });
            assert_eq!(
                shown,
                notify::Shown {
                    app: "Uraeda".to_owned(),
                    summary: "Recurring tasks needs you".to_owned(),
                    body: "1 question, about 3 minutes.".to_owned(),
                    actions: vec!["default".to_owned(), "Open".to_owned()],
                    desktop_entry: Some("dev.uraeda.app".to_owned()),
                }
            );
            let id = wait_for("the app gets the notification's id", 10, || {
                sent.try_recv().ok()
            });
            let clicked = wait_for("the app hears the click", 10, || clicked.try_recv().ok());
            assert_eq!(clicked, id);
        },
    );
}

/// Check 6. Each part of the UI is drawn in the font the app bundles for it, read from the app's
/// own files: the display's fonts hold none of them. A font the app does not register, or a token
/// naming a family the app does not bundle, is drawn in another font, and fails here.
#[test]
fn the_bundled_fonts_are_the_ones_drawn() {
    on_hidden_display("the_bundled_fonts_are_the_ones_drawn", || {
        // As the runner `nsh` generates for the app: the app's module, with its fonts, beside
        // Native Shell's own, and the app's files where a package holds them.
        nsh_platform_linux::set_ui_sets(vec![nsh_base::registry(), uraeda_app::registry()]);
        let shipped = fonts::shipped();
        let stage = Stage::open(AppOptions {
            asset_base: Some(AssetBase::Directory(shipped.path().to_owned())),
            ..AppOptions::default()
        });
        let named = stage.posts("named");
        stage.load(
            Bundle::source(pages::of_the_app("fonts.tsx"))
                .with_capabilities_json(Some(r#"{ "host": ["named"] }"#))
                .expect("the page's capabilities"),
        );
        let named = wait_for("the page names its fonts", 30, || named.try_recv().ok());
        // Each line's name, and the family it names first: the one to draw it.
        let lines: Vec<(String, String)> = named
            .as_array()
            .expect("the page's lines")
            .iter()
            .map(|line| {
                let text = |key: &str| line[key].as_str().unwrap_or_default();
                let first = text("family").split(',').next().unwrap_or_default();
                (text("name").to_owned(), first.trim().to_owned())
            })
            .collect();
        assert!(
            lines
                .iter()
                .any(|(name, family)| { name == "tokens.type.code" && family == "JetBrains Mono" }),
            "code's font is JetBrains Mono until another is picked: {lines:?}"
        );
        for (name, family) in &lines {
            assert_ne!(
                &fonts::on_display(&stage, family),
                family,
                "the display's own fonts hold {family}, which {name} names: this check could not \
                 tell the app's file from the machine's"
            );
        }

        stage.send("draw");
        let reds = || (1..=u8::MAX).zip(&lines);
        let drawn = wait_for("GTK draws every line", 30, || {
            let drawn = fonts::drawn(&stage);
            reds()
                .all(|(red, _)| drawn.contains_key(&red))
                .then_some(drawn)
        });
        let fallen: Vec<String> = reds()
            .filter(|(red, (_, family))| !drawn[red].iter().eq([family]))
            .map(|(red, (name, family))| {
                format!("{name} names {family}, and is drawn in {:?}", drawn[&red])
            })
            .collect();
        assert_eq!(
            fallen,
            Vec::<String>::new(),
            "a text is drawn in another font than the bundled one it names"
        );
    });
}
