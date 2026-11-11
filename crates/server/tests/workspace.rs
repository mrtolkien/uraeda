//! The workspace's records and actions, over `/live`: the list of repositories, a repository's
//! workspace, what needs the human, the settings, and the themes, each read in its shape, written
//! by its actions, and followed as its files change on disk.

mod support;

use std::fs;
use std::time::Duration;

use serde_json::{Value, json};
use support::{Held, TestRepo, TestServer, call, fixture_repo, read};
use uraeda_core::repositories;
use uraeda_protocol::{ErrorCode, NeedsYouList, Repositories, Settings, Themes, Workspace};
use uraeda_server::Server;

/// The fixture's feature that waits on the human: its questions are not answered.
const HUMAN: &str = "2026-10-11-web-ui";

/// A server whose list holds the repository, by its folder's name.
async fn serving(repo: &TestRepo) -> TestServer {
    support::setup().folder(repo.path()).start().await
}

/// The names of the listed repositories, in the list's order.
fn names(repositories: &Value) -> Vec<&str> {
    let rows = repositories["rows"].as_array().expect("rows");
    rows.iter()
        .map(|row| row["name"].as_str().unwrap())
        .collect()
}

/// The rows of what needs the human that are of this folder.
fn asking<'a>(list: &'a Value, folder: &str) -> Vec<&'a Value> {
    let rows = list["rows"].as_array().expect("rows");
    rows.iter().filter(|row| row["folder"] == folder).collect()
}

/// The feature of a workspace, by its folder.
fn feature<'a>(workspace: &'a Value, folder: &str) -> &'a Value {
    let features = workspace["features"].as_array().expect("features");
    let found = features.iter().find(|feature| feature["folder"] == folder);
    found.unwrap_or_else(|| panic!("no feature {folder} in {workspace}"))
}

#[tokio::test]
async fn repositories_answers_its_shape() {
    let repo = fixture_repo("todo-app");
    let server = serving(&repo).await;

    let value = read(&server, "Repositories", Value::Null).await;

    let path = repo.path().to_string_lossy();
    let row = json!({ "id": "todo-app", "name": "todo-app", "path": path, "home": path, "missing": false });
    assert_eq!(value, json!({ "rows": [row], "problem": null }));
    serde_json::from_value::<Repositories>(value).expect("the protocol's type reads it");
}

#[tokio::test]
async fn folder_suggestions_answers_its_shape() {
    let home = tempfile::tempdir().unwrap();
    for folder in ["dev/.cache", "dev/other", "dev/todo-app/.git", "dev/Tools"] {
        fs::create_dir_all(home.path().join(folder)).unwrap();
    }
    fs::write(home.path().join("dev/todo.txt"), "x").unwrap();
    let home_path = home.path().to_string_lossy();
    let server = support::setup().env("HOME", &home_path).start().await;
    let suggested =
        async |text: &str| read(&server, "FolderSuggestions", json!({ "text": text })).await;

    // Folders only, by name, git ones marked, hidden ones left out, whatever the case typed.
    let rows = json!([
        { "path": "~/dev/Tools/", "git": false },
        { "path": "~/dev/todo-app/", "git": true },
    ]);
    assert_eq!(suggested("~/dev/to").await, json!({ "rows": rows }));
    // A dot shows the hidden ones, and an absolute path keeps its form.
    let hidden = json!([{ "path": format!("{home_path}/dev/.cache/"), "git": false }]);
    let typed = format!("{home_path}/dev/.c");
    assert_eq!(suggested(&typed).await, json!({ "rows": hidden }));
    // A path that is not absolute, or a folder that does not exist, gets none.
    for text in ["dev/to", "~/nowhere/to", ""] {
        assert_eq!(suggested(text).await, json!({ "rows": [] }), "{text:?}");
    }
}

#[tokio::test]
async fn slug_proposal_answers_its_shape() {
    let server = support::server().await;

    let value = read(
        &server,
        "SlugProposal",
        json!({ "text": "Login redirects twice" }),
    )
    .await;

    let levels = json!(["low", "medium", "high"]);
    assert_eq!(
        value,
        json!({ "slug": "login-redirects", "discoveryLevels": levels })
    );
}

