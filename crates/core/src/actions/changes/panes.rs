//! The Commit page's panes: a branch's changes, its suggested message, and its commit with the
//! message the human typed, or its discard. The default branch's pane holds every change of the
//! lists and the files a buffer edited; another branch's, the files a buffer edited alone.

use crate::actions::commit::{self, Mode};
use crate::git::Git;

use super::{
    ActionError, CHORE, Change, Changes, Committed, Listed, Place, commit_listed, discard, edits,
    gather, message_of,
};

/// Whose pane: the default branch's, or another branch's, its files named from the feature's
/// folder at `folder` from the top level, its commits scoped by the feature's `slug`.
#[derive(Clone, Copy, Debug)]
pub enum Pane<'a> {
    Default,
    Branch {
        folder: Option<&'a str>,
        slug: Option<&'a str>,
    },
}

fn listed(place: &Place, pane: Pane) -> Listed {
    match pane {
        Pane::Default => gather(place),
        Pane::Branch { folder, .. } => edits::listed(place, folder),
    }
}

/// The type and scope of a pane's commits: `chore: `, or `chore(<slug>): ` on a feature's branch.
fn scope(pane: Pane) -> String {
    match pane {
        Pane::Branch {
            slug: Some(slug), ..
        } => format!("chore({slug}): "),
        _ => CHORE.to_string(),
    }
}

/// A pane's changes, and the message suggested for them: the subject, then the body.
pub fn pane(place: &Place, pane: Pane) -> (Changes, String) {
    let listed = listed(place, pane);
    let message = match message_of(&listed, &scope(pane)) {
        (subject, Some(body)) => format!("{subject}\n\n{body}"),
        (subject, None) => subject,
    };
    let changes = Changes {
        count: listed.changes.len() as u32,
        lines: listed.changes.into_iter().map(|c| c.line).collect(),
    };
    (changes, message)
}

/// A message as typed, trimmed of the blank lines around it: its first line, and the lines after
/// it, blank lines before them left out. `None` when every line is blank.
fn typed(message: &str) -> Option<(String, Option<String>)> {
    let mut lines = message.lines().skip_while(|line| line.trim().is_empty());
    let subject = lines.next()?.to_string();
    let rest: Vec<&str> = lines.skip_while(|line| line.trim().is_empty()).collect();
    let end = rest
        .iter()
        .rposition(|line| !line.trim().is_empty())
        .map_or(0, |at| at + 1);
    let body = (end > 0).then(|| rest[..end].join("\n"));
    Some((subject, body))
}

/// Commits a pane's files with `message`, as typed, trimmed of the blank lines around it. The
/// record of the buffer's edits it commits ends as the commit lands (see [`crate::actions::edited`]). The default branch's commit may amend the latest one
/// only with the suggested message; another branch's commits its files alone, leaving any other
/// file of its worktree out. Refused with "A commit needs a message." when the message is blank.
pub fn commit_pane(place: &Place, pane: Pane, message: &str) -> Result<Committed, ActionError> {
    let typed = typed(message)
        .ok_or_else(|| ActionError::Refused("A commit needs a message.".to_string()))?;
    let listed = listed(place, pane);
    if let Pane::Default = pane {
        let amends = typed == message_of(&listed, CHORE);
        return commit_listed(place, &listed, typed, amends);
    }
    if listed.paths.is_empty() {
        return Err(ActionError::Refused(
            "This branch has no change to commit".to_string(),
        ));
    }
    let (subject, body) = typed;
    let change = Change {
        paths: listed.paths.clone(),
        subject,
        body,
    };
    let mode = Mode {
        only: true,
        amends: false,
        typed: true,
    };
    commit::commit_as(place, &change, mode)
}

/// Discards a pane: the default branch's as [`discard`] does; another branch's files a buffer
/// edited put back as `HEAD` has them (ruling R3).
pub fn discard_pane(place: &Place, pane: Pane) -> Result<(), ActionError> {
    if let Pane::Default = pane {
        return discard(place);
    }
    let listed = listed(place, pane);
    let git = Git::open(&place.root)?;
    let staged: Vec<&str> = listed.edits.iter().map(String::as_str).collect();
    git.unstage(&staged)?;
    edits::restore(place, &git, &listed.edits)
}
