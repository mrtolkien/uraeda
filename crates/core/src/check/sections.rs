//! `sections.*`: a file has its template's title, every required section at its level, in the
//! template's order, and no level-2 section the template does not have. A template section whose
//! placeholder starts with `[Optional` may be left out.

use crate::embedded;
use crate::files::markdown::{Document, Heading};
use crate::workspace::{FileKind, Problem};

use super::{Checked, File};

fn template_path(kind: Checked) -> Option<&'static str> {
    let path = match kind {
        Checked::Workflow(FileKind::Discovery) => "YYYY-MM-DD-feature-slug/discovery-01.md",
        Checked::Workflow(FileKind::Clarifications) => {
            "YYYY-MM-DD-feature-slug/clarifications-01.md"
        }
        Checked::Workflow(FileKind::Spec) => "YYYY-MM-DD-feature-slug/spec.md",
        Checked::Workflow(FileKind::Plan) => "YYYY-MM-DD-feature-slug/plan.md",
        Checked::Workflow(FileKind::Rulings) => "YYYY-MM-DD-feature-slug/rulings.md",
        Checked::Workflow(FileKind::DataModel) => "YYYY-MM-DD-feature-slug/data-model.md",
        Checked::Workflow(FileKind::Assessment) => "bugs/YYYY-MM-DD-bug-slug/assessment.md",
        Checked::Decision => "decisions/decision-topic.md",
        _ => return None,
    };
    Some(path)
}

#[derive(Debug)]
enum Slot {
    Title(String),
    Fixed(String),
    /// Numbered items like `Q1`, `US1`, `Task 1`, `R1`: the prefix before the number.
    Item(String),
    /// A heading with a literal start, like `Proposed change (`.
    Prefix(String),
    /// Any heading, like `[Product]`.
    Free,
}

struct TemplateHeading {
    level: u8,
    text: String,
    slot: Slot,
    optional: bool,
}

fn item_prefix(text: &str) -> Option<String> {
    let digits = text.find(|c: char| c.is_ascii_digit())?;
    let prefix = &text[..digits];
    ["Q", "US", "Task ", "R", "C"]
        .contains(&prefix)
        .then(|| prefix.to_string())
}

fn template(kind: Checked) -> Option<Vec<TemplateHeading>> {
    let text = embedded::template(template_path(kind)?)?;
    let document = Document::parse(text);
    let lines: Vec<&str> = text.lines().collect();
    let mut headings = Vec::new();
    for (index, heading) in document.headings.iter().enumerate() {
        let end = document
            .headings
            .get(index + 1)
            .map_or(lines.len(), |next| next.line - 1);
        let body = lines[heading.line..end]
            .iter()
            .find(|l| !l.trim().is_empty());
        let optional = body.is_some_and(|l| {
            let l = l.trim_start();
            l.starts_with("[Optional") || l.starts_with("- [Optional")
        });
        // The template's raw heading text keeps its placeholders, which the parser turns into
        // links or text: read it from the line itself.
        let raw = lines[heading.line - 1]
            .trim_start_matches('#')
            .trim()
            .to_string();
        let slot = if heading.level == 1 {
            Slot::Title(raw.split('[').next().unwrap_or_default().to_string())
        } else if raw.starts_with('[') {
            Slot::Free
        } else if let Some(prefix) = item_prefix(&raw) {
            Slot::Item(prefix)
        } else if let Some((prefix, _)) = raw.split_once('[') {
            Slot::Prefix(prefix.to_string())
        } else {
            Slot::Fixed(raw.clone())
        };
        headings.push(TemplateHeading {
            level: heading.level,
            text: raw,
            slot,
            optional,
        });
    }
    Some(headings)
}

fn hashes(level: u8) -> String {
    "#".repeat(level as usize)
}

