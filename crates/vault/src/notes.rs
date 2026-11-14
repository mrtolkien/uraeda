//! Reading and writing notes, for `ura vault` and the sync: listings with each note's
//! `description`, writes that never leave half a file, one frontmatter field set alone, and
//! deletions into `.trash/`.

use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;
use uraeda_core::files::frontmatter;

use crate::{Vault, paths};

#[derive(Debug, thiserror::Error)]
pub enum NoteError {
    #[error("{0} is not a path in the vault")]
    Path(String),
    #[error("{0} is git's or ura's, and read only in the vault")]
    ReadOnly(String),
    #[error("{0} is behind a link, and read only in the vault")]
    Linked(String),
    #[error("no note {0}")]
    Missing(String),
    #[error("a field is set as name=value, on one line")]
    Field,
    #[error("{0}: {1}")]
    Io(String, io::Error),
}

/// One entry of a listing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Entry {
    /// From the vault's folder: `wiki/apps/todoist.md`, `wiki/apps/` for a folder.
    pub path: String,
    /// The note's `description`, when it has one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// The folders and notes of `folder`, the vault's own when empty: folders first, then notes, each
/// sorted. Hidden names are left out.
pub fn ls(vault: &Vault, folder: &str) -> Result<Vec<Entry>, NoteError> {
    let (dir, prefix) = if folder.trim_matches('/').is_empty() {
        (vault.root().to_path_buf(), String::new())
    } else {
        let clean = paths::clean(folder).ok_or_else(|| NoteError::Path(folder.into()))?;
        (vault.root().join(&clean), format!("{clean}/"))
    };
    let entries = std::fs::read_dir(&dir).map_err(|e| NoteError::Io(folder.into(), e))?;
    let (mut folders, mut notes) = (Vec::new(), Vec::new());
    for entry in entries.flatten() {
        let Some(name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            folders.push(Entry {
                path: format!("{prefix}{name}/"),
                description: None,
            });
        } else if name.ends_with(".md") {
            notes.push(Entry {
                path: format!("{prefix}{name}"),
                description: std::fs::read_to_string(&path)
                    .ok()
                    .and_then(|t| description(&t)),
            });
        }
    }
    folders.sort_by(|a, b| a.path.cmp(&b.path));
    notes.sort_by(|a, b| a.path.cmp(&b.path));
    folders.extend(notes);
    Ok(folders)
}

/// A note's `description`, trimmed, when it has a non-empty one.
pub fn description(text: &str) -> Option<String> {
    let front = frontmatter::parse(text).ok()?;
    let value = front.text("description")?.trim();
    (!value.is_empty()).then(|| value.to_string())
}

/// A note's text.
pub fn read(vault: &Vault, path: &str) -> Result<String, NoteError> {
    let file = vault
        .file(path)
        .ok_or_else(|| NoteError::Path(path.into()))?;
    std::fs::read_to_string(&file).map_err(|e| match e.kind() {
        io::ErrorKind::NotFound => NoteError::Missing(path.into()),
        _ => NoteError::Io(path.into(), e),
    })
}

/// Writes a note, its folders made: refused for a path neither `ura vault` nor the phone writes.
pub fn write(vault: &Vault, path: &str, bytes: &[u8]) -> Result<(), NoteError> {
    let file = writable(vault, path)?;
    write_atomic(&file, bytes).map_err(|e| NoteError::Io(path.into(), e))
}

/// Sets one frontmatter field of a note, `name=value`, and leaves the rest byte for byte.
pub fn set(vault: &Vault, path: &str, assignment: &str) -> Result<(), NoteError> {
    let (name, value) = assignment
        .split_once('=')
        .filter(|(n, v)| valid_name(n) && !v.contains(['\n', '\r']))
        .ok_or(NoteError::Field)?;
    let text = read(vault, path)?;
    write(vault, path, set_field(&text, name, value).as_bytes())
}

