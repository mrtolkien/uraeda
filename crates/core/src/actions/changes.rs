//! The commit bar's one change list: the changes of `INBOX.md` and `PRIORITIES.md` since the last
//! commit, a note that left the inbox for the priorities or a draft counted as one move. Its count,
//! its commit message, Commit, and Discard all come from it.

use std::fs;

use crate::files::inbox::{self, NoteChange};
use crate::files::lines;
use crate::files::priorities::{self, EntryChange, Section};
use crate::files::proposal;
use crate::git::Git;

use super::place::{self, Place};
use super::priorities::{describe, line, short};
use super::{ActionError, Change, Committed, commit, images};

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

/// What Discard does to a draft, besides restoring the two lists: it never loses the human's text.
enum Undo {
    /// A draft a move wrote and nobody committed: deleted while it holds what the move wrote.
    Created { path: String, written: String },
    /// A draft a note was added to: the note's item, by its markdown, taken out again.
    Grown { path: String, markdown: String },
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

/// A draft changed since the last commit: its path, its title, and the list items added to it,
/// each as its markdown and its text.
struct Grown {
    path: String,
    title: String,
    added: Vec<(String, String)>,
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
                        None => Some((markdown, text)),
                    },
                )
                .collect();
            let title = crate::view::title(&now).unwrap_or_else(|| path.clone());
            Some(Grown { path, title, added })
        })
        .collect()
}

/// The draft `link`, from `specs/`, when it has changes since the last commit, and whether it was
/// ever committed.
fn uncommitted_draft(place: &Place, link: &str) -> Option<(String, bool)> {
    let path = crate::workspace::resolve("specs", link)?;
    if !crate::target::is_draft(&path) {
        return None;
    }
    let (now, then) = versions(place, &path);
    (now.is_some() && now != then).then_some((path, then.is_some()))
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

/// The drafts a pairing found: those the commit holds, and what Discard does to them.
#[derive(Default)]
struct Drafts {
    paths: Vec<String>,
    undo: Vec<Undo>,
}

impl Drafts {
    /// Holds the draft `link` in the commit when it changed; when no commit has it, Discard deletes
    /// it while it holds `written`, what the move wrote.
    fn linked(
        &mut self,
        place: &Place,
        link: Option<&str>,
        written: impl FnOnce() -> Option<String>,
    ) {
        let Some((path, committed)) = link.and_then(|link| uncommitted_draft(place, link)) else {
            return;
        };
        if !committed && let Some(written) = written() {
            self.undo.push(Undo::Created {
                path: path.clone(),
                written,
            });
        }
        self.paths.push(path);
    }
}

/// What a draft made from the note of the text `text` in `inbox`, not a link, held when a move
/// wrote it.
fn written_from(inbox: &str, text: &str) -> Option<String> {
    let note = inbox::parse(inbox)
        .into_iter()
        .find(|note| note.text == text && note.link.is_none())?;
    let (title, nested) = inbox::draft_parts(inbox, &note.id)?;
    Some(super::draft::proposal(&title, &nested))
}

/// What the draft a note added as a draft links held when it was written: its link's text.
fn written_for_link(inbox: &str, id: &str) -> Option<String> {
    Some(super::draft::proposal(&inbox::link_title(inbox, id)?, &[]))
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

/// Takes an item of the text `text` out of the items added to the drafts, and gives its draft's
/// path and title, and the item's markdown.
fn take_item(drafts: &mut [Grown], text: &str) -> Option<(String, String, String)> {
    drafts.iter_mut().find_map(|draft| {
        let at = draft.added.iter().position(|added| added.1 == text)?;
        let (markdown, _) = draft.added.remove(at);
        Some((draft.path.clone(), draft.title.clone(), markdown))
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
    // A draft folder's images go with it, as the attachments decision says: those its files link,
    // the others deleted, once the staged files are checked.
    let folders: Vec<&str> = listed
        .paths
        .iter()
        .filter_map(|path| path.strip_suffix("/proposal.md"))
        .collect();
    let mut candidates = listed.paths.clone();
    candidates.extend(folders.iter().map(|folder| images::images_folder(folder)));
    place::ensure_only_staged(place, &candidates)?;
    let mut paths = listed.paths.clone();
    for folder in folders {
        paths.extend(images::linked_images(place, folder)?);
    }
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
