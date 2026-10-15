//! The commit bar's one change list: the changes of `INBOX.md` and `PRIORITIES.md` since the last
//! commit, a note that left the inbox for the priorities or a draft counted as one move. Its count,
//! its commit message, Commit, and Discard all come from it.

use std::fs;

use crate::files::inbox::{self, NoteChange};
use crate::files::priorities::{self, EntryChange, Section};
use crate::files::proposal;
use crate::git::Git;

use super::place::{self, Place};
use super::priorities::{describe, line, short};
use super::{ActionError, Change, Committed, commit, images};

mod drafts;

use drafts::{
    Drafts, Grown, Undo, grown_drafts, never_committed, take_item, written_for_link, written_from,
};

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

/// The change list, the files its commit holds, and what Discard does to drafts.
struct Listed {
    changes: Vec<Described>,
    paths: Vec<String>,
    undo: Vec<Undo>,
}

/// A file's text from the top level, and its text at `HEAD`; `None` when absent.
fn versions(place: &Place, path: &str) -> (Option<String>, Option<String>) {
    let now = fs::read_to_string(place.root.join(path)).ok();
    (now, place::committed(place, path))
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

/// The texts of `INBOX.md` and `PRIORITIES.md`, now and at `HEAD`.
struct Texts {
    inbox: (Option<String>, Option<String>),
    priorities: (Option<String>, Option<String>),
}

/// Each change, a removed note paired with an entry or a draft's item of the same text as a move,
/// and the drafts those moves and the added notes went into.
fn pair(place: &Place, texts: &Texts) -> (Vec<Described>, Drafts) {
    let inbox_now = texts.inbox.0.as_deref().unwrap_or_default();
    let inbox_then = texts.inbox.1.as_deref().unwrap_or_default();
    let priorities_now = texts.priorities.0.as_deref().unwrap_or_default();
    let priorities_then = texts.priorities.1.as_deref().unwrap_or_default();
    let mut entries: Vec<Option<EntryChange>> = priorities::diff(priorities_then, priorities_now)
        .into_iter()
        .map(Some)
        .collect();
    let linked_entries = priorities::parse(priorities_now);
    let linked_notes = inbox::parse(inbox_now);
    let mut found = Drafts::default();
    let mut grown: Option<Vec<Grown>> = None;
    let mut changes = Vec::new();
    for change in inbox::diff(inbox_then, inbox_now) {
        if let NoteChange::Removed { text, .. } = &change {
            if let Some(section) = take_entry(&mut entries, text) {
                let link = linked_entries
                    .iter()
                    .find(|e| e.section == section && &e.text == text)
                    .and_then(|e| e.link.as_deref());
                found.linked(place, link, || written_from(inbox_then, text));
                changes.push(moved_out(text, section.title()));
                continue;
            }
            let grown = grown.get_or_insert_with(|| grown_drafts(place));
            if let Some((path, title, markdown)) = take_item(grown, text) {
                changes.push(moved_out(text, &format!("the draft {title}")));
                found.undo.push(Undo::Grown {
                    path: path.clone(),
                    markdown,
                });
                found.paths.push(path);
                continue;
            }
        }
        if let NoteChange::Added { text, .. } = &change
            && let Some(note) = linked_notes
                .iter()
                .find(|note| &note.text == text && note.link.is_some())
        {
            let written = || written_for_link(inbox_now, &note.id);
            found.linked(place, note.link.as_deref(), written);
        }
        changes.push(note_change(&change));
    }
    changes.extend(entries.into_iter().flatten().map(|entry| Described {
        subject: describe(&entry),
        line: line(&entry),
    }));
    never_committed(place, texts, &mut found);
    (changes, found)
}

/// The files the commit holds: each list that changed, then the drafts.
fn files(texts: &Texts, drafts: Vec<String>) -> Vec<String> {
    let mut files = Vec::new();
    if texts.inbox.0 != texts.inbox.1 {
        files.push(INBOX.to_string());
    }
    if texts.priorities.0 != texts.priorities.1 {
        files.push(PRIORITIES.to_string());
    }
    for path in drafts {
        if !files.contains(&path) {
            files.push(path);
        }
    }
    files
}

fn gather(place: &Place) -> Listed {
    let texts = Texts {
        inbox: versions(place, INBOX),
        priorities: versions(place, PRIORITIES),
    };
    let (changes, drafts) = pair(place, &texts);
    Listed {
        changes,
        paths: files(&texts, drafts.paths),
        undo: drafts.undo,
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

/// The drafts a commit of the two lists holds: those the moves went into, and those the lists link
/// that no commit has. A draft's commit from its editor holding the lists holds them too.
pub(super) fn drafts(place: &Place) -> Vec<String> {
    let mut paths = gather(place).paths;
    paths.retain(|path| path != INBOX && path != PRIORITIES);
    paths
}

/// The `images/` folders of the folder drafts among `paths`, which their commit may stage.
pub(super) fn images_folders(paths: &[String]) -> Vec<String> {
    paths
        .iter()
        .filter_map(|path| path.strip_suffix("/proposal.md"))
        .map(images::images_folder)
        .collect()
}

/// The images the folder drafts among `paths` link, which go with them as the attachments decision
/// says, the others deleted: called once the staged files are checked.
pub(super) fn linked_images(place: &Place, paths: &[String]) -> Result<Vec<String>, ActionError> {
    let mut linked = Vec::new();
    for folder in paths
        .iter()
        .filter_map(|path| path.strip_suffix("/proposal.md"))
    {
        linked.extend(images::linked_images(place, folder)?);
    }
    Ok(linked)
}

/// Commits `INBOX.md`, `PRIORITIES.md`, and the drafts notes went into, a draft folder with its
/// images, with a message naming their changes.
pub fn commit(place: &Place) -> Result<Committed, ActionError> {
    let listed = gather(place);
    if listed.paths.is_empty() {
        return Err(ActionError::Refused(
            "INBOX.md and PRIORITIES.md have no change to commit".to_string(),
        ));
    }
    let (subject, body) = message_of(&listed);
    let mut candidates = listed.paths.clone();
    candidates.extend(images_folders(&listed.paths));
    place::ensure_only_staged(place, &candidates)?;
    let mut paths = listed.paths.clone();
    paths.extend(linked_images(place, &listed.paths)?);
    commit::commit(
        place,
        &Change {
            paths,
            subject,
            body,
        },
    )
}

/// Restores the committed `INBOX.md` and `PRIORITIES.md`, staged edits included, deleting one that
/// no commit has. A draft is never lost: one a move wrote and nobody committed is deleted only while
/// it holds what the move wrote, with at most a note's images, which go with it, and one a note was
/// added to loses that note's lines only.
pub fn discard(place: &Place) -> Result<(), ActionError> {
    let listed = gather(place);
    let git = Git::open(&place.root)?;
    for path in [INBOX, PRIORITIES] {
        if place::committed(place, path).is_some() {
            git.restore(path)?;
        } else if place.root.join(path).is_file() {
            fs::remove_file(place.root.join(path))?;
        }
    }
    for undo in listed.undo {
        match undo {
            Undo::Created { path, written } => {
                super::draft::remove_written(place, &path, &written)?;
            }
            Undo::Grown { path, markdown } => {
                let file = place.root.join(&path);
                let text = fs::read_to_string(&file)?;
                if let Some(without) = proposal::without_item(&text, &markdown) {
                    fs::write(file, without)?;
                }
            }
        }
    }
    Ok(())
}
