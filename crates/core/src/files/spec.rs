//! The user stories and success criteria of a spec.

use super::document::{Block, BlockKind, Document};
use super::items::{
    Criterion, MockupLink, Scenario, SpecItems, Story, TierChoice, headings, section,
};
use crate::check::allowed_values;
use crate::workspace::FileKind;

/// The risk tiers a spec may have, from the least risk to the most.
pub fn risk_tiers() -> &'static [&'static str] {
    allowed_values(FileKind::Spec, "risk-tier")
}

/// Whether the plan waits for the human's review once the spec is approved at the tier `chosen`:
/// the spec's own `plan-review` while the tier stays the one it proposes, else false, whatever the
/// tier.
pub fn plan_review_default(
    proposed: Option<&str>,
    current: Option<bool>,
    chosen: Option<&str>,
) -> bool {
    chosen == proposed && current.unwrap_or(false)
}

/// Each risk tier an approval may pick, with the plan review it gives by default.
pub fn tier_choices(proposed: Option<&str>, current: Option<bool>) -> Vec<TierChoice> {
    risk_tiers()
        .iter()
        .map(|tier| TierChoice {
            value: tier.to_string(),
            plan_review: plan_review_default(proposed, current, Some(tier)),
        })
        .collect()
}

/// `US2: Complete a repeating task (P1)` as its id, title, and priority.
pub(crate) fn story_heading(text: &str) -> Option<(String, String, String)> {
    let (id, rest) = text.split_once(':')?;
    let number = id.strip_prefix("US")?;
    if number.is_empty() || !number.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let rest = rest.trim();
    let (title, priority) = match rest.strip_suffix(')').and_then(|r| r.rsplit_once(" (")) {
        Some((title, priority)) if priority.starts_with('P') => (title, priority),
        _ => (rest, ""),
    };
    Some((
        id.to_string(),
        title.trim().to_string(),
        priority.to_string(),
    ))
}

/// The stories, `### US1: Title (P1)`, and the criteria, `- **SC-001**: ...`, of a spec.
pub fn items(doc: &Document) -> SpecItems {
    let mut stories = Vec::new();
    for (index, level, text) in headings(doc) {
        let Some((id, title, priority)) = (level == 3).then(|| story_heading(&text)).flatten()
        else {
            continue;
        };
        let blocks = section(doc, index, 3);
        let why = blocks
            .iter()
            .copied()
            .find(|&id| doc.text(id).starts_with("Why this priority"));
        let intro = blocks
            .iter()
            .position(|&id| doc.text(id).trim_end().ends_with("scenarios:"));
        let list = intro
            .and_then(|intro| blocks[intro + 1..].first().copied())
            .filter(|&list| doc.blocks[list as usize].kind == BlockKind::List);
        let details = intro
            .zip(list)
            .map(|(intro, list)| vec![blocks[intro], list])
            .unwrap_or_default();
        let scenarios = list
            .map(|list| {
                let start = doc.blocks[list as usize].start.unwrap_or(1);
                doc.children(list)
                    .enumerate()
                    .map(|(n, item)| Scenario {
                        number: start + n as u32,
                        block: item.id,
                    })
                    .collect()
            })
            .unwrap_or_default();
        stories.push(Story {
            id,
            title,
            priority,
            heading_block: doc.blocks[index].id,
            blocks,
            why,
            scenarios,
            details,
        });
    }
    let criteria = doc
        .blocks
        .iter()
        .filter(|b| b.kind == BlockKind::Item)
        .filter_map(|b| {
            let first = b.spans.first().filter(|s| s.strong)?;
            let id = first.text.trim_end_matches(':').trim();
            let number = id.strip_prefix("SC-")?;
            (!number.is_empty() && number.bytes().all(|c| c.is_ascii_digit())).then(|| Criterion {
                id: id.to_string(),
                block: b.id,
            })
        })
        .collect();
    SpecItems {
        stories,
        criteria,
        risk_tier: None,
        plan_review: None,
        tiers: Vec::new(),
        details: details(doc),
        mockups: mockups(doc),
    }
}

/// The blocks of the level-2 section titled `title`, nested ones included, as a range of indices.
fn section_range(doc: &Document, title: &str) -> Option<std::ops::Range<usize>> {
    let all = headings(doc);
    let position = all
        .iter()
        .position(|(_, level, text)| *level == 2 && text == title)?;
    let end = all[position + 1..]
        .iter()
        .find(|(_, level, _)| *level <= 2)
        .map_or(doc.blocks.len(), |(index, _, _)| *index);
    Some(all[position].0..end)
}

/// The links of the `## Mockups` section to files under `mockups/`, in order, each with the block
/// a review comment on it lands on. A link whose text has several marks, several spans, is one.
fn mockups(doc: &Document) -> Vec<MockupLink> {
    let Some(range) = section_range(doc, "Mockups") else {
        return Vec::new();
    };
    let mut links: Vec<MockupLink> = Vec::new();
    for block in &doc.blocks[range] {
        let mut previous = None;
        for span in &block.spans {
            let target = span.link.as_ref().map(|link| link.target.as_str());
            let path = target
                .and_then(|target| target.split('#').next())
                .map(|path| path.strip_prefix("./").unwrap_or(path))
                .filter(|path| path.starts_with("mockups/"));
            match (path, links.last_mut()) {
                (Some(_), Some(last)) if previous == target => last.label.push_str(&span.text),
                (Some(path), _) => links.push(MockupLink {
                    path: path.to_string(),
                    label: span.text.clone(),
                    block: holder(doc, block),
                }),
                _ => {}
            }
            previous = target;
        }
    }
    links
}

/// The block a review selects for a block: itself, or its nearest list item or table row, or its
/// top-level block.
fn holder(doc: &Document, block: &Block) -> u32 {
    let mut current = block;
    while let Some(parent) = current.parent {
        if matches!(current.kind, BlockKind::Item | BlockKind::Row) {
            break;
        }
        current = &doc.blocks[parent as usize];
    }
    current.id
}

/// The `## Details` heading and the top-level blocks after it, its subheadings included, up to the
/// next level-1 or level-2 heading.
fn details(doc: &Document) -> Vec<u32> {
    let Some(range) = section_range(doc, "Details") else {
        return Vec::new();
    };
    doc.blocks[range]
        .iter()
        .filter(|b| b.parent.is_none())
        .map(|b| b.id)
        .collect()
}
