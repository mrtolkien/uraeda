//! The items of a spec: its parts, its stories and their scenarios, and its success criteria.

use super::document::{Block, BlockKind, Document, Span, SpanLink, plain};
use super::items::{
    Criterion, MockupLink, Scenario, SpecItems, Story, TierChoice, headings, section,
};

mod parts;
use super::stories::StoryTarget;
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

/// The items of a spec: its parts and what they hold, its stories, and its criteria,
/// `- **SC-001** (measure): ...`.
pub fn items(doc: &Document) -> SpecItems {
    let parts = parts::parts(doc);
    let (block, minutes, approve) = parts::block(doc);
    let (units, tradeoffs) = parts::architecture(doc, parts::part(&parts, "Architecture"));
    let stories = stories(doc);
    SpecItems {
        mockups: stories
            .iter()
            .flat_map(|story| story_mockups(doc, story))
            .collect(),
        stories,
        criteria: criteria(doc),
        risk_tier: None,
        plan_review: None,
        tiers: Vec::new(),
        block,
        minutes,
        approve,
        answers: parts::answers(doc, parts::part(&parts, "Your review")),
        decisions: parts::decisions(doc, parts::part(&parts, "Decisions")),
        edges: parts::edges(doc, parts::part(&parts, "Edge cases")),
        units,
        tradeoffs,
        principles: parts::principles(doc, parts::part(&parts, "Constitution check")),
        parts,
    }
}

/// The items of `## Your review` and of `## Decisions` that `items` does not read, by block: the
/// page draws nothing for them, so `ura check` reports them.
pub(crate) fn unread_items(doc: &Document) -> (Vec<u32>, Vec<u32>) {
    let parts = parts::parts(doc);
    (
        parts::unread_answers(doc, parts::part(&parts, "Your review")),
        parts::unread_decisions(doc, parts::part(&parts, "Decisions")),
    )
}

/// The stories, `### US1: Title (P1)`, with their "Why this priority" paragraph, their mockup, and
/// their key and more scenarios.
fn stories(doc: &Document) -> Vec<Story> {
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
        let mockup = blocks
            .iter()
            .copied()
            .find(|&id| alone_mockup(&doc.blocks[id as usize]));
        let (key, key_blocks) = scenarios(doc, &blocks, "Key scenarios:");
        let (more, more_blocks) = scenarios(doc, &blocks, "More scenarios:");
        stories.push(Story {
            id,
            title,
            priority,
            heading_block: doc.blocks[index].id,
            why,
            mockup,
            key,
            key_blocks,
            more,
            more_blocks,
            blocks,
        });
    }
    stories
}

/// The scenarios of the list right after the paragraph `intro`, numbered from the list's start,
/// and that paragraph and list: none without the list.
fn scenarios(doc: &Document, blocks: &[u32], intro: &str) -> (Vec<Scenario>, Vec<u32>) {
    let found = blocks
        .iter()
        .position(|&id| doc.text(id).trim() == intro)
        .and_then(|at| Some((blocks[at], blocks.get(at + 1).copied()?)))
        .filter(|&(_, list)| doc.blocks[list as usize].kind == BlockKind::List);
    let Some((paragraph, list)) = found else {
        return (Vec::new(), Vec::new());
    };
    let start = doc.blocks[list as usize].start.unwrap_or(1);
    let scenarios = doc
        .children(list)
        .enumerate()
        .map(|(n, item)| Scenario {
            number: start + n as u32,
            block: item.id,
        })
        .collect();
    (scenarios, vec![paragraph, list])
}

/// Whether a block is a paragraph holding only one link, to a story or an HTML mockup.
fn alone_mockup(block: &Block) -> bool {
    let Some(link) = block.spans.first().and_then(|s| s.link.as_ref()) else {
        return false;
    };
    block.kind == BlockKind::Paragraph
        && block.spans.iter().all(|s| s.link.as_ref() == Some(link))
        && mockup(link).is_some()
}

/// Spans without the first `count` bytes of their text, nor the blanks after them. `count` falls
/// after an ASCII character, so on a character's boundary.
fn spans_after(spans: &[Span], count: usize) -> Vec<Span> {
    let mut left = count;
    let mut kept = Vec::new();
    for span in spans {
        if left >= span.text.len() {
            left -= span.text.len();
            continue;
        }
        let text = span.text[left..].to_string();
        left = 0;
        let text = if kept.is_empty() {
            text.trim_start().to_string()
        } else {
            text
        };
        if !text.is_empty() || !kept.is_empty() {
            kept.push(Span {
                text,
                ..span.clone()
            });
        }
    }
    kept
}

/// The criteria, `- **SC-001** (measure): ...`, with their measure when they have one, and their
/// sentence: the item's spans after the id, the measure, and the colon after either.
fn criteria(doc: &Document) -> Vec<Criterion> {
    doc.blocks
        .iter()
        .filter(|b| b.kind == BlockKind::Item)
        .filter_map(|b| {
            let (first, rest) = b.spans.split_first().filter(|(s, _)| s.strong)?;
            let id = first.text.trim_end_matches(':').trim();
            let number = id.strip_prefix("SC-")?;
            if number.is_empty() || !number.bytes().all(|c| c.is_ascii_digit()) {
                return None;
            }
            let text = plain(rest);
            let measure = text
                .trim_start()
                .strip_prefix('(')
                .and_then(|rest| rest.split_once("):"))
                .map(|(measure, _)| measure.trim().to_string());
            let blanks = text.len() - text.trim_start().len();
            let cut = match &measure {
                Some(_) => text.find("):").map_or(0, |at| at + 2),
                None if text[blanks..].starts_with(':') => blanks + 1,
                None => 0,
            };
            Some(Criterion {
                id: id.to_string(),
                measure,
                sentence: spans_after(rest, cut),
                block: b.id,
            })
        })
        .collect()
}

/// The story and HTML mockups a story links, in order, each with the block a review comment on it
/// lands on: its blocks, nested ones included, up to the next heading of level 3 or above. A link
/// whose text has several marks, several spans, is one.
fn story_mockups(doc: &Document, story: &Story) -> Vec<MockupLink> {
    let start = story.heading_block as usize + 1;
    let end = doc.blocks[start..]
        .iter()
        .position(|b| b.kind == BlockKind::Heading && b.level.unwrap_or(1) <= 3)
        .map_or(doc.blocks.len(), |at| start + at);
    let mut links: Vec<MockupLink> = Vec::new();
    for block in &doc.blocks[start..end] {
        let mut previous = None;
        for span in &block.spans {
            let link = span.link.as_ref();
            match (link.and_then(mockup), links.last_mut()) {
                (Some(_), Some(last)) if previous == link => last.label.push_str(&span.text),
                (Some((path, story)), _) => links.push(MockupLink {
                    path,
                    label: span.text.clone(),
                    block: holder(doc, block),
                    story,
                }),
                _ => {}
            }
            previous = link;
        }
    }
    links
}

/// The mockup a link opens: its story's stories file, or `mockups/<file>.html` when its path ends
/// there, written from the spec's folder or from the repository's root.
fn mockup(link: &SpanLink) -> Option<(String, Option<StoryTarget>)> {
    if let Some(story) = &link.story {
        return Some((story.path.clone(), Some(story.clone())));
    }
    let mut parts = link.path.as_deref()?.rsplit('/');
    let file = parts.next()?;
    (parts.next() == Some("mockups") && file.ends_with(".html"))
        .then(|| (format!("mockups/{file}"), None))
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
