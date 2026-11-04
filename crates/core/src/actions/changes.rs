//! The commit bar's one change list: the changes of `INBOX.md` and `PRIORITIES.md` since the last
//! commit, a note that left the inbox for the priorities or a proposal file counted as one move.
//! Its count, its commit message, Commit, and Discard all come from it.

use std::fs;

use crate::files::inbox::{self, NoteChange};
use crate::files::priorities::{self, ProposalChange, Section};

use super::amend::CHORE;
use super::commit::Mode;
use super::place::{self, Place};
use super::priorities::{describe, line, short};
use super::{ActionError, Change, Committed, commit, images};

mod discard;
mod edits;
mod files;
mod linked;
mod panes;
mod repairs;
mod texts;

pub use discard::discard;
pub use panes::{Pane, pane};

use files::{
    Edited, Found, Grown, Undo, edited_files, grown_files, linked_by, take_item, take_note,
    uncategorized, written_for_link, written_from,
};
use linked::never_committed;
use texts::{Texts, texts};

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

/// The change list, the files its commit holds, what Discard does to proposal files and note
/// files, and the link repairs among the files, which Discard restores.
struct Listed {
    changes: Vec<Described>,
    paths: Vec<String>,
    undo: Vec<Undo>,
    repairs: Vec<String>,
    /// The files a buffer edited, among `paths`: each one change.
    edits: Vec<String>,
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

/// Takes out of `proposals` the edit that made a line of the priorities a link to the proposal file
/// at `path`, its text unchanged: the line `linked` has now.
fn take_linked(
    proposals: &mut [Option<ProposalChange>],
    linked: &[priorities::Proposal],
    path: &str,
) {
    let links_path = |text: &str| {
        linked.iter().any(|proposal| {
            proposal.text == text
                && proposal
                    .link
                    .as_deref()
                    .and_then(|link| crate::workspace::resolve("specs", link))
                    .is_some_and(|linked| linked == path)
        })
    };
    let found = proposals.iter_mut().find(|change| {
        matches!(change, Some(ProposalChange::Edited { before, after, .. })
            if before == after && links_path(after))
    });
    if let Some(found) = found {
        *found = None;
    }
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
                // A line given its file for the note: its link is part of the move.
                take_linked(&mut proposals, &linked_proposals, &path);
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
    if texts.inbox_changed {
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

/// The change list with the link repairs: every file of `specs/` other than the lists and the files
/// listed already, whose change is links alone, as its own change.
fn gather(place: &Place) -> Listed {
    gather_with(place, edits::edits(place), &[])
}

/// The change list of the lists' own commit, the editor's and the commit bar's: the files a buffer
/// edited other than the lists are left out, for the Git page alone to commit.
fn gather_lists_route(place: &Place) -> Listed {
    let (edits, others) = lists_and_other_edits(place);
    gather_with(place, edits, &others)
}

/// The files a buffer edited: the lists, then the others.
fn lists_and_other_edits(place: &Place) -> (Vec<String>, Vec<String>) {
    edits::edits(place)
        .into_iter()
        .partition(|path| path == INBOX || path == PRIORITIES)
}

/// [`gather`] over the files a buffer edited, `edits`, `left` the ones it leaves out.
fn gather_with(place: &Place, edits: Vec<String>, left: &[String]) -> Listed {
    let mut listed = gather_lists(place, &edits, left);
    let mut taken = listed.paths.clone();
    taken.extend([INBOX.to_string(), PRIORITIES.to_string()]);
    taken.extend(edits.iter().chain(left).cloned());
    let repaired = repairs::repairs(place, &taken);
    for (path, name) in repaired.iter().zip(repairs::names(&repaired)) {
        listed.changes.push(Described {
            subject: format!("repair links in {name}"),
            line: format!("- Repair links: {name}"),
        });
        listed.paths.push(path.clone());
        listed.repairs.push(path.clone());
    }
    // A file a buffer edited is one change, before the others.
    let mut changes: Vec<Described> = edits.iter().map(|path| edits::edit(path)).collect();
    changes.append(&mut listed.changes);
    listed.changes = changes;
    let mut paths = edits.clone();
    paths.extend(
        listed
            .paths
            .into_iter()
            .filter(|path| !edits.contains(path)),
    );
    listed.paths = paths;
    listed.edits = edits;
    listed
}

/// The change list of the two lists, and of the proposal files and note files they need or the
/// human edited; a list among `edits`, the files a buffer edited, has no change line of its own,
/// and a file of `left` is not listed as edited. The files the lists need, and what Discard does to
/// them, still come from both lists since the last commit: a buffer's edit of the inbox holds the
/// note file a note added before it links.
fn gather_lists(place: &Place, edits: &[String], left: &[String]) -> Listed {
    let texts = texts(place, &[]);
    let (changes, mut found) = pair(place, &texts);
    let edited = |path: &str| edits.iter().any(|edit| edit == path);
    // The lines of a list a buffer edited read as if it had not changed.
    let mut changes = if edited(INBOX) || edited(PRIORITIES) {
        pair(place, &self::texts(place, edits)).0
    } else {
        changes
    };
    let mut paths = found.paths;
    let inbox_now = versions(place, INBOX).0.unwrap_or_default();
    // The proposal files and note files the human edited in their editor, which have no Commit of
    // their own: this list commits them. Discard leaves their text.
    let taken: Vec<String> = paths.iter().chain(edits).chain(left).cloned().collect();
    for Edited {
        path,
        title,
        now,
        then,
    } in edited_files(place, &taken)
    {
        if uncategorized(&inbox_now, &path, &now, &then) {
            paths.push(path.clone());
            found.undo.push(Undo::Uncategorized { path });
            continue;
        }
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
        repairs: Vec::new(),
        edits: Vec::new(),
    }
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

/// The commit message of `listed`, its type and scope `scope`, like `chore: `.
fn message_of(listed: &Listed, scope: &str) -> (String, Option<String>) {
    match listed.changes.as_slice() {
        [] if listed.paths == [PRIORITIES] => ("chore: update the priorities".to_string(), None),
        [] => ("chore: update the inbox".to_string(), None),
        [change] => (format!("{scope}{}", change.subject), None),
        [first, rest @ ..] => (
            format!("{scope}{}, and {} more", first.subject, rest.len()),
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
    message_of(&gather(place), CHORE)
}

/// The proposal files and note files a commit of the two lists holds: those the moves went into,
/// those the lists link that no commit has, and the note files that moved or left. A proposal
/// file's commit from its editor holding the lists holds them too, and leaves the link repairs on
/// the Git page.
pub(super) fn linked_files(place: &Place) -> Vec<String> {
    let (_, others) = lists_and_other_edits(place);
    let mut paths = gather_lists(place, &[], &others).paths;
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
/// with its images, with a message naming their changes. The other files a buffer edited wait for
/// the Git page.
pub fn commit(place: &Place) -> Result<Committed, ActionError> {
    let listed = gather_lists_route(place);
    let message = message_of(&listed, CHORE);
    commit_listed(place, &listed, message, true)
}

/// Commits what `listed` holds with `message`, its subject and its body, amending only when
/// `amends`. The record of the buffer's edits it held ends as the commit lands, which changes
/// their files in `HEAD`: a refused one keeps them listed.
fn commit_listed(
    place: &Place,
    listed: &Listed,
    (subject, body): (String, Option<String>),
    amends: bool,
) -> Result<Committed, ActionError> {
    if listed.paths.is_empty() {
        return Err(ActionError::Refused(
            "INBOX.md and PRIORITIES.md have no change to commit".to_string(),
        ));
    }
    let mut paths = listed.paths.clone();
    paths.extend(linked_images(place, &listed.paths)?);
    let change = Change {
        paths,
        subject,
        body,
    };
    // A message that may not amend is one the human typed.
    // Alone: files the human staged stay staged, out of the commit.
    let mode = Mode {
        only: true,
        amends,
        typed: !amends,
    };
    commit::commit_as(place, &change, mode)
}
