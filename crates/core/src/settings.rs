//! Uraeda's settings, `config.toml` in its config folder: the only code that finds, reads, checks,
//! and writes the file (see `specs/decisions/settings.md`). A change edits the file as it is when
//! written, keeping its comments, its unknown keys, and its order.

use std::path::{Path, PathBuf};

#[cfg(feature = "napi")]
use napi_derive::napi;
use toml_edit::{Array, DocumentMut, Item, Key, TableLike, Value};

use crate::api::ApiError;

mod file;
mod keyboard;
mod list;
mod rules;
mod runs;
mod runs_write;

pub(crate) use file::{line, load as load_text, parse as parse_text};
pub use keyboard::{set_single_key_shortcuts, set_vim_commands, set_vim_mode};
pub use runs::{
    ReviewerOptions, RunOptions, RunPick, STEPS, StepOptions, check_run_options, merge_run_options,
};
pub use runs_write::set_run_options;

/// The start of a file the first write creates.
pub(crate) const HEADER: &str =
    "# Uraeda's settings. The settings page writes this file too, and keeps your comments.\n";

/// The settings the file holds, an absent key unset.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Settings {
    pub server: ServerSettings,
    pub runs: RunSettings,
    pub keyboard: KeyboardSettings,
}

/// The `[server]` table.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ServerSettings {
    /// Trimmed and in lower case.
    pub allowed_hosts: Option<Vec<String>>,
    pub port: Option<u16>,
    pub open_browser: Option<bool>,
}

/// The `[runs]` table: how the workflow's runs start.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RunSettings {
    /// Whether a run the server's restart cut continues by itself: `true` when unset.
    pub continue_after_restart: Option<bool>,
    /// Whether a run a session limit stopped continues at its reset: `true` when unset.
    pub continue_after_limit: Option<bool>,
    /// Automatic continues in a row before the run asks, 1 to 10: 3 when unset.
    pub automatic_continues: Option<i64>,
    /// Whether an open pull request behind the default branch is caught up by itself: `false`
    /// when unset.
    pub catch_up_pull_requests: Option<bool>,
    /// Whether the jobs start at their times: `true` when unset.
    pub scheduled_jobs: Option<bool>,
    /// The agent a new session runs on when nothing picks one, like `claude` or `codex`: the
    /// first agent on when unset, not registered, or off in the session's repository.
    pub default_agent: Option<String>,
    /// Each step's agent, model, effort, and session, the implementers, and the reviewers: the
    /// `[runs.steps.<step>]`, `[runs.implementers]`, and `[[runs.reviewers]]` tables.
    pub options: RunOptions,
}

/// A kind of automatic run, each with its switch in `[runs]`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContinueKey {
    /// `continue_after_restart`.
    Restart,
    /// `continue_after_limit`.
    Limit,
    /// `catch_up_pull_requests`.
    CatchUp,
    /// `scheduled_jobs`.
    Jobs,
}

impl ContinueKey {
    /// The switch's key in `[runs]`.
    pub const fn key(self) -> &'static str {
        match self {
            Self::Restart => "continue_after_restart",
            Self::Limit => "continue_after_limit",
            Self::CatchUp => "catch_up_pull_requests",
            Self::Jobs => "scheduled_jobs",
        }
    }
}

/// The `[keyboard]` table: how the web UI's keys behave.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct KeyboardSettings {
    /// Whether the keys of one printable character act: `true` when unset.
    pub single_key_shortcuts: Option<bool>,
    /// Whether the text fields edit with Vim's keys: `false` when unset.
    pub vim_mode: Option<bool>,
    /// The lines of Vim's commands run when Vim starts, like `imap jj <Esc>`: none when unset.
    pub vim_commands: Option<Vec<String>>,
}

