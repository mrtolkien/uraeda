//! The proposal files and note files of the change list: those the moves went into, paired by
//! their text, those the lists link that no commit has, and the note files that moved or left with
//! their notes, with what Discard does to each.

use std::fs;

use crate::files::inbox;
use crate::files::lines;
use crate::files::priorities;
use crate::files::proposal;

use super::super::expand;
use super::super::images::folder_of;
use super::super::place::{self, Place};
use super::{Texts, versions};

/// What Discard does to a proposal file or a note file, besides restoring the two lists: it never
/// loses the human's text.
pub(super) enum Undo {
    /// A file a move wrote and nobody committed: deleted while it holds what the move wrote.
    Created { path: String, written: String },
    /// A proposal file a note was added to: the note's item, by its markdown, taken out again.
    Grown { path: String, markdown: String },
    /// A proposal file a note's note file went into: the `## Notes` subsection titled `title`, the
    /// note's text, taken out again, with the images it linked that no commit has, and the
    /// `## Notes` it left empty when the last commit had none.
    Merged {
        path: String,
        title: String,
        drop_notes: bool,
    },
    /// A committed single file an attached image made a folder, at `path`: put back at `old` while
    /// the folder holds what the conversion wrote, with at most images added.
    Converted { old: String, path: String },
    /// A note file its note's move put among the proposals, at `path`: moved back to `note`.
    Moved { path: String, note: String },
    /// A committed note file, `note`, its note's removal deleted: written back as the removal found
    /// it, else its committed files, `paths`, restored.
    Removed { note: String, paths: Vec<String> },
}

/// The folders of proposal files and of note files, each with the name of a folder's main file.
pub(super) const FOLDERS: [(&str, &str); 2] = [
    ("specs/proposals", "proposal.md"),
    ("specs/notes", "note.md"),
];

