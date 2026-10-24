//! What changed in a spec since its human reviewed it: the spec at the commit of the review its
//! revision answers, against the version the page shows, part by part as a decision's change
//! matches them. The frontmatter is not a part, nor is the opening callout, rewritten at every
//! revision, and no rule's strength or check is read.

use super::answered::revision_of;
use crate::compare::{Part, Version, diff, matched, section_titles, version};
use crate::files::document;
use crate::files::items::ReviewItems;
use crate::git::Git;
use crate::view::{SinceChange, SinceReview};

/// The change of the spec at `path` since `review`, the review that requested the revision of
/// `current`, the spec as read: from the spec at the review's commit to `shown`. Not found when
/// the commit does not resolve, or holds no spec.
pub(super) fn since_review(
    git: &Git,
    path: &str,
    review: &ReviewItems,
    current: &str,
    shown: &str,
) -> SinceReview {
    let reviewed = git
        .resolve(&review.commit)
        .and_then(|commit| git.read_file(commit, path).ok().flatten())
        .and_then(|bytes| String::from_utf8(bytes).ok());
    // A review that requests changes is answered by the next revision.
    let revision = revision_of(current).unwrap_or_default().saturating_sub(1);
    let Some(reviewed) = reviewed else {
        return SinceReview {
            revision,
            found: false,
            parts: Vec::new(),
        };
    };
    let (old, new) = (spec_version(&reviewed), spec_version(shown));
    let parts = section_titles(&old, &new)
        .iter()
        .flat_map(|title| matched(old.parts(title), new.parts(title)))
        .filter_map(change)
        .collect();
    SinceReview {
        revision,
        found: true,
        parts,
    }
}

/// The parts of a spec's text, those of its opening callout left out.
fn spec_version(text: &str) -> Version {
    let doc = document::parse(text, "");
    let callout = crate::files::spec::items(&doc)
        .block
        .map(|id| &doc.blocks[id as usize]);
    let mut version = version(text);
    if let Some(callout) = callout {
        let inside = |part: &Part| {
            part.lines.start >= callout.start_line && part.lines.end <= callout.end_line
        };
        for (_, parts) in &mut version.sections {
            parts.retain(|part| !inside(part));
        }
    }
    version
}

/// A part's change, `None` when it is kept.
fn change((old, new): (Option<&Part>, Option<&Part>)) -> Option<SinceChange> {
    let (kind, runs) = diff((old, new));
    let shown = new.or(old)?;
    (kind != "kept").then(|| SinceChange {
        kind: kind.to_string(),
        heading: shown.heading.clone(),
        before: old.map(|part| part.lines),
        after: new.map(|part| part.lines),
        runs,
    })
}
