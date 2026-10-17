//! The review a spec's revision answers: `## Your review` answers the review that requested the
//! revision, which the review file stops holding once a new review starts or the spec is approved.

use crate::files::document;
use crate::files::frontmatter;
use crate::files::items::{ReviewItems, items};
use crate::git::{Git, ObjectId};
use crate::workspace::Feature;

/// For `spec.md` at revision 2 or later, `spec-review.md` as it stood at the first commit, on the
/// first-parent history from `tip`, whose spec reads the revision of `text`: kept only when its
/// verdict is `changes-requested`. `tip` is the feature's branch's, else the default branch's.
pub(super) fn answered(
    git: &Git,
    feature: &Feature,
    tip: Option<ObjectId>,
    name: &str,
    text: &str,
) -> Option<ReviewItems> {
    if name != "spec.md" {
        return None;
    }
    let revision = revision_of(text).filter(|revision| *revision >= 2)?;
    let tip = tip.or_else(|| git.tip(&git.default_branch()?))?;
    let path = format!("{}/{name}", feature.path);
    let read = |commit, path: &str| {
        let bytes = git.read_file(commit, path).ok()??;
        Some(String::from_utf8_lossy(&bytes).into_owned())
    };
    let mut first = None;
    for commit in git.first_parent_changes(tip, &path).ok()? {
        if read(commit, &path).as_deref().and_then(revision_of) == Some(revision) {
            first = Some(commit);
        } else if first.is_some() {
            break;
        }
    }
    let review_name = crate::actions::review::review_name(name);
    let review_text = read(first?, &format!("{}/{review_name}", feature.path))?;
    let doc = document::parse(&review_text, &feature.path);
    items(&review_name, &review_text, &doc)
        .review
        .filter(|review| review.verdict == "changes-requested")
}

fn revision_of(text: &str) -> Option<u32> {
    u32::try_from(frontmatter::parse(text).ok()?.integer("revision")?).ok()
}
