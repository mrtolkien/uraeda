//! A round's notes: its free notes, and the comments on its settled points, written at their end.

use super::{AnswerError, NOTES, check_lines, replace_after};

/// The `**Notes:**` line and its text, when the file has one. Its code blocks are kept as written:
/// a heading in one does not end the notes.
pub fn notes(text: &str) -> Option<(usize, String)> {
    let mut found: Option<(usize, String)> = None;
    let mut in_code = false;
    for (index, line) in text.lines().enumerate() {
        let fence = crate::files::is_fence(line);
        let code = in_code || fence;
        in_code ^= fence;
        if !code && line.starts_with('#') {
            if found.is_some() {
                break;
            }
            continue;
        }
        let marker = (!code)
            .then(|| NOTES.iter().find_map(|marker| line.strip_prefix(marker)))
            .flatten();
        if let Some(rest) = marker {
            found = Some((index + 1, rest.trim().to_string()));
        } else if let Some((_, notes)) = found.as_mut() {
            notes.push('\n');
            notes.push_str(line);
        }
    }
    found.map(|(line, notes)| (line, notes.trim().to_string()))
}

/// The fence a text leaves open, `` ``` `` or `~~~`, if any.
fn open_fence(text: &str) -> Option<&'static str> {
    let mut open = None;
    for line in text.lines().filter(|line| crate::files::is_fence(line)) {
        open = match open {
            Some(_) => None,
            None if line.trim_start().starts_with('~') => Some("~~~"),
            None => Some("```"),
        };
    }
    open
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
    // A fence the free notes leave open is closed before the comments, which it would hide.
    let closed;
    let free = match open_fence(free) {
        Some(fence) if !bullets.is_empty() => {
            closed = format!("{free}\n{fence}");
            closed.as_str()
        }
        _ => free,
    };
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
    use super::{join_notes, round_notes, set_notes, split_notes};
    use crate::files::clarifications::set_answer;

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

    /// Free notes and comments written, then the free notes and comments they read back as.
    type Written<'a> = (
        &'a str,
        &'a [(&'a str, &'a str)],
        &'a str,
        &'a [(&'a str, &'a str)],
    );

    fn owned(comments: &[(&str, &str)]) -> Vec<(String, String)> {
        comments
            .iter()
            .map(|(subject, text)| (subject.to_string(), text.to_string()))
            .collect()
    }

    #[test]
    fn code_blocks_in_the_notes_are_kept_as_written() {
        let round = "## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n";
        let code = "See:\n\n```\n## Not a heading\n- **A point**: not a comment\n```\n\nAfter.";
        let fenced = "```sh\n# a shell comment\n```\n\nAfter.";
        let rows: [Written; 7] = [
            // Code in the free notes, a heading and a bullet in it, with no comment.
            (code, &[], code, &[]),
            // Code in the free notes, then a comment.
            (
                code,
                &[("A point", "Keep it.")],
                code,
                &[("A point", "Keep it.")],
            ),
            // Code in a comment.
            (
                "Fine.",
                &[(
                    "A point",
                    "Try:\n\n```\nlet x = 1;\n\n  indented\n```\n\nThen.",
                )],
                "Fine.",
                &[(
                    "A point",
                    "Try:\n\n```\nlet x = 1;\n\n  indented\n```\n\nThen.",
                )],
            ),
            // An unclosed fence in the free notes is closed before the comments, which it hid.
            (
                "See:\n\n~~~\ncode",
                &[("A point", "Keep it.")],
                "See:\n\n~~~\ncode\n~~~",
                &[("A point", "Keep it.")],
            ),
            // An unclosed fence with no comment after it stays as written.
            ("See:\n\n```\ncode", &[], "See:\n\n```\ncode", &[]),
            // Notes starting with a code block, which starts on the line after the marker.
            (fenced, &[], fenced, &[]),
            (
                fenced,
                &[("A point", "Keep it.")],
                fenced,
                &[("A point", "Keep it.")],
            ),
        ];
        for (free, comments, read_free, read_comments) in rows {
            let written = set_notes(round, free, &owned(comments)).unwrap();
            let read = round_notes(&written).unwrap();
            assert_eq!(
                (read.free.as_str(), read.comments),
                (read_free, owned(read_comments)),
                "{written:?}"
            );
            // Saving the free notes read keeps the file as it is.
            assert_eq!(set_answer(&written, "notes", read_free).unwrap(), written);
        }
    }
}
