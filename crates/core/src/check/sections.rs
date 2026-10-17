//! `sections.*`: a file has its template's title, every required section at its level, in the
//! template's order, and no level-2 section the template does not have, nor, in a round, a level-3
//! heading under a section whose template has only fixed ones. A template section whose placeholder starts with
//! `[Optional` may be left out, and one starting `[Optional, required from round 02` only in a
//! first round. `settled.*`: a round's settled points sit in groups.

use crate::embedded;
use crate::files::document::{self, Block, BlockKind, plain};
use crate::files::markdown::{Document, Heading};
use crate::files::{clarifications, inbox};
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
        Checked::Decision | Checked::PreviewDecision => "decisions/decision-topic.md",
        Checked::Record => "done/YYYY-MM-DD-feature-slug.md",
        Checked::Triage => "INBOX-TRIAGE.md",
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
    /// Optional in a first round, required from round 02 on, like `### Since the last round`.
    later_rounds: bool,
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
        let later_rounds = body.is_some_and(|l| {
            l.trim_start()
                .starts_with("[Optional, required from round 02")
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
            later_rounds,
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
    check_title(file, document, &slots, problems);
    check_required(file, document, &slots, problems);
    check_unknown(file, document, &slots, problems);
    check_order(file, document, &slots, problems);
}

fn check_title(
    file: &File<'_>,
    document: &Document,
    slots: &[TemplateHeading],
    problems: &mut Vec<Problem>,
) {
    let Some(Slot::Title(prefix)) = slots.first().map(|s| &s.slot) else {
        return;
    };
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

/// The file's round, from its name like `clarifications-02.md`: 1 for any other file.
fn round_of(file: &File<'_>) -> u32 {
    let name = file.path.rsplit('/').next().unwrap_or_default();
    FileKind::of(name).and_then(|(_, round)| round).unwrap_or(1)
}

/// Required sections and items. A heading under an optional level-2 section is required only when
/// that section is there, and one required from round 02 on only in a later round.
fn check_required(
    file: &File<'_>,
    document: &Document,
    slots: &[TemplateHeading],
    problems: &mut Vec<Problem>,
) {
    let mut parent: Option<&TemplateHeading> = None;
    let mut absent_parents = Vec::new();
    for (index, slot) in slots.iter().enumerate() {
        if slot.level == 2 {
            parent = Some(slot);
        } else if slot.level > 2
            && let Some(parent) = parent
            && parent.optional
            && !document
                .headings
                .iter()
                .any(|h| h.level == 2 && matches(&parent.slot, h))
        {
            absent_parents.push(index);
        }
    }
    let later_round = round_of(file) > 1;
    let required = |slot: &TemplateHeading| !slot.optional || (slot.later_rounds && later_round);
    for (_, slot) in slots
        .iter()
        .enumerate()
        .filter(|(index, s)| required(s) && s.level >= 2 && !absent_parents.contains(index))
    {
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
}

/// The template's level-3 headings under its level-2 section matching `heading`, when they are all
/// fixed headings: then a file's level-3 headings there must be among them.
fn fixed_children<'a>(slots: &'a [TemplateHeading], heading: &Heading) -> Option<Vec<&'a str>> {
    let index = slots
        .iter()
        .position(|s| s.level == 2 && matches(&s.slot, heading))?;
    let children: Vec<&TemplateHeading> = slots[index + 1..]
        .iter()
        .take_while(|s| s.level > 2)
        .filter(|s| s.level == 3)
        .collect();
    let texts: Vec<&str> = children
        .iter()
        .filter_map(|s| match &s.slot {
            Slot::Fixed(text) => Some(text.as_str()),
            _ => None,
        })
        .collect();
    (!texts.is_empty() && texts.len() == children.len()).then_some(texts)
}

/// Unknown level-2 sections, unless the template lets any heading in, and in a round, unknown
/// level-3 headings under a section whose template has only fixed ones: the Context and the
/// settled points. A heading in a quote or a callout is the quote's, and left out.
fn check_unknown(
    file: &File<'_>,
    document: &Document,
    slots: &[TemplateHeading],
    problems: &mut Vec<Problem>,
) {
    let free_level_2 = slots
        .iter()
        .any(|s| s.level == 2 && matches!(s.slot, Slot::Free));
    let round = file.kind == Checked::Workflow(FileKind::Clarifications);
    let mut parent: Option<&Heading> = None;
    for heading in document.headings.iter().filter(|h| !h.quoted) {
        if heading.level == 2 {
            parent = Some(heading);
        }
        let known = match heading.level {
            2 => {
                free_level_2
                    || slots
                        .iter()
                        .any(|s| s.level == 2 && matches(&s.slot, heading))
            }
            3 if round => parent
                .and_then(|parent| fixed_children(slots, parent))
                .is_none_or(|children| children.contains(&heading.text.as_str())),
            _ => true,
        };
        if !known {
            problems.push(file.problem(
                Some(heading.line),
                "sections.unknown",
                format!(
                    "unknown section \"{} {}\"",
                    hashes(heading.level),
                    heading.text
                ),
            ));
        }
    }
}

/// The order of the fixed sections.
fn check_order(
    file: &File<'_>,
    document: &Document,
    slots: &[TemplateHeading],
    problems: &mut Vec<Problem>,
) {
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

/// `settled.group`: in a round, every settled point sits under a group, `### Check these`,
/// `### Behaviour`, or `### Under the hood`: a top-level list item between `## Settled without the
/// human` and its first top-level sub-heading, or its notes, is in none.
pub(super) fn check_settled_groups(file: &File<'_>, problems: &mut Vec<Problem>) {
    let tree = document::parse(file.text, "");
    let top_heading = |b: &Block, level: u32| {
        b.parent.is_none() && b.kind == BlockKind::Heading && b.level.is_some_and(|l| l <= level)
    };
    let Some(start) = tree.blocks.iter().position(|b| {
        top_heading(b, 2) && b.level == Some(2) && plain(&b.spans) == "Settled without the human"
    }) else {
        return;
    };
    let notes_line = clarifications::notes(file.text).map_or(u32::MAX, |(line, _)| line as u32);
    let loose = tree.blocks[start + 1..]
        .iter()
        .filter(|b| b.parent.is_none())
        .take_while(|b| !top_heading(b, 3) && b.start_line < notes_line)
        .filter(|b| b.kind == BlockKind::List)
        .flat_map(|list| tree.children(list.id));
    for item in loose {
        problems.push(file.problem(
            Some(item.start_line as usize),
            "settled.group",
            "a settled point outside a group: put it under \"### Check these\", \"### Behaviour\", or \"### Under the hood\"",
        ));
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

/// `inbox.*`: the inbox is titled `# Inbox`, and names each category once. Tools add to a repeated
/// category's first heading, so the second is reported. An empty heading names no category.
pub(super) fn check_inbox(file: &File<'_>, document: &Document, problems: &mut Vec<Problem>) {
    let title = document.headings.iter().find(|h| h.level == 1);
    if title.is_none_or(|title| title.text != "Inbox") {
        problems.push(file.problem(
            title.map(|title| title.line),
            "inbox.title",
            "the title is \"# Inbox\"",
        ));
    }
    let mut seen = Vec::new();
    for (line, name) in inbox::category_headings(file.text) {
        if name.is_empty() {
            continue;
        }
        if seen.contains(&name) {
            problems.push(file.problem(
                Some(line),
                "inbox.category",
                format!("the category \"{name}\" is repeated"),
            ));
        } else {
            seen.push(name);
        }
    }
}

/// A record's rounds, `### Round 01`, `### Round 02`, ..., and the questions of each round,
/// `#### Q1:`, `#### Q2:`, ..., follow-ups like `Q2.B` aside, are numbered from 1 without gaps.
pub(super) fn check_record_numbering(
    file: &File<'_>,
    document: &Document,
    problems: &mut Vec<Problem>,
) {
    let mut round = 0;
    let mut question = 0;
    for heading in &document.headings {
        if heading.level == 3
            && let Some(number) = heading.text.strip_prefix("Round ")
        {
            round += 1;
            question = 0;
            if number.parse::<u32>().ok() != Some(round) || number.len() != 2 {
                problems.push(file.problem(
                    Some(heading.line),
                    "sections.numbering",
                    format!("Round {number} should be Round {round:02}"),
                ));
            }
        } else if heading.level == 4
            && let Some(rest) = heading.text.strip_prefix('Q')
        {
            let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
            if digits.is_empty() || !rest[digits.len()..].starts_with(':') {
                continue;
            }
            question += 1;
            if digits.parse::<u32>().ok() != Some(question) {
                problems.push(file.problem(
                    Some(heading.line),
                    "sections.numbering",
                    format!("Q{digits} should be Q{question}"),
                ));
            }
        }
    }
}
