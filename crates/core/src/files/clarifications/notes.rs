//! A round's notes: its free notes, and the comments on its settled points, written at their end.

use super::{AnswerError, NOTES, check_lines, replace_after};

/// The `**Notes:**` line and its text, when the file has one.
pub fn notes(text: &str) -> Option<(usize, String)> {
    let mut found: Option<(usize, String)> = None;
    for (number, line) in crate::files::lines_outside_code(text) {
        if line.starts_with('#') {
            if found.is_some() {
                break;
            }
            continue;
        }
        if let Some((_, rest)) = NOTES
            .iter()
            .find_map(|marker| line.strip_prefix(marker).map(|rest| (marker, rest)))
        {
            found = Some((number, rest.trim().to_string()));
        } else if let Some((_, notes)) = found.as_mut() {
            notes.push('\n');
            notes.push_str(line);
        }
    }
    found.map(|(line, notes)| (line, notes.trim().to_string()))
}

/// The bold subject a top-level bullet starts with, `- **<subject>**`, trimmed, and the text after
/// it, without the `:` that follows the subject.
fn comment_bullet(line: &str) -> Option<(&str, &str)> {
    let (subject, rest) = line.strip_prefix("- **")?.split_once("**")?;
    let rest = rest.strip_prefix(':').unwrap_or(rest);
    Some((subject.trim(), rest.trim()))
}

/// Whether a line of the notes continues the bullet above it: indented, and not blank.
fn continues(line: &str) -> bool {
    line.starts_with([' ', '\t']) && !line.trim().is_empty()
}

/// The notes split into the free notes and the comments on settled points: the top-level bullets
/// whose bold start is one of `subjects`, as `(subject, text)`, in order. A comment's further lines
/// are its indented lines, and the blank lines between them; every other line is free notes.
pub fn split_notes(notes: &str, subjects: &[String]) -> (String, Vec<(String, String)>) {
    let lines: Vec<&str> = notes.lines().collect();
    let mut free: Vec<&str> = Vec::new();
    let mut comments = Vec::new();
    let mut in_code = false;
    // Whether the free notes' last line came before a comment taken out of them.
    let mut after_comment = false;
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        index += 1;
        if crate::files::is_fence(line) {
            in_code = !in_code;
        }
        let bullet = comment_bullet(line).filter(|(subject, _)| {
            !in_code && subjects.iter().any(|known| known.trim() == *subject)
        });
        let Some((subject, first)) = bullet else {
            let blank = line.trim().is_empty();
            // The blank lines around a comment taken out of the free notes are kept once.
            if !(blank && after_comment && free.last().is_none_or(|last| last.trim().is_empty())) {
                free.push(line);
            }
            after_comment &= blank;
            continue;
        };
        let mut text = vec![first.to_string()];
        while index < lines.len() {
            let blanks = lines[index..]
                .iter()
                .take_while(|line| line.trim().is_empty())
                .count();
            if !lines
                .get(index + blanks)
                .is_some_and(|line| continues(line))
            {
                break;
            }
            text.extend((0..blanks).map(|_| String::new()));
            let line = lines[index + blanks];
            let unindented = line
                .strip_prefix("  ")
                .or_else(|| line.strip_prefix('\t'))
                .unwrap_or_else(|| line.trim_start());
            text.push(unindented.to_string());
            index += blanks + 1;
        }
        comments.push((subject.to_string(), text.join("\n").trim().to_string()));
        after_comment = true;
    }
    (free.join("\n").trim().to_string(), comments)
}

/// The notes from the free notes and the comments on settled points: the free notes, a blank line,
/// then one bullet per comment, `- **<subject>**: <text>`, its further lines indented by two
/// spaces.
pub fn join_notes(free: &str, comments: &[(String, String)]) -> String {
    let bullets: Vec<String> = comments
        .iter()
        .map(|(subject, text)| {
            let text = text.trim().replace('\n', "\n  ");
            format!("- **{subject}**: {text}")
        })
        .collect();
    let free = free.trim();
    match (free.is_empty(), bullets.is_empty()) {
        (_, true) => free.to_string(),
        (true, false) => bullets.join("\n"),
        (false, false) => format!("{free}\n\n{}", bullets.join("\n")),
    }
}

