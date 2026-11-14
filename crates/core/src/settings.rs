//! Uraeda's settings, `config.toml` in its config folder: the only code that finds, reads, checks,
//! and writes the file (see `specs/decisions/settings.md`). A change edits the file as it is when
//! written, keeping its comments, its unknown keys, and its order.

use std::path::{Path, PathBuf};

use toml_edit::{DocumentMut, Item, Key, TableLike, Value};

use crate::api::ApiError;

mod file;
mod rules;
mod runs;
mod runs_write;

pub use runs::{
    ReviewerOptions, RunOptions, RunPick, STEPS, StepOptions, check_run_options, merge_run_options,
};
pub use runs_write::set_run_options;

/// The start of a file the first write creates.
pub(crate) const HEADER: &str =
    "# Uraeda's settings. The settings page writes this file too, and keeps your comments.\n";

/// The settings the file holds, an absent key unset.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Settings {
    pub server: ServerSettings,
    pub runs: RunSettings,
    pub keyboard: KeyboardSettings,
}

/// The `[server]` table.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ServerSettings {
    /// Trimmed and in lower case.
    pub allowed_hosts: Option<Vec<String>>,
    pub port: Option<u16>,
    pub open_browser: Option<bool>,
}

/// The `[runs]` table: how the workflow's runs start.
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

/// The `[keyboard]` table: how the web UI's keys behave.
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
    let _lock = crate::lock::folder_lock(dir);
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
