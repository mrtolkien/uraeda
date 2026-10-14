//! The list of repositories the web UI serves, `repositories.json` in Uraeda's data folder, shared
//! by the CLI and the server (see `specs/decisions/repositories.md`).

use std::fs;
use std::io::{ErrorKind, Write as _};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::SystemTime;

use serde::{Deserialize, Serialize};

use crate::git::Git;
use crate::today;

/// The list's file, in the data folder.
const FILE: &str = "repositories.json";
/// Where a write goes before it is renamed over the file, one per write: `repositories.json.`,
/// then the process and a count, so writers in other processes never share it.
const TEMPORARY: &str = "repositories.json.";
/// The file format this core reads and writes.
const VERSION: u64 = 1;

/// A repository of the list.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Repository {
    /// Unique in the list, made of letters, digits, `.`, `_`, and `-`.
    pub name: String,
    /// The main checkout, absolute.
    pub path: PathBuf,
    /// When it was added or last opened, in RFC 3339, in UTC.
    pub opened_at: String,
    /// `path` no longer holds the main checkout of a git repository.
    pub missing: bool,
}

/// A repository `add` listed, or found listed already.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Added {
    pub repository: Repository,
    pub existed: bool,
}

/// Failing to read or change the list.
#[derive(Debug, thiserror::Error)]
pub enum ListError {
    #[error("repositories.json could not be read: {0}")]
    Read(String),
    #[error("No such folder: {}.", .0.display())]
    NoSuchFolder(PathBuf),
    #[error("Not a git repository: {}. Run git init there first.", .0.display())]
    NotARepository(PathBuf),
    #[error("No repository named “{0}”")]
    Unknown(String),
    #[error("repositories.json could not be written: {0}")]
    Write(String),
}

/// The file, as stored.
#[derive(Debug, Deserialize, Serialize)]
struct File {
    version: u64,
    repositories: Vec<Entry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    name: String,
    path: PathBuf,
    opened_at: String,
}

/// Uraeda's data folder for the user: `URAEDA_DATA_DIR`, or else the operating system's default for
/// application data. `var` reads the environment, an empty value counting as unset; `os` is
/// `std::env::consts::OS`.
pub fn data_dir(var: impl Fn(&str) -> Option<String>, os: &str, home: &Path) -> PathBuf {
    let var = |name: &str| var(name).filter(|value| !value.is_empty());
    if let Some(folder) = var("URAEDA_DATA_DIR") {
        return PathBuf::from(folder);
    }
    match os {
        // Joined with `\` whatever the platform this runs on.
        "windows" => {
            let roaming =
                var("APPDATA").unwrap_or_else(|| format!("{}\\AppData\\Roaming", home.display()));
            PathBuf::from(format!("{roaming}\\uraeda"))
        }
        "macos" => home.join("Library/Application Support/uraeda"),
        _ => var("XDG_DATA_HOME")
            .map_or_else(|| home.join(".local/share"), PathBuf::from)
            .join("uraeda"),
    }
}

/// The data folder from this process's environment.
pub fn default_data_dir() -> PathBuf {
    let home = std::env::home_dir().unwrap_or_default();
    data_dir(|name| std::env::var(name).ok(), std::env::consts::OS, &home)
}

/// The list, the most recently opened first, then by name. A missing file is an empty list.
pub fn read(data_dir: &Path) -> Result<Vec<Repository>, ListError> {
    Ok(listed(load(data_dir)?))
}

/// Adds the git repository holding `folder`, an absolute path, as its main checkout. A repository
/// listed already is touched, and returned with `existed`.
pub fn add(data_dir: &Path, folder: &Path, now: SystemTime) -> Result<Added, ListError> {
    if !folder.is_dir() {
        return Err(ListError::NoSuchFolder(folder.into()));
    }
    let path = Git::discover(folder)
        .map_err(|_| ListError::NotARepository(folder.into()))?
        .main_root();
    let _lock = crate::api::write_lock();
    let mut entries = load(data_dir)?;
    let opened_at = today::rfc3339(now);
    let existed = match entries.iter_mut().find(|entry| entry.path == path) {
        Some(entry) => {
            entry.opened_at = opened_at;
            true
        }
        None => {
            let name = unique_name(&entries, &path);
            entries.push(Entry {
                name,
                path: path.clone(),
                opened_at,
            });
            false
        }
    };
    save(data_dir, &entries)?;
    let entry = entries.iter().find(|entry| entry.path == path);
    Ok(Added {
        repository: repository(entry.expect("added").clone()),
        existed,
    })
}

