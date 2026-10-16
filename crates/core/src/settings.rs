//! Uraeda's settings, `config.toml` in its config folder: the only code that finds, reads, checks,
//! and writes the file (see `specs/decisions/settings.md`). A change edits the file as it is when
//! written, keeping its comments, its unknown keys, and its order.

use std::path::{Path, PathBuf};

#[cfg(feature = "napi")]
use napi_derive::napi;
use toml_edit::{Array, DocumentMut, Item, TableLike, Value};

use crate::api::ApiError;

mod file;
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

/// Adds a host name, trimmed and in lower case, at the end of `allowed_hosts`.
pub fn add_allowed_host(dir: &Path, name: &str) -> Result<Settings, ApiError> {
    let name = rules::host_name(name).map_err(refused)?;
    change(dir, |server| {
        let hosts = hosts(server);
        if position(hosts, &name).is_some() {
            return Err(already(&name));
        }
        let decor = hosts
            .iter()
            .last()
            .map(|last| last.decor().clone())
            .filter(|decor| prefix(decor).contains('\n'));
        hosts.push(name.as_str());
        if let (Some(decor), Some(added)) = (decor, hosts.iter_mut().last()) {
            *added.decor_mut() = decor;
        }
        Ok(())
    })
}

/// Replaces the host name `from` with `to`, trimmed and in lower case, in its place.
pub fn edit_allowed_host(dir: &Path, from: &str, to: &str) -> Result<Settings, ApiError> {
    let to = rules::host_name(to).map_err(refused)?;
    change(dir, |server| {
        let hosts = hosts(server);
        let index = position(hosts, from).ok_or_else(|| not_listed(from))?;
        if position(hosts, &to).is_some_and(|other| other != index) {
            return Err(already(&to));
        }
        hosts.replace(index, to.as_str());
        Ok(())
    })
}

/// Removes the host name `name`.
pub fn remove_allowed_host(dir: &Path, name: &str) -> Result<Settings, ApiError> {
    change(dir, |server| {
        let hosts = hosts(server);
        let index = position(hosts, name).ok_or_else(|| not_listed(name))?;
        let removed = hosts.remove(index);
        // The first name's place, `["` with no space, goes to the name now first.
        if let (0, Some(first)) = (index, hosts.get_mut(0)) {
            *first.decor_mut() = removed.decor().clone();
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

/// The file's text, `None` when there is none, and its settings; or the `unreadable` problem.
fn checked(dir: &Path) -> Result<(Option<String>, Settings), ApiError> {
    let unreadable = |problem: String| ApiError {
        code: "unreadable",
        message: format!("Cannot read {}: {problem}", shown(&dir.join(file::FILE))),
        output: None,
    };
    let text = file::load(dir).map_err(unreadable)?;
    let settings = text
        .as_deref()
        .map_or_else(|| Ok(Settings::default()), file::parse)
        .map_err(unreadable)?;
    Ok((text, settings))
}

/// Applies `edit` to the `[server]` table of the file as it is now, one write at a time, and
/// writes the file, refused while the file cannot be read.
fn change(
    dir: &Path,
    edit: impl FnOnce(&mut dyn TableLike) -> Result<(), ApiError>,
) -> Result<Settings, ApiError> {
    let _lock = crate::api::write_lock();
    let (text, _) = checked(dir)?;
    let text = text.unwrap_or_else(|| format!("{HEADER}\n[server]\n"));
    let mut document: DocumentMut = text.parse().expect("a file read without a problem parses");
    let server = document
        .as_table_mut()
        .entry("server")
        .or_insert_with(toml_edit::table)
        .as_table_like_mut()
        .expect("a file read without a problem has a table of settings");
    edit(server)?;
    let text = document.to_string();
    let settings = file::parse(&text).expect("a change keeps the file valid");
    file::save(dir, &text).map_err(|reason| {
        refused(format!(
            "Could not save {}: {reason}.",
            shown(&dir.join(file::FILE))
        ))
    })?;
    Ok(settings)
}

/// `allowed_hosts`, created empty when absent.
fn hosts(server: &mut dyn TableLike) -> &mut Array {
    if server.get("allowed_hosts").is_none() {
        server.insert("allowed_hosts", Item::Value(Value::Array(Array::new())));
    }
    server
        .get_mut("allowed_hosts")
        .and_then(Item::as_array_mut)
        .expect("a file read without a problem lists its host names")
}

/// Where `name`, trimmed and in any case, is in the list.
fn position(hosts: &Array, name: &str) -> Option<usize> {
    let name = name.trim();
    hosts.iter().position(|value| {
        value
            .as_str()
            .is_some_and(|listed| listed.eq_ignore_ascii_case(name))
    })
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

fn prefix(decor: &toml_edit::Decor) -> &str {
    decor
        .prefix()
        .and_then(|prefix| prefix.as_str())
        .unwrap_or_default()
}

fn refused(message: impl Into<String>) -> ApiError {
    ApiError {
        code: "refused",
        message: message.into(),
        output: None,
    }
}

fn already(name: &str) -> ApiError {
    refused(format!("{name} is already allowed."))
}

fn not_listed(name: &str) -> ApiError {
    refused(format!("{} is not an allowed host name.", name.trim()))
}

/// `path`, with the home folder written `~`.
fn shown(path: &Path) -> String {
    let home = std::env::home_dir().filter(|home| !home.as_os_str().is_empty());
    match home.and_then(|home| path.strip_prefix(home).ok().map(Path::to_owned)) {
        Some(rest) => Path::new("~").join(rest).display().to_string(),
        None => path.display().to_string(),
    }
}
