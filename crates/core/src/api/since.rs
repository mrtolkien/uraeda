//! What changed in a spec since its human reviewed it: the spec at the commit of the review its
//! revision answers, against the version the page shows, part by part as a decision's change
//! matches them, a heading of level 3 or deeper a part too. The frontmatter is not a part, nor is
//! the opening callout, rewritten at every revision, and no rule's strength or check is read. A
//! section renamed is its heading's change, its parts compared with the ones it had.

use super::answered::revision_of;
use crate::compare::{Part, Version, diff, matched, section_titles, version_with_headings};
use crate::files::document;
use crate::files::items::ReviewItems;
use crate::gates::AWAITING_HUMAN;
use crate::git::Git;
use crate::view::{SinceChange, SinceReview};

/// The change of the spec at `path` since `review`, the review its revision answers, while it waits
/// for its human: an approved spec is under review no more (R6). While it waits, the page shows
/// the committed spec, `committed` when it differs from `current`, the spec as read.
pub(super) fn while_waiting(
    git: &Git,
    path: &str,
    review: Option<&ReviewItems>,
    status: Option<&str>,
    current: &str,
    committed: Option<&str>,
) -> Option<SinceReview> {
    let review = review.filter(|_| status == Some(AWAITING_HUMAN))?;
    Some(since_review(
        git,
        path,
        review,
        current,
        committed.unwrap_or(current),
    ))
}

/// The change of the spec at `path` since `review`, the review that requested the revision of
/// `current`, the spec as read: from the spec at the review's commit to `shown`. Not found when
/// the commit does not resolve, or holds no spec. The revision is the one the reviewed spec reads,
/// else the one before `current`'s.
fn since_review(
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
    let Some(reviewed) = reviewed else {
        // A review that requests changes is most often answered by the next revision.
        return SinceReview {
            revision: revision_of(current).unwrap_or_default().saturating_sub(1),
            found: false,
            parts: Vec::new(),
        };
    };
    let revision = revision_of(&reviewed)
        .or_else(|| revision_of(current).map(|revision| revision.saturating_sub(1)))
        .unwrap_or_default();
    let (old, new) = (spec_version(&reviewed), spec_version(shown));
    SinceReview {
        revision,
        found: true,
        parts: compared(&old, &new),
    }
}

/// The changes of two versions, section by section, a section renamed at the newer's place.
fn compared(old: &Version, new: &Version) -> Vec<SinceChange> {
    let renamed = renamed(old, new);
    let mut changes = Vec::new();
    for title in section_titles(old, new) {
        let before = match renamed.iter().find(|(_, head)| head.heading == title) {
            Some(&(was, now)) => {
                changes.extend(change((Some(was), Some(now))));
                was.heading.as_str()
            }
            None if renamed.iter().any(|(was, _)| was.heading == title) => continue,
            None => title.as_str(),
        };
        let pairs = matched(old.parts(before), new.parts(&title));
        changes.extend(pairs.into_iter().filter_map(change));
    }
    changes
}

/// The `##` headings of the sections only one version has, paired when they are the same section
/// renamed: its heading and parts, read as one part, are the same part.
fn renamed<'a>(old: &'a Version, new: &'a Version) -> Vec<(&'a Part, &'a Part)> {
    let (was, now) = (only(old, new), only(new, old));
    let wholes = |heads: &[&Part], version: &Version| -> Vec<Part> {
        heads.iter().map(|head| whole(head, version)).collect()
    };
    let (was_whole, now_whole) = (wholes(&was, old), wholes(&now, new));
    let index = |list: &[Part], part: &Part| list.iter().position(|p| std::ptr::eq(p, part));
    matched(&was_whole, &now_whole)
        .into_iter()
        .filter_map(|pair| match pair {
            (Some(o), Some(n)) => Some((was[index(&was_whole, o)?], now[index(&now_whole, n)?])),
            _ => None,
        })
        .collect()
}

/// The `##` headings of `version` that `other` has no section of.
fn only<'a>(version: &'a Version, other: &Version) -> Vec<&'a Part> {
    let heads = version.heads.iter();
    heads
        .filter(|head| other.heads.iter().all(|h| h.heading != head.heading))
        .collect()
}

/// A section as one part: its heading's text, then its parts'.
fn whole(head: &Part, version: &Version) -> Part {
    let parts = version.parts(&head.heading).iter();
    Part {
        text: [head.text.as_str()]
            .into_iter()
            .chain(parts.map(|part| part.text.as_str()))
            .collect::<Vec<_>>()
            .join(" "),
        item: false,
        lines: head.lines,
        heading: head.heading.clone(),
    }
}

/// The parts of a spec's text, those of its opening callout left out.
fn spec_version(text: &str) -> Version {
    let doc = document::parse(text, "");
    let callout = crate::files::spec::items(&doc)
        .block
        .map(|id| &doc.blocks[id as usize]);
    let mut version = version_with_headings(text);
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
