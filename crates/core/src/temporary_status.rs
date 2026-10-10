// TEMPORARY: replaced by the CLI feature.
//! Reads the `status` field of the workflow files in spec folders.
//!
//! A thin slice that proves the stack end to end: the CLI prints it, the server serves it, the web
//! UI shows it. Its output and edge cases are not the final design.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Deserialize;

// TEMPORARY: replaced by the CLI feature.
/// A workflow file's status, as written in its frontmatter.
#[cfg_attr(feature = "napi", napi(string_enum = "kebab-case"))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    AwaitingHuman,
    Answered,
    Approved,
    ChangesRequested,
    AutoApproved,
}

impl Status {
    pub fn as_str(&self) -> &'static str {
        match self {
            Status::AwaitingHuman => "awaiting-human",
            Status::Answered => "answered",
            Status::Approved => "approved",
            Status::ChangesRequested => "changes-requested",
            Status::AutoApproved => "auto-approved",
        }
    }
}

// TEMPORARY: replaced by the CLI feature.
/// One workflow file: exactly one of `status` and `problem` is set.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileStatus {
    /// The file's name, like `clarifications-01.md`.
    pub file: String,
    /// `None` when the file is invalid.
    pub status: Option<Status>,
    /// What is wrong with the file, like `unknown status "done"`. `None` when it is valid.
    pub problem: Option<String>,
}

// TEMPORARY: replaced by the CLI feature.
/// A feature folder and its workflow files: clarifications rounds in order, then `spec.md`, then
/// `plan.md`.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FolderStatus {
    /// The folder's name, like `2026-10-10-stack-decision`.
    pub name: String,
    pub files: Vec<FileStatus>,
}

// TEMPORARY: replaced by the CLI feature.
/// Failing to read a folder itself. Problems with a file are in its `FileStatus`.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("{}: no such folder", .0.display())]
    NoSuchFolder(PathBuf),
    #[error("{}: not a folder", .0.display())]
    NotAFolder(PathBuf),
    #[error("{}: {message}", path.display())]
    Io { path: PathBuf, message: String },
}

// TEMPORARY: replaced by the CLI feature.
/// The kinds of workflow files that carry a status.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Kind {
    Clarifications(u8),
    Spec,
    Plan,
}

impl Kind {
    fn from_file_name(name: &str) -> Option<Kind> {
        match name {
            "spec.md" => Some(Kind::Spec),
            "plan.md" => Some(Kind::Plan),
            _ => {
                let round = name.strip_prefix("clarifications-")?.strip_suffix(".md")?;
                if round.len() == 2 && round.bytes().all(|byte| byte.is_ascii_digit()) {
                    round.parse().ok().map(Kind::Clarifications)
                } else {
                    None
                }
            }
        }
    }

    /// The statuses allowed for this kind, from the skill's workflow status table.
    fn allowed(&self) -> &'static [Status] {
        match self {
            Kind::Clarifications(_) => &[Status::AwaitingHuman, Status::Answered],
            Kind::Spec => &[
                Status::AwaitingHuman,
                Status::Approved,
                Status::ChangesRequested,
            ],
            Kind::Plan => &[
                Status::AwaitingHuman,
                Status::AutoApproved,
                Status::Approved,
                Status::ChangesRequested,
            ],
        }
    }
}

// TEMPORARY: replaced by the CLI feature.
/// Reads the workflow files of one feature folder.
pub fn temporary_read_folder(path: &Path) -> Result<FolderStatus, CoreError> {
    let entries = read_dir(path)?;
    let mut files: Vec<(Kind, String, PathBuf)> = entries
        .into_iter()
        .filter(|entry| entry.is_file)
        .filter_map(|entry| Some((Kind::from_file_name(&entry.name)?, entry.name, entry.path)))
        .collect();
    files.sort_by_key(|(kind, _, _)| *kind);

    Ok(FolderStatus {
        name: folder_name(path),
        files: files
            .into_iter()
            .map(|(kind, name, path)| read_file(kind, name, &path))
            .collect(),
    })
}

