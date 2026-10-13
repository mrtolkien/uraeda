//! The user stories and success criteria of a spec.

use super::document::{BlockKind, Document};
use super::items::{Criterion, Scenario, SpecItems, Story, TierChoice, headings, section};
use crate::check::allowed_values;
use crate::workspace::FileKind;

/// The risk tier whose plan waits for the human's review unless the spec says otherwise.
const REVIEWED_TIER: &str = "high";

/// The risk tiers a spec may have, from the least risk to the most.
pub fn risk_tiers() -> &'static [&'static str] {
    allowed_values(FileKind::Spec, "risk-tier")
}

/// Whether the plan waits for the human's review once the spec is approved at the tier `chosen`:
/// the spec's own `plan-review` while the tier stays the one it proposes, else the tier's default,
/// true for `high` only.
pub fn plan_review_default(
    proposed: Option<&str>,
    current: Option<bool>,
    chosen: Option<&str>,
) -> bool {
    let tier_default = chosen == Some(REVIEWED_TIER);
    if chosen == proposed {
        current.unwrap_or(tier_default)
    } else {
        tier_default
    }
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
        let scenarios = intro
            .and_then(|intro| blocks[intro + 1..].first().copied())
            .filter(|&list| doc.blocks[list as usize].kind == BlockKind::List)
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
    }
}
