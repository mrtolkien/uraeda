//! A decision's shape, as warnings: how many rules it holds, and their order by strength.

use super::File;
use crate::decisions::{Strength, strength};
use crate::files::document::{BlockKind, Document, parse, plain};
use crate::workspace::Problem;

/// The most rules a decision holds before `decision.rules` warns.
pub const DECISION_RULES: usize = 10;

/// Warns on a decision of more than `DECISION_RULES` rules (`decision.rules`), on its `## Rules`
/// heading, and on its first rule stronger than the one before it (`decision.order`). A rule is a
/// top-level item of `## Rules`' lists; one without a keyword is not ordered.
pub(super) fn check_decision(file: &File<'_>, problems: &mut Vec<Problem>) {
    let document = parse(file.text, "");
    let Some(heading) = document.blocks.iter().find(|b| {
        b.parent.is_none()
            && b.kind == BlockKind::Heading
            && b.level == Some(2)
            && plain(&b.spans).trim() == "Rules"
    }) else {
        return;
    };
    let rules = rules(&document, heading.id);
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
    let mut before: Option<Strength> = None;
    for (line, found) in rules {
        let Some(found) = found else {
            continue;
        };
        if let Some(weaker) = before.filter(|b| b.rank() > found.rank()) {
            problems.push(file.warning(
                Some(line),
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

/// The rules after the heading `heading`, up to the next level-1 or level-2 heading: each
/// top-level item of its lists, with its line and its strength.
fn rules(document: &Document, heading: u32) -> Vec<(usize, Option<Strength>)> {
    document
        .blocks
        .iter()
        .filter(|b| b.parent.is_none() && b.id > heading)
        .take_while(|b| b.kind != BlockKind::Heading || b.level.unwrap_or(1) > 2)
        .filter(|b| b.kind == BlockKind::List)
        .flat_map(|list| document.children(list.id))
        .filter(|item| item.kind == BlockKind::Item)
        .map(|item| (item.start_line as usize, strength(&plain(&item.spans))))
        .collect()
}

/// A strength as the rule writes it, `MUST NOT`.
fn keyword(strength: Strength) -> String {
    strength.as_str().to_uppercase().replace('-', " ")
}
