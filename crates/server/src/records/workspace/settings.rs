//! The settings in force: each from the variable of the server's environment that gives it for
//! this run, then the settings file, read through the core, then its default. The record
//! `Settings` shows them, the actions `settings.*` write the file, and the allowed host names
//! reach the guard as they change.
//!
//! The file is read as the server starts, after each action that writes it, and each time it
//! changes on disk. A file that cannot be read gives the defaults, and is the record's problem.

mod actions;
mod given;
pub(in crate::records) mod options;

use std::sync::Mutex;

use uraeda_core::settings as core;
use uraeda_protocol::{KeyboardSettings, RunSettings, ServerSettings, Setting, Settings, Source};

use self::given::Given;
use crate::live::{Bus, Registry, locked};
use crate::shared::Shared;
use crate::{DEFAULT_PORT, Failure};

/// The automatic continues in a row when no variable or file gives them.
const AUTOMATIC_CONTINUES: u32 = 3;

/// The settings in force, as last read, and what the environment gives for this run.
struct InForce {
    given: Given,
    settings: Mutex<Settings>,
    /// Held by the one reload that runs, so the last read is the one kept.
    reloading: Mutex<()>,
}

/// Reads the settings, gives the guard the allowed host names, and registers the record and its
/// actions.
///
/// # Errors
///
/// When a variable of the server's environment is not a value of its setting.
pub(super) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
    let mut given = Given::read(shared.environment())?;
    given.no_scheduled_jobs = shared.find::<crate::jobs::NoScheduledJobs>().is_some();
    let (settings, problem) = read(shared, &given);
    problem.iter().for_each(|problem| report(problem));
    shared.allow_hosts(settings.server.allowed_hosts.in_force.clone());
    shared.provide(InForce {
        given,
        settings: Mutex::new(settings),
        reloading: Mutex::default(),
    });
    registry.record::<Settings>(|shared, ()| Ok(current(shared)));
    actions::register(registry);
    Ok(())
}

/// The settings in force, as last read: what any domain applies, as the continues of a run.
pub(crate) fn current(shared: &Shared) -> Settings {
    locked(&shared.get::<InForce>().settings).clone()
}

/// Reads the settings file again. When a value in force or the problem changed, the guard gets
/// the allowed host names, and the record's subscribers the change.
pub(crate) fn reload(shared: &Shared) {
    let in_force = shared.get::<InForce>();
    let _turn = locked(&in_force.reloading);
    let (settings, problem) = read(shared, &in_force.given);
    let before = std::mem::replace(&mut *locked(&in_force.settings), settings.clone());
    if before == settings {
        return;
    }
    if let Some(problem) = problem.filter(|_| before.problem != settings.problem) {
        report(&problem);
    }
    shared.allow_hosts(settings.server.allowed_hosts.in_force);
    shared.get::<Bus>().changed::<Settings>(&());
}

/// Prints the problem of a settings file that cannot be read: once, until it changes.
fn report(problem: &str) {
    eprintln!("uraeda: {problem} The server uses its defaults until the file is fixed.");
}

/// The settings in force now, and the file's problem when it cannot be read.
fn read(shared: &Shared, given: &Given) -> (Settings, Option<String>) {
    let (file, problem) = match core::read(shared.config_dir()) {
        Ok(file) => (file, None),
        Err(error) => (core::Settings::default(), Some(error.message)),
    };
    let settings = Settings {
        file: core::shown_file(shared.config_dir()),
        problem: problem.clone(),
        server: server(shared, given, file.server),
        runs: runs(given, file.runs),
        keyboard: keyboard(file.keyboard),
    };
    (settings, problem)
}

/// A setting: the value given for this run, by its variable, else the file's, else the default.
fn setting<T: Clone>(given: Option<(&'static str, T)>, saved: Option<T>, default: T) -> Setting<T> {
    let (in_force, source) = match (given, &saved) {
        (Some((name, value)), _) => (
            value,
            Source::Environment {
                name: name.to_owned(),
            },
        ),
        (None, Some(saved)) => (saved.clone(), Source::File),
        (None, None) => (default, Source::Default),
    };
    Setting {
        in_force,
        saved,
        source,
    }
}

/// The `[server]` table, in force.
fn server(shared: &Shared, given: &Given, file: core::ServerSettings) -> ServerSettings {
    ServerSettings {
        allowed_hosts: setting(given.allowed_hosts.clone(), file.allowed_hosts, Vec::new()),
        open_browser: setting(None, file.open_browser, true),
        port: port(shared, file.port),
    }
}

/// The port in force is the one the server listens on.
///
/// TEMPORARY: the file's port is the Node server's while both exist (ruling R32), so only
/// `--port` moves this server from its default. Task 61 gives the port its setting and its
/// variable.
fn port(shared: &Shared, saved: Option<u16>) -> Setting<u16> {
    let source = match shared.port() {
        DEFAULT_PORT => Source::Default,
        _ => Source::Flag {
            name: "--port".to_owned(),
        },
    };
    Setting {
        in_force: shared.port(),
        saved,
        source,
    }
}

/// The `[runs]` table, in force.
fn runs(given: &Given, file: core::RunSettings) -> RunSettings {
    // The core keeps the number from 1 to 10.
    let continues = file
        .automatic_continues
        .and_then(|count| u32::try_from(count).ok());
    RunSettings {
        automatic_continues: setting(given.automatic_continues, continues, AUTOMATIC_CONTINUES),
        catch_up_pull_requests: setting(given.catch_up, file.catch_up_pull_requests, false),
        continue_after_limit: setting(given.after_limit, file.continue_after_limit, true),
        continue_after_restart: setting(given.after_restart, file.continue_after_restart, true),
        scheduled_jobs: scheduled_jobs(given, file.scheduled_jobs),
        claude_effort_from_env: given.claude_effort.clone(),
        default_agent: file.default_agent,
        options: options::sent(file.options),
    }
}

/// The switch of the scheduled jobs: `--no-scheduled-jobs`, else its variable, else the file,
/// else on.
fn scheduled_jobs(given: &Given, saved: Option<bool>) -> Setting<bool> {
    let mut switch = setting(given.scheduled_jobs, saved, true);
    if given.no_scheduled_jobs {
        switch.in_force = false;
        switch.source = Source::Flag {
            name: "--no-scheduled-jobs".to_owned(),
        };
    }
    switch
}

/// The `[keyboard]` table, in force: no variable gives a key's behaviour.
fn keyboard(file: core::KeyboardSettings) -> KeyboardSettings {
    KeyboardSettings {
        single_key_shortcuts: setting(None, file.single_key_shortcuts, true),
        vim_mode: setting(None, file.vim_mode, false),
        vim_commands: setting(None, file.vim_commands, Vec::new()),
    }
}
