//! The settings file, `config.toml` in Uraeda's config folder: read, and changed one value at a
//! time. A file that cannot be read rejects with `unreadable: `, and an invalid value or a failed
//! write with `refused: `.

use std::path::{Path, PathBuf};

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::settings::{self, Settings};

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
