//! A branch's changes waiting for a commit, which the lists' count of changes adds up. The default
//! branch's hold every change of the lists and the files a buffer edited; another branch's, the
//! files a buffer edited alone.

use super::{Changes, Listed, Place, edits, gather};

/// Whose changes: the default branch's, or another branch's, its files named from the feature's
/// folder at `folder` from the top level.
#[derive(Clone, Copy, Debug)]
pub enum Pane<'a> {
    Default,
    Branch { folder: Option<&'a str> },
}

fn listed(place: &Place, pane: Pane) -> Listed {
    match pane {
        Pane::Default => gather(place),
        Pane::Branch { folder } => edits::listed(place, folder),
    }
}

/// A branch's changes: their count, and each as a line.
pub fn pane(place: &Place, pane: Pane) -> Changes {
    let listed = listed(place, pane);
    Changes {
        count: listed.changes.len() as u32,
        lines: listed.changes.into_iter().map(|c| c.line).collect(),
    }
}
