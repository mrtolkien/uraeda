//! Drafts and proposals edited as text: saved as typed, over the version they were read at only,
//! and committed with the skill's message.

use std::fs;

use crate::files::document::hash;
use crate::files::markdown::Document;
use crate::git::Git;
use crate::workspace::folder_slug;

use super::place::{self, Place};
use super::{ActionError, Change, Committed, commit};

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

/// The commit of a draft, `chore: draft <title>`, with `PRIORITIES.md` when it changed; of a
/// proposal, `chore(<slug>): proposal`, or `chore(<slug>): edit the proposal` once committed; and
/// the same for a bug's report.
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
        format!("chore: draft {title}")
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
    if committed(path).is_some_and(|bytes| bytes == text.as_bytes()) && paths.len() == 1 {
        return Err(ActionError::Refused(format!(
            "{path} has no change to commit"
        )));
    }
    Ok(Change {
        paths,
        subject,
        body: None,
    })
}

/// Commits a draft or a proposal, as [`change`] names it.
pub fn commit(place: &Place, path: &str) -> Result<Committed, ActionError> {
    let change = change(place, path)?;
    place::ensure_only_staged(place, &change.paths)?;
    commit::commit(place, &change)
}