// TEMPORARY: replaced by the CLI feature.
/// Reads every feature folder of a `specs/` folder, newest first. Feature folders are named
/// `YYYY-MM-DD-<slug>`.
pub fn temporary_read_specs(path: &Path) -> Result<Vec<FolderStatus>, CoreError> {
    let mut folders: Vec<_> = read_dir(path)?
        .into_iter()
        .filter(|entry| !entry.is_file && is_feature_folder(&entry.name))
        .collect();
    folders.sort_by(|a, b| b.name.cmp(&a.name));
    folders
        .iter()
        .map(|entry| temporary_read_folder(&entry.path))
        .collect()
}

struct Entry {
    name: String,
    path: PathBuf,
    is_file: bool,
}

fn read_dir(path: &Path) -> Result<Vec<Entry>, CoreError> {
    let io_error = |error: std::io::Error| CoreError::Io {
        path: path.to_path_buf(),
        message: error.to_string(),
    };
    let metadata = fs::metadata(path).map_err(|error| match error.kind() {
        ErrorKind::NotFound => CoreError::NoSuchFolder(path.to_path_buf()),
        _ => io_error(error),
    })?;
    if !metadata.is_dir() {
        return Err(CoreError::NotAFolder(path.to_path_buf()));
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(path).map_err(io_error)? {
        let entry = entry.map_err(io_error)?;
        let Ok(name) = entry.file_name().into_string() else {
            continue;
        };
        let file_type = entry.file_type().map_err(io_error)?;
        if file_type.is_file() || file_type.is_dir() {
            entries.push(Entry {
                name,
                path: entry.path(),
                is_file: file_type.is_file(),
            });
        }
    }
    Ok(entries)
}

fn folder_name(path: &Path) -> String {
    fs::canonicalize(path)
        .ok()
        .and_then(|path| {
            path.file_name()
                .map(|name| name.to_string_lossy().into_owned())
        })
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn is_feature_folder(name: &str) -> bool {
    let bytes = name.as_bytes();
    bytes.len() > 11
        && bytes[..10]
            .iter()
            .enumerate()
            .all(|(index, byte)| match index {
                4 | 7 => *byte == b'-',
                _ => byte.is_ascii_digit(),
            })
        && bytes[10] == b'-'
}

fn read_file(kind: Kind, file: String, path: &Path) -> FileStatus {
    match read_status(kind, path) {
        Ok(status) => FileStatus {
            file,
            status: Some(status),
            problem: None,
        },
        Err(problem) => FileStatus {
            file,
            status: None,
            problem: Some(problem),
        },
    }
}

#[derive(Deserialize)]
struct Frontmatter {
    status: Option<Field>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Field {
    Text(String),
    Other(serde::de::IgnoredAny),
}

fn read_status(kind: Kind, path: &Path) -> Result<Status, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let text = String::from_utf8(bytes).map_err(|_| "not UTF-8".to_string())?;
    let yaml = frontmatter(&text).ok_or("no frontmatter")?;
    let frontmatter: Option<Frontmatter> = if yaml.trim().is_empty() {
        None
    } else {
        serde_saphyr::from_str(yaml)
            .map_err(|error| format!("frontmatter is not valid YAML: {error}"))?
    };
    let value = match frontmatter.and_then(|frontmatter| frontmatter.status) {
        None => return Err("no status field".to_string()),
        Some(Field::Other(_)) => return Err("status is not a string".to_string()),
        Some(Field::Text(value)) => value,
    };
    kind.allowed()
        .iter()
        .find(|status| status.as_str() == value)
        .copied()
        .ok_or_else(|| format!("unknown status \"{value}\""))
}

/// The text between a first line `---` and the next line `---`.
fn frontmatter(text: &str) -> Option<&str> {
    let mut lines = text.split_inclusive('\n');
    let first = lines.next()?;
    if first.trim_end_matches(['\r', '\n']) != "---" {
        return None;
    }
    let start = first.len();
    let mut end = start;
    for line in lines {
        if line.trim_end_matches(['\r', '\n']) == "---" {
            return Some(&text[start..end]);
        }
        end += line.len();
    }
    None
}
