//! Agents' notes: the note files of `specs/notes/` that no link of `INBOX.md` reaches. Each is a
//! note of the inbox on its own, shown where `ura note` would add its line: at the end of its
//! category.
//! A branch adds one instead of editing `INBOX.md`, so parallel branches never conflict there.

use super::{Note, add, note_line, parse};
use crate::files::frontmatter;

/// A note file of `specs/notes/`, `<name>.md` or `<name>/note.md`, read for the inbox.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NoteFile {
    /// From the top level: `specs/notes/x.md`.
    pub path: String,
    pub text: String,
}

/// An agent's note: a note file no note links, with the fields of its frontmatter.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct AgentNote {
    pub path: String,
    pub agent: bool,
    pub about: Option<String>,
    pub category: Option<String>,
    /// Its line, as a note linking its file: `- [agent] [slug] [Title](notes/x.md)`.
    pub line: String,
}

/// Whether a path from the top level names a note file: `specs/notes/<name>.md`, or
/// `specs/notes/<name>/note.md`.
pub fn is_note_file_path(path: &str) -> bool {
    let Some(rest) = path.strip_prefix(crate::target::NOTES) else {
        return false;
    };
    match rest.split_once('/') {
        None => rest.ends_with(".md"),
        Some((name, file)) => !name.is_empty() && file == "note.md",
    }
}

/// The note's text: the file's first `# ` heading, or else its name.
fn title(path: &str, text: &str) -> String {
    let heading = frontmatter::body(text)
        .lines()
        .find_map(|line| line.strip_prefix("# "))
        .map(str::trim)
        .filter(|title| !title.is_empty());
    match heading {
        Some(title) => title.to_string(),
        None => {
            let name = path.strip_suffix("/note.md").unwrap_or(path);
            let name = name.rsplit('/').next().unwrap_or(name);
            name.strip_suffix(".md").unwrap_or(name).to_string()
        }
    }
}

/// A title as a link's text: its brackets and backslashes escaped.
fn escaped(title: &str) -> String {
    let mut text = String::new();
    for c in title.chars() {
        if matches!(c, '[' | ']' | '\\') {
            text.push('\\');
        }
        text.push(c);
    }
    text
}

fn agent_note(file: &NoteFile) -> AgentNote {
    let front = frontmatter::parse(&file.text).ok();
    let field = |key: &str| {
        front
            .as_ref()
            .and_then(|front| front.text(key))
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(String::from)
    };
    let agent = front
        .as_ref()
        .and_then(|front| front.get("agent"))
        .is_some_and(|value| *value == frontmatter::Value::Bool(true));
    let about = field("about").filter(|about| super::is_slug(about));
    let link = file.path.strip_prefix("specs/").unwrap_or(&file.path);
    let text = format!("[{}]({link})", escaped(&title(&file.path, &file.text)));
    AgentNote {
        path: file.path.clone(),
        agent,
        about: about.clone(),
        category: field("category"),
        line: note_line(agent, about.as_deref(), &text),
    }
}

/// The files the links of `INBOX.md`'s text `text` resolve to, from the top level: a note's, and
/// any other link of the file, like one in a note's nested item.
fn linked_files(text: &str) -> Vec<String> {
    let mut linked: Vec<String> = parse(text).iter().filter_map(Note::file).collect();
    linked.extend(
        crate::files::markdown::Document::parse(text)
            .links
            .iter()
            .filter(|link| !link.wiki && !link.image)
            .filter_map(|link| crate::workspace::resolve("specs", &link.target)),
    );
    linked
}

/// The agents' notes among `files`: the note files no link of `text` reaches, by path.
pub(crate) fn agent_notes(text: &str, files: &[NoteFile]) -> Vec<AgentNote> {
    let linked = linked_files(text);
    let mut notes: Vec<AgentNote> = files
        .iter()
        .filter(|file| is_note_file_path(&file.path) && !linked.contains(&file.path))
        .map(agent_note)
        .collect();
    notes.sort_by(|a, b| a.path.cmp(&b.path));
    notes
}

/// `INBOX.md`'s text with a line for each agent's note of `files`, added where `ura note` adds one:
/// what the commit bar compares, so an agent's note removed or moved counts as a change.
pub fn joined(text: &str, files: &[NoteFile]) -> String {
    agent_notes(text, files)
        .iter()
        .fold(text.to_string(), |joined, note| {
            add(&joined, note.category.as_deref(), &note.line).0
        })
}

/// The note files among `paths`, from the top level, with the texts `read` gives them.
pub fn note_files(paths: &[String], read: impl Fn(&str) -> Option<String>) -> Vec<NoteFile> {
    paths
        .iter()
        .filter(|path| is_note_file_path(path))
        .filter_map(|path| {
            Some(NoteFile {
                path: path.clone(),
                text: read(path)?,
            })
        })
        .collect()
}

/// The paths of the note files of `specs/notes/` in the checkout at `root`, from the top level.
pub fn note_paths_on_disk(root: &std::path::Path) -> Vec<String> {
    let notes = crate::target::NOTES;
    let mut paths: Vec<String> = std::fs::read_dir(root.join(notes))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            let is_dir = entry.file_type().is_ok_and(|kind| kind.is_dir());
            match is_dir {
                true if entry.path().join("note.md").is_file() => {
                    Some(format!("{notes}{name}/note.md"))
                }
                false if name.ends_with(".md") => Some(format!("{notes}{name}")),
                _ => None,
            }
        })
        .collect();
    paths.sort();
    paths
}
