//! The settings file, `config.toml` in Uraeda's config folder: read, and changed one value at a
//! time. A file that cannot be read rejects with `unreadable: `, and an invalid value or a failed
//! write with `refused: `.

use std::path::{Path, PathBuf};

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::settings::{self, ContinueKey, RunOptions, Settings};

use super::{Job, job};

/// Uraeda's config folder: `custom` when set and not empty, else `URAEDA_CONFIG_DIR` from this
/// process's environment, else `$XDG_CONFIG_HOME/uraeda`, else `~/.config/uraeda`.
#[napi]
pub fn config_dir(custom: Option<String>) -> String {
    custom
        .filter(|folder| !folder.is_empty())
        .map_or_else(settings::default_config_dir, PathBuf::from)
        .to_string_lossy()
        .into_owned()
}

/// The settings file in the config folder `dir`, the home folder written `~`, as the core's messages
/// write it.
#[napi]
pub fn settings_file(dir: String) -> String {
    settings::shown_file(Path::new(&dir))
}

/// `typed`, trimmed, when it is a port, a whole number from 1 to 65535. Throws the problem
/// otherwise, `The port is a number from 1 to 65535.`
#[napi]
pub fn checked_port(typed: String) -> napi::Result<u32> {
    settings::port(&typed)
        .map(u32::from)
        .map_err(napi::Error::from_reason)
}

/// `typed`, trimmed, when it is a cap on automatic continues, a whole number from 1 to 10. Throws
/// the problem otherwise, `Automatic continues in a row is a whole number from 1 to 10.`
#[napi]
pub fn checked_automatic_continues(typed: String) -> napi::Result<i64> {
    settings::automatic_continues(&typed).map_err(napi::Error::from_reason)
}

/// The settings in the folder's file, the defaults when there is none.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn read_settings(dir: String) -> AsyncTask<Job<Settings>> {
    job(move || settings::read(Path::new(&dir)))
}

/// Adds a host name, in lower case, to the allowed host names.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn add_allowed_host(dir: String, name: String) -> AsyncTask<Job<Settings>> {
    job(move || settings::add_allowed_host(Path::new(&dir), &name))
}

/// Replaces an allowed host name with another, in its place.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn edit_allowed_host(dir: String, from: String, to: String) -> AsyncTask<Job<Settings>> {
    job(move || settings::edit_allowed_host(Path::new(&dir), &from, &to))
}

/// Removes an allowed host name.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn remove_allowed_host(dir: String, name: String) -> AsyncTask<Job<Settings>> {
    job(move || settings::remove_allowed_host(Path::new(&dir), &name))
}

/// Sets the port, from the text typed.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn set_port(dir: String, port: String) -> AsyncTask<Job<Settings>> {
    job(move || settings::set_port(Path::new(&dir), &port))
}

/// Sets whether a start opens a browser.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn set_open_browser(dir: String, open: bool) -> AsyncTask<Job<Settings>> {
    job(move || settings::set_open_browser(Path::new(&dir), open))
}

/// Sets whether the run after a spec's approval starts in a new agent session.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn set_build_in_fresh_session(dir: String, fresh: bool) -> AsyncTask<Job<Settings>> {
    job(move || settings::set_build_in_fresh_session(Path::new(&dir), fresh))
}

/// Replaces the run options of the settings file with `options`, writing only the values set, and
/// removes the old `build_in_fresh_session`. Rejects with `refused: ` the options `checkRunOptions`
/// refuses.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn set_run_options(dir: String, options: RunOptions) -> AsyncTask<Job<Settings>> {
    job(move || settings::set_run_options(Path::new(&dir), &options))
}

/// Throws `refused: ` and the problem when `options` holds a step not of the workflow's, a step
/// twice, a depth not `waves` or `branch`, or a reviewer without exactly one of an agent and a
/// command. It reads nothing, so it returns at once.
#[napi]
pub fn check_run_options(options: RunOptions) -> napi::Result<()> {
    settings::check_run_options(&options)
        .map_err(|error| napi::Error::from_reason(format!("{}: {}", error.code, error.message)))
}

/// A feature's run options over the settings' defaults: each value the feature sets wins, and its
/// reviewers replace the defaults' list whole. It reads nothing, so it returns at once.
#[napi]
pub fn merge_run_options(defaults: RunOptions, feature: RunOptions) -> RunOptions {
    settings::merge_run_options(&defaults, &feature)
}

/// Sets whether the keys of one printable character act in the web UI.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn set_single_key_shortcuts(dir: String, on: bool) -> AsyncTask<Job<Settings>> {
    job(move || settings::set_single_key_shortcuts(Path::new(&dir), on))
}

/// Sets whether a kind of automatic run is on: the continue after a restart or after a usage
/// limit, or the catch-up of open pull requests.
#[napi(
    ts_args_type = "dir: string, key: \"restart\" | \"limit\" | \"catch-up\", on: boolean",
    ts_return_type = "Promise<Settings>"
)]
pub fn set_continue(dir: String, key: String, on: bool) -> napi::Result<AsyncTask<Job<Settings>>> {
    let key = match key.as_str() {
        "restart" => ContinueKey::Restart,
        "limit" => ContinueKey::Limit,
        "catch-up" => ContinueKey::CatchUp,
        _ => {
            return Err(napi::Error::from_reason(format!(
                "refused: {key} is not a kind of automatic run: restart, limit, or catch-up."
            )));
        }
    };
    Ok(job(move || {
        settings::set_continue(Path::new(&dir), key, on)
    }))
}

/// Sets the automatic continues in a row, from the text typed.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn set_automatic_continues(dir: String, continues: String) -> AsyncTask<Job<Settings>> {
    job(move || settings::set_automatic_continues(Path::new(&dir), &continues))
}

/// Sets whether the text fields edit with Vim's keys.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn set_vim_mode(dir: String, on: bool) -> AsyncTask<Job<Settings>> {
    job(move || settings::set_vim_mode(Path::new(&dir), on))
}

/// Sets the lines of Vim's commands run when Vim starts.
#[napi(ts_return_type = "Promise<Settings>")]
pub fn set_vim_commands(dir: String, lines: Vec<String>) -> AsyncTask<Job<Settings>> {
    job(move || settings::set_vim_commands(Path::new(&dir), &lines))
}
