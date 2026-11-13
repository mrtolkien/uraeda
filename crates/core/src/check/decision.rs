//! A decision's shape, as warnings: how many rules it holds, how long its Why runs, how many
//! alternatives it lists, and each rule's case. A decision that grows long is holding a feature's
//! spec or an area's guide: each warning says to cut, or to move the rest to a guide.

use super::File;
use super::writing::is_word;
use crate::decisions::CASE;
use crate::files::document::{Block, BlockKind, Document, Span, parse, plain};
use crate::workspace::Problem;

/// The most rules a decision holds before `decision.rules` warns. Every `pub` item of this module
/// is a limit, exported from `check` as it is.
pub const DECISION_RULES: usize = 8;

/// The most words of its Why before `decision.why` warns.
pub const DECISION_WHY_WORDS: usize = 80;

/// The most alternatives it lists before `decision.alternatives` warns.
pub const DECISION_ALTERNATIVES: usize = 3;

/// Warns where a decision drifts from the shape of the writing reference: a Why past
/// `DECISION_WHY_WORDS` words (`decision.why`), more than `DECISION_ALTERNATIVES` alternatives
/// (`decision.alternatives`), on their headings, and the rules, as `check_rules` says. A section it
/// lacks measures nothing, and a decision that opens with no quote is not a problem: the human may
/// never have said it in one sentence.
pub(super) fn check_decision(file: &File<'_>, problems: &mut Vec<Problem>) {
    let document = parse(file.text, "");
    let mut warn = |block: &Block, rule: &str, message: String| {
        problems.push(file.warning(Some(block.start_line as usize), rule, message));
    };
    if let Some(why) = top_heading(&document, Some("Why")) {
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
                format!(
                    "{words} words: keep the reason under {DECISION_WHY_WORDS}, and cut the rest \
                     or move it to a guide"
                ),
            );
        }
    }
    if let Some(heading) = top_heading(&document, Some("Alternatives considered")) {
        let count = items(&document, heading).len();
        if count > DECISION_ALTERNATIVES {
            warn(
                heading,
                "decision.alternatives",
                format!(
                    "{count} alternatives: keep at most {DECISION_ALTERNATIVES}, the ones an agent \
                     could propose again, and cut the rest"
                ),
            );
        }
    }
    if let Some(heading) = top_heading(&document, Some("Rules")) {
        check_rules(file, &document, heading, problems);
    }
}

/// Warns on a decision of more than `DECISION_RULES` rules (`decision.rules`), on its `## Rules`
/// heading, and on each rule with no case, no emphasized `So:` (`decision.example`), on its line.
/// A rule is a top-level item of `## Rules`' lists.
fn check_rules(file: &File<'_>, document: &Document, heading: &Block, problems: &mut Vec<Problem>) {
    let rules = items(document, heading);
    if rules.len() > DECISION_RULES {
        problems.push(file.warning(
            Some(heading.start_line as usize),
            "decision.rules",
            format!(
                "{} rules: a decision this long holds a spec or a guide, so cut rules or move them \
                 to a guide",
                rules.len()
            ),
        ));
    }
    for rule in rules {
        if !has_case(&rule.spans) {
            problems.push(file.warning(
                Some(rule.start_line as usize),
                "decision.example",
                format!("a rule with no case: add one after _{CASE}_, as an agent would meet it"),
            ));
        }
    }
}

/// Whether a rule's spans hold its case: `So:` in emphasis.
fn has_case(spans: &[Span]) -> bool {
    spans
        .iter()
        .any(|span| span.emphasis && !span.code && span.text.trim() == CASE)
}

/// The first top-level `##` heading, named `name` when one is given.
fn top_heading<'a>(document: &'a Document, name: Option<&str>) -> Option<&'a Block> {
    document.blocks.iter().find(|b| {
        b.parent.is_none()
            && b.kind == BlockKind::Heading
            && b.level == Some(2)
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
