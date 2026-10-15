//! The drafts of the change list: those the moves went into, paired by their text, and those the
//! lists link that no commit has, with what Discard does to each.

use std::fs;

use crate::files::inbox;
use crate::files::lines;
use crate::files::priorities;

use super::super::draft;
use super::super::place::{self, Place};
use super::{Texts, versions};

/// What Discard does to a draft, besides restoring the two lists: it never loses the human's text.
pub(super) enum Undo {
    /// A draft a move wrote and nobody committed: deleted while it holds what the move wrote.
    Created { path: String, written: String },
    /// A draft a note was added to: the note's item, by its markdown, taken out again.
    Grown { path: String, markdown: String },
    /// A committed single-file draft an attached image made a folder, at `path`: put back at `old`
    /// while the folder holds what the conversion wrote, with at most images added.
    Converted { old: String, path: String },
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
pub(super) struct Grown {
    path: String,
    title: String,
    added: Vec<(String, String)>,
}

pub(super) fn grown_drafts(place: &Place) -> Vec<Grown> {
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

/// The drafts a pairing found: those the commit holds, and what Discard does to them.
#[derive(Default)]
pub(super) struct Drafts {
    pub(super) paths: Vec<String>,
    pub(super) undo: Vec<Undo>,
}

impl Drafts {
    /// Holds the draft `link` in the commit when it changed; when no commit has it, Discard deletes
    /// it while it holds what the move wrote at its path, `written`.
    pub(super) fn linked(
        &mut self,
        place: &Place,
        link: Option<&str>,
        written: impl FnOnce(&str) -> Option<String>,
    ) {
        let Some((path, committed)) = link.and_then(|link| uncommitted_draft(place, link)) else {
            return;
        };
        if !committed && let Some(written) = written(&path) {
            self.undo.push(Undo::Created {
                path: path.clone(),
                written,
            });
        }
        self.paths.push(path);
    }
}

/// What a draft at `path` made from the note of the text `text` in `inbox`, not a link, held when
/// a move wrote it.
pub(super) fn written_from(inbox: &str, text: &str, path: &str) -> Option<String> {
    let note = inbox::parse(inbox)
        .into_iter()
        .find(|note| note.text == text && note.draft().is_none())?;
    let (title, nested) = inbox::draft_parts(inbox, &note.id)?;
    Some(draft::from_note(path, &title, &nested))
}

/// What the draft at `path` a note added as a draft links held when it was written: its link's
/// text.
pub(super) fn written_for_link(inbox: &str, id: &str, path: &str) -> Option<String> {
    Some(draft::from_note(path, &inbox::link_title(inbox, id)?, &[]))
}

/// The links of the lists' texts to drafts, each with the markdown of its text when it is the
/// whole entry or note, as a tool writes it.
fn draft_links(inbox: &str, priorities: &str) -> Vec<(String, Option<String>)> {
    let lines: Vec<&str> = priorities.lines().collect();
    let entries = priorities::parse(priorities)
        .into_iter()
        .filter_map(|entry| {
            let first = lines
                .get(entry.line - 1)
                .and_then(|l| lines::item_marker(l));
            let title = first.and_then(|(_, rest)| inbox::link_text(rest));
            Some((entry.link?, title))
        });
    let notes = inbox::parse(inbox).into_iter().filter_map(|note| {
        let title = inbox::link_title(inbox, &note.id);
        Some((note.link?, title))
    });
    entries
        .chain(notes)
        .filter_map(|(link, title)| Some((crate::workspace::resolve("specs", &link)?, title)))
        .filter(|(path, _)| crate::target::is_draft(path))
        .collect()
}

/// Holds in the commit every draft the lists link that no commit has, so none of their links points
/// at a file the commit lacks: a note added and moved since the last commit leaves no trace in the
/// inbox to pair. One linked since the last commit Discard deletes while it holds what a tool wrote
/// for the link, the proposal titled by its text.
pub(super) fn never_committed(place: &Place, texts: &Texts, found: &mut Drafts) {
    if texts.inbox.0 == texts.inbox.1 && texts.priorities.0 == texts.priorities.1 {
        return;
    }
    let text = |version: &Option<String>| version.clone().unwrap_or_default();
    let then = draft_links(&text(&texts.inbox.1), &text(&texts.priorities.1));
    let now = draft_links(&text(&texts.inbox.0), &text(&texts.priorities.0));
    for (path, title) in now.clone() {
        if found.paths.contains(&path)
            || !place.root.join(&path).is_file()
            || place::committed(place, &path).is_some()
        {
            continue;
        }
        if let Some(old) = converted_from(place, &path, &then, &now) {
            found.undo.push(Undo::Converted {
                old: old.clone(),
                path: path.clone(),
            });
            found.paths.extend([old, path]);
            continue;
        }
        if let Some(title) = title.filter(|_| !then.iter().any(|(was, _)| *was == path)) {
            found.undo.push(Undo::Created {
                path: path.clone(),
                written: draft::from_note(&path, &title, &[]),
            });
        }
        found.paths.push(path);
    }
}

/// The committed single-file draft the folder draft `path` was made from by an attached image: the
/// lists linked it at the last commit and link `path` in its place, the file is gone, and `path` is
/// in the folder named after it, numbered when that name was taken.
fn converted_from(
    place: &Place,
    path: &str,
    then: &[(String, Option<String>)],
    now: &[(String, Option<String>)],
) -> Option<String> {
    let folder = path.strip_suffix("/proposal.md")?;
    then.iter()
        .map(|(old, _)| old)
        .find(|old| {
            let Some(stem) = old.strip_suffix(".md") else {
                return false;
            };
            let named = folder == stem
                || folder
                    .strip_prefix(stem)
                    .and_then(|rest| rest.strip_prefix('-'))
                    .is_some_and(|number| number.parse::<u32>().is_ok());
            named
                && !old.ends_with("/proposal.md")
                && !now.iter().any(|(linked, _)| linked == *old)
                && !place.root.join(old).exists()
                && place::committed(place, old).is_some()
        })
        .cloned()
}

/// Takes an item of the text `text` out of the items added to the drafts, and gives its draft's
/// path and title, and the item's markdown.
pub(super) fn take_item(drafts: &mut [Grown], text: &str) -> Option<(String, String, String)> {
    drafts.iter_mut().find_map(|draft| {
        let at = draft.added.iter().position(|added| added.1 == text)?;
        let (markdown, _) = draft.added.remove(at);
        Some((draft.path.clone(), draft.title.clone(), markdown))
    })
}
