//! Where a feature's or a change's files live: its folder, its branch, and its record.

use super::Kind;
use crate::today::Date;

/// A feature folder's name: `2026-10-10-cli-core`, with a real date and a slug.
pub fn folder_slug(folder: &str) -> Option<&str> {
    let (date, slug) = (folder.get(..10)?, folder.get(11..)?);
    (folder.as_bytes().get(10) == Some(&b'-') && Date::parse(date).is_some() && !slug.is_empty())
        .then_some(slug)
}

/// The feature or change a branch is for: `2026-10-10-cli-core`, or `change/2026-10-14-x`.
pub fn branch_folder(branch: &str) -> Option<(Kind, &str)> {
    match branch.strip_prefix("change/") {
        Some(folder) => folder_slug(folder).map(|_| (Kind::Change, folder)),
        None => folder_slug(branch).map(|_| (Kind::Feature, branch)),
    }
}

/// The branch of a feature or a change.
pub fn folder_branch(kind: Kind, folder: &str) -> String {
    match kind {
        Kind::Feature => folder.to_string(),
        Kind::Change => format!("change/{folder}"),
    }
}

/// Where a finished feature's or change's record lives.
pub fn record_path(folder: &str) -> String {
    format!("specs/done/{folder}.md")
}

/// The feature or change a path under `specs/` is in, and the path inside its folder, empty for the
/// folder itself: `specs/x/proposal.md` is in the feature `x`, and `specs/changes/x` is the change
/// `x`. The inverse of [`folder_path`].
pub fn path_folder(path: &str) -> Option<(Kind, &str, &str)> {
    let rest = path.strip_prefix("specs/")?;
    let (kind, rest) = match rest.strip_prefix("changes/") {
        Some(rest) => (Kind::Change, rest),
        None => (Kind::Feature, rest),
    };
    let (folder, inside) = rest.split_once('/').unwrap_or((rest, ""));
    (!folder.is_empty()).then_some((kind, folder, inside))
}

/// The folder of a feature or a change, from the repository's root.
pub(crate) fn folder_path(kind: Kind, folder: &str) -> String {
    match kind {
        Kind::Feature => format!("specs/{folder}"),
        Kind::Change => format!("specs/changes/{folder}"),
    }
}

/// The first file of a feature's or a change's folder, its proposal: committed, it starts the
/// workflow.
pub fn first_file(_kind: Kind) -> &'static str {
    "proposal.md"
}
