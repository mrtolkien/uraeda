//! The sandbox, `ura sandbox`: this server over sample projects and a fake agent, without
//! sign-in, as the [sandbox](/specs/decisions/sandbox.md) decision describes. Every screen is
//! reviewed on it, and the app's tests reach it.
//!
//! - **Its folder** holds everything it reads and writes: `projects/` (`sample`, `empty`,
//!   `broken`, `realistic`, `bare`, and `sample`'s `origin`), `data/`, `config/` (two jobs and
//!   four extensions), and `bin/` (a `gh` that lists the sample's pull requests). It is kept
//!   until a reset builds it again. Nothing reads or writes the human's own folders.
//! - **Its agent** is the fake runtime, registered as `fake`, `claude`, and `codex`: no agent of
//!   the machine is registered. See [`agent`].
//! - **Its list is locked**: no repository is added, opened, or removed, and the machine's
//!   folders are not suggested.
//! - **Without sign-in**, unless [`Mode::sign_in`] keeps it: then a new key is shown at each
//!   start, for the sign-in and pairing screens.
//! - **Its builders read the checkout it was built from**: its `fixtures/` and the skill's
//!   templates, at run time. A build of `ura` outside a checkout has no sandbox to give.

mod agent;
mod feature_runs;
mod git;
mod origin;
mod others;
mod sample;
mod sessions;
mod stories;
mod texts;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

pub use agent::{AT_LENGTH, CANNED_REPLY, SLOWLY, long_reply};
pub use sessions::{LONG_CHAT, LONG_CHAT_MESSAGES};

use uraeda_protocol::{SessionPick, Trigger};

use crate::http::Routes;
use crate::records::sessions::runs::{self, First};
use crate::runner::Store;
use crate::shared::Shared;
use crate::{Clock, Failure, Options};

/// The port the sandbox asks for, away from `ura serve`'s 4320 and the Node sandbox's 4410.
pub const PORT: u16 = 4420;

/// The sample projects' last day, which `ura sandbox` makes today with `URA_TODAY`: the core
/// reads it from the process's environment.
pub const TODAY: &str = "2026-10-21";

/// What changes the sample projects: a sandbox built by other builders is stale.
const BUILDERS: &str = "3";

/// How the sandbox's server runs.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Mode {
    /// Keeps sign-in on, for its screens.
    pub sign_in: bool,
}

/// The sandbox's folders.
#[derive(Clone, Debug)]
pub struct Sandbox {
    /// The folder that holds the others.
    pub folder: PathBuf,
    pub config_dir: PathBuf,
    pub data_dir: PathBuf,
    /// The sample projects, each in a folder of its name.
    pub projects: PathBuf,
    /// Whether older builders built it: a reset builds it again.
    pub stale: bool,
}

/// How [`prepare`] makes the sandbox ready.
#[derive(Clone, Copy, Debug, Default)]
pub struct Prepare {
    /// Builds it again, whatever is there.
    pub reset: bool,
    /// Adds the chat of 20,000 messages to the sample project, kept until a reset.
    pub long_chat: bool,
}

/// The checkout this build of the server comes from, whose fixtures the builders read.
pub fn checkout() -> PathBuf {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest.ancestors().nth(2).unwrap_or(manifest).to_owned()
}

/// The sandbox's folder in the checkout: `.sandbox-next/`, apart from the Node sandbox's
/// `.sandbox/` while both exist (task 61), ignored by git.
pub fn default_folder() -> PathBuf {
    checkout().join(".sandbox-next")
}

/// A path of the checkout's `fixtures/`.
fn fixture(path: &str) -> PathBuf {
    checkout().join("fixtures").join(path)
}

/// A fixture's text.
fn fixture_text(path: &str) -> Result<String, String> {
    let file = fixture(path);
    fs::read_to_string(&file).map_err(|error| format!("{}: {error}", file.display()))
}

/// The sandbox in a folder, built when it is missing, unfinished, or a reset asks for it, and
/// kept as it is otherwise.
///
/// # Errors
///
/// What stopped a build: a folder that cannot be written, a fixture missing outside a checkout,
/// or git failing. A build that fails leaves no stamp, so the next one starts again.
pub fn prepare(folder: &Path, prepare: Prepare) -> Result<Sandbox, String> {
    if !fixture("repo").is_dir() {
        let checkout = checkout();
        return Err(format!(
            "the sandbox is built from a checkout of Uraeda, and {} is none: run `just sandbox` there",
            checkout.display()
        ));
    }
    let stamp = folder.join("stamp");
    let built = fs::read_to_string(&stamp).ok();
    if prepare.reset || built.is_none() {
        build(folder)?;
        fs::write(&stamp, BUILDERS).map_err(|error| error.to_string())?;
    }
    let sandbox = folders(
        folder,
        built.is_some_and(|built| built != BUILDERS) && !prepare.reset,
    );
    if prepare.long_chat {
        add_long_chat(&sandbox)?;
    }
    Ok(sandbox)
}

