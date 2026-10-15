//! A proposal, a feature's or a change's: how far discovery researches it, and which of its `##` sections
//! are written yet.

use crate::check::allowed_values;
use crate::workspace::FileKind;

use super::{frontmatter, markdown};

/// The effort discovery puts in when the proposal names none, or a value that is not one.
const DEFAULT_DISCOVERY: &str = "high";

/// The discovery efforts a proposal may ask for, from the least research to the most.
pub fn discovery_levels() -> &'static [&'static str] {
    allowed_values(FileKind::Proposal, "discovery")
}

/// The effort a proposal's `discovery` field asks for: `high` without the field, or with a value
/// that is not one of the levels.
pub fn discovery(text: &str) -> &'static str {
    let front = frontmatter::parse(text).ok();
    let value = front.as_ref().and_then(|front| front.raw("discovery"));
    discovery_levels()
        .iter()
        .find(|level| Some(**level) == value)
        .copied()
        .unwrap_or(DEFAULT_DISCOVERY)
}

/// The text with its `discovery` field set to `level`, its comment kept; refused for a value that
/// is not a level.
pub fn set_discovery(text: &str, level: &str) -> Result<String, String> {
    let levels = discovery_levels();
    if !levels.contains(&level) {
        return Err(format!(
            "discovery \"{level}\" is not one of {}",
            levels.join(", ")
        ));
    }
    Ok(frontmatter::set(text, "discovery", level))
}

/// A part of the text: before its first `##` heading, without one, or under one.
struct Section {
    heading: Option<String>,
    text: String,
}

/// The text's parts: what comes before the first `##` heading, then each `##` section, without
/// the frontmatter and the `#` title.
fn sections(text: &str) -> Vec<Section> {
    let document = markdown::Document::parse(text);
    let body_start = frontmatter::block(text).map_or(1, |(_, end_line)| end_line + 1);
    let mut found = vec![Section {
        heading: None,
        text: String::new(),
    }];
    for (index, line) in text.lines().enumerate() {
        let number = index + 1;
        if number < body_start {
            continue;
        }
        match document.headings.iter().find(|h| h.line == number) {
            Some(heading) if heading.level == 2 => found.push(Section {
                heading: Some(heading.text.clone()),
                text: String::new(),
            }),
            Some(heading) if heading.level == 1 => {}
            _ => {
                let last = found.last_mut().expect("the part before any heading");
                last.text.push_str(line);
                last.text.push('\n');
            }
        }
    }
    found
}

/// Whether a proposal holds more than its title and What: text in any other part of it.
pub fn is_written(text: &str) -> bool {
    sections(text).iter().any(|section| {
        section.heading.as_deref() != Some("What") && !section.text.trim().is_empty()
    })
}

/// The headings of the `##` sections that hold no text yet, in order.
pub fn empty_sections(text: &str) -> Vec<String> {
    sections(text)
        .into_iter()
        .filter(|section| section.text.trim().is_empty())
        .filter_map(|section| section.heading)
        .collect()
}
