//! Drafting a line of `PRIORITIES.md`, or a note of the inbox: a draft file from the proposal
//! template, linked from the line.

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

/// `  Now   Basic web UI`, one line per entry, the sections padded to the longest one plus two
/// spaces.
pub fn listed(entries: &[&Entry]) -> String {
    let width = entries
        .iter()
        .map(|entry| entry.section.title().len() + 2)
        .max()
        .unwrap_or_default();
    entries
        .iter()
        .map(|entry| format!("\n  {:<width$}{}", entry.section.title(), entry.text))
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
    let content = proposal(&entry.text, &[]);
    if content.is_empty() {
        return Err(ActionError::Refused("no proposal template".into()));
    }
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

/// A path for a new draft named after `text` that no draft has: `specs/drafts/<slug>.md`, then
/// with `-2`, `-3`, ... when a file or a folder draft has the name.
pub fn free_path(place: &Place, text: &str) -> String {
    let slug = Some(slug::from_text(text))
        .filter(|slug| !slug.is_empty())
        .unwrap_or_else(|| "note".to_string());
    let taken = |name: &str| {
        let base = place.root.join("specs/drafts");
        base.join(format!("{name}.md")).exists() || base.join(name).exists()
    };
    let name = (1..)
        .map(|n| match n {
            1 => slug.clone(),
            n => format!("{slug}-{n}"),
        })
        .find(|name| !taken(name))
        .unwrap_or(slug);
    format!("specs/drafts/{name}.md")
}

/// Writes a new draft at `path` from the proposal template, with `line` as its title and the
/// paragraph of What, and `nested`, a note's nested lines, after it.
pub fn write_new(
    place: &Place,
    path: &str,
    line: &str,
    nested: &[String],
) -> Result<(), ActionError> {
    let content = proposal(line, nested);
    if content.is_empty() {
        return Err(ActionError::Refused("no proposal template".into()));
    }
    let draft = place.root.join(path);
    fs::create_dir_all(draft.parent().unwrap_or(&place.root))?;
    fs::write(&draft, content)?;
    Ok(())
}

/// The proposal template with `line` as its title and as the paragraph of What, and no other
/// placeholder: each section keeps its heading, empty. `nested` lines follow the paragraph.
fn proposal(line: &str, nested: &[String]) -> String {
    let mut paragraphs: Vec<String> = Vec::new();
    for paragraph in embedded::proposal_paragraphs() {
        if paragraph.starts_with("# ") {
            paragraphs.push(format!("# {line}"));
        } else if !embedded::is_placeholder(paragraph) {
            paragraphs.push(paragraph.to_string());
        } else if paragraphs.last().is_some_and(|last| last == "## What") {
            paragraphs.push(line.to_string());
            if !nested.is_empty() {
                paragraphs.push(nested.join("\n"));
            }
        }
    }
    if paragraphs.is_empty() {
        return String::new();
    }
    paragraphs.join("\n\n") + "\n"
}
