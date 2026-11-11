//! The extensions' server parts, through the real protocol: each test's server loads the
//! extensions of `fixtures/extensions/` from a temporary config folder, in a VM each.
//!
//! The extensions decision's rules are the costly ones to lose: an extension loads only from
//! the config folder, a broken one stops alone, a save reloads it without a restart, and
//! nothing a VM started outlives it. `extensions_vm/broken.rs` holds the broken ones and the
//! server's stop, `extensions_vm/reach.rs` what an extension reaches.

#[path = "extensions_vm/broken.rs"]
mod broken;
#[path = "extensions_vm/reach.rs"]
mod reach;
mod support;

use std::fs;
use std::path::Path;
use std::time::Duration;

use serde_json::{Value, json};
use support::{
    Held, Live, Setup, TestRepo, TestServer, fixture, fixture_repo, gone, group_members,
};
use uraeda_protocol::ErrorCode;
use uraeda_server::extensions;

/// The repository every test's server lists.
const REPO: &str = "todo-app";

/// A start with these fixture extensions in its config folder.
fn with(mut setup: Setup, names: &[&str]) -> Setup {
    for name in names {
        setup = copied(
            setup,
            &fixture("extensions").join(name),
            &format!("extensions/{name}"),
        );
    }
    setup
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

/// A server that lists the repository, with these fixture extensions.
async fn started(repo: &TestRepo, names: &[&str]) -> TestServer {
    with(support::setup().folder(repo.path()), names)
        .start()
        .await
}

/// Which record of an extension, in the tests' repository.
fn record(extension: &str, name: &str) -> Value {
    json!({ "repo": REPO, "extension": extension, "name": name })
}

/// Holds a record of an extension until it has a value.
async fn loaded(server: &TestServer, extension: &str, name: &str) -> Held {
    let mut held = Held::open(server, "ExtensionRecord", record(extension, name)).await;
    let what = format!("the record {name} of {extension}");
    held.until(&what, |record| record["error"].is_null()).await;
    held
}

/// Runs an action of an extension, in the tests' repository.
async fn act(
    server: &TestServer,
    extension: &str,
    name: &str,
    input: Value,
) -> Result<Value, support::Refused> {
    let input = json!({ "repo": REPO, "extension": extension, "name": name, "input": input });
    let answered = support::call(server, "extensions.act", input).await?;
    Ok(answered["output"].clone())
}

/// An extension's row of a value of `Extensions`.
fn row<'a>(extensions: &'a Value, name: &str) -> &'a Value {
    let rows = extensions["extensions"].as_array().expect("rows");
    let found = rows.iter().find(|row| row["name"] == name);
    found.unwrap_or(&Value::Null)
}

/// Waits until an extension is in a state: its row.
async fn in_state(server: &TestServer, name: &str, state: &str) -> Value {
    let mut all = Held::open(server, "Extensions", json!({ "repo": null })).await;
    let what = format!("{name} to be {state}");
    let reached = all
        .until(&what, |all| row(all, name)["state"] == state)
        .await;
    row(reached, name).clone()
}

/// The VMs' threads that run in this process, by their names, as the system lists them.
fn vm_threads() -> Vec<String> {
    let tasks = fs::read_dir("/proc/self/task").expect("the process's threads");
    let names = tasks.filter_map(|task| fs::read_to_string(task.ok()?.path().join("comm")).ok());
    let names = names.map(|name| name.trim().to_owned());
    names.filter(|name| name.starts_with("vm:")).collect()
}