#[tokio::test]
async fn workspace_answers_its_shape() {
    let repo = fixture_repo("todo-app");
    let server = serving(&repo).await;

    let value = read(&server, "Workspace", json!({ "repo": "todo-app" })).await;

    let workspace: Workspace =
        serde_json::from_value(value.clone()).expect("the protocol's type reads it");
    assert_eq!(workspace.root, repo.path().to_string_lossy());
    assert_eq!(workspace.default_branch.as_deref(), Some("main"));
    assert!(!workspace.priorities.is_empty(), "the priorities are read");
    assert!(!workspace.preview, "the fixture has no preview decision");
    // A feature carries its folder as its id, its step, and its status: this one waits on the
    // human's answers, and no session works on it.
    let waiting = feature(&value, HUMAN);
    assert_eq!(waiting["id"], HUMAN);
    assert_eq!(waiting["label"], Value::Null);
    assert_eq!(waiting["step"]["name"], "human-gate");
    assert_eq!(waiting["step"]["file"], "clarifications-01.md");
    let needs = json!({
        "status": "needs-you", "label": "Needs you", "reason": "step",
        "session": null, "turn": null, "wait": null,
    });
    assert_eq!(waiting["status"], needs);
    // One the agent works on next waits on nobody's answer.
    let idle = feature(&value, "2026-10-12-cli-tuis");
    assert_eq!(idle["status"]["status"], "idle");
}

// The repositories decision: a record of a repository is scoped to it by name, never mixing two.
#[tokio::test]
async fn a_record_of_a_repository_no_longer_there_is_refused() {
    let repo = fixture_repo("todo-app");
    let server = serving(&repo).await;
    let workspace = |name: &'static str| Held::asked(&server, "Workspace", json!({ "repo": name }));

    let Err((code, message)) = workspace("another").await else {
        panic!("an unknown name is refused");
    };
    assert_eq!(
        (code, message.as_str()),
        (ErrorCode::Refused, "No repository named “another”")
    );

    // Its folder moved away: the list says it is missing, and its records are refused.
    let away = repo.parent().join("away");
    fs::rename(repo.path(), &away).unwrap();
    let Err((code, _)) = workspace("todo-app").await else {
        panic!("a repository whose folder is gone is refused");
    };
    assert_eq!(code, ErrorCode::Refused);
    let listed = read(&server, "Repositories", Value::Null).await;
    assert_eq!(listed["rows"][0]["missing"], true);

    // And back: it is found again.
    fs::rename(&away, repo.path()).unwrap();
    assert!(workspace("todo-app").await.is_ok(), "found again once back");
}

// US6.5 of the redesign: what needs the human is listed across repositories, with what it asks
// and where to answer it.
#[tokio::test]
async fn needs_you_list_answers_its_shape() {
    let (first, second) = (fixture_repo("todo-app"), fixture_repo("notes"));
    let server = serving(&first).await;
    call(
        &server,
        "repositories.add",
        json!({ "folder": second.path() }),
    )
    .await
    .expect("the second repository is added");

    let value = read(&server, "NeedsYouList", Value::Null).await;

    serde_json::from_value::<NeedsYouList>(value.clone()).expect("the protocol's type reads it");
    let rows = asking(&value, HUMAN);
    let mut repositories: Vec<_> = rows.iter().map(|row| row["repository"].clone()).collect();
    repositories.sort_by_key(Value::to_string);
    assert_eq!(repositories, [json!("notes"), json!("todo-app")]);
    let row = rows.iter().find(|row| row["repository"] == "todo-app");
    let expected = json!({
        "id": format!("todo-app/{HUMAN}"),
        "key": format!("todo-app/{HUMAN}:step:human-gate:clarifications-01.md:step:"),
        "repository": "todo-app",
        "folder": HUMAN,
        "href": format!("/r/todo-app/f/{HUMAN}/clarifications-01.md"),
        "label": "web-ui",
        "title": row.unwrap()["title"],
        "message": "Questions to answer",
        "reason": "step",
    });
    assert_eq!(**row.unwrap(), expected);
    assert!(
        asking(&value, "2026-10-12-cli-tuis").is_empty(),
        "an agent's step asks nothing"
    );
}