/// Moves a note to `.trash/`, at the same path, numbered when one is there already.
pub fn rm(vault: &Vault, path: &str) -> Result<(), NoteError> {
    let file = writable(vault, path)?;
    if !file.is_file() {
        return Err(NoteError::Missing(path.into()));
    }
    trash(vault, path).map_err(|e| NoteError::Io(path.into(), e))
}

/// Moves a file of the vault to `.trash/`, at the same path, numbered when one is there already.
pub fn trash(vault: &Vault, path: &str) -> io::Result<()> {
    let from = vault.root().join(path);
    let mut to = vault.root().join(paths::TRASH).join(path);
    let mut n = 2;
    while to.exists() {
        to = numbered(&vault.root().join(paths::TRASH).join(path), n);
        n += 1;
    }
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::rename(from, to)
}

/// Writes a file whole or not at all: a hidden file beside it first, then renamed over it.
pub fn write_atomic(file: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = file.parent().unwrap_or(Path::new("."));
    std::fs::create_dir_all(parent)?;
    let name = file.file_name().unwrap_or_default().to_string_lossy();
    let temporary = parent.join(format!(".{name}.ura-tmp"));
    std::fs::write(&temporary, bytes)?;
    std::fs::rename(&temporary, file)
}

/// `text` with its frontmatter's field `name` set to `value`: the field's line, and the lines of
/// a list or block under it, replaced; else a line added at the frontmatter's end; else a
/// frontmatter added on top.
pub fn set_field(text: &str, name: &str, value: &str) -> String {
    let line = format!("{name}: {}\n", yaml_value(value));
    let Ok((_, end)) = frontmatter::block(text) else {
        return format!("---\n{line}---\n{text}");
    };
    let lines: Vec<&str> = text.split_inclusive('\n').collect();
    // Lines 1..end-1 are the frontmatter's, between the two `---`.
    let close = end - 1;
    let prefix = format!("{name}:");
    let found = (1..close).find(|&i| {
        lines[i]
            .strip_prefix(&prefix)
            .is_some_and(|rest| rest.is_empty() || rest.starts_with([' ', '\n', '\r']))
    });
    let mut out = String::with_capacity(text.len() + line.len());
    match found {
        Some(start) => {
            let mut after = start + 1;
            while after < close && lines[after].starts_with([' ', '\t', '-']) {
                after += 1;
            }
            lines[..start].iter().for_each(|l| out.push_str(l));
            out.push_str(&line);
            lines[after..].iter().for_each(|l| out.push_str(l));
        }
        None => {
            lines[..close].iter().for_each(|l| out.push_str(l));
            out.push_str(&line);
            lines[close..].iter().for_each(|l| out.push_str(l));
        }
    }
    out
}

/// A value as YAML: plain when it reads back as the same text, else quoted.
fn yaml_value(value: &str) -> String {
    let plain = !value.is_empty()
        && value
            .chars()
            .all(|c| c.is_alphanumeric() || " _-./@+".contains(c))
        && !value.starts_with([' ', '-', '@'])
        && !value.ends_with(' ');
    if plain {
        value.to_string()
    } else {
        serde_json::to_string(value).unwrap_or_default()
    }
}

fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// The file a write or a deletion of `path` touches: refused for a path neither `ura vault` nor
/// the phone writes, and for one that goes through a link, which could lead out of the vault or
/// into a repository's files.
pub fn writable(vault: &Vault, path: &str) -> Result<PathBuf, NoteError> {
    let clean = paths::clean(path).ok_or_else(|| NoteError::Path(path.into()))?;
    if !paths::is_writable(&clean) {
        return Err(NoteError::ReadOnly(path.into()));
    }
    let mut at = vault.root().to_path_buf();
    for part in clean.split('/') {
        at.push(part);
        match std::fs::symlink_metadata(&at) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err(NoteError::Linked(path.into()));
            }
            Ok(_) => {}
            // Nothing there yet, nor below it.
            Err(_) => break,
        }
    }
    Ok(vault.root().join(clean))
}