/// Waits until no VM's thread runs: the ones left once the wait is over.
async fn no_vm_threads() -> Vec<String> {
    for _ in 0..200 {
        if vm_threads().is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    vm_threads()
}

// The spec's US3, and the plan's first: what an extension registers is read and called by
// name, with no entry of the catalog. A page reads `ExtensionRecord` and calls
// `extensions.act`.
#[tokio::test]
async fn an_extensions_record_and_action_answer_through_the_protocol() {
    let repo = fixture_repo(REPO);
    let server = started(&repo, &["echo"]).await;

    let mut counter = loaded(&server, "echo", "counter").await;
    let expected = json!({ "count": 0, "greeting": "hello", "repository": REPO, "version": 1 });
    assert_eq!(counter.value, json!({ "value": expected, "error": null }));

    let added = act(&server, "echo", "add", json!({ "by": 2 })).await;
    assert_eq!(added, Ok(json!({ "count": 2, "shouted": "ADDED 2!" })));
    // The extension said its record changed: who holds it gets the change.
    let changed = |record: &Value| record["value"]["count"] == 2;
    counter.until("the count", changed).await;

    // A promise is waited for, and a throw is the action's refusal, in the extension's words.
    let late = act(&server, "echo", "later", json!({ "ms": 20 })).await;
    assert_eq!(late, Ok(json!("late")));
    let refused = act(&server, "echo", "refuse", json!(null)).await;
    assert_eq!(
        refused,
        Err((ErrorCode::Refused, "echo: not today".to_owned()))
    );
    let unknown = act(&server, "echo", "nothing", json!(null)).await;
    let no_action = "echo: echo has no action nothing".to_owned();
    assert_eq!(unknown, Err((ErrorCode::Refused, no_action)));
    let missing = support::read(&server, "ExtensionRecord", record("echo", "nothing")).await;
    assert_eq!(missing["error"], "echo has no record nothing");

    // Its route answers a signed-in request, with the repository of its address, or none.
    let cookie = server.sign_in().await;
    let path = format!("/r/{REPO}/x/echo/hello?name=a%20b");
    let hello = server.get(&path).cookie(&cookie).send().await;
    let said = json!({ "method": "GET", "name": "a b", "repository": REPO });
    assert_eq!((hello.status, hello.json()), (200, said));
    let global = server.get("/x/echo/hello").cookie(&cookie).send().await;
    assert_eq!(global.json()["repository"], json!(null));
    let other = server.get("/x/echo/nothing").cookie(&cookie).send().await;
    assert_eq!(
        (other.status, other.text()),
        (404, "echo has no route /x/echo/nothing".to_owned())
    );
    // A route it registered for GET alone.
    let posted = server.post("/x/echo/hello").cookie(&cookie).send().await;
    assert_eq!(posted.status, 404);

    let shown = in_state(&server, "echo", "on").await;
    assert_eq!(shown["problems"], json!([]));
    assert_eq!(shown["valuesHere"], json!({ "greeting": "hello" }));
    server.stop().await;
}

// The extensions decision: an extension reloads on change, with no restart of the owner's.
// The version before it is unloaded first, with what it started: here a child process.
#[tokio::test]
async fn a_saved_server_ts_replaces_the_running_one_without_a_restart() {
    let repo = fixture_repo(REPO);
    let server = started(&repo, &["busy"]).await;
    let mut child = loaded(&server, "busy", "child").await;
    let first = child.value["value"]["pid"].as_u64().expect("a process") as u32;
    assert_eq!(child.value["value"]["version"], 1);
    assert!(
        !group_members(first).is_empty(),
        "the first version's command runs"
    );

    let file = server.config_dir().join("extensions/busy/server.ts");
    let saved = fs::read_to_string(&file)
        .unwrap()
        .replace("version: 1", "version: 2");
    fs::write(&file, saved).unwrap();

    let second = |record: &Value| record["value"]["version"] == 2;
    let reloaded = child.until("the saved version", second).await;
    let second = reloaded["value"]["pid"].as_u64().expect("a process") as u32;
    assert_ne!(first, second);
    assert_eq!(
        gone(first).await,
        Vec::<u32>::new(),
        "the unloaded version's command is gone"
    );
    assert!(
        !group_members(second).is_empty(),
        "the new version's command runs"
    );

    // A version that does not compile leaves the one before it running, and says why.
    fs::write(&file, "export default function activate( {").unwrap();
    let mut all = Held::open(&server, "Extensions", json!({ "repo": null })).await;
    let problem = |all: &Value| row(all, "busy")["problems"] != json!([]);
    let shown = all.until("the compile problem", problem).await;
    let shown = row(shown, "busy");
    assert_eq!(
        (&shown["state"], &shown["problems"][0]["file"]),
        (&json!("on"), &json!("server.ts"))
    );
    assert_eq!(shown["problems"][0]["line"], 1);
    assert!(
        !group_members(second).is_empty(),
        "the running version goes on"
    );
    server.stop().await;
}

// The settings page: where an extension is on, and its settings, are written to the settings
// file, and the extension loads again with them. Where it is off, its record says so, its
// action is refused, and a session's agent gets none of its skills.
#[tokio::test]
async fn the_settings_pages_actions_reload_an_extension_and_turn_it_off() {
    let repo = fixture_repo(REPO);
    let setup = with(support::setup().folder(repo.path()), &["echo"]);
    let skill = "extensions/echo/skills/echo/SKILL.md";
    let server = setup.config(skill, "# Echo\n").start().await;
    let mut counter = loaded(&server, "echo", "counter").await;
    let skills = server.config_dir().join("extensions/echo/skills");
    assert_eq!(extensions::skills(server.shared(), REPO), [skills]);

    let mut live = Live::of(&server).await;
    let set = json!({ "name": "echo", "repository": REPO, "key": "greeting", "value": "bonjour" });
    assert_eq!(live.call("extensions.setSetting", set).await, json!(null));
    // A read after the action's answer shows what it wrote.
    let all = live.read("Extensions", json!({ "repo": null })).await;
    assert_eq!(row(&all, "echo")["values"], json!({ "greeting": "hello" }));
    assert_eq!(
        row(&all, "echo")["repositoryValues"],
        json!({ REPO: { "greeting": "bonjour" } })
    );
    let here = live.read("Extensions", json!({ "repo": REPO })).await;
    assert_eq!(
        row(&here, "echo")["valuesHere"],
        json!({ "greeting": "bonjour" })
    );
    let greeted = |record: &Value| record["value"]["greeting"] == "bonjour";
    counter.until("the new greeting", greeted).await;

    let off = json!({ "name": "echo", "onAll": false, "on": [] });
    assert_eq!(live.call("extensions.setOn", off).await, json!(null));
    let all = live.read("Extensions", json!({ "repo": null })).await;
    assert_eq!(row(&all, "echo")["state"], "off");
    let is_off = |record: &Value| record["error"] == "echo is off in todo-app";
    counter
        .until("the record of an extension that is off", is_off)
        .await;
    let refused = act(&server, "echo", "add", json!({ "by": 1 })).await;
    assert_eq!(
        refused,
        Err((ErrorCode::Refused, "echo is off in todo-app".to_owned()))
    );
    assert_eq!(
        extensions::skills(server.shared(), REPO),
        Vec::<std::path::PathBuf>::new()
    );
    assert_eq!(
        vm_threads(),
        Vec::<String>::new(),
        "an extension that is off runs nothing"
    );

    // A built-in is turned off the same way, and a setting no manifest declares is refused.
    let inbox_off = json!({ "name": "inbox", "onAll": false, "on": [] });
    live.call("extensions.setOn", inbox_off).await;
    let all = live.read("Extensions", json!({ "repo": null })).await;
    assert_eq!(row(&all, "inbox")["state"], "off");
    let unknown = json!({ "name": "echo", "repository": null, "key": "volume", "value": 3 });
    let (code, message) = live.refused("extensions.setSetting", unknown).await;
    assert_eq!(
        (code, message.as_str()),
        (ErrorCode::Refused, "echo has no setting named volume")
    );
    server.stop().await;
}

// The extensions decision: extensions load only from the config folder, never from a
// repository. A cloned repository that carries an extensions folder runs nothing.
#[tokio::test]
async fn an_extension_in_a_repositorys_folder_is_never_loaded() {
    let repo = fixture_repo(REPO);
    let echo = fixture("extensions/echo");
    for folder in [
        "extensions/echo",
        "specs/extensions/echo",
        ".uraeda/extensions/echo",
    ] {
        for file in ["extension.toml", "server.ts", "lib/shout.ts"] {
            let text = fs::read_to_string(echo.join(file)).unwrap();
            repo.write(&format!("{folder}/{file}"), &text);
        }
    }
    repo.commit("an extension in the repository");
    let server = support::setup().folder(repo.path()).start().await;

    // The loader read the config folder once its extensions folder shows. An action of the
    // settings page makes it read again, with the repository listed.
    let mut all = Held::open(&server, "Extensions", json!({ "repo": REPO })).await;
    let read = |all: &Value| all["folder"] != "";
    all.until("the loader's first read", read).await;
    let everywhere = json!({ "name": "inbox", "onAll": true, "on": [] });
    assert_eq!(
        support::call(&server, "extensions.setOn", everywhere).await,
        Ok(json!(null))
    );
    let all = support::read(&server, "Extensions", json!({ "repo": REPO })).await;
    let rows = all["extensions"].as_array().expect("rows");
    let yours: Vec<&Value> = rows
        .iter()
        .filter(|row| row["isBuiltIn"] == false)
        .collect();
    assert_eq!(
        yours,
        Vec::<&Value>::new(),
        "only the built-in extensions are listed"
    );
    let counter = support::read(&server, "ExtensionRecord", record("echo", "counter")).await;
    assert_eq!(
        counter,
        json!({ "value": null, "error": "echo is off in todo-app" })
    );
    assert_eq!(vm_threads(), Vec::<String>::new());
    server.stop().await;
}
