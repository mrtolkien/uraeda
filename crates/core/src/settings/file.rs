//! The settings file's text: read and checked, each problem with its line, and written whole.

use std::fs;
use std::io::{ErrorKind, Write as _};
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use toml_edit::{Document, Item, Key, TableLike};

use super::rules;
use super::{ServerSettings, Settings};

/// The file, in the config folder.
pub const FILE: &str = "config.toml";
/// Where a write goes before it is renamed over the file, one per write: `config.toml.`, then the
/// process and a count, so writers in other processes never share it.
const TEMPORARY: &str = "config.toml.";

/// The file's text, `None` when there is none. Any other failure is the problem, as a reason.
pub fn load(dir: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(dir.join(FILE)) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("{}.", reason(&error))),
    }
}

/// The settings `text` holds, or its first problem: `line 3, port: The port is …`.
pub fn parse(text: &str) -> Result<Settings, String> {
    let document = Document::parse(text).map_err(|error| {
        let line = error.span().map_or(1, |span| line(text, span.start));
        let message = error
            .message()
            .lines()
            .map(str::trim)
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join(", ");
        format!("line {line}: {message}.")
    })?;
    let Some((key, server)) = document.as_table().get_key_value("server") else {
        return Ok(Settings::default());
    };
    let server = server
        .as_table_like()
        .ok_or_else(|| {
            (
                offset(key, server),
                "server",
                "[server] is a table of settings.".to_owned(),
            )
        })
        .and_then(parse_server)
        .map_err(|(offset, key, problem)| {
            let at = offset.map_or_else(String::new, |offset| {
                format!("line {}, ", line(text, offset))
            });
            format!("{at}{key}: {problem}")
        })?;
    Ok(Settings { server })
}

/// A problem: where it is, as an offset in the text, the key, and the problem.
type Problem = (Option<usize>, &'static str, String);

/// Where a key is, or its value when the key has no place.
fn offset(key: &Key, item: &Item) -> Option<usize> {
    key.span().or_else(|| item.span()).map(|span| span.start)
}

/// The `[server]` table's values.
fn parse_server(server: &dyn TableLike) -> Result<ServerSettings, Problem> {
    let mut settings = ServerSettings::default();
    if let Some((key, item)) = server.get_key_value("allowed_hosts") {
        settings.allowed_hosts = Some(allowed_hosts(item).map_err(|(span, problem)| {
            let start = span.map(|span| span.start).or_else(|| offset(key, item));
            (start, "allowed_hosts", problem)
        })?);
    }
    if let Some((key, item)) = server.get_key_value("port") {
        let port = item
            .as_integer()
            .ok_or_else(|| rules::PORT_PROBLEM.to_owned())
            .and_then(rules::port_number);
        settings.port = Some(port.map_err(|problem| (offset(key, item), "port", problem))?);
    }
    if let Some((key, item)) = server.get_key_value("open_browser") {
        let open = item.as_bool().ok_or_else(|| {
            (
                offset(key, item),
                "open_browser",
                "Opening a browser at start is true or false.".to_owned(),
            )
        })?;
        settings.open_browser = Some(open);
    }
    Ok(settings)
}

/// The host names of `allowed_hosts`, trimmed and in lower case, or the problem and the span of
/// the value at fault.
fn allowed_hosts(item: &Item) -> Result<Vec<String>, (Option<Range<usize>>, String)> {
    let list = || "The allowed host names are a list, like [\"mac.tail1234.ts.net\"].".to_owned();
    let array = item.as_array().ok_or_else(|| (None, list()))?;
    array
        .iter()
        .map(|value| {
            let name = value.as_str().ok_or_else(|| (value.span(), list()))?;
            rules::host_name(name).map_err(|problem| (value.span(), problem))
        })
        .collect()
}

/// The line, from 1, holding `offset`.
fn line(text: &str, offset: usize) -> usize {
    text[..offset.min(text.len())].matches('\n').count() + 1
}

/// Replaces the file whole with `text`: written aside, then renamed over it. The failure is its
/// reason, `permission denied`.
pub fn save(dir: &Path, text: &str) -> Result<(), String> {
    let failed = |error: std::io::Error| reason(&error);
    fs::create_dir_all(dir).map_err(failed)?;
    let temporary = temporary(dir);
    let mut file = fs::File::create_new(&temporary).map_err(failed)?;
    let written = file
        .write_all(text.as_bytes())
        .and_then(|()| file.sync_all())
        .and_then(|()| fs::rename(&temporary, dir.join(FILE)));
    if let Err(error) = written {
        let _ = fs::remove_file(&temporary);
        return Err(failed(error));
    }
    Ok(())
}

/// An I/O error's kind, in lower case: `permission denied`.
fn reason(error: &std::io::Error) -> String {
    error.kind().to_string().to_lowercase()
}

/// A temporary file's path no other write uses, in this process or another.
fn temporary(dir: &Path) -> PathBuf {
    static COUNT: AtomicU64 = AtomicU64::new(0);
    let count = COUNT.fetch_add(1, Ordering::Relaxed);
    dir.join(format!("{TEMPORARY}{}.{count}.tmp", std::process::id()))
}