/// The sandbox's folders in a folder.
fn folders(folder: &Path, stale: bool) -> Sandbox {
    Sandbox {
        folder: folder.to_owned(),
        config_dir: folder.join("config"),
        data_dir: folder.join("data"),
        projects: folder.join("projects"),
        stale,
    }
}

/// When the sample sessions were written: the sample's day, at 10:00 UTC.
fn seeded_at() -> SystemTime {
    // 2026-10-21T10:00:00Z.
    SystemTime::UNIX_EPOCH + Duration::from_secs(1_792_576_800)
}

/// What builds a sample project in its folder.
type Builder = fn(&Path) -> Result<(), String>;

/// Builds the sandbox in a folder, replacing what is there.
fn build(folder: &Path) -> Result<(), String> {
    if folder.exists() {
        fs::remove_dir_all(folder).map_err(|error| format!("{}: {error}", folder.display()))?;
    }
    let sandbox = folders(folder, false);
    let projects = &sandbox.projects;
    // Each project in a thread of its own: they share nothing.
    let builders: [(&str, Builder); 5] = [
        ("sample", sample::build),
        ("empty", |path| others::empty(path).map(drop)),
        ("broken", others::broken),
        ("realistic", others::realistic),
        ("bare", others::bare),
    ];
    std::thread::scope(|scope| {
        let built: Vec<_> = builders
            .iter()
            .map(|(name, builder)| scope.spawn(move || builder(&projects.join(name))))
            .collect();
        let results = built.into_iter().map(|thread| {
            thread
                .join()
                .unwrap_or_else(|_| Err("a builder panicked".to_owned()))
        });
        results.collect::<Result<Vec<()>, String>>()
    })?;
    config(&sandbox.config_dir)?;
    gh(&folder.join("bin"))?;
    let at = seeded_at();
    // "sample" last, the most recently opened.
    let mut sample_root = String::new();
    for (index, name) in ["bare", "broken", "empty", "realistic", "sample"]
        .iter()
        .enumerate()
    {
        let opened = at + Duration::from_secs(u64::try_from(index).unwrap_or_default());
        let added = uraeda_core::repositories::add(&sandbox.data_dir, &projects.join(name), opened)
            .map_err(|error| format!("{name}: {error}"))?;
        sample_root = added.repository.path.to_string_lossy().into_owned();
    }
    let store = Store::open(&sandbox.data_dir).map_err(|error| error.to_string())?;
    let seeded = sessions::seed(&store, &sample_root, at);
    store.close();
    seeded
}

/// Adds the long chat to the sample project, unless it has it.
fn add_long_chat(sandbox: &Sandbox) -> Result<(), String> {
    let listed = uraeda_core::repositories::read(&sandbox.data_dir).map_err(|e| e.to_string())?;
    let sample = listed
        .into_iter()
        .find(|repository| repository.name == "sample");
    let root = sample.ok_or("the sandbox lists no project `sample`")?.path;
    let root = root.to_string_lossy();
    let store = Store::open(&sandbox.data_dir).map_err(|error| error.to_string())?;
    let added = match sessions::has_long_chat(&store, &root) {
        Ok(false) => sessions::long_chat(&store, &root, seeded_at()),
        other => other.map(drop),
    };
    store.close();
    added
}

/// The sandbox's two jobs, in "sample", the second report only, which start only by "Run now":
/// the sandbox runs no job at its times.
const JOBS: &str = r#"[[jobs]]
name = "Dependencies"
repositories = ["sample"]
schedule = "daily 03:00"
prompt = """
Upgrade the dependencies to their latest versions, and offer the change.
"""

[[jobs]]
name = "Weekly report"
repositories = ["sample"]
schedule = "monday 09:00"
report_only = true
prompt = """
Read the week's commits, and report what changed and what looks risky.
"""
"#;

/// The config folder: its jobs, and four extensions, `echo` with a record, actions, and a route,
/// `hello` with a page, the documentation's worked example `wiki` with a place and a pane of
/// Home, and `throws`, which breaks as it loads, for the settings to name.
fn config(config_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(config_dir).map_err(|error| error.to_string())?;
    fs::write(config_dir.join("config.toml"), JOBS).map_err(|error| error.to_string())?;
    let extensions = config_dir.join("extensions");
    git::copy(&fixture("extensions/echo"), &extensions.join("echo"))?;
    git::copy(&fixture("pages/hello"), &extensions.join("hello"))?;
    git::copy(&fixture("extensions/throws"), &extensions.join("throws"))?;
    git::copy(
        &checkout().join("examples/extensions/wiki"),
        &extensions.join("wiki"),
    )
}