/// `a/b.md` numbered `n`: `a/b 2.md`.
fn numbered(path: &Path, n: u32) -> PathBuf {
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let name = match path.extension() {
        Some(ext) => format!("{stem} {n}.{}", ext.to_string_lossy()),
        None => format!("{stem} {n}"),
    };
    path.with_file_name(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sets_a_field_alone() {
        let text = "---\nstatus: idea\nsources:\n  - a\n  - b\nrank: 2\n---\n# T\n";
        assert_eq!(
            set_field(text, "status", "started"),
            "---\nstatus: started\nsources:\n  - a\n  - b\nrank: 2\n---\n# T\n"
        );
        assert_eq!(
            set_field(text, "sources", "x"),
            "---\nstatus: idea\nsources: x\nrank: 2\n---\n# T\n"
        );
        assert_eq!(
            set_field(text, "branch", "feat/x: y"),
            "---\nstatus: idea\nsources:\n  - a\n  - b\nrank: 2\nbranch: \"feat/x: y\"\n---\n# T\n"
        );
        assert_eq!(set_field("# T\n", "rank", "1"), "---\nrank: 1\n---\n# T\n");
        assert_eq!(
            set_field("---\nstatus_x: 1\n---\n", "status", "now"),
            "---\nstatus_x: 1\nstatus: now\n---\n"
        );
    }

    #[test]
    fn writes_lists_and_trashes() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::new(dir.path());
        let note = "---\ndescription: A todo app\n---\n# Todoist\n";
        write(&vault, "wiki/apps/todoist.md", note.as_bytes()).unwrap();
        write(&vault, "wiki/apps/a.md", b"# A\n").unwrap();
        std::fs::create_dir_all(dir.path().join("wiki/apps/old")).unwrap();
        let listed = ls(&vault, "wiki/apps").unwrap();
        let paths: Vec<&str> = listed.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(
            paths,
            ["wiki/apps/old/", "wiki/apps/a.md", "wiki/apps/todoist.md"]
        );
        assert_eq!(listed[2].description.as_deref(), Some("A todo app"));
        assert!(matches!(
            write(&vault, "projects/x/specs/spec.md", b""),
            Err(NoteError::ReadOnly(_))
        ));
        assert!(matches!(
            write(&vault, "../x.md", b""),
            Err(NoteError::Path(_))
        ));
        #[cfg(unix)]
        {
            let outside = tempfile::tempdir().unwrap();
            std::fs::write(outside.path().join("kept.md"), "kept").unwrap();
            std::os::unix::fs::symlink(outside.path(), dir.path().join("inbox")).unwrap();
            std::os::unix::fs::symlink(
                outside.path().join("kept.md"),
                dir.path().join("wiki/one.md"),
            )
            .unwrap();
            for path in ["inbox/new.md", "inbox/kept.md", "wiki/one.md"] {
                assert!(
                    matches!(write(&vault, path, b"x"), Err(NoteError::Linked(_))),
                    "{path}"
                );
                assert!(
                    matches!(rm(&vault, path), Err(NoteError::Linked(_))),
                    "{path}"
                );
            }
            assert_eq!(read(&vault, "inbox/kept.md").unwrap(), "kept");
            assert!(!outside.path().join("new.md").exists());
        }
        rm(&vault, "wiki/apps/a.md").unwrap();
        write(&vault, "wiki/apps/a.md", b"again").unwrap();
        rm(&vault, "wiki/apps/a.md").unwrap();
        assert!(dir.path().join(".trash/wiki/apps/a.md").is_file());
        assert!(dir.path().join(".trash/wiki/apps/a 2.md").is_file());
        assert!(matches!(
            rm(&vault, "wiki/apps/a.md"),
            Err(NoteError::Missing(_))
        ));
    }
}
