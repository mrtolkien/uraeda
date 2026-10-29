//! Whether an action's commit amends the latest commit: both are `chore:` commits of proposal
//! files, note files, the inbox, or the priorities alone, on the default branch, and no other
//! branch holds the latest one. A run of small edits makes one commit, whose message lists them.

use std::fs;

use crate::git::{Git, Latest};

use super::Change;
use super::place::Place;

/// The files whose commits amend each other: the two lists, and what is under the two folders.
const LISTS: [&str; 2] = [super::inbox::PATH, super::priorities::PATH];
const FOLDERS: [&str; 2] = ["specs/proposals/", "specs/notes/"];

/// The type and the missing scope of the commits amended.
const CHORE: &str = "chore: ";

/// The message of the latest commit amended with `change`, its subject and its body, or `None`
/// when `change` is a commit of its own. A read that fails makes it a commit of its own.
pub fn message(place: &Place, change: &Change) -> Option<(String, String)> {
    if !joins(&change.subject, change.body.as_deref(), &change.paths) {
        return None;
    }
    let git = Git::open(&place.root).ok()?;
    let branch = git.current_branch()?;
    if git.default_branch()? != branch {
        return None;
    }
    let latest = git.latest().ok()??;
    if latest.parents.len() != 1
        || !joins(&latest.subject, latest.body.as_deref(), &latest.files)
        || undoes(place, &git, &latest, &change.paths)
        || git.held_elsewhere(latest.id, &branch).unwrap_or(true)
    {
        return None;
    }
    Some(merged(&latest, change))
}

/// Whether a commit may join another: an unscoped `chore:`, with no body or a list of changes,
/// holding only the files whose commits amend each other.
fn joins(subject: &str, body: Option<&str>, paths: &[String]) -> bool {
    subject.starts_with(CHORE)
        && body.is_none_or(|body| body.lines().all(|line| line.starts_with("- ")))
        && !paths.is_empty()
        && paths.iter().all(|path| {
            LISTS.contains(&path.as_str()) || FOLDERS.iter().any(|folder| path.starts_with(folder))
        })
}

/// Whether committing `paths` as they are in the working tree takes every file of `latest` back
/// to its parent's: the amend would leave it empty.
fn undoes(place: &Place, git: &Git, latest: &Latest, paths: &[String]) -> bool {
    let parent = latest.parents[0];
    latest.files.iter().all(|file| paths.contains(file))
        && paths.iter().all(|path| {
            fs::read(place.root.join(path)).ok() == git.read_file(parent, path).ok().flatten()
        })
}

/// The subject naming the latest commit's first change and the count of the others, and the body
/// listing every change of both, one per line.
fn merged(latest: &Latest, change: &Change) -> (String, String) {
    let mut lines = changes(&latest.subject, latest.body.as_deref());
    lines.extend(changes(&change.subject, change.body.as_deref()));
    let first = description(&latest.subject);
    let first = match latest.body {
        Some(_) => without_count(first),
        None => first,
    };
    let subject = format!("{CHORE}{first}, and {} more", lines.len() - 1);
    (subject, lines.join("\n"))
}

/// A commit's changes, one per line: its body's list, or its subject's one change.
fn changes(subject: &str, body: Option<&str>) -> Vec<String> {
    match body {
        Some(body) => body.lines().map(String::from).collect(),
        None => {
            let description = description(subject);
            let mut chars = description.chars();
            let first = chars.next().map(|c| c.to_uppercase().collect::<String>());
            vec![format!("- {}{}", first.unwrap_or_default(), chars.as_str())]
        }
    }
}

fn description(subject: &str) -> &str {
    subject.strip_prefix(CHORE).unwrap_or(subject)
}

/// A description without its `, and <count> more`.
fn without_count(description: &str) -> &str {
    match description.rsplit_once(", and ") {
        Some((first, rest))
            if rest
                .strip_suffix(" more")
                .is_some_and(|count| count.parse::<u32>().is_ok()) =>
        {
            first
        }
        _ => description,
    }
}