#[tokio::test]
async fn themes_answers_its_shape() {
    let ember = "name = \"Ember\"\nmode = \"dark\"\n\n[roles]\naction = \"#ff5500\"\n";
    let server = support::setup()
        .config("themes/ember.toml", ember)
        .start()
        .await;

    let value = read(&server, "Themes", Value::Null).await;

    let themes: Themes = serde_json::from_value(value).expect("the protocol's type reads it");
    assert!(themes.folder.ends_with("/themes/"), "{}", themes.folder);
    // The shipped themes, dark first, each mode's default first, then the user's.
    assert_eq!(themes.themes[0].id, "catppuccin-mocha");
    assert!(themes.themes[0].is_shipped);
    let ember = themes.themes.iter().find(|theme| theme.id == "ember");
    let ember = ember.expect("the user's theme is listed");
    assert_eq!(
        (ember.name.as_str(), ember.mode.as_str()),
        ("Ember", "dark")
    );
    assert_eq!(ember.roles["action"], "#ff5500");
    assert!(!ember.is_shipped);
    let [file] = themes.files.as_slice() else {
        panic!("one theme file of the user's: {:?}", themes.files);
    };
    assert_eq!(
        (file.file.as_str(), file.id.as_str()),
        ("ember.toml", "ember")
    );
    assert!(file.is_listed);
}

// The settings decision: a setting resolves from its variable, then the file, then its default.
#[tokio::test]
async fn settings_answers_its_shape() {
    let toml = "[runs]\nautomatic_continues = 5\ncontinue_after_limit = false\n";
    let server = support::setup()
        .config("config.toml", toml)
        .env("URAEDA_CONTINUE_AFTER_LIMIT", "true")
        .env("CLAUDE_CODE_EFFORT_LEVEL", "high")
        .start()
        .await;

    let value = read(&server, "Settings", Value::Null).await;

    serde_json::from_value::<Settings>(value.clone()).expect("the protocol's type reads it");
    let from = |kind: &str| json!({ "kind": kind });
    let unset =
        |value: Value| json!({ "inForce": value, "saved": null, "source": from("default") });
    assert!(value["file"].as_str().unwrap().ends_with("/config.toml"));
    assert_eq!(value["problem"], Value::Null);
    assert_eq!(value["server"]["allowedHosts"], unset(json!([])));
    assert_eq!(value["server"]["openBrowser"], unset(json!(true)));
    assert_eq!(value["server"]["port"]["inForce"], server.port());
    let keyboard = json!({
        "singleKeyShortcuts": unset(json!(true)),
        "vimMode": unset(json!(false)),
        "vimCommands": unset(json!([])),
    });
    assert_eq!(value["keyboard"], keyboard);
    let variable = json!({ "kind": "environment", "name": "URAEDA_CONTINUE_AFTER_LIMIT" });
    let runs = json!({
        "automaticContinues": { "inForce": 5, "saved": 5, "source": from("file") },
        "catchUpPullRequests": unset(json!(false)),
        "continueAfterLimit": { "inForce": true, "saved": false, "source": variable },
        "continueAfterRestart": unset(json!(true)),
        "scheduledJobs": unset(json!(true)),
        "claudeEffortFromEnv": "high",
        "options": { "steps": [], "implementers": null, "reviewers": null, "reviewDepth": null },
    });
    assert_eq!(value["runs"], runs);
}