/// Uraeda's config folder: `URAEDA_CONFIG_DIR`, or else `$XDG_CONFIG_HOME/uraeda`, or else
/// `~/.config/uraeda`, on every system. `var` reads the environment, an empty value counting as
/// unset.
pub fn config_dir(var: impl Fn(&str) -> Option<String>, home: &Path) -> PathBuf {
    let var = |name: &str| var(name).filter(|value| !value.is_empty());
    if let Some(folder) = var("URAEDA_CONFIG_DIR") {
        return PathBuf::from(folder);
    }
    var("XDG_CONFIG_HOME")
        .map_or_else(|| home.join(".config"), PathBuf::from)
        .join("uraeda")
}

/// The config folder from this process's environment.
pub fn default_config_dir() -> PathBuf {
    let home = std::env::home_dir().unwrap_or_default();
    config_dir(|name| std::env::var(name).ok(), &home)
}

/// The settings in `dir`'s file: the defaults, all `None`, when there is none. A file that cannot
/// be read, or holds an invalid value, is `unreadable`.
pub fn read(dir: &Path) -> Result<Settings, ApiError> {
    checked(dir).map(|(_, settings)| settings)
}

/// `typed`, trimmed, when it is a port, a whole number from 1 to 65535; otherwise the problem, as
/// a flag or a variable giving the port is checked.
pub fn port(typed: &str) -> Result<u16, String> {
    rules::port(typed)
}

/// `typed`, trimmed, when it is a cap on automatic continues, a whole number from 1 to 10;
/// otherwise the problem, as a flag or a variable giving the cap is checked.
pub fn automatic_continues(typed: &str) -> Result<i64, String> {
    rules::automatic_continues(typed)
}

/// Adds a host name, trimmed and in lower case, at the end of `allowed_hosts`.
pub fn add_allowed_host(dir: &Path, name: &str) -> Result<Settings, ApiError> {
    let name = rules::host_name(name).map_err(refused)?;
    change(dir, |server| {
        let hosts = hosts(server)?;
        if !positions(hosts, &name).is_empty() {
            return Err(already(&name));
        }
        list::push(hosts, &name);
        Ok(())
    })
}

/// Replaces the host name `from` with `to`, trimmed and in lower case, in its place. A name the
/// file lists more than once is replaced in its first place, and its copies removed.
pub fn edit_allowed_host(dir: &Path, from: &str, to: &str) -> Result<Settings, ApiError> {
    let to = rules::host_name(to).map_err(refused)?;
    change(dir, |server| {
        let hosts = hosts(server)?;
        let places = positions(hosts, from);
        let Some((&first, copies)) = places.split_first() else {
            return Err(not_listed(from));
        };
        if positions(hosts, &to)
            .iter()
            .any(|other| !places.contains(other))
        {
            return Err(already(&to));
        }
        for &copy in copies.iter().rev() {
            list::remove(hosts, copy);
        }
        hosts.replace(first, to.as_str());
        Ok(())
    })
}

/// Removes the host name `name`, every copy of it.
pub fn remove_allowed_host(dir: &Path, name: &str) -> Result<Settings, ApiError> {
    change(dir, |server| {
        let hosts = hosts(server)?;
        let places = positions(hosts, name);
        if places.is_empty() {
            return Err(not_listed(name));
        }
        for &place in places.iter().rev() {
            list::remove(hosts, place);
        }
        Ok(())
    })
}

/// Sets the port to `typed`, a whole number from 1 to 65535.
pub fn set_port(dir: &Path, typed: &str) -> Result<Settings, ApiError> {
    let port = rules::port(typed).map_err(refused)?;
    change(dir, |server| {
        set(server, "port", Value::from(i64::from(port)));
        Ok(())
    })
}

/// Sets whether a start opens a browser.
pub fn set_open_browser(dir: &Path, open: bool) -> Result<Settings, ApiError> {
    change(dir, |server| {
        set(server, "open_browser", Value::from(open));
        Ok(())
    })
}