/// The files of the working tree in `folders`, as [`FOLDERS`] gives them: single files, and each
/// folder's main file.
pub(super) fn files_in(place: &Place, folders: &[(&str, &str)]) -> Vec<String> {
    let mut files = Vec::new();
    for (folder, main) in folders {
        let Ok(entries) = fs::read_dir(place.root.join(folder)) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if entry.path().is_dir() {
                if entry.path().join(main).is_file() {
                    files.push(format!("{folder}/{name}/{main}"));
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

/// A proposal file changed since the last commit: its path, its title, the list items added to it,
/// each as its markdown and its text, the titles of the `## Notes` subsections added to it, and
/// whether the last commit had a `## Notes`.
pub(super) struct Grown {
    path: String,
    title: String,
    added: Vec<(String, String)>,
    notes: Vec<String>,
    had_notes: bool,
}

/// The items of `now` that `then` lacks, each as often as it lacks it.
fn added_to<T: PartialEq>(now: Vec<T>, mut then: Vec<T>) -> Vec<T> {
    now.into_iter()
        .filter(|item| match then.iter().position(|was| was == item) {
            Some(at) => {
                then.remove(at);
                false
            }
            None => true,
        })
        .collect()
}

pub(super) fn grown_files(place: &Place) -> Vec<Grown> {
    files_in(place, &FOLDERS[..1])
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
            // A folder no commit has, which an image made of a single file, had that file's text.
            let then = then
                .or_else(|| place::committed(place, &format!("{}.md", folder_of(&path)?)))
                .unwrap_or_default();
            let notes = added_to(proposal::note_titles(&now), proposal::note_titles(&then));
            let had_notes = proposal::has_notes(&then);
            let title = crate::view::title(&now).unwrap_or_else(|| path.clone());
            Some(Grown {
                path,
                title,
                added,
                notes,
                had_notes,
            })
        })
        .collect()
}

/// The proposal file or note file `link`, from `specs/`, when it has changes since the last commit,
/// and whether it was ever committed.
fn uncommitted_file(place: &Place, link: &str) -> Option<(String, bool)> {
    let path = crate::workspace::resolve("specs", link)?;
    if !crate::target::is_linked_file(&path) {
        return None;
    }
    let (now, then) = versions(place, &path);
    (now.is_some() && now != then).then_some((path, then.is_some()))
}

/// The files a pairing found: those the commit holds, and what Discard does to them.
#[derive(Default)]
pub(super) struct Found {
    pub(super) paths: Vec<String>,
    pub(super) undo: Vec<Undo>,
}

impl Found {
    /// Holds the file `link` in the commit when it changed; when no commit has it, Discard deletes
    /// it while it holds what the move wrote at its path, `written`.
    pub(super) fn linked(
        &mut self,
        place: &Place,
        link: Option<&str>,
        written: impl FnOnce(&str) -> Option<String>,
    ) {
        let Some((path, committed)) = link.and_then(|link| uncommitted_file(place, link)) else {
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

    /// Holds in the commit the move of the note file `note`, from the top level, which its note's
    /// move put among the proposals at `path`: its committed files, gone from their place, and the
    /// proposal file. Discard moves it back.
    pub(super) fn moved(&mut self, place: &Place, note: &str, path: Option<String>) {
        let Some(path) = path else {
            return;
        };
        if path == note || place.root.join(note).exists() || !place.root.join(&path).is_file() {
            return;
        }
        self.paths
            .extend(super::super::inbox::committed_note_file(place, note));
        if !self.paths.contains(&path) {
            self.paths.push(path.clone());
        }
        self.undo.push(Undo::Moved {
            path,
            note: note.to_string(),
        });
    }

    /// Holds in the commit the removal of the note file `note`, from the top level, which left with
    /// its note: its committed files, gone from their place. Discard restores them.
    pub(super) fn removed(&mut self, place: &Place, note: &str) {
        if place.root.join(note).exists() {
            return;
        }
        let paths = super::super::inbox::committed_note_file(place, note);
        if paths.is_empty() {
            return;
        }
        self.paths.extend(paths.iter().cloned());
        self.undo.push(Undo::Removed {
            note: note.to_string(),
            paths,
        });
    }
}

/// The proposal files and note files the files among `paths` link that no commit has, and that
/// `paths` lacks: a note added and moved into a proposal file since the last commit took its file
/// there, which the commit must hold too.
pub(super) fn linked_by(place: &Place, paths: &[String]) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    for path in paths
        .iter()
        .filter(|path| crate::target::is_linked_file(path))
    {
        let Ok(text) = fs::read_to_string(place.root.join(path)) else {
            continue;
        };
        let folder = path.rsplit_once('/').map_or("", |(folder, _)| folder);
        for link in crate::files::markdown::Document::parse(&text).links {
            let Some(linked) = crate::workspace::resolve(folder, &link.target) else {
                continue;
            };
            if crate::target::is_linked_file(&linked)
                && linked.ends_with(".md")
                && !paths.contains(&linked)
                && !found.contains(&linked)
                && place.root.join(&linked).is_file()
                && place::committed(place, &linked).is_none()
            {
                found.push(linked);
            }
        }
    }
    found
}

/// What a file at `path` made from the note of the text `text` in `inbox`, not a link, held when a
/// move wrote it.
pub(super) fn written_from(inbox: &str, text: &str, path: &str) -> Option<String> {
    let note = inbox::parse(inbox)
        .into_iter()
        .find(|note| note.text == text && note.file().is_none())?;
    let (title, nested) = inbox::note_file_parts(inbox, &note.id)?;
    Some(expand::from_note(path, &title, &nested))
}

/// What the note file at `path` a note added as a file links held when it was written: its link's
/// text.
pub(super) fn written_for_link(inbox: &str, id: &str, path: &str) -> Option<String> {
    Some(expand::from_note(path, &inbox::link_title(inbox, id)?, &[]))
}

/// The links of the lists' texts to proposal files and note files, each with the markdown of its
/// text when it is the whole proposal or note, as a tool writes it.
fn file_links(inbox: &str, priorities: &str) -> Vec<(String, Option<String>)> {
    let lines: Vec<&str> = priorities.lines().collect();
    let proposals = priorities::parse(priorities)
        .into_iter()
        .filter_map(|proposal| {
            let first = lines
                .get(proposal.line - 1)
                .and_then(|l| lines::item_marker(l));
            let title = first.and_then(|(_, rest)| inbox::link_text(rest));
            Some((proposal.link?, title))
        });
    let notes = inbox::parse(inbox).into_iter().filter_map(|note| {
        let title = inbox::link_title(inbox, &note.id);
        Some((note.link?, title))
    });
    proposals
        .chain(notes)
        .filter_map(|(link, title)| Some((crate::workspace::resolve("specs", &link)?, title)))
        .filter(|(path, _)| crate::target::is_linked_file(path))
        .collect()
}

/// Holds in the commit every file the lists link that no commit has, so none of their links points
/// at a file the commit lacks: a note added and moved since the last commit leaves no trace in the
/// inbox to pair. One linked since the last commit Discard deletes while it holds what a tool wrote
/// for the link, the proposal titled by its text, with the nested lines the proposal of that text
/// had at the last commit.
pub(super) fn never_committed(place: &Place, texts: &Texts, found: &mut Found) {
    if texts.inbox.0 == texts.inbox.1 && texts.priorities.0 == texts.priorities.1 {
        return;
    }
    let text = |version: &Option<String>| version.clone().unwrap_or_default();
    let then = file_links(&text(&texts.inbox.1), &text(&texts.priorities.1));
    let now = file_links(&text(&texts.inbox.0), &text(&texts.priorities.0));
    for (path, title) in now.clone() {
        if !place.root.join(&path).is_file() || place::committed(place, &path).is_some() {
            continue;
        }
        // A proposal file made a folder, which a note went into too: once its note is taken out,
        // Discard makes it the single file again.
        if let Some(old) = converted_from(place, &path, &then, &now)
            && !found.paths.contains(&old)
        {
            found.undo.push(Undo::Converted {
                old: old.clone(),
                path: path.clone(),
            });
            found.paths.push(old);
            if !found.paths.contains(&path) {
                found.paths.push(path);
            }
            continue;
        }
        if found.paths.contains(&path) {
            continue;
        }
        if let Some(title) = title.filter(|_| !then.iter().any(|(was, _)| *was == path))
            && let Some(written) = written_by_move(place, &path, &title)
        {
            found.undo.push(Undo::Created {
                path: path.clone(),
                written,
            });
        }
        found.paths.push(path);
    }
}

/// What a move wrote in the file at `path` titled `title`, read from the file itself: the lines
/// between its title line and its next section are the proposal's children, which may have changed
/// since the last commit, so any list lines stand for them. `None` when anything else stands
/// there, or in the sections: the human typed in it.
fn written_by_move(place: &Place, path: &str, title: &str) -> Option<String> {
    const MARK: &str = "\u{1}children";
    let text = fs::read_to_string(place.root.join(path)).ok()?;
    let bare = expand::from_note(path, title, &[]);
    if text == bare {
        return Some(bare);
    }
    let marked = expand::from_note(path, title, &[MARK.to_string()]);
    let (head, tail) = marked.split_once(MARK)?;
    let middle = text
        .strip_prefix(head)?
        .strip_suffix(tail.trim_start_matches('\n'))?;
    let children: Vec<&str> = middle
        .lines()
        .filter(|line| crate::files::proposal::image_file(line).is_none())
        .collect();
    let listed = children.iter().all(|line| {
        let line = line.trim_start();
        line.is_empty() || lines::item_marker(line).is_some()
    });
    let children = children.join("\n");
    let children = children.trim_matches('\n');
    // The children as they stand, links included: they were rebased when the file was written.
    let written = if children.is_empty() {
        bare
    } else {
        format!("{head}{children}{tail}")
    };
    listed.then_some(written)
}

/// The committed single file the folder's main file `path` was made from by an attached image: the
/// lists linked it at the last commit and link `path` in its place, the file is gone, and `path` is
/// in the folder named after it, numbered when that name was taken.
fn converted_from(
    place: &Place,
    path: &str,
    then: &[(String, Option<String>)],
    now: &[(String, Option<String>)],
) -> Option<String> {
    let folder = folder_of(path)?;
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
                && folder_of(old).is_none()
                && !now.iter().any(|(linked, _)| linked == *old)
                && !place.root.join(old).exists()
                && place::committed(place, old).is_some()
        })
        .cloned()
}

/// Takes a `## Notes` subsection titled `text` out of those added to the proposal files, and gives
/// what Discard does to it, and its file's path and title.
pub(super) fn take_note(grown: &mut [Grown], text: &str) -> Option<(Undo, String, String)> {
    grown.iter_mut().find_map(|file| {
        let at = file.notes.iter().position(|title| title == text)?;
        let title = file.notes.remove(at);
        let undo = Undo::Merged {
            path: file.path.clone(),
            title,
            drop_notes: !file.had_notes,
        };
        Some((undo, file.path.clone(), file.title.clone()))
    })
}

/// Takes back, for Discard, the `## Notes` subsection titled `title` of the proposal file at
/// `path`, a note's note file's text, with the `## Notes` it left empty, `drop_notes`, and the
/// images of the file's folder it linked that no commit has and nothing links any more.
pub(super) fn unmerge(
    place: &Place,
    path: &str,
    title: &str,
    drop_notes: bool,
) -> Result<(), crate::actions::ActionError> {
    let file = place.root.join(path);
    let text = fs::read_to_string(&file)?;
    let Some((without, removed)) = proposal::without_note(&text, title, drop_notes) else {
        return Ok(());
    };
    fs::write(&file, &without)?;
    let folder = path.rsplit_once('/').map_or("", |(folder, _)| folder);
    let images = super::super::images::images_folder(folder);
    if !super::super::images::in_place(&place.root, &images) {
        return Ok(());
    }
    let git = crate::git::Git::open(&place.root)?;
    let committed = |file: &str| {
        git.head()
            .is_some_and(|head| git.read_file(head, file).ok().flatten().is_some())
    };
    let linked: Vec<String> = crate::files::markdown::Document::parse(&without)
        .links
        .iter()
        .filter_map(|link| crate::workspace::resolve(folder, &link.target))
        .collect();
    for link in crate::files::markdown::Document::parse(&removed).links {
        let Some(image) = crate::workspace::resolve(folder, &link.target) else {
            continue;
        };
        if image.starts_with(&format!("{images}/"))
            && !linked.contains(&image)
            && !committed(&image)
        {
            let _ = fs::remove_file(place.root.join(&image));
        }
    }
    let _ = fs::remove_dir(place.root.join(&images));
    Ok(())
}

/// Takes an item of the text `text` out of the items added to the proposal files, and gives its
/// file's path and title, and the item's markdown.
pub(super) fn take_item(grown: &mut [Grown], text: &str) -> Option<(String, String, String)> {
    grown.iter_mut().find_map(|file| {
        let at = file.added.iter().position(|added| added.1 == text)?;
        let (markdown, _) = file.added.remove(at);
        Some((file.path.clone(), file.title.clone(), markdown))
    })
}
