//! A typed start's line of **Now**: the one it replaces by its link, and what it leaves to do by
//! hand.

use crate::files::lines;
use crate::files::priorities::{self, Proposal, Section};

use super::typed::Typed;

/// What puts a typed start's proposal, and its images, in `destination`, as the step left to do
/// by hand.
pub(super) fn typed_write_left(destination: &str, images: usize) -> String {
    let proposal = format!("write {destination}/proposal.md from the text");
    if images == 0 {
        proposal
    } else {
        format!("{proposal}, and its images in {destination}/images/")
    }
}

/// `PRIORITIES.md` with a typed start's link to `target` on top of **Now**, in place of the line
/// of **Now** it starts from, `line`, its plain text, when **Now** holds it once, without a link,
/// the spaces of both collapsed: a line changed since it was read stays. Then the lines nested
/// under the line, which the started proposal takes, but those the typed text holds already.
pub(super) fn started_line(
    priorities_text: &str,
    typed: &Typed,
    line: Option<&str>,
    target: &str,
) -> (String, Vec<String>) {
    let name = &typed.title;
    let found: Vec<Proposal> = line.map_or_else(Vec::new, |line| {
        let line = lines::one_line(line);
        priorities::parse(priorities_text)
            .into_iter()
            .filter(|p| p.section == Section::Now && p.link.is_none())
            .filter(|p| lines::one_line(&p.text) == line)
            .collect()
    });
    let moved = match found.as_slice() {
        [found] => priorities::move_to_started(priorities_text, found.line, name, target)
            .map(|edited| (edited, found.nested(priorities_text))),
        _ => None,
    };
    let Some((edited, mut nested)) = moved else {
        return (
            priorities::add_started(priorities_text, name, target),
            Vec::new(),
        );
    };
    nested.retain(|line| !typed.holds(line));
    (edited, nested)
}