// US2 of the multi-repo server: a folder is added by its path, opened, and removed, and removing
// changes nothing in the folder.
#[tokio::test]
async fn the_lists_actions_write_the_list_and_leave_the_folders() {
    let (first, second) = (fixture_repo("todo-app"), fixture_repo("notes"));
    let home = second.parent().to_string_lossy().into_owned();
    let server = support::setup()
        .folder(first.path())
        .env("HOME", &home)
        .start()
        .await;
    let listed = async || read(&server, "Repositories", Value::Null).await;

    // A folder inside a repository, typed from the home folder, adds its main checkout.
    server.clock().advance(Duration::from_secs(60));
    let added = call(
        &server,
        "repositories.add",
        json!({ "folder": "~/notes/specs/" }),
    )
    .await;
    assert_eq!(added, Ok(json!({ "name": "notes" })));
    let list = listed().await;
    assert_eq!(names(&list), ["notes", "todo-app"]);
    assert_eq!(list["rows"][0]["home"], "~/notes");
    let stored = repositories::read(server.data_dir()).unwrap();
    assert_eq!(stored[0].path, second.path(), "the list's file holds it");

    // Adding it again answers its name, and lists it once.
    let again = call(
        &server,
        "repositories.add",
        json!({ "folder": second.path() }),
    )
    .await;
    assert_eq!(again, Ok(json!({ "name": "notes" })));
    assert_eq!(names(&listed().await), ["notes", "todo-app"]);

    // Opening a repository moves it first.
    server.clock().advance(Duration::from_secs(60));
    let opened = call(&server, "repositories.open", json!({ "name": "todo-app" })).await;
    assert_eq!(opened, Ok(Value::Null));
    assert_eq!(names(&listed().await), ["todo-app", "notes"]);

    // Removing takes it off the list, and leaves its folder as it is.
    let removed = call(&server, "repositories.remove", json!({ "name": "notes" })).await;
    assert_eq!(removed, Ok(Value::Null));
    assert_eq!(names(&listed().await), ["todo-app"]);
    assert!(second.exists("specs/PRIORITIES.md"), "the folder is left");

    // What cannot be done is refused, with the core's message.
    let refusals = [
        (
            "repositories.remove",
            json!({ "name": "notes" }),
            "No repository named “notes”",
        ),
        (
            "repositories.open",
            json!({ "name": "notes" }),
            "No repository named “notes”",
        ),
        (
            "repositories.add",
            json!({ "folder": "notes" }),
            "Type an absolute path, starting with / or ~.",
        ),
        (
            "repositories.add",
            json!({ "folder": "/nowhere/at-all" }),
            "No such folder: /nowhere/at-all.",
        ),
    ];
    for (action, input, message) in refusals {
        let answer = call(&server, action, input.clone()).await;
        assert_eq!(
            answer,
            Err((ErrorCode::Refused, message.to_owned())),
            "{action} of {input}"
        );
    }
}

// The repositories decision: `ura add`, the app, and hand edits change one list a running server
// follows.
#[tokio::test]
async fn the_list_follows_its_file() {
    let (first, second) = (fixture_repo("todo-app"), fixture_repo("notes"));
    let server = serving(&first).await;
    let mut list = Held::open(&server, "Repositories", Value::Null).await;
    assert_eq!(names(&list.value), ["todo-app"]);

    // `ura add`, in another process, writes the list's file through the core.
    repositories::add(server.data_dir(), second.path(), server.clock().now()).unwrap();
    list.until("the added repository", |list| {
        names(list).contains(&"notes")
    })
    .await;
    // The new repository is served, and watched: a commit on a branch of it reaches its workspace.
    let args = json!({ "repo": "notes" });
    let mut workspace = Held::open(&server, "Workspace", args).await;
    second.switch_new("2026-11-01-new-idea");
    second.write(
        "specs/2026-11-01-new-idea/proposal.md",
        "# Proposal: New idea\n",
    );
    second.commit("feat: a new idea");
    let has_it = |workspace: &Value| {
        let features = workspace["features"].as_array().unwrap();
        features
            .iter()
            .any(|feature| feature["folder"] == "2026-11-01-new-idea")
    };
    workspace.until("the new feature", has_it).await;

    // A list that cannot be read keeps the rows, says why, and refuses a change.
    let file = server.data_dir().join("repositories.json");
    let good = fs::read_to_string(&file).unwrap();
    fs::write(&file, "{ not json").unwrap();
    let broken = list
        .until("the problem", |list| !list["problem"].is_null())
        .await;
    assert_eq!(names(broken), ["notes", "todo-app"]);
    assert!(
        broken["problem"]
            .as_str()
            .unwrap()
            .starts_with("repositories.json could not be read")
    );
    let refused = call(&server, "repositories.remove", json!({ "name": "notes" })).await;
    assert_eq!(refused.unwrap_err().0, ErrorCode::Refused);

    // A hand edit removing a repository takes it off the list.
    let mut edited: Value = serde_json::from_str(&good).unwrap();
    let rows = edited["repositories"].as_array_mut().unwrap();
    rows.retain(|row| row["name"] != "notes");
    fs::write(&file, edited.to_string()).unwrap();
    let fixed = list
        .until("the hand edit", |list| names(list) == ["todo-app"])
        .await;
    assert_eq!(fixed["problem"], Value::Null);
}

