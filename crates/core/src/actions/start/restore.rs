//! A start's writes put back as they were, once a hook refused its commit: nothing is made.

use std::fs;
use std::io;

use super::plan::Plan;
use super::{Source, Start};

impl Start<'_> {
    /// Puts back what the start wrote: each moved file at its path, `proposal_before` as the
    /// proposal's text when its nested lines were added, the dated folder gone, and
    /// `PRIORITIES.md` as it was read. The refused commit already took back what it staged.
    pub(super) fn put_back(
        &self,
        plan: &Plan,
        moves: &[(String, String)],
        proposal_before: Option<&str>,
    ) -> io::Result<()> {
        let root = self.root;
        if let Some(text) = proposal_before {
            fs::write(root.join(format!("{}/proposal.md", plan.destination)), text)?;
        }
        if let Source::Proposal(_) = self.source {
            for (from, to) in moves.iter().rev() {
                if let Some(parent) = root.join(from).parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::rename(root.join(to), root.join(from))?;
            }
        }
        // The folder was free before the start, as its plan checked: all it holds is the start's.
        fs::remove_dir_all(root.join(&plan.destination))?;
        let priorities = root.join("specs/PRIORITIES.md");
        match &plan.priorities_before {
            Some(text) => fs::write(priorities, text),
            None => fs::remove_file(priorities),
        }
    }
}