/// A `gh` that lists the sample's open pull requests, first on the server's `PATH`.
fn gh(bin: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt as _;
    let rows: Vec<serde_json::Value> = sample::PULL_REQUESTS
        .iter()
        .map(|(branch, number, draft, changes)| {
            serde_json::json!({
                "headRefName": branch,
                "headRefOid": "0".repeat(40),
                "isDraft": draft,
                "number": number,
                "reviewDecision": if *changes { "CHANGES_REQUESTED" } else { "" },
                "url": format!("https://github.com/mrtolkien/uraeda/pull/{number}"),
            })
        })
        .collect();
    let listed = serde_json::Value::Array(rows).to_string();
    fs::create_dir_all(bin).map_err(|error| error.to_string())?;
    let file = bin.join("gh");
    fs::write(&file, format!("#!/bin/sh\ncat <<'EOF'\n{listed}\nEOF\n"))
        .and_then(|()| fs::set_permissions(&file, fs::Permissions::from_mode(0o755)))
        .map_err(|error| format!("{}: {error}", file.display()))
}

/// The server's options for a sandbox, on a port: its folders, its `gh` first on the `PATH`, no
/// job at its times, and no folder joining its list. `environment` is the process's, which a
/// human's server's variables are taken out of.
pub fn options(
    sandbox: &Sandbox,
    port: u16,
    mode: Mode,
    environment: Vec<(String, String)>,
) -> Options {
    let bin = sandbox.folder.join("bin").to_string_lossy().into_owned();
    let mut environment: Vec<(String, String)> = environment
        .into_iter()
        // The web build to serve is the checkout's own, never the owner's data.
        .filter(|(name, _)| !name.starts_with("URAEDA_") || name == "URAEDA_WEB_BUILD")
        .collect();
    let path = environment.iter_mut().find(|(name, _)| name == "PATH");
    match path {
        Some((_, path)) => *path = format!("{bin}:{path}"),
        None => environment.push(("PATH".to_owned(), bin)),
    }
    Options {
        port,
        config_dir: sandbox.config_dir.clone(),
        data_dir: sandbox.data_dir.clone(),
        folder: None,
        environment,
        allow_origins: Vec::new(),
        clock: Clock::system(),
        no_scheduled_jobs: true,
        sandbox: Some(mode),
    }
}

/// Registers the sandbox's agent in place of the built-in runtimes.
pub(crate) fn register_agents(shared: &Shared) -> Result<(), Failure> {
    agent::register(shared)
}

/// The features at work as the sandbox first starts, each with the agent it runs on: the
/// implementation and the discovery of "sample", and in "realistic" a plan built by Claude Code
/// and a spec written by Codex, so each mark shows.
const AT_WORK: [(&str, &str, Option<&str>); 4] = [
    ("sample", sample::folders::WORKING, None),
    ("sample", sample::folders::DISCOVERY, None),
    (
        "realistic",
        others::realistic_folders::BUILDING,
        Some("claude"),
    ),
    (
        "realistic",
        others::realistic_folders::SPECIFYING,
        Some("codex"),
    ),
];

/// The sandbox's last domain: on its first start, sends the workflow's run of the features at
/// work, as "Continue" does, which the agent plays for twelve hours. A later start leaves them to
/// the continues of the run lifecycle.
pub(crate) fn mount(shared: &Shared, _routes: &mut Routes) -> Result<(), Failure> {
    if shared.find::<Mode>().is_none() {
        return Ok(());
    }
    let shared = shared.clone();
    tokio::task::spawn_blocking(move || {
        for (repository, folder, runtime) in AT_WORK {
            let started = crate::records::repositories::path(&shared, repository)
                .ok()
                .and_then(|root| {
                    let store = shared.get::<Store>();
                    store.latest_session(&root.to_string_lossy(), folder).ok()
                });
            if !matches!(started, Some(None)) {
                continue;
            }
            let pick = SessionPick {
                runtime: runtime.map(str::to_owned),
                ..SessionPick::default()
            };
            let first = First {
                pick,
                ..First::default()
            };
            if let Err(fault) = runs::send(&shared, repository, folder, Trigger::Manual, first) {
                eprintln!(
                    "uraeda: the sandbox's {folder} did not start: {}",
                    fault.message()
                );
            }
        }
    });
    Ok(())
}