// The feature status decision's one place, read by the sidebar and the notifications: a commit
// that answers the questions moves the feature in its workspace, and takes it off what needs the
// human.
#[tokio::test]
async fn a_commit_reaches_the_workspace_and_what_needs_the_human() {
    let repo = fixture_repo("todo-app");
    let server = serving(&repo).await;
    let args = json!({ "repo": "todo-app" });
    let mut workspace = Held::open(&server, "Workspace", args).await;
    let mut needs = Held::open(&server, "NeedsYouList", Value::Null).await;
    assert_eq!(asking(&needs.value, HUMAN).len(), 1);

    repo.switch(HUMAN);
    repo.remove(&format!("specs/{HUMAN}/clarifications-01.md"));
    repo.commit("docs: answers");
    repo.switch("main");

    let moved = |workspace: &Value| feature(workspace, HUMAN)["step"]["name"] != "human-gate";
    let after = workspace.until("the feature's next step", moved).await;
    assert_ne!(feature(after, HUMAN)["status"]["status"], "needs-you");
    needs
        .until("the row to go", |list| asking(list, HUMAN).is_empty())
        .await;
}

// The break it catches: a domain's hook left out of the one watcher, so its records show a
// file written by an editor or an agent only once the page is opened again.
#[tokio::test]
async fn a_file_written_outside_the_server_reaches_a_record_of_each_domain() {
    let repo = fixture_repo("todo-app");
    let server = serving(&repo).await;
    let args = json!({ "repo": "todo-app" });
    let buffer = json!({ "repo": "todo-app", "path": "specs/INBOX.md" });
    let mut inbox = Held::open(&server, "Inbox", args.clone()).await;
    let mut buffer = Held::open(&server, "Buffer", buffer).await;
    let mut page = Held::open(&server, "GitPage", args).await;
    let notes = inbox.value["count"].as_u64().expect("the notes' count");

    let text = repo.read("specs/INBOX.md");
    repo.write("specs/INBOX.md", &format!("{text}- Written in an editor\n"));

    // The features' record, writing's, and git's each follow the file.
    let counted = |inbox: &Value| inbox["count"] == notes + 1;
    inbox.until("the inbox to count the note", counted).await;
    let written = |buffer: &Value| buffer.to_string().contains("Written in an editor");
    buffer.until("the buffer to hold the note", written).await;
    let changed = |page: &Value| page.to_string().contains("specs/INBOX.md");
    page.until("the Git page to list the file", changed).await;
}

/// The settings' actions, each with its input, the place of its setting in the record, and the
/// value it saves.
fn settings_writes() -> Vec<(&'static str, Value, [&'static str; 2], Value)> {
    let options = json!({
        "steps": [{ "step": "plan", "agent": "codex", "model": null, "effort": "high", "newSession": null }],
        "implementers": null,
        "reviewers": [{ "agent": null, "model": null, "effort": null, "instructions": null, "command": "vp check" }],
        "reviewDepth": "branch",
    });
    vec![
        (
            "settings.addHost",
            json!({ "name": "Mac.Tail1234.ts.net" }),
            ["server", "allowedHosts"],
            json!(["mac.tail1234.ts.net"]),
        ),
        (
            "settings.editHost",
            json!({ "from": "mac.tail1234.ts.net", "to": "laptop.ts.net" }),
            ["server", "allowedHosts"],
            json!(["laptop.ts.net"]),
        ),
        (
            "settings.removeHost",
            json!({ "name": "laptop.ts.net" }),
            ["server", "allowedHosts"],
            json!([]),
        ),
        (
            "settings.setPort",
            json!({ "port": " 4400 " }),
            ["server", "port"],
            json!(4400),
        ),
        (
            "settings.setOpenBrowser",
            json!({ "open": false }),
            ["server", "openBrowser"],
            json!(false),
        ),
        (
            "settings.setAutomaticContinues",
            json!({ "continues": "7" }),
            ["runs", "automaticContinues"],
            json!(7),
        ),
        (
            "settings.setContinue",
            json!({ "key": "restart", "on": false }),
            ["runs", "continueAfterRestart"],
            json!(false),
        ),
        (
            "settings.setContinue",
            json!({ "key": "limit", "on": false }),
            ["runs", "continueAfterLimit"],
            json!(false),
        ),
        (
            "settings.setContinue",
            json!({ "key": "catch-up", "on": true }),
            ["runs", "catchUpPullRequests"],
            json!(true),
        ),
        (
            "settings.setContinue",
            json!({ "key": "jobs", "on": false }),
            ["runs", "scheduledJobs"],
            json!(false),
        ),
        (
            "settings.setSingleKeyShortcuts",
            json!({ "on": false }),
            ["keyboard", "singleKeyShortcuts"],
            json!(false),
        ),
        (
            "settings.setVimMode",
            json!({ "on": true }),
            ["keyboard", "vimMode"],
            json!(true),
        ),
        (
            "settings.setVimCommands",
            json!({ "lines": ["imap jj <Esc>"] }),
            ["keyboard", "vimCommands"],
            json!(["imap jj <Esc>"]),
        ),
        (
            "settings.setRunOptions",
            json!({ "options": options }),
            ["runs", "options"],
            options,
        ),
    ]
}

