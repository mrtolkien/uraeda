//! The decisions a feature's branch changed: each file of `specs/decisions/` compared between the
//! merge base of the branch and the default branch, and the branch's side, computed on each read.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use super::change::{DecisionChange, compare};
use crate::files::document::hash;
use crate::git::{Git, ObjectId};

const DIR: &str = "specs/decisions";

/// Where a branch's decisions are read: the branch's side from its checkout when it has one, else
/// from its tip; the merge base's side from git.
pub struct BranchSides<'a> {
    pub git: &'a Git,
    /// The checkout holding the branch, when its files were read from disk.
    pub disk: Option<&'a Path>,
    /// The branch's tip.
    pub tip: Option<ObjectId>,
    /// The default branch's tip.
    pub default: Option<ObjectId>,
}

/// A decision at the merge base.
enum Before {
    Absent,
    Text(String),
    /// No merge base, or its file not readable as text.
    Unknown,
}

fn path(name: &str) -> String {
    format!("{DIR}/{name}.md")
}

/// The decision a file name of `specs/decisions/` holds: a markdown file directly in the folder.
fn name_of(file: &str) -> Option<&str> {
    file.strip_suffix(".md").filter(|name| !name.contains('/'))
}

fn lossy(bytes: Vec<u8>) -> String {
    String::from_utf8(bytes)
        .unwrap_or_else(|error| String::from_utf8_lossy(error.as_bytes()).into_owned())
}

impl BranchSides<'_> {
    /// Computed on each read, so a merge of the default branch moves it.
    fn merge_base(&self) -> Option<ObjectId> {
        self.git.merge_base(self.tip?, self.default?).ok()?
    }

    /// Every decision's name on both sides.
    fn names(&self, base: Option<ObjectId>) -> BTreeSet<String> {
        let mut files: Vec<String> = match self.disk {
            Some(root) => std::fs::read_dir(root.join(DIR))
                .into_iter()
                .flatten()
                .flatten()
                .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
                .filter_map(|entry| entry.file_name().into_string().ok())
                .collect(),
            None => self.listed(self.tip),
        };
        files.extend(self.listed(base));
        files
            .iter()
            .filter_map(|file| name_of(file).map(String::from))
            .collect()
    }

    /// The files of `specs/decisions/` at a commit, by file name.
    fn listed(&self, commit: Option<ObjectId>) -> Vec<String> {
        let files = commit.and_then(|commit| self.git.list_files(commit, DIR).ok());
        files
            .unwrap_or_default()
            .into_iter()
            .filter_map(|file| Some(file.strip_prefix(&format!("{DIR}/"))?.to_string()))
            .collect()
    }

    /// The branch's version of a decision.
    fn after(&self, name: &str) -> Option<String> {
        let bytes = match self.disk {
            Some(root) => std::fs::read(root.join(path(name))).ok(),
            None => self.git.read_file(self.tip?, &path(name)).ok().flatten(),
        };
        bytes.map(lossy)
    }

    fn before(&self, base: Option<ObjectId>, name: &str) -> Before {
        let Some(base) = base else {
            return Before::Unknown;
        };
        match self.git.read_file(base, &path(name)) {
            Ok(None) => Before::Absent,
            Ok(Some(bytes)) => String::from_utf8(bytes).map_or(Before::Unknown, Before::Text),
            Err(_) => Before::Unknown,
        }
    }

    /// One decision's change, or `None` when neither side has it. Without the merge base's
    /// version, the branch's text is all added, `compared` false.
    fn change(
        &self,
        base: Option<ObjectId>,
        name: &str,
        listed: bool,
        skip_same: bool,
    ) -> Option<DecisionChange> {
        let after = self.after(name);
        let before = self.before(base, name);
        // With `skip_same`, an unlisted decision whose text is the same on both sides is no change:
        // its parse is skipped.
        if let (true, false, Before::Text(before), Some(after)) =
            (skip_same, listed, &before, &after)
            && before == after
        {
            return None;
        }
        let mut change = match before {
            Before::Text(before) => compare(name, Some(&before), after.as_deref()),
            Before::Absent => compare(name, None, Some(after.as_deref()?)),
            Before::Unknown => {
                let mut change = compare(name, None, after.as_deref());
                change.compared = false;
                if after.is_none() {
                    change.kind = "removed".to_string();
                }
                change
            }
        };
        change.listed = listed;
        Some(change)
    }
}

impl BranchSides<'_> {
    /// A hash of each decision's two versions, by name: it differs when either side's text does.
    pub fn fingerprints(&self) -> BTreeMap<String, String> {
        let base = self.merge_base();
        self.names(base)
            .into_iter()
            .map(|name| {
                let before = match self.before(base, &name) {
                    Before::Text(text) => format!("text:{text}"),
                    Before::Absent => "absent".to_string(),
                    Before::Unknown => "unknown".to_string(),
                };
                let after = self
                    .after(&name)
                    .map_or("absent".into(), |t| format!("text:{t}"));
                let key = hash(&format!("{before}\u{0}{after}"));
                (name, key)
            })
            .collect()
    }
}

/// Whether a change is one: a new or removed decision, an uncompared one, a field of its title or
/// frontmatter that differs, or a part not kept. A rewrap is none.
fn differs(change: &DecisionChange) -> bool {
    !change.compared
        || change.kind != "changed"
        || !change.fields.is_empty()
        || change
            .sections
            .iter()
            .flat_map(|section| &section.parts)
            .any(|part| part.kind != "kept")
}

/// Every decision the branch changed, and every listed one found on either side: the listed ones
/// first in the order of `listed`, then the others by name.
pub fn branch_changes(sides: &BranchSides<'_>, listed: &[String]) -> Vec<DecisionChange> {
    let base = sides.merge_base();
    let mut changes: Vec<DecisionChange> = sides
        .names(base)
        .iter()
        .filter_map(|name| sides.change(base, name, listed.contains(name), true))
        .filter(|change| change.listed || differs(change))
        .collect();
    changes.sort_by_key(|change| {
        listed
            .iter()
            .position(|name| *name == change.name)
            .unwrap_or(listed.len())
    });
    changes
}

/// One decision as the branch has it: its text and its change. `None` when the branch has no
/// such decision.
pub fn branch_decision(
    sides: &BranchSides<'_>,
    name: &str,
    listed: bool,
) -> Option<(String, DecisionChange)> {
    let text = sides.after(name)?;
    let change = sides.change(sides.merge_base(), name, listed, false)?;
    Some((text, change))
}
