//! `sections.missing` for `PRIORITIES.md`'s Now, Next, and Later, and the warnings of a retired
//! Blocked and of a section's context whose text is not in its marker's callout.

use crate::files::markdown::Document;
use crate::files::priorities;
use crate::workspace::Problem;

use super::File;

pub(super) fn check_priorities(file: &File<'_>, document: &Document, problems: &mut Vec<Problem>) {
    for section in ["Now", "Next", "Later"] {
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
    if let Some(proposal) = priorities::parse(file.text)
        .iter()
        .find(|proposal| proposal.section == priorities::Section::Blocked)
    {
        problems.push(file.warning(
            Some(proposal.line),
            "priorities.blocked",
            "Blocked is retired: move its lines",
        ));
    }
    for context in priorities::contexts(file.text)
        .iter()
        .filter(|context| context.text.is_none())
    {
        problems.push(file.warning(
            Some(context.line),
            "priorities.context",
            "a section's context has no text: put the text in the same callout as its marker",
        ));
    }
}
