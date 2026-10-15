//! The commit bar's one change list: the changes of `INBOX.md` and `PRIORITIES.md` since the last
//! commit, a note that left the inbox for the priorities or a draft counted as one move. Its count,
//! its commit message, Commit, and Discard all come from it.

use std::fs;

use crate::files::inbox::{self, NoteChange};
use crate::files::lines;
use crate::files::priorities::{self, EntryChange, Section};
use crate::git::Git;

use super::place::{self, Place};
use super::priorities::{describe, line, short};
use super::{ActionError, Change, Committed, commit};

const INBOX: &str = super::inbox::PATH;
const PRIORITIES: &str = super::priorities::PATH;

/// What the commit bar shows: how many changes wait, and each as a line of the commit's body.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Changes {
    pub count: u32,
    pub lines: Vec<String>,
}

/// One change: its description in a subject, and its line in the body.
struct Described {
    subject: String,
    line: String,
}

/// The change list, and the files its commit holds.
struct Listed {
    changes: Vec<Described>,
    paths: Vec<String>,
}

/// A file's text from the top level, and its text at `HEAD`; `None` when absent.
fn versions(place: &Place, path: &str) -> (Option<String>, Option<String>) {
    let now = fs::read_to_string(place.root.join(path)).ok();
    (now, place::committed(place, path))
}

/// The drafts and backlog files of the working tree: single files, and folders' `proposal.md`.
fn draft_files(place: &Place) -> Vec<String> {
    let mut files = Vec::new();
    for folder in ["specs/drafts", "specs/backlog"] {
        let Ok(entries) = fs::read_dir(place.root.join(folder)) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if entry.path().is_dir() {
                if entry.path().join("proposal.md").is_file() {
                    files.push(format!("{folder}/{name}/proposal.md"));
                }
            } else if name.ends_with(".md") {
                files.push(format!("{folder}/{name}"));
            }
        }
    }
    files.sort();
    files
}

/// Each list item of a text: its markdown, to tell items apart, and its text without markdown.
fn items(text: &str) -> Vec<(String, String)> {
    let unix = text.replace("\r\n", "\n");
    let all: Vec<&str> = unix.split('\n').collect();
    lines::items(&unix, |_, _| Some(()))
        .into_iter()
        .map(|((), item)| {
            let markdown = lines::signed_markdown(&all, &item);
            (
                markdown,
                lines::plain(&lines::item_text(&all, &item).join("\n")).0,
            )
        })
        .collect()
}

/// A draft changed since the last commit: its path, its title, and the texts of the list items
/// added to it.
struct Grown {
    path: String,
    title: String,
    added: Vec<String>,
}

fn grown_drafts(place: &Place) -> Vec<Grown> {
    draft_files(place)
        .into_iter()
        .filter_map(|path| {
            let (now, then) = versions(place, &path);
            let now = now?;
            if then.as_deref() == Some(now.as_str()) {
                return None;
            }
            let mut before = items(then.as_deref().unwrap_or_default());
            let added = items(&now)
                .into_iter()
                .filter_map(
                    |(markdown, text)| match before.iter().position(|b| b.0 == markdown) {
                        Some(at) => {
                            before.remove(at);
                            None
                        }
                        None => Some(text),
                    },
                )
                .collect();
            let title = crate::view::title(&now).unwrap_or_else(|| path.clone());
            Some(Grown { path, title, added })
        })
        .collect()
}

/// The draft `link`, from `specs/`, when it has changes since the last commit.
fn uncommitted_draft(place: &Place, link: &str) -> Option<String> {
    let path = crate::workspace::resolve("specs", link)?;
    if !crate::target::is_draft(&path) {
        return None;
    }
    let (now, then) = versions(place, &path);
    (now.is_some() && now != then).then_some(path)
}

fn category(name: &Option<String>) -> &str {
    name.as_deref().unwrap_or("No category")
}

/// A change of the inbox alone, described.
fn note_change(change: &NoteChange) -> Described {
    let (subject, line) = match change {
        NoteChange::Added { text, .. } => (
            format!("add \"{}\" to the inbox", short(text)),
            format!("- Add to the inbox: {text}"),
        ),
        NoteChange::Removed { text, .. } => (
            format!("remove \"{}\" from the inbox", short(text)),
            format!("- Remove from the inbox: {text}"),
        ),
        NoteChange::Moved { from, to, text } if from == to => (
            format!(
                "move \"{}\" within {} in the inbox",
                short(text),
                category(to)
            ),
            format!("- Move within {} in the inbox: {text}", category(to)),
        ),
        NoteChange::Moved { to, text, .. } => (
            format!("move \"{}\" to {} in the inbox", short(text), category(to)),
            format!("- Move to {} in the inbox: {text}", category(to)),
        ),
        NoteChange::Edited { before, after, .. } => (
            format!("edit \"{}\" in the inbox", short(after)),
            format!("- Edit in the inbox: {before} -> {after}"),
        ),
    };
    Described { subject, line }
}

/// A note moved out of the inbox, to `place`, a section's title or `the draft <title>`.
fn moved_out(text: &str, to: &str) -> Described {
    Described {
        subject: format!("move \"{}\" from the inbox to {to}", short(text)),
        line: format!("- Move from the inbox to {to}: {text}"),
    }
}