/// Sets whether the kind of automatic run `key` is on, in `[runs]`.
pub fn set_continue(dir: &Path, key: ContinueKey, on: bool) -> Result<Settings, ApiError> {
    change_table(dir, "runs", |runs| {
        set(runs, key.key(), Value::from(on));
        Ok(())
    })
}

/// Sets the automatic continues in a row to `typed`, a whole number from 1 to 10, in `[runs]`.
pub fn set_automatic_continues(dir: &Path, typed: &str) -> Result<Settings, ApiError> {
    let continues = rules::automatic_continues(typed).map_err(refused)?;
    change_table(dir, "runs", |runs| {
        set(runs, "automatic_continues", Value::from(continues));
        Ok(())
    })
}

/// Sets the agent a new session runs on when nothing picks one, trimmed, in `[runs]`: `None`
/// removes it, and the first agent on is the default again. An empty name is refused.
pub fn set_default_agent(dir: &Path, agent: Option<&str>) -> Result<Settings, ApiError> {
    let agent = agent.map(str::trim);
    if agent == Some("") {
        return Err(refused("The agent is empty."));
    }
    change_table(dir, "runs", |runs| {
        match agent {
            Some(agent) => set(runs, "default_agent", Value::from(agent)),
            None => {
                runs.remove("default_agent");
            }
        }
        Ok(())
    })
}

/// The file's text and layout, `None` when there is none, and its settings; or the `unreadable`
/// problem.
fn checked(dir: &Path) -> Result<(Option<(String, file::Layout)>, Settings), ApiError> {
    let read = file::load(dir).map_err(|problem| unreadable(dir, &problem))?;
    let settings = read
        .as_ref()
        .map_or_else(|| Ok(Settings::default()), |(text, _)| file::parse(text))
        .map_err(|problem| unreadable(dir, &problem))?;
    Ok((read, settings))
}

/// Applies `edit` to the `[server]` table of the file as it is now, as `change_table` does.
fn change(
    dir: &Path,
    edit: impl FnOnce(&mut dyn TableLike) -> Result<(), ApiError>,
) -> Result<Settings, ApiError> {
    change_table(dir, "server", edit)
}

/// Applies `edit` to the table `name` of the file as it is now, as `change_path` does.
fn change_table(
    dir: &Path,
    name: &str,
    edit: impl FnOnce(&mut dyn TableLike) -> Result<(), ApiError>,
) -> Result<Settings, ApiError> {
    change_path(dir, &[name], edit)
}

/// Applies `edit` to the table at `path`, like `["extensions", "wiki"]` for `[extensions.wiki]`,
/// of the file as it is now, created when absent with the tables above it implicit, one write at a
/// time, and writes the file, refused while the file cannot be read. A file the write creates
/// starts with its header and the table at `path`.
pub(crate) fn change_path(
    dir: &Path,
    path: &[&str],
    edit: impl FnOnce(&mut dyn TableLike) -> Result<(), ApiError>,
) -> Result<Settings, ApiError> {
    let table = path.iter().map(|name| Key::new(*name).to_string());
    let table = table.collect::<Vec<_>>().join(".");
    let seed = if path.is_empty() {
        HEADER.to_owned()
    } else {
        format!("{HEADER}\n[{table}]\n")
    };
    change_document(dir, &seed, |document| {
        edit(nested(dir, document.as_table_mut(), path)?)
    })
}

