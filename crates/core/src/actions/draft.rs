//! Drafting a line of `PRIORITIES.md`: a draft file from the proposal template, linked from the
//! line.

use std::fs;

use crate::embedded;
use crate::files::priorities::{self, Entry};
use crate::slug;

use super::ActionError;
use super::place::Place;

const PRIORITIES: &str = "specs/PRIORITIES.md";

/// The lines that can be drafted: those without a link.
pub fn candidates(place: &Place) -> Result<Vec<Entry>, ActionError> {
    let text = fs::read_to_string(place.root.join(PRIORITIES))?;
    Ok(priorities::parse(&text)
        .into_iter()
        .filter(|entry| entry.link.is_none())
        .collect())
}

/// `  Now   Basic web UI`, one line per entry.
pub fn listed(entries: &[&Entry]) -> String {
    entries
        .iter()
        .map(|entry| format!("\n  {:<6}{}", entry.section.title(), entry.text))
        .collect()
}

/// A draft written: its path from the top level, and the line it drafts.
pub struct Drafted {
    pub path: String,
    pub text: String,
}

/// Drafts the one line of `PRIORITIES.md` containing `query`, ignoring case.
pub fn run(place: &Place, query: &str) -> Result<Drafted, ActionError> {
    let priorities_path = place.root.join(PRIORITIES);
    let text = fs::read_to_string(&priorities_path)?;
    let lower = query.to_lowercase();
    let entries = priorities::parse(&text);
    let matching: Vec<&Entry> = entries
        .iter()
        .filter(|entry| entry.text.to_lowercase().contains(&lower))
        .collect();
    let entry = match matching.as_slice() {
        [] => {
            return Err(ActionError::Refused(format!(
                "no line of PRIORITIES.md matches \"{query}\""
            )));
        }
        [entry] => *entry,
        several => {
            return Err(ActionError::Refused(format!(
                "{} lines match \"{query}\":{}",
                several.len(),
                listed(several)
            )));
        }
    };
    draft_entry(place, &text, entry)
}

/// Drafts the line of `PRIORITIES.md` with the id `id`, like `next-2`, as the web UI names it.
pub fn create(place: &Place, id: &str) -> Result<Drafted, ActionError> {
    let text = fs::read_to_string(place.root.join(PRIORITIES))?;
    let entries = priorities::parse(&text);
    let entry = entries
        .iter()
        .find(|entry| format!("{}-{}", entry.section.id(), entry.position) == id)
        .ok_or_else(|| ActionError::Refused(format!("no priority {id}")))?;
    draft_entry(place, &text, entry)
}

fn draft_entry(place: &Place, text: &str, entry: &Entry) -> Result<Drafted, ActionError> {
    let priorities_path = place.root.join(PRIORITIES);
    if let Some(link) = &entry.link {
        return Err(ActionError::Refused(format!(
            "{} already links {link}",
            entry.text
        )));
    }
    let path = format!("specs/drafts/{}.md", slug::from_text(&entry.text));
    let draft = place.root.join(&path);
    if draft.exists() {
        return Err(ActionError::Refused(format!("{path} exists")));
    }
    let template = embedded::template("YYYY-MM-DD-feature-slug/proposal.md")
        .ok_or_else(|| ActionError::Refused("no proposal template".into()))?;
    let content = template.replacen("# [Feature name]", &format!("# {}", entry.text), 1);
    let target = path.trim_start_matches("specs/");
    let linked = priorities::link(text, entry.line, target)
        .ok_or_else(|| ActionError::Refused("cannot link the line".into()))?;
    fs::create_dir_all(draft.parent().unwrap_or(&place.root))?;
    fs::write(&draft, content)?;
    fs::write(&priorities_path, linked)?;
    Ok(Drafted {
        path,
        text: entry.text.clone(),
    })
}