fn matches(slot: &Slot, heading: &Heading) -> bool {
    match slot {
        Slot::Title(_) => false,
        Slot::Fixed(text) => heading.text == *text,
        Slot::Item(prefix) => heading
            .text
            .strip_prefix(prefix.as_str())
            .is_some_and(numbered),
        Slot::Prefix(prefix) => heading.text.starts_with(prefix.as_str()),
        Slot::Free => true,
    }
}

/// What follows an item's prefix: its number, a follow-up's letter like `.B`, then `:`.
fn numbered(rest: &str) -> bool {
    let digits = rest.len() - rest.trim_start_matches(|c: char| c.is_ascii_digit()).len();
    if digits == 0 {
        return false;
    }
    let rest = &rest[digits..];
    let rest = rest
        .strip_prefix('.')
        .and_then(|letter| letter.strip_prefix(|c: char| c.is_ascii_uppercase()))
        .unwrap_or(rest);
    rest.starts_with(':')
}

pub(super) fn check_sections(file: &File<'_>, document: &Document, problems: &mut Vec<Problem>) {
    let Some(slots) = template(file.kind) else {
        return;
    };
    // The title.
    if let Some(Slot::Title(prefix)) = slots.first().map(|s| &s.slot) {
        match document.headings.iter().find(|h| h.level == 1) {
            None => problems.push(file.problem(None, "sections.title", "no title")),
            Some(title) if !title.text.starts_with(prefix.as_str()) => problems.push(file.problem(
                Some(title.line),
                "sections.title",
                format!("the title starts with \"{prefix}\""),
            )),
            Some(_) => {}
        }
    }
    // Required sections and items.
    for slot in slots.iter().filter(|s| !s.optional && s.level >= 2) {
        let present = match &slot.slot {
            Slot::Fixed(_) | Slot::Item(_) => document
                .headings
                .iter()
                .any(|h| h.level == slot.level && matches(&slot.slot, h)),
            _ => true,
        };
        // A follow-up question is never required.
        let follow_up = matches!(&slot.slot, Slot::Item(p) if p == "Q") && slot.level == 3;
        if !present && !follow_up {
            problems.push(file.problem(
                None,
                "sections.missing",
                format!("missing section \"{} {}\"", hashes(slot.level), slot.text),
            ));
        }
    }
    // Unknown level-2 sections, unless the template lets any heading in.
    let free_level_2 = slots
        .iter()
        .any(|s| s.level == 2 && matches!(s.slot, Slot::Free));
    if !free_level_2 {
        for heading in document.headings.iter().filter(|h| h.level == 2) {
            let known = slots
                .iter()
                .any(|s| s.level == 2 && matches(&s.slot, heading));
            if !known {
                problems.push(file.problem(
                    Some(heading.line),
                    "sections.unknown",
                    format!("unknown section \"## {}\"", heading.text),
                ));
            }
        }
    }
    // The order of the fixed sections.
    let mut last: Option<(usize, &Heading)> = None;
    for heading in &document.headings {
        let Some(index) = slots.iter().position(|s| {
            s.level == heading.level
                && matches!(&s.slot, Slot::Fixed(text) if *text == heading.text)
        }) else {
            continue;
        };
        if let Some((last_index, last_heading)) = last
            && index < last_index
        {
            problems.push(file.problem(
                Some(heading.line),
                "sections.order",
                format!(
                    "\"{} {}\" must come before \"{} {}\", as in the template",
                    hashes(heading.level),
                    heading.text,
                    hashes(last_heading.level),
                    last_heading.text
                ),
            ));
            continue;
        }
        last = Some((index, heading));
    }
}

pub(super) fn check_priorities(file: &File<'_>, document: &Document, problems: &mut Vec<Problem>) {
    for section in ["Now", "Next", "Later", "Blocked"] {
        let present = document
            .headings
            .iter()
            .any(|h| h.level == 2 && h.text == section);
        if !present {
            problems.push(file.problem(
                None,
                "sections.missing",
                format!("missing section \"## {section}\""),
            ));
        }
    }
}
