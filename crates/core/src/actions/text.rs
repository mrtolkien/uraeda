//! Drafts and proposals edited as text: saved as typed, over the version they were read at only,
//! and committed with the skill's message.

use std::fs;

use crate::files::document::hash;
use crate::files::markdown::Document;
use crate::git::Git;
use crate::workspace::folder_slug;

use super::place::{self, Place};
use super::{ActionError, Change, Committed, commit, images};

const PRIORITIES: &str = "specs/PRIORITIES.md";

/// A file's text from the top level of a working tree, empty when it does not exist.
fn read(place: &Place, path: &str) -> String {
    fs::read_to_string(place.root.join(path)).unwrap_or_default()
}

/// Refuses a path outside `specs/`, or one climbing out of it.
fn checked(path: &str) -> Result<(), ActionError> {
    if !path.starts_with("specs/") || path.split('/').any(|part| part == ".." || part.is_empty()) {
        return Err(ActionError::Refused(format!(
            "{path} is not a file of specs/"
        )));
    }
    Ok(())
}

/// Writes `text` over the file read at `hash`, the hash of its text then, an absent file's being
/// that of the empty text. Returns the new hash.
pub fn save(place: &Place, path: &str, text: &str, previous: &str) -> Result<String, ActionError> {
    checked(path)?;
    if hash(&read(place, path)) != previous {
        return Err(ActionError::changed(path));
    }
    let file = place.root.join(path);
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(file, text)?;
    Ok(hash(text))
}

/// The folder whose `images/` a file's commit holds: none for a single-file draft.
fn folder(path: &str) -> Option<&str> {
    let (folder, _) = path.rsplit_once('/')?;
    (!matches!(folder, "specs/drafts" | "specs/backlog")).then_some(folder)
}

/// The single-file draft a folder draft was, `specs/drafts/<slug>.md` for
/// `specs/drafts/<slug>/proposal.md`.
fn single_file(path: &str) -> Option<String> {
    let rest = path
        .strip_prefix("specs/drafts/")
        .map(|rest| ("specs/drafts", rest))
        .or_else(|| {
            path.strip_prefix("specs/backlog/")
                .map(|rest| ("specs/backlog", rest))
        })?;
    let slug = rest.1.strip_suffix("/proposal.md")?;
    (!slug.contains('/')).then(|| format!("{}/{slug}.md", rest.0))
}

/// Every path a file's commit may hold, for the check of the staged files before any write.
fn candidates(path: &str) -> Vec<String> {
    let mut paths = vec![path.to_string(), PRIORITIES.to_string()];
    paths.extend(folder(path).map(images::images_folder));
    paths.extend(single_file(path));
    paths
}

/// The commit of a draft, `chore: draft <title>`, or `chore: edit the draft <title>` once
/// committed, and of a backlog file, `chore: add <title> to the backlog`, or
/// `chore: edit <title> in the backlog`, both with `PRIORITIES.md` when it changed; of a proposal,
/// `chore(<slug>): proposal`, or `chore(<slug>): edit the proposal` once committed; and the same
/// for a bug's report. The commit holds the images the file's folder links, the others deleted
/// from disk, and a folder draft's single file, committed before it became a folder, as deleted.
pub fn change(place: &Place, path: &str) -> Result<Change, ActionError> {
    checked(path)?;
    let git = Git::open(&place.root)?;
    let committed = |path: &str| {
        git.head()
            .and_then(|head| git.read_file(head, path).ok().flatten())
    };
    let text = read(place, path);
    let title = Document::parse(&text)
        .headings
        .into_iter()
        .find(|h| h.level == 1)
        .map(|h| h.text)
        .unwrap_or_else(|| path.to_string());
    let mut paths = vec![path.to_string()];
    let subject = if path.starts_with("specs/drafts/") || path.starts_with("specs/backlog/") {
        let priorities = read(place, PRIORITIES);
        if committed(PRIORITIES).is_some_and(|bytes| bytes != priorities.as_bytes()) {
            paths.push(PRIORITIES.to_string());
        }
        // A draft committed as one file, then made a folder by an image.
        let moved = single_file(path)
            .filter(|old| committed(old).is_some() && !place.root.join(old).exists());
        let edit = committed(path).is_some() || moved.is_some();
        paths.extend(moved);
        match (edit, path.starts_with("specs/backlog/")) {
            (false, false) => format!("chore: draft {title}"),
            (false, true) => format!("chore: add {title} to the backlog"),
            (true, false) => format!("chore: edit the draft {title}"),
            (true, true) => format!("chore: edit {title} in the backlog"),
        }
    } else if let Some((slug, file)) = path
        .strip_prefix("specs/bugs/")
        .and_then(|rest| rest.strip_suffix("/report.md"))
        .map(|folder| (folder, "report"))
        .or_else(|| {
            path.strip_prefix("specs/")
                .and_then(|rest| rest.strip_suffix("/proposal.md"))
                .map(|folder| (folder, "proposal"))
        })
        .and_then(|(folder, file)| Some((folder_slug(folder)?, file)))
    {
        if committed(path).is_some() {
            format!("chore({slug}): edit the {file}")
        } else {
            format!("chore({slug}): {file}")
        }
    } else {
        return Err(ActionError::Refused(format!(
            "{path} is not a draft, a proposal, or a report"
        )));
    };
    // Unlinked images are deleted first: a deletion of a committed one is a change.
    let (images, images_changed) = match folder(path) {
        Some(folder) => (
            images::linked_images(place, folder)?,
            images::images_changed(place, folder)?,
        ),
        None => (Vec::new(), false),
    };
    if committed(path).is_some_and(|bytes| bytes == text.as_bytes())
        && paths.len() == 1
        && !images_changed
    {
        return Err(ActionError::Refused(format!(
            "{path} has no change to commit"
        )));
    }
    paths.extend(images);
    Ok(Change {
        paths,
        subject,
        body: None,
    })
}

/// Commits a draft or a proposal, as [`change`] names it.
pub fn commit(place: &Place, path: &str) -> Result<Committed, ActionError> {
    checked(path)?;
    place::ensure_only_staged(place, &candidates(path))?;
    let change = change(place, path)?;
    place::ensure_only_staged(place, &change.paths)?;
    commit::commit(place, &change)
}
