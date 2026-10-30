//! A decision's shape, as warnings: how long its sections run, how many rules it holds, how many
//! keywords each rule holds, and their order by strength.

use super::File;
use super::writing::{is_word, sentences};
use crate::decisions::{Strength, keywords, strength};
use crate::files::document::{Block, BlockKind, Document, Span, parse, plain};
use crate::workspace::Problem;

/// The most rules a decision holds before `decision.rules` warns. Every `pub` item of this module
/// is a limit, exported from `check` as it is.
pub const DECISION_RULES: usize = 10;

/// The most sentences of its intent before `decision.intent` warns.
pub const DECISION_INTENT_SENTENCES: usize = 3;

/// The most words of its Why before `decision.why` warns.
pub const DECISION_WHY_WORDS: usize = 80;

/// The most alternatives it lists before `decision.alternatives` warns.
pub const DECISION_ALTERNATIVES: usize = 3;

/// The most consequences it lists before `decision.consequences` warns.
pub const DECISION_CONSEQUENCES: usize = 4;

/// Warns where a decision drifts from the limits of the writing reference: an intent past
/// `DECISION_INTENT_SENTENCES` sentences, on the title (`decision.intent`); a Why past
/// `DECISION_WHY_WORDS` words (`decision.why`); more than `DECISION_ALTERNATIVES` alternatives
/// (`decision.alternatives`) or `DECISION_CONSEQUENCES` consequences (`decision.consequences`), on
/// their headings; and the rules, as `check_rules` says. A section it lacks measures nothing.
pub(super) fn check_decision(file: &File<'_>, problems: &mut Vec<Problem>) {
    let document = parse(file.text, "");
    let mut warn = |block: &Block, rule: &str, message: String| {
        problems.push(file.warning(Some(block.start_line as usize), rule, message));
    };
    if let Some(title) = top_heading(&document, 1, None) {
        let intent: usize = section(&document, title)
            .filter(|b| b.parent.is_none() && b.kind == BlockKind::Paragraph)
            .map(|b| sentences(&counted_text(&b.spans)).len())
            .sum();
        if intent > DECISION_INTENT_SENTENCES {
            warn(
                title,
                "decision.intent",
                format!(
                    "{intent} sentences: keep the intent to at most {DECISION_INTENT_SENTENCES}"
                ),
            );
        }
    }
    if let Some(why) = top_heading(&document, 2, Some("Why")) {
        let words: usize = section(&document, why)
            .filter(|b| matches!(b.kind, BlockKind::Paragraph | BlockKind::Item))
            .map(|b| {
                counted_text(&b.spans)
                    .split_whitespace()
                    .filter(|w| is_word(w))
                    .count()
            })
            .sum();
        if words > DECISION_WHY_WORDS {
            warn(
                why,
                "decision.why",
                format!("{words} words: keep the reason under {DECISION_WHY_WORDS}"),
            );
        }
    }
    let listed = [
        (
            "Alternatives considered",
            DECISION_ALTERNATIVES,
            "decision.alternatives",
            "alternatives",
            "the ones an agent could propose again",
        ),
        (
            "Consequences",
            DECISION_CONSEQUENCES,
            "decision.consequences",
            "consequences",
            "the costs and what a later feature must do",
        ),
    ];
    for (name, limit, rule, noun, keep) in listed {
        if let Some(heading) = top_heading(&document, 2, Some(name)) {
            let count = items(&document, heading).len();
            if count > limit {
                warn(
                    heading,
                    rule,
                    format!("{count} {noun}: keep at most {limit}, {keep}"),
                );
            }
        }
    }
    if let Some(heading) = top_heading(&document, 2, Some("Rules")) {
        check_rules(file, &document, heading, problems);
    }
}

/// Warns on a decision of more than `DECISION_RULES` rules (`decision.rules`), on its `## Rules`
/// heading; on each rule holding more than one keyword before its check, outside code
/// (`decision.keywords`); and on its first rule stronger than the one before it
/// (`decision.order`). A rule is a top-level item of `## Rules`' lists; one without a keyword is
/// not ordered.
fn check_rules(file: &File<'_>, document: &Document, heading: &Block, problems: &mut Vec<Problem>) {
    let rules = items(document, heading);
    if rules.len() > DECISION_RULES {
        problems.push(file.warning(
            Some(heading.start_line as usize),
            "decision.rules",
            format!(
                "{} rules: keep at most {DECISION_RULES}, or split the topic",
                rules.len()
            ),
        ));
    }
    for rule in &rules {
        let text = counted_text(&rule.spans);
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        let own = text.split("Checked by").next().unwrap_or_default();
        let count = keywords(own);
        if count > 1 {
            problems.push(file.warning(
                Some(rule.start_line as usize),
                "decision.keywords",
                format!("{count} keywords: one rule holds one MUST, SHOULD, or MAY"),
            ));
        }
    }
    let mut before: Option<Strength> = None;
    for rule in rules {
        let Some(found) = strength(&plain(&rule.spans)) else {
            continue;
        };
        if let Some(weaker) = before.filter(|b| b.rank() > found.rank()) {
            problems.push(file.warning(
                Some(rule.start_line as usize),
                "decision.order",
                format!(
                    "a {} rule after a {} one: put the strongest first",
                    keyword(found),
                    keyword(weaker)
                ),
            ));
            break;
        }
        before = Some(found);
    }
}

/// The first top-level heading of `level`, named `name` when one is given.
fn top_heading<'a>(document: &'a Document, level: u32, name: Option<&str>) -> Option<&'a Block> {
    document.blocks.iter().find(|b| {
        b.parent.is_none()
            && b.kind == BlockKind::Heading
            && b.level == Some(level)
            && name.is_none_or(|name| plain(&b.spans).trim() == name)
    })
}

/// The blocks after a heading, nested ones included, up to the next top-level heading of level 1
/// or 2: a heading in a quote or an item does not end it.
fn section<'a>(document: &'a Document, heading: &Block) -> impl Iterator<Item = &'a Block> {
    let id = heading.id;
    document
        .blocks
        .iter()
        .filter(move |b| b.id > id)
        .take_while(|b| {
            b.parent.is_some() || b.kind != BlockKind::Heading || b.level.unwrap_or(1) > 2
        })
}

/// The top-level items of a section's top-level lists.
fn items<'a>(document: &'a Document, heading: &Block) -> Vec<&'a Block> {
    section(document, heading)
        .filter(|b| b.parent.is_none() && b.kind == BlockKind::List)
        .flat_map(|list| document.children(list.id))
        .filter(|item| item.kind == BlockKind::Item)
        .collect()
}

/// The text of spans as a decision's limits count it: a link counts by its text, and inline code
/// and images count for nothing.
fn counted_text(spans: &[Span]) -> String {
    spans
        .iter()
        .map(|span| {
            if span.code || span.image.is_some() {
                " "
            } else {
                span.text.as_str()
            }
        })
        .collect()
}

/// A strength as the rule writes it, `MUST NOT`.
fn keyword(strength: Strength) -> String {
    strength.as_str().to_uppercase().replace('-', " ")
}