/// A round's notes: the `**Notes:**` line, the free notes, the comments on settled points as
/// `(subject, text)`, and the subjects of the settled points, which take comments.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RoundNotes {
    pub line: usize,
    pub free: String,
    pub comments: Vec<(String, String)>,
    pub subjects: Vec<String>,
}

/// The notes of a round, split, when the file has a `**Notes:**` line.
pub fn round_notes(text: &str) -> Option<RoundNotes> {
    let (line, notes) = notes(text)?;
    let document = crate::files::document::parse(text, "");
    let subjects: Vec<String> = crate::files::items::settled_points(&document, line)
        .into_iter()
        .map(|point| point.subject)
        .collect();
    let (free, comments) = split_notes(&notes, &subjects);
    Some(RoundNotes {
        line,
        free,
        comments,
        subjects,
    })
}

/// Writes the notes as the free notes, then the comments on settled points, as `join_notes` does.
pub fn set_notes(
    text: &str,
    free: &str,
    comments: &[(String, String)],
) -> Result<String, AnswerError> {
    let free = free.replace("\r\n", "\n");
    check_lines(&free)?;
    for (_, comment) in comments {
        check_lines(comment)?;
    }
    crate::files::with_unix_newlines(text, |text| {
        let (line, _) = notes(text).ok_or(AnswerError::NoNotesLine)?;
        let comments: Vec<(String, String)> = comments
            .iter()
            .map(|(subject, comment)| (subject.clone(), comment.replace("\r\n", "\n")))
            .collect();
        let joined = join_notes(&free, &comments);
        // Notes starting with a comment start on the line after the marker, as a list.
        let notes = if free.trim().is_empty() && !comments.is_empty() {
            format!("\n\n{joined}")
        } else {
            joined
        };
        Ok(replace_after(text, line, NOTES[0], &notes))
    })
}

#[cfg(test)]
mod tests {
    use super::{join_notes, split_notes};

    /// A notes text, its free notes, and its comments as `(subject, text)`.
    type Row<'a> = (&'a str, &'a str, &'a [(&'a str, &'a str)]);

    #[test]
    fn notes_split_into_free_notes_and_comments_and_join_back() {
        let subjects = ["Undoing a completion".to_string()];
        let rows: [Row; 5] = [
            ("Overall fine.", "Overall fine.", &[]),
            (
                "Overall fine.\n\n- **Undoing a completion**: Keep the undo.",
                "Overall fine.",
                &[("Undoing a completion", "Keep the undo.")],
            ),
            (
                "- **Undoing a completion**: Keep the undo.\n  Also for deletes.",
                "",
                &[("Undoing a completion", "Keep the undo.\nAlso for deletes.")],
            ),
            (
                "- **Nothing matches**: stays free.",
                "- **Nothing matches**: stays free.",
                &[],
            ),
            (
                "Intro\n- **Undoing a completion**: written by hand\nOutro",
                "Intro\nOutro",
                &[("Undoing a completion", "written by hand")],
            ),
        ];
        for (notes, free, comments) in rows {
            let comments: Vec<(String, String)> = comments
                .iter()
                .map(|(subject, text)| (subject.to_string(), text.to_string()))
                .collect();
            let split = split_notes(notes, &subjects);
            assert_eq!(split, (free.to_string(), comments.clone()), "{notes:?}");
            // What is written reads back as the same parts.
            let joined = join_notes(free, &comments);
            assert_eq!(
                split_notes(&joined, &subjects),
                (free.to_string(), comments),
                "{joined:?}"
            );
        }
    }
}
