//! Where files of `specs/` went: the moves a link rewrite follows, made by the core's own moves or
//! read from git's history.

use std::fmt;

/// Where a file or folder went, from the top level.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Went {
    /// Moved: its new path, and the anchor the link takes instead of its own, for a note merged
    /// into a proposal file's `## Notes`.
    Moved {
        path: String,
        anchor: Option<String>,
    },
    /// A finished folder's file, now its record `specs/done/<folder>.md`.
    Record(String),
    /// Deleted, by the commit `commit` (7 characters), whose subject is `subject`.
    Deleted { commit: String, subject: String },
}

/// The check's message tail for a link to a file that went: `it moved to /<path>`,
/// `it became the record /<path>`, or `deleted in <commit> (<subject>)`.
impl fmt::Display for Went {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Moved { path, .. } => write!(f, "it moved to /{path}"),
            Self::Record(path) => write!(f, "it became the record /{path}"),
            Self::Deleted { commit, subject } => write!(f, "deleted in {commit} ({subject})"),
        }
    }
}

/// A file or folder of `specs/` that went somewhere.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Move {
    /// The file or folder from the top level. A folder matches every path under it, the rest of
    /// the path kept after a `Moved`'s path. Ending in `#anchor`, it matches only the links with
    /// that anchor, compared case-insensitively: the Undo of a merged note.
    pub from: String,
    pub went: Went,
}

impl Move {
    /// The rest of `path` after this move's file or folder, empty or starting with `/`, when a link
    /// to `path` with the anchor `anchor` is one this move takes. `None` when it is not.
    pub fn rest<'a>(&self, path: &'a str, anchor: Option<&str>) -> Option<&'a str> {
        let (from, wanted) = match self.from.split_once('#') {
            Some((from, wanted)) => (from, Some(wanted)),
            None => (self.from.as_str(), None),
        };
        if let Some(wanted) = wanted
            && !anchor.is_some_and(|anchor| anchor.eq_ignore_ascii_case(wanted))
        {
            return None;
        }
        let rest = path.strip_prefix(from)?;
        (rest.is_empty() || rest.starts_with('/')).then_some(rest)
    }
}
