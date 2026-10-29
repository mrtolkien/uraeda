//! The proposal files and note files the lists link that no commit has: each held in the commit, and
//! deleted by Discard while it holds what a tool wrote for its link.

use std::fs;

use crate::files::inbox;
use crate::files::lines;
use crate::files::priorities;
use crate::files::proposal;

use super::super::expand;
use super::super::images::folder_of;
use super::super::place::{self, Place};
use super::Texts;
use super::files::{Found, Undo};

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
        let listed = found.paths.contains(&path);
        // A file listed already is another change's, unless a note went into its `## Notes`.
        let merged = |undo: &Undo| matches!(undo, Undo::Merged { path: p, .. } if *p == path);
        if let Some(title) = title.filter(|_| !then.iter().any(|(was, _)| *was == path))
            && (!listed || found.undo.iter().any(merged))
        {
            created(place, found, &path, &title);
        }
        if !listed {
            found.paths.push(path);
        }
    }
}

/// Has Discard delete the file at `path`, linked since the last commit by a line or a note titled
/// `title`, while it holds what a tool wrote for it once the notes Discard takes out of its
/// `## Notes` are out: a proposal file expanded for a note to go into, its template's `## Notes`
/// then kept for it.
fn created(place: &Place, found: &mut Found, path: &str, title: &str) {
    let has_created = |undo: &Undo| matches!(undo, Undo::Created { path: p, .. } if p == path);
    if found.undo.iter().any(has_created) {
        return;
    }
    let Ok(mut text) = fs::read_to_string(place.root.join(path)) else {
        return;
    };
    let mut merged = false;
    for undo in &found.undo {
        if let Undo::Merged { path: p, title, .. } = undo
            && p == path
            && let Some((without, _)) = proposal::without_note(&text, title, false)
        {
            text = without;
            merged = true;
        }
    }
    let Some(written) = written_by_move(path, title, &text) else {
        return;
    };
    if merged {
        for undo in &mut found.undo {
            if let Undo::Merged {
                path: p,
                drop_notes,
                ..
            } = undo
                && p == path
            {
                *drop_notes = false;
            }
        }
    }
    found.undo.push(Undo::Created {
        path: path.to_string(),
        written,
    });
}

/// What a move wrote in the file at `path` titled `title`, read from the file itself: the lines
/// between its title line and its next section are the proposal's children, which may have changed
/// since the last commit, so any list lines stand for them. `None` when anything else stands
/// there, or in the sections: the human typed in it.
fn written_by_move(path: &str, title: &str, text: &str) -> Option<Vec<String>> {
    const MARK: &str = "\u{1}children";
    let bare = expand::written_shapes(path, title, &[]);
    let marked = expand::written_shapes(path, title, &[MARK.to_string()]);
    let found: Vec<String> = bare
        .into_iter()
        .zip(marked)
        .filter_map(|(bare, marked)| written_in(text, bare, &marked))
        .collect();
    (!found.is_empty()).then_some(found)
}

/// What a move wrote in `text`, as [`written_by_move`] finds it, for one shape of the file: `bare`
/// without children, and `marked` with a mark where they go.
fn written_in(text: &str, bare: String, marked: &str) -> Option<String> {
    const MARK: &str = "\u{1}children";
    if text == bare {
        return Some(bare);
    }
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