// The settings decision: a setting changed in the app is written to the one TOML file, keeps the
// human's comments, and never overwrites a file that is invalid.
#[tokio::test]
async fn each_settings_action_writes_the_file_and_shows_in_the_record() {
    let server = support::setup()
        .config("config.toml", "# Mine.\n[server]\n")
        .start()
        .await;
    let file = server.config_dir().join("config.toml");

    for (action, input, [table, key], saved) in settings_writes() {
        let answer = call(&server, action, input.clone()).await;
        assert_eq!(answer, Ok(Value::Null), "{action} of {input}");
        let record = read(&server, "Settings", Value::Null).await;
        let setting = &record[table][key];
        // The run options are the file's own, with no value in force apart.
        let shown = if key == "options" {
            setting
        } else {
            &setting["saved"]
        };
        assert_eq!(*shown, saved, "{action} of {input}: {setting}");
    }
    let written = fs::read_to_string(&file).unwrap();
    assert!(
        written.starts_with("# Mine.\n"),
        "the comment is kept: {written}"
    );
    assert!(written.contains("vim_mode = true"), "{written}");

    // What the core refuses is refused with its message.
    let refusals = [
        (
            "settings.setPort",
            json!({ "port": "70000" }),
            "The port is a number from 1 to 65535.",
        ),
        (
            "settings.removeHost",
            json!({ "name": "nobody.ts.net" }),
            "nobody.ts.net is not an allowed host name.",
        ),
    ];
    for (action, input, message) in refusals {
        let answer = call(&server, action, input.clone()).await;
        assert_eq!(
            answer,
            Err((ErrorCode::Refused, message.to_owned())),
            "{action} of {input}"
        );
    }
    let unknown = call(
        &server,
        "settings.setContinue",
        json!({ "key": "always", "on": true }),
    )
    .await;
    assert_eq!(unknown.unwrap_err().0, ErrorCode::BadInput);

    // A file that cannot be read is the record's problem, and is never overwritten.
    fs::write(&file, "[server\n").unwrap();
    let mut settings = Held::open(&server, "Settings", Value::Null).await;
    let broken = settings
        .until("the problem", |record| !record["problem"].is_null())
        .await;
    assert_eq!(
        broken["keyboard"]["vimMode"]["inForce"], false,
        "the defaults apply meanwhile"
    );
    let refused = call(&server, "settings.setVimMode", json!({ "on": true })).await;
    assert_eq!(refused.unwrap_err().0, ErrorCode::Refused);
    assert_eq!(fs::read_to_string(&file).unwrap(), "[server\n");
}

/// The status the server answers a request for `host`: 403 when the guard refuses the name.
async fn status_for(server: &TestServer, host: &str) -> u16 {
    server
        .get("/session")
        .header("host", host)
        .send()
        .await
        .status
}