/// Takes a repository off the list, leaving its folder as it is.
pub fn remove(data_dir: &Path, name: &str) -> Result<(), ListError> {
    let _lock = crate::api::write_lock();
    let mut entries = load(data_dir)?;
    let before = entries.len();
    entries.retain(|entry| entry.name != name);
    if entries.len() == before {
        return Err(ListError::Unknown(name.into()));
    }
    save(data_dir, &entries)
}

/// Records that a repository was opened now.
pub fn touch(data_dir: &Path, name: &str, now: SystemTime) -> Result<Repository, ListError> {
    let _lock = crate::api::write_lock();
    let mut entries = load(data_dir)?;
    let entry = entries
        .iter_mut()
        .find(|entry| entry.name == name)
        .ok_or_else(|| ListError::Unknown(name.into()))?;
    entry.opened_at = today::rfc3339(now);
    let touched = entry.clone();
    save(data_dir, &entries)?;
    Ok(repository(touched))
}

/// The file's entries, as stored.
fn load(data_dir: &Path) -> Result<Vec<Entry>, ListError> {
    let text = match fs::read_to_string(data_dir.join(FILE)) {
        Ok(text) => text,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(ListError::Read(error.to_string())),
    };
    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|error| ListError::Read(error.to_string()))?;
    match json.get("version") {
        Some(version) if version.as_u64() == Some(VERSION) => {}
        Some(version) => return Err(ListError::Read(format!("unknown version {version}"))),
        None => return Err(ListError::Read("no \"version\"".into())),
    }
    let file: File =
        serde_json::from_value(json).map_err(|error| ListError::Read(error.to_string()))?;
    Ok(file.repositories)
}

/// Replaces the file whole, the list sorted: written aside, then renamed over it.
fn save(data_dir: &Path, entries: &[Entry]) -> Result<(), ListError> {
    let write = |error: std::io::Error| ListError::Write(error.to_string());
    let mut repositories = entries.to_vec();
    repositories.sort_by(order);
    let file = File {
        version: VERSION,
        repositories,
    };
    let mut text = serde_json::to_string_pretty(&file).expect("the list is JSON");
    text.push('\n');
    fs::create_dir_all(data_dir).map_err(write)?;
    let temporary = temporary(data_dir);
    let mut file = fs::File::create_new(&temporary).map_err(write)?;
    let written = file
        .write_all(text.as_bytes())
        .and_then(|()| fs::rename(&temporary, data_dir.join(FILE)));
    if let Err(error) = written {
        let _ = fs::remove_file(&temporary);
        return Err(write(error));
    }
    Ok(())
}

/// A temporary file's path no other write uses, in this process or another.
fn temporary(data_dir: &Path) -> PathBuf {
    static COUNT: AtomicU64 = AtomicU64::new(0);
    let count = COUNT.fetch_add(1, Ordering::Relaxed);
    data_dir.join(format!("{TEMPORARY}{}.{count}.tmp", std::process::id()))
}

/// The most recently opened first, then by name.
fn order(a: &Entry, b: &Entry) -> std::cmp::Ordering {
    b.opened_at
        .cmp(&a.opened_at)
        .then_with(|| a.name.cmp(&b.name))
}

fn listed(mut entries: Vec<Entry>) -> Vec<Repository> {
    entries.sort_by(order);
    entries.into_iter().map(repository).collect()
}

fn repository(entry: Entry) -> Repository {
    let missing = Git::open(&entry.path).map_or(true, |git| git.main_root() != entry.path);
    Repository {
        name: entry.name,
        path: entry.path,
        opened_at: entry.opened_at,
        missing,
    }
}

/// The folder's name, made of letters, digits, `.`, `_`, and `-`; when taken, its parent's name
/// before it; then `-2`, `-3`, and so on.
fn unique_name(entries: &[Entry], path: &Path) -> String {
    let taken = |name: &str| entries.iter().any(|entry| entry.name == name);
    let part = |path: Option<&Path>| {
        path.and_then(Path::file_name)
            .map(|name| safe(&name.to_string_lossy()))
            .unwrap_or_default()
    };
    let folder = part(Some(path));
    let folder = if folder.is_empty() {
        "repository".to_string()
    } else {
        folder
    };
    if !taken(&folder) {
        return folder;
    }
    let parent = part(path.parent());
    let base = if parent.is_empty() {
        folder
    } else {
        format!("{parent}-{folder}")
    };
    if !taken(&base) {
        return base;
    }
    (2..)
        .map(|count| format!("{base}-{count}"))
        .find(|name| !taken(name))
        .expect("a free name")
}

/// Replaces every character outside `[A-Za-z0-9._-]` with `-`.
fn safe(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') {
                c
            } else {
                '-'
            }
        })
        .collect()
}
