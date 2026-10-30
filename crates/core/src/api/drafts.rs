//! A proposal drafted on the New page: its line in the priorities, the file it is expanded into,
//! and the text typed under its heading, written under one write lock, in place of the browser's
//! read, insert, expand, read, and save.

use std::path::Path;

use super::proposal_edits::section;
use super::{Result, reach_default_from, read_proposal_file, write_lock};
use crate::actions::{expand, priorities as edits, text};
use crate::files::document::hash;
use crate::files::priorities::Priorities;
use crate::view::ProposalFileView;

/// Writes `title` as the first proposal of a section that has not started, the started ones
/// staying above it, expands it into a proposal file, and writes `body` under the file's heading,
/// unless it is blank. Returns the file, for its editor. An expand refused takes the line back out,
/// so the priorities are as they were.
pub fn draft_proposal(
    repo: &Path,
    section_id: &str,
    title: &str,
    body: &str,
) -> Result<ProposalFileView> {
    let section = section(section_id)?;
    let _lock = write_lock(repo);
    let (place, workspace) = reach_default_from(repo)?;
    let read = workspace.join_priorities(edits::read(&place));
    let index = first_not_started(&read, section_id);
    let inserted = edits::insert(&place, section, index, &[format!("- {title}")], &read.hash)?;
    let id = format!("{}-{}", section.id(), index + 1);
    let expanded = match expand::create(&place, &id) {
        Ok(expanded) => expanded,
        Err(error) => {
            // The refusal is the expand's: a line the removal could not take out stays in the
            // commit page's changes.
            let _ = edits::remove(&place, &id, &inserted.hash);
            return Err(error.into());
        }
    };
    if !body.trim().is_empty() {
        let file = std::fs::read_to_string(place.root.join(&expanded.path))
            .map_err(crate::actions::ActionError::from)?;
        let written = format!("{}\n\n{}\n", file.trim_end(), body.trim());
        text::save(&place, &expanded.path, &written, &hash(&file))?;
    }
    read_proposal_file(repo, &expanded.path)
}

/// The index of the first proposal of the section `id` that has not started, or its end.
fn first_not_started(priorities: &Priorities, id: &str) -> usize {
    let proposals = priorities
        .sections
        .iter()
        .find(|section| section.section == id)
        .map_or(&[][..], |section| &section.proposals[..]);
    proposals
        .iter()
        .position(|proposal| proposal.running.is_none())
        .unwrap_or(proposals.len())
}
