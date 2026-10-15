//! Notes found by their lines as written, rather than by their place: what an Undo looks for.

use super::{note_lines, parse, unmarked_lines};

/// A note given by its lines as written: its text, and its lines as another file takes them, its
/// marks dropped, as [`unmarked_lines`] gives them. What an Undo looks for in that file.
pub fn of_lines(lines: &[String]) -> Option<(String, Vec<String>)> {
    let text = format!("# Inbox\n\n{}\n", lines.join("\n"));
    let note = parse(&text).into_iter().next()?;
    let (unmarked, _) = unmarked_lines(&text, &note.id)?;
    Some((note.text, unmarked))
}

/// The ids of the notes whose lines, sub-items included, are exactly `lines`.
pub fn ids_of_lines(text: &str, lines: &[String]) -> Vec<String> {
    parse(text)
        .into_iter()
        .filter(|note| note_lines(text, &note.id).is_some_and(|found| found == lines))
        .map(|note| note.id)
        .collect()
}
