//! The commit bar's one change list: the changes of `INBOX.md` and `PRIORITIES.md` since the last
//! commit, a note that left the inbox for the priorities or a proposal file counted as one move.
//! Its count, its commit message, Commit, and Discard all come from it.

use std::fs;

use crate::files::inbox::{self, NoteChange};
use crate::files::priorities::{self, ProposalChange, Section};
use crate::files::proposal;
use crate::git::Git;

use super::place::{self, Place};
use super::priorities::{describe, line, short};
use super::{ActionError, Change, Committed, commit, images};

mod files;

use files::{
    FOLDERS, Found, Grown, Undo, files_in, grown_files, linked_by, never_committed, take_item,
    take_note, unmerge, written_for_link, written_from,
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

/// The change list, the files its commit holds, and what Discard does to proposal files and note
/// files.
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

/// A note moved out of the inbox, to `place`, a section's title or `the proposal <title>`.
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

/// The note file of the note of the text `text` in `inbox`, from the top level.
fn note_file(inbox: &str, text: &str) -> Option<String> {
    inbox::parse(inbox)
        .into_iter()
        .find(|note| note.text == text)?
        .file()
}

/// The file the list item `markdown` of the proposal file at `path` links, from the top level: where
/// a note's file went with the note.
fn item_link(path: &str, markdown: &str) -> Option<String> {
    let folder = path.rsplit_once('/').map_or("", |(folder, _)| folder);
    let (_, link) = crate::files::lines::plain(markdown);
    crate::workspace::resolve(folder, &link?)
}

/// Each change, a removed note paired with a proposal or a proposal file's item of the same text as
/// a move, and the files those moves and the added notes went into, or the removed notes left.
fn pair(place: &Place, texts: &Texts) -> (Vec<Described>, Found) {
    let inbox_now = texts.inbox.0.as_deref().unwrap_or_default();
    let inbox_then = texts.inbox.1.as_deref().unwrap_or_default();
    let priorities_now = texts.priorities.0.as_deref().unwrap_or_default();
    let priorities_then = texts.priorities.1.as_deref().unwrap_or_default();
    let mut proposals: Vec<Option<ProposalChange>> =
        priorities::diff(priorities_then, priorities_now)
            .into_iter()
            .map(Some)
            .collect();
    let linked_proposals = priorities::parse(priorities_now);
    let linked_notes = inbox::parse(inbox_now);
    let mut found = Found::default();
    let mut grown: Option<Vec<Grown>> = None;
    let mut changes = Vec::new();
    for change in inbox::diff(inbox_then, inbox_now) {
        if let NoteChange::Removed { text, .. } = &change {
            if let Some((section, moved)) = take_moved(&mut proposals, inbox_then, text) {
                let link = linked_proposals
                    .iter()
                    .find(|p| p.section == section && p.text == moved)
                    .and_then(|p| p.link.as_deref());
                found.linked(place, link, |path| written_from(inbox_then, text, path));
                if let Some(note) = note_file(inbox_then, text) {
                    let moved = link.and_then(|link| crate::workspace::resolve("specs", link));
                    found.moved(place, &note, moved);
                }
                changes.push(moved_out(text, section.title()));
                continue;
            }
            let grown = grown.get_or_insert_with(|| grown_files(place));
            // A note whose note file went into a proposal file's `## Notes`, under its title.
            let note = note_file(inbox_then, text);
            if let Some(note) = &note
                && let Some((undo, path, title)) = take_note(grown, text)
            {
                changes.push(moved_out(text, &format!("the proposal {title}")));
                found.removed(place, note);
                found.undo.push(undo);
                found.paths.push(path);
                continue;
            }
            if let Some((path, title, markdown)) = take_item(grown, text) {
                changes.push(moved_out(text, &format!("the proposal {title}")));
                if let Some(note) = &note {
                    found.moved(place, note, item_link(&path, &markdown));
                }
                found.undo.push(Undo::Grown {
                    path: path.clone(),
                    markdown,
                });
                found.paths.push(path);
                continue;
            }
            if let Some(note) = &note {
                found.removed(place, note);
            }
        }
        if let NoteChange::Added { text, .. } = &change
            && let Some(note) = linked_notes
                .iter()
                .find(|note| &note.text == text && note.link.is_some())
        {
            let written = |path: &str| written_for_link(inbox_now, &note.id, path);
            found.linked(place, note.link.as_deref(), written);
        }
        changes.push(note_change(&change));
    }
    changes.extend(proposals.into_iter().flatten().map(|proposal| Described {
        subject: describe(&proposal),
        line: line(&proposal),
    }));
    never_committed(place, texts, &mut found);
    (changes, found)
}

/// The files the commit holds: each list that changed, then the proposal files and note files.
fn files(texts: &Texts, linked: Vec<String>) -> Vec<String> {
    let mut files = Vec::new();
    if texts.inbox.0 != texts.inbox.1 {
        files.push(INBOX.to_string());
    }
    if texts.priorities.0 != texts.priorities.1 {
        files.push(PRIORITIES.to_string());
    }
    for path in linked {
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
    let (mut changes, found) = pair(place, &texts);
    let mut paths = found.paths;
    // The proposal files and note files the human edited in their editor, which have no Commit of
    // their own: this list commits them. Discard leaves their text.
    for (path, title) in edited_files(place, &paths) {
        let what = if crate::target::is_note_file(&path) {
            "note file"
        } else {
            "proposal"
        };
        changes.push(Described {
            subject: format!("edit the {what} \"{}\"", short(&title)),
            line: format!("- Edit the {what}: {title}"),
        });
        paths.push(path);
    }
    let linked = linked_by(place, &paths);
    paths.extend(linked);
    Listed {
        changes,
        paths: files(&texts, paths),
        undo: found.undo,
    }
}

/// The proposal files and note files whose text differs from the committed one, with each title;
/// `taken` are the files the list holds already. A file no commit has is a note's or a
/// proposal's, which [`never_committed`] counts.
fn edited_files(place: &Place, taken: &[String]) -> Vec<(String, String)> {
    let mut found = Vec::new();
    for path in files_in(place, &FOLDERS) {
        if taken.contains(&path) {
            continue;
        }
        let (Ok(now), Some(then)) = (
            fs::read_to_string(place.root.join(&path)),
            place::committed(place, &path),
        ) else {
            continue;
        };
        if now != then {
            let title = crate::view::title(&now).unwrap_or_else(|| path.clone());
            found.push((path, title));
        }
    }
    found
}

/// Takes the added proposal the removed note of the text `text` in `inbox` became out of the
/// priorities' changes, and gives its section and text: the note's lines, moved, or a link to the
/// proposal file made from it, whose text escapes the note's markdown.
fn take_moved(
    proposals: &mut [Option<ProposalChange>],
    inbox: &str,
    text: &str,
) -> Option<(Section, String)> {
    if let Some(section) = take_proposal(proposals, text) {
        return Some((section, text.to_string()));
    }
    let note = inbox::parse(inbox)
        .into_iter()
        .find(|note| note.text == text && note.file().is_none())?;
    let expanded = inbox::expanded_text(inbox, &note.id)?;
    Some((take_proposal(proposals, &expanded)?, expanded))
}

/// Takes the added proposal of the text `text` out of the priorities' changes, and gives its
/// section.
fn take_proposal(proposals: &mut [Option<ProposalChange>], text: &str) -> Option<Section> {
    let at = proposals.iter().position(|proposal| {
        matches!(proposal, Some(ProposalChange::Added { text: added, .. }) if added == text)
    })?;
    match proposals[at].take() {
        Some(ProposalChange::Added { section, .. }) => Some(section),
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

/// The proposal files and note files a commit of the two lists holds: those the moves went into,
/// those the lists link that no commit has, and the note files that moved or left. A proposal
/// file's commit from its editor holding the lists holds them too.
pub(super) fn linked_files(place: &Place) -> Vec<String> {
    let mut paths = gather(place).paths;
    paths.retain(|path| path != INBOX && path != PRIORITIES);
    paths
}

/// The `images/` folders of the folders' main files among `paths`, which their commit may stage.
pub(super) fn images_folders(paths: &[String]) -> Vec<String> {
    paths
        .iter()
        .filter_map(|path| images::folder_of(path))
        .map(images::images_folder)
        .collect()
}

/// The images the folders' main files among `paths` link, which go with them as the attachments
/// decision says, the others deleted: called once the staged files are checked.
pub(super) fn linked_images(place: &Place, paths: &[String]) -> Result<Vec<String>, ActionError> {
    let mut linked = Vec::new();
    for folder in paths.iter().filter_map(|path| images::folder_of(path)) {
        linked.extend(images::linked_images(place, folder)?);
    }
    Ok(linked)
}

/// Commits `INBOX.md`, `PRIORITIES.md`, and the files notes went into, moved, or left, a folder
/// with its images, with a message naming their changes.
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
/// no commit has. A file is never lost: one a move wrote and nobody committed is deleted only while
/// it holds what the move wrote, with at most a note's images, which go with it, one a note was
/// added to loses that note's lines only, a note file a move put among the proposals moves back,
/// and a committed one a removal deleted comes back.
pub fn discard(place: &Place) -> Result<(), ActionError> {
    let listed = gather(place);
    let git = Git::open(&place.root)?;
    // Nothing discarded stays staged, as a refused commit or the human left it: a deleted file's
    // entry would block the next commit, or bring the file back.
    let mut staged: Vec<&str> = vec![INBOX, PRIORITIES];
    let folders = images_folders(&listed.paths);
    staged.extend(listed.paths.iter().chain(&folders).map(String::as_str));
    git.unstage(&staged)?;
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
                super::expand::remove_written(place, &path, &written)?;
            }
            Undo::Converted { old, path } => {
                let Some(written) = place::committed(place, &old) else {
                    continue;
                };
                if super::expand::remove_written(place, &path, &written)? {
                    git.restore(&old)?;
                } else {
                    super::attach::retarget(place, &old, &path)?;
                }
            }
            Undo::Grown { path, markdown } => {
                let file = place.root.join(&path);
                let text = fs::read_to_string(&file)?;
                if let Some(without) = proposal::without_item(&text, &markdown) {
                    fs::write(file, without)?;
                }
            }
            Undo::Merged {
                path,
                title,
                drop_notes,
            } => unmerge(place, &path, &title, drop_notes)?,
            Undo::Moved { path, note } => super::inbox::back_to_notes(place, &path, &note)?,
            Undo::Removed { note, paths } => {
                if !super::inbox::restore_note_file(place, &note)? {
                    for path in paths {
                        git.restore(&path)?;
                    }
                }
            }
        }
    }
    Ok(())
}
