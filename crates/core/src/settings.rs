//! Uraeda's settings, `config.toml` in its config folder: the only code that finds, reads, checks,
//! and writes the file (see `specs/decisions/settings.md`). A change edits the file as it is when
//! written, keeping its comments, its unknown keys, and its order.

use std::path::{Path, PathBuf};

#[cfg(feature = "napi")]
use napi_derive::napi;
use toml_edit::{Array, DocumentMut, Item, TableLike, Value};

use crate::api::ApiError;

mod file;
mod list;
mod rules;

/// The start of a file the first write creates.
const HEADER: &str =
    "# Uraeda's settings. The settings page writes this file too, and keeps your comments.\n";

/// The settings the file holds, an absent key unset.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Settings {
    pub server: ServerSettings,
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

/// Applies `edit` to the `[server]` table of the file as it is now, one write at a time, and
/// writes the file, refused while the file cannot be read.
fn change(
    dir: &Path,
    edit: impl FnOnce(&mut dyn TableLike) -> Result<(), ApiError>,
) -> Result<Settings, ApiError> {
    let _lock = crate::api::write_lock();
    let (read, _) = checked(dir)?;
    let (text, layout) =
        read.unwrap_or_else(|| (format!("{HEADER}\n[server]\n"), file::Layout::default()));
    // `checked` parsed the same text, so these failures are unreachable; each still answers.
    let mut document: DocumentMut = text
        .parse()
        .map_err(|error: toml_edit::TomlError| unreadable(dir, error.message()))?;
    let server = document
        .as_table_mut()
        .entry("server")
        .or_insert_with(toml_edit::table)
        .as_table_like_mut()
        .ok_or_else(|| unreadable(dir, "[server] is a table of settings."))?;
    edit(server)?;
    let text = document.to_string();
    let not_saved = |reason: &str| refused(format!("Could not save {}: {reason}", shown_file(dir)));
    let settings = file::parse(&text).map_err(|problem| not_saved(&problem))?;
    file::save(dir, &text, layout).map_err(|reason| not_saved(&format!("{reason}.")))?;
    Ok(settings)
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
fn set(server: &mut dyn TableLike, key: &str, mut value: Value) {
    match server.get_mut(key) {
        Some(Item::Value(old)) => {
            *value.decor_mut() = old.decor().clone();
            *old = value;
        }
        _ => {
            server.insert(key, Item::Value(value));
        }
    }
}

fn refused(message: impl Into<String>) -> ApiError {
    ApiError {
        code: "refused",
        message: message.into(),
        output: None,
    }
}

fn unreadable(dir: &Path, problem: &str) -> ApiError {
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
