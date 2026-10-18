//! A review comment on lines of a decision's file: read on the feature's branch, or at its merge
//! base with the default branch for a part the branch removed.

use crate::files::review::{Anchor, Review, is_decision_name};
use crate::git::{Git, ObjectId};

use super::super::ActionError;
use super::quoted;

/// The decision a comment points into: its file's stem, `specs/decisions/<name>.md`, and whether
/// the lines are of a part the branch removed.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DecisionTarget {
    pub name: String,
    pub removed: bool,
}

fn path(name: &str) -> String {
    format!("specs/decisions/{name}.md")
}

fn refused(message: String) -> ActionError {
    ActionError::Refused(message)
}

/// Where a comment of a spec's review on lines `start` to `end` of a decision points, and the
/// lines it quotes: the decision at `tip`, or at the merge base for a removed part.
pub(super) fn anchored(
    git: &Git,
    tip: ObjectId,
    file: &str,
    target: &DecisionTarget,
    lines: Option<(usize, usize)>,
) -> Result<(Anchor, Vec<String>), ActionError> {
    if file != "spec.md" {
        return Err(refused(format!("{file} lists no decision to comment on")));
    }
    let Some((start, end)) = lines else {
        return Err(refused(
            "a comment on a decision is on its lines".to_string(),
        ));
    };
    let name = &target.name;
    if !is_decision_name(name) {
        return Err(refused(format!("\"{name}\" is not a decision's name")));
    }
    let file = format!("{name}.md");
    let (at, place) = if target.removed {
        (merge_base(git, tip)?, "the default branch")
    } else {
        (tip, "the branch")
    };
    let text = git
        .read_file(at, &path(name))?
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .ok_or_else(|| refused(format!("{file} is not a decision on {place}")))?;
    let (heading, quote) = quoted(&text, &file, start, end)?;
    let anchor = Anchor::Decision {
        name: name.clone(),
        start,
        end,
        heading,
        removed: target.removed,
    };
    Ok((anchor, quote))
}

/// The merge base of the branch's tip and the default branch's.
fn merge_base(git: &Git, tip: ObjectId) -> Result<ObjectId, ActionError> {
    let default = git
        .default_branch()
        .and_then(|branch| git.tip(&branch))
        .ok_or_else(|| refused("the default branch has no commit".to_string()))?;
    git.merge_base(tip, default)?
        .ok_or_else(|| refused("the branch shares no commit with the default branch".to_string()))
}

/// Refuses a comment on a decision whose text changed between a pending review's commit and
/// `tip`: its lines, read at `tip`, would not be those of the review's commit. A removed part's
/// lines are the merge base's, at any commit.
pub(super) fn unchanged_since(
    git: &Git,
    review: &Review,
    tip: ObjectId,
    target: &DecisionTarget,
) -> Result<(), ActionError> {
    let path = path(&target.name);
    let now = git.read_file(tip, &path).ok().flatten();
    let unchanged = target.removed
        || git
            .resolve(&review.commit)
            .is_some_and(|old| git.read_file(old, &path).ok().flatten() == now);
    if unchanged {
        return Ok(());
    }
    Err(refused(format!(
        "{}.md changed since the pending review's commit: start over to comment on it",
        target.name
    )))
}

/// Whether the decisions a review comments on are as they were at its commit, a removed part's
/// excepted.
pub(crate) fn comments_current(git: &Git, review: &Review, tip: ObjectId) -> bool {
    review
        .comments
        .iter()
        .filter_map(|comment| match &comment.anchor {
            Anchor::Decision {
                name,
                removed: false,
                ..
            } => Some(name),
            _ => None,
        })
        .all(|name| {
            let path = path(name);
            git.resolve(&review.commit).is_some_and(|old| {
                git.read_file(old, &path).ok().flatten() == git.read_file(tip, &path).ok().flatten()
            })
        })
}
