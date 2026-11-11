//! A record's own rules: its numbering, its name, and the note it opens with.

use std::path::Path;

use super::{File, sections};
use crate::files::markdown;
use crate::workspace::Problem;

/// Checks a record of `specs/done/`: its sections' numbering, a dated name, and its note.
pub(super) fn check_record(
    file: &File<'_>,
    document: &markdown::Document,
    problems: &mut Vec<Problem>,
) {
    sections::check_record_numbering(file, document, problems);
    let name = Path::new(&file.path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let dated = name
        .strip_suffix(".md")
        .is_some_and(|stem| crate::workspace::folder_slug(stem).is_some());
    if !dated {
        problems.push(file.problem(
            None,
            "names.record",
            format!("\"{name}\" is not a record's name: YYYY-MM-DD-<slug>.md"),
        ));
    }
    let noted = document
        .callout
        .as_ref()
        .is_some_and(|c| c.kind == markdown::CalloutKind::Note);
    if !noted {
        problems.push(file.problem(
            None,
            "blocks.note",
            "a record opens with a \"> [!NOTE]\" block",
        ));
    }
}