/// Each change, a removed note paired with an entry or a draft's item of the same text as a move,
/// and the files the commit holds.
fn gather(place: &Place) -> Listed {
    let (inbox_now, inbox_then) = versions(place, INBOX);
    let (priorities_now, priorities_then) = versions(place, PRIORITIES);
    let inbox_now_text = inbox_now.clone().unwrap_or_default();
    let priorities_now_text = priorities_now.clone().unwrap_or_default();
    let mut entries: Vec<Option<EntryChange>> = priorities::diff(
        priorities_then.as_deref().unwrap_or_default(),
        &priorities_now_text,
    )
    .into_iter()
    .map(Some)
    .collect();
    let linked_entries = priorities::parse(&priorities_now_text);
    let linked_notes = inbox::parse(&inbox_now_text);
    let mut paths: Vec<String> = Vec::new();
    let mut drafts: Option<Vec<Grown>> = None;
    let mut changes = Vec::new();
    let notes = inbox::diff(inbox_then.as_deref().unwrap_or_default(), &inbox_now_text);
    for change in &notes {
        if let NoteChange::Removed { text, .. } = change {
            if let Some(section) = take_entry(&mut entries, text) {
                let link = linked_entries
                    .iter()
                    .find(|e| e.section == section && &e.text == text)
                    .and_then(|e| e.link.as_deref());
                paths.extend(link.and_then(|link| uncommitted_draft(place, link)));
                changes.push(moved_out(text, section.title()));
                continue;
            }
            let drafts = drafts.get_or_insert_with(|| grown_drafts(place));
            if let Some(draft) = take_item(drafts, text) {
                changes.push(moved_out(text, &format!("the draft {}", draft.1)));
                paths.push(draft.0);
                continue;
            }
        }
        if let NoteChange::Added { text, .. } = change {
            let link = linked_notes
                .iter()
                .find(|note| &note.text == text)
                .and_then(|note| note.link.as_deref());
            paths.extend(link.and_then(|link| uncommitted_draft(place, link)));
        }
        changes.push(note_change(change));
    }
    changes.extend(entries.into_iter().flatten().map(|entry| Described {
        subject: describe(&entry),
        line: line(&entry),
    }));
    let changed = |now: &Option<String>, then: &Option<String>| now != then;
    let mut files = Vec::new();
    if changed(&inbox_now, &inbox_then) {
        files.push(INBOX.to_string());
    }
    if changed(&priorities_now, &priorities_then) {
        files.push(PRIORITIES.to_string());
    }
    for path in paths {
        if !files.contains(&path) {
            files.push(path);
        }
    }
    Listed {
        changes,
        paths: files,
    }
}

/// Takes the added entry of the text `text` out of the priorities' changes, and gives its section.
fn take_entry(entries: &mut [Option<EntryChange>], text: &str) -> Option<Section> {
    let at = entries.iter().position(
        |entry| matches!(entry, Some(EntryChange::Added { text: added, .. }) if added == text),
    )?;
    match entries[at].take() {
        Some(EntryChange::Added { section, .. }) => Some(section),
        _ => None,
    }
}

/// Takes an item of the text `text` out of the items added to the drafts, and gives its draft's
/// path and title.
fn take_item(drafts: &mut [Grown], text: &str) -> Option<(String, String)> {
    drafts.iter_mut().find_map(|draft| {
        let at = draft.added.iter().position(|added| added == text)?;
        draft.added.remove(at);
        Some((draft.path.clone(), draft.title.clone()))
    })
}

/// The changes the commit bar counts.
pub fn list(place: &Place) -> Changes {
    let listed = gather(place);
    Changes {
        count: listed.changes.len() as u32,
        lines: listed.changes.into_iter().map(|c| c.line).collect(),
    }
}

fn message_of(listed: &Listed) -> (String, Option<String>) {
    match listed.changes.as_slice() {
        [] if listed.paths == [PRIORITIES] => ("chore: update the priorities".to_string(), None),
        [] => ("chore: update the inbox".to_string(), None),
        [change] => (format!("chore: {}", change.subject), None),
        [first, rest @ ..] => (
            format!("chore: {}, and {} more", first.subject, rest.len()),
            Some(
                listed
                    .changes
                    .iter()
                    .map(|c| c.line.as_str())
                    .collect::<Vec<_>>()
                    .join("\n"),
            ),
        ),
    }
}

/// The commit message of the changes: the first change, and with more, their count, and every
/// change in the body.
pub fn message(place: &Place) -> (String, Option<String>) {
    message_of(&gather(place))
}

/// Commits `INBOX.md`, `PRIORITIES.md`, and the drafts notes went into, with a message naming
/// their changes.
pub fn commit(place: &Place) -> Result<Committed, ActionError> {
    let listed = gather(place);
    if listed.paths.is_empty() {
        return Err(ActionError::Refused(
            "INBOX.md and PRIORITIES.md have no change to commit".to_string(),
        ));
    }
    let (subject, body) = message_of(&listed);
    let change = Change {
        paths: listed.paths,
        subject,
        body,
    };
    place::ensure_only_staged(place, &change.paths)?;
    commit::commit(place, &change)
}

/// Restores the committed `INBOX.md`, `PRIORITIES.md`, and drafts the commit would hold, staged
/// edits included. A file with no committed version is deleted.
pub fn discard(place: &Place) -> Result<(), ActionError> {
    let listed = gather(place);
    let git = Git::open(&place.root)?;
    let mut paths = vec![INBOX.to_string(), PRIORITIES.to_string()];
    paths.extend(
        listed
            .paths
            .into_iter()
            .filter(|path| path != INBOX && path != PRIORITIES),
    );
    for path in paths {
        if place::committed(place, &path).is_some() {
            git.restore(&path)?;
        } else if place.root.join(&path).is_file() {
            fs::remove_file(place.root.join(&path))?;
        }
    }
    Ok(())
}