// US1 of the settings page, and ruling R35: a host name written in the settings file passes the
// guard from the next request, by hand or from the app, and a symlinked file, as dotfiles are, is
// followed.
#[cfg(unix)]
#[tokio::test]
async fn a_host_name_in_the_settings_passes_the_guard_until_it_changes() {
    let server = support::server().await;
    let dotfiles = tempfile::tempdir().unwrap();
    let mut settings = Held::open(&server, "Settings", Value::Null).await;
    let hosts = |record: &Value| record["server"]["allowedHosts"]["inForce"].clone();
    assert_eq!(status_for(&server, "mac.ts.net").await, 403);

    // The app adds a name.
    let added = call(&server, "settings.addHost", json!({ "name": "mac.ts.net" })).await;
    assert_eq!(added, Ok(Value::Null));
    assert_ne!(status_for(&server, "mac.ts.net").await, 403);
    settings
        .until("the added name", |record| {
            hosts(record) == json!(["mac.ts.net"])
        })
        .await;

    // The file becomes a link into the dotfiles, which hold another name.
    let real = dotfiles.path().join("uraeda.toml");
    let file = server.config_dir().join("config.toml");
    fs::write(&real, "[server]\nallowed_hosts = [\"laptop.ts.net\"]\n").unwrap();
    fs::remove_file(&file).unwrap();
    std::os::unix::fs::symlink(&real, &file).unwrap();
    settings
        .until("the linked file", |record| {
            hosts(record) == json!(["laptop.ts.net"])
        })
        .await;
    assert_eq!(status_for(&server, "mac.ts.net").await, 403);
    assert_ne!(status_for(&server, "laptop.ts.net").await, 403);

    // A hand edit of the dotfiles' file is followed through the link.
    fs::write(&real, "[server]\nallowed_hosts = []\n").unwrap();
    settings
        .until("the hand edit", |record| hosts(record) == json!([]))
        .await;
    assert_eq!(status_for(&server, "laptop.ts.net").await, 403);
}

// Review focus 1 of the settings page: names given for one run stay, whatever the file lists, and
// are never written into it.
#[tokio::test]
async fn host_names_given_by_the_environment_stay_whatever_the_file_lists() {
    let server = support::setup()
        .env("URAEDA_ALLOWED_HOSTS", "Build.ts.net, ci.ts.net")
        .start()
        .await;

    let added = call(&server, "settings.addHost", json!({ "name": "mac.ts.net" })).await;
    assert_eq!(added, Ok(Value::Null));

    let record = read(&server, "Settings", Value::Null).await;
    let variable = json!({ "kind": "environment", "name": "URAEDA_ALLOWED_HOSTS" });
    let hosts = json!({
        "inForce": ["build.ts.net", "ci.ts.net"], "saved": ["mac.ts.net"], "source": variable,
    });
    assert_eq!(record["server"]["allowedHosts"], hosts);
    assert_ne!(status_for(&server, "build.ts.net").await, 403);
    assert_eq!(status_for(&server, "mac.ts.net").await, 403);
    let written = fs::read_to_string(server.config_dir().join("config.toml")).unwrap();
    assert!(!written.contains("build.ts.net"), "{written}");
}

// R13 of the settings page: a variable that is not a setting's value stops the start, and says
// which.
#[tokio::test]
async fn a_variable_that_is_no_value_stops_the_start() {
    let rows = [
        (
            "URAEDA_CONTINUE_AFTER_RESTART",
            "maybe",
            "URAEDA_CONTINUE_AFTER_RESTART is true or false.",
        ),
        (
            "URAEDA_AUTOMATIC_CONTINUES",
            "11",
            "URAEDA_AUTOMATIC_CONTINUES",
        ),
    ];
    for (name, value, problem) in rows {
        let setup = support::setup().env(name, value);
        let Err(error) = Server::start(setup.options()).await else {
            panic!("{name}={value} stops the start");
        };
        assert!(
            error.to_string().contains(problem),
            "{name}={value}: {error}"
        );
    }
}

// The colour themes decision: a theme file written in the themes folder is served again.
#[tokio::test]
async fn a_theme_file_written_reaches_the_record() {
    let server = support::server().await;
    let mut themes = Held::open(&server, "Themes", Value::Null).await;
    let listed = |themes: &Value, id: &str| {
        let themes = themes["themes"].as_array().unwrap();
        themes.iter().any(|theme| theme["id"] == id)
    };
    assert!(!listed(&themes.value, "ember"));

    // The themes folder is made after the start, then a file in it.
    let folder = server.config_dir().join("themes");
    fs::create_dir(&folder).unwrap();
    let ember = "name = \"Ember\"\nmode = \"dark\"\n\n[roles]\naction = \"#ff5500\"\n";
    fs::write(folder.join("ember.toml"), ember).unwrap();
    themes
        .until("the new theme", |themes| listed(themes, "ember"))
        .await;

    // A change of the file is one too, and a file with a problem says so.
    fs::write(folder.join("ember.toml"), "mode = \"dusk\"\n").unwrap();
    let after = themes
        .until("the theme to go", |themes| !listed(themes, "ember"))
        .await;
    assert_eq!(after["files"][0]["isListed"], false);
    assert!(!after["files"][0]["problems"].as_array().unwrap().is_empty());
}