/// Applies `edit` to the whole document of the file as it is now, as `change_path` does; a file
/// the write creates starts with the text `seed`.
pub(crate) fn change_document(
    dir: &Path,
    seed: &str,
    edit: impl FnOnce(&mut DocumentMut) -> Result<(), ApiError>,
) -> Result<Settings, ApiError> {
    let _lock = crate::cache::folder_lock(dir);
    let (read, _) = checked(dir)?;
    let (text, layout) = read.unwrap_or_else(|| (seed.to_owned(), file::Layout::default()));
    // `checked` parsed the same text, so this failure is unreachable; it still answers.
    let mut document: DocumentMut = text
        .parse()
        .map_err(|error: toml_edit::TomlError| unreadable(dir, error.message()))?;
    edit(&mut document)?;
    let text = document.to_string();
    let not_saved = |reason: &str| refused(format!("Could not save {}: {reason}", shown_file(dir)));
    let settings = file::parse(&text).map_err(|problem| not_saved(&problem))?;
    file::save(dir, &text, layout).map_err(|reason| not_saved(&format!("{reason}.")))?;
    Ok(settings)
}

/// The table at `path` in `table`, each one created when absent: implicit, so that it shows no
/// header of its own, but for the last.
fn nested<'a>(
    dir: &Path,
    table: &'a mut dyn TableLike,
    path: &[&str],
) -> Result<&'a mut dyn TableLike, ApiError> {
    let Some((name, rest)) = path.split_first() else {
        return Ok(table);
    };
    let inner = table
        .entry(name)
        .or_insert_with(|| {
            let mut created = toml_edit::Table::new();
            created.set_implicit(!rest.is_empty());
            Item::Table(created)
        })
        .as_table_like_mut()
        .ok_or_else(|| unreadable(dir, &format!("[{name}] is a table of settings.")))?;
    nested(dir, inner, rest)
}

/// `allowed_hosts`, created empty when absent.
fn hosts(server: &mut dyn TableLike) -> Result<&mut Array, ApiError> {
    if server.get("allowed_hosts").is_none() {
        server.insert("allowed_hosts", Item::Value(Value::Array(Array::new())));
    }
    // A file read without a problem lists its host names, so the refusal is unreachable.
    server
        .get_mut("allowed_hosts")
        .and_then(Item::as_array_mut)
        .ok_or_else(|| refused("The allowed host names are not a list."))
}

/// Every place where `name`, trimmed and in any case, is in the list.
fn positions(hosts: &Array, name: &str) -> Vec<usize> {
    let name = name.trim();
    hosts
        .iter()
        .enumerate()
        .filter(|(_, value)| {
            value
                .as_str()
                .is_some_and(|listed| listed.eq_ignore_ascii_case(name))
        })
        .map(|(place, _)| place)
        .collect()
}

/// Sets `key` to `value`, keeping the comment and spaces around the value it replaces.
pub(crate) fn set(table: &mut dyn TableLike, key: &str, mut value: Value) {
    match table.get_mut(key) {
        Some(Item::Value(old)) => {
            *value.decor_mut() = old.decor().clone();
            *old = value;
        }
        _ => {
            table.insert(key, Item::Value(value));
        }
    }
}

pub(crate) fn refused(message: impl Into<String>) -> ApiError {
    ApiError {
        code: "refused",
        message: message.into(),
        output: None,
    }
}

pub(crate) fn unreadable(dir: &Path, problem: &str) -> ApiError {
    ApiError {
        code: "unreadable",
        message: format!("Cannot read {}: {problem}", shown_file(dir)),
        output: None,
    }
}

fn already(name: &str) -> ApiError {
    refused(format!("{name} is already allowed."))
}

fn not_listed(name: &str) -> ApiError {
    refused(format!("{} is not an allowed host name.", name.trim()))
}

/// `path` as messages show it, the home folder `home` written `~`; unchanged outside it, or when
/// `home` is empty.
pub fn shown(path: &Path, home: &Path) -> String {
    match path.strip_prefix(home) {
        Ok(rest) if !home.as_os_str().is_empty() => Path::new("~").join(rest).display().to_string(),
        _ => path.display().to_string(),
    }
}

/// The settings file in `dir`, as messages show it, the home folder written `~`.
pub fn shown_file(dir: &Path) -> String {
    shown(
        &dir.join(file::FILE),
        &std::env::home_dir().unwrap_or_default(),
    )
}
