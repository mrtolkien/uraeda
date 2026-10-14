//! The questions of a clarifications file, their options, and their answers.

const ANSWER: &str = "**Answer:**";
const NOTES: [&str; 2] = ["**Notes:**", "**Notes**:"];

/// A question, `## Q2: ...`, or a follow-up, `### Q2.B: ...`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Question {
    /// `Q2`, or `Q2.B` for a follow-up.
    pub id: String,
    /// The parent's id, for a follow-up.
    pub parent: Option<String>,
    /// The parent's option a follow-up depends on.
    pub letter: Option<char>,
    pub title: String,
    /// The line of its heading.
    pub line: usize,
    /// The letters of its options, in order.
    pub options: Vec<char>,
    /// The answer, trimmed; empty when blank.
    pub answer: String,
    /// The line of its `**Answer:**` marker, or 0 when it has none.
    pub answer_line: usize,
}

/// Whether a follow-up needs an answer, from its parent's answer.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Applicability {
    Yes,
    No,
    /// The parent's answer names no option letter.
    Unclear,
}

impl Question {
    /// A question applies unless it is a follow-up whose parent's answer picked other options.
    pub fn applies(&self, all: &[Question]) -> Applicability {
        let (Some(parent), Some(letter)) = (&self.parent, self.letter) else {
            return Applicability::Yes;
        };
        let Some(parent) = all.iter().find(|question| &question.id == parent) else {
            return Applicability::Unclear;
        };
        let picked = picked_letters(&parent.answer, &parent.options);
        if picked.is_empty() {
            Applicability::Unclear
        } else if picked.contains(&letter) {
            Applicability::Yes
        } else {
            Applicability::No
        }
    }

    /// Whether the round asks it now: it may apply, and a follow-up's parent has an answer, which
    /// tells whether it does.
    pub fn asked(&self, all: &[Question]) -> bool {
        let parent_blank = self.parent.as_ref().is_some_and(|parent| {
            all.iter()
                .find(|question| &question.id == parent)
                .is_some_and(|parent| parent.answer.trim().is_empty())
        });
        self.applies(all) != Applicability::No && !parent_blank
    }
}

/// The option letters an answer starts with: "B and C: ..." is B and C, "C, we want ..." is C.
fn picked_letters(answer: &str, options: &[char]) -> Vec<char> {
    let mut picked = Vec::new();
    for word in answer
        .split(|c: char| !(c.is_alphanumeric() || c == '\''))
        .filter(|word| !word.is_empty())
    {
        let mut chars = word.chars();
        match (chars.next(), chars.next()) {
            (Some(letter), None) if options.contains(&letter) => picked.push(letter),
            _ if word.eq_ignore_ascii_case("and") || word.eq_ignore_ascii_case("or") => {}
            _ => break,
        }
    }
    picked
}

/// A question heading's id, its parent and letter for a follow-up, and its title.
pub type QuestionHeading = (String, Option<(String, char)>, String);

fn heading(line: &str) -> Option<QuestionHeading> {
    let (rest, follow_up) = if let Some(rest) = line.strip_prefix("### Q") {
        (rest, true)
    } else if let Some(rest) = line.strip_prefix("## Q") {
        (rest, false)
    } else {
        return None;
    };
    let (id, title) = rest.split_once(':')?;
    let title = title.trim().to_string();
    if follow_up {
        let (number, letter) = id.split_once('.')?;
        let mut letters = letter.chars();
        let letter = letters.next().filter(|c| c.is_ascii_uppercase())?;
        if letters.next().is_some() || !is_number(number) {
            return None;
        }
        Some((
            format!("Q{id}"),
            Some((format!("Q{number}"), letter)),
            title,
        ))
    } else {
        is_number(id).then(|| (format!("Q{id}"), None, title))
    }
}

fn is_number(text: &str) -> bool {
    !text.is_empty() && text.bytes().all(|byte| byte.is_ascii_digit())
}

/// The letter of an option line, `- **A (recommended). ...**` or `- **B. ...**`.
fn option_letter(line: &str) -> Option<char> {
    let rest = line.strip_prefix("- **")?;
    let mut chars = rest.chars();
    let letter = chars.next().filter(|c| c.is_ascii_uppercase())?;
    let rest = chars.as_str();
    (rest.starts_with(". ") || rest.starts_with(" (recommended).")).then_some(letter)
}

/// Every question and follow-up of a clarifications file, in order.
pub fn parse(text: &str) -> Vec<Question> {
    let mut questions: Vec<Question> = Vec::new();
    let mut in_answer = false;
    for (number, line) in super::lines_outside_code(text) {
        if line.starts_with('#') {
            in_answer = false;
            if let Some((id, parent, title)) = heading(line) {
                questions.push(Question {
                    id,
                    parent: parent.as_ref().map(|(id, _)| id.clone()),
                    letter: parent.map(|(_, letter)| letter),
                    title,
                    line: number,
                    options: Vec::new(),
                    answer: String::new(),
                    answer_line: 0,
                });
            } else if line.starts_with("## ") {
                // A section that is not a question ends the last one.
                questions.push(Question {
                    id: String::new(),
                    parent: None,
                    letter: None,
                    title: String::new(),
                    line: number,
                    options: Vec::new(),
                    answer: String::new(),
                    answer_line: 0,
                });
            }
            continue;
        }
        let Some(question) = questions.last_mut() else {
            continue;
        };
        if let Some(answer) = line.strip_prefix(ANSWER) {
            question.answer_line = number;
            question.answer = answer.trim().to_string();
            in_answer = true;
        } else if in_answer {
            question.answer.push('\n');
            question.answer.push_str(line);
        } else if let Some(letter) = option_letter(line) {
            question.options.push(letter);
        }
    }
    questions.retain(|question| !question.id.is_empty());
    for question in &mut questions {
        question.answer = question.answer.trim().to_string();
    }
    questions
}

/// The `**Notes:**` line and its text, when the file has one.
pub fn notes(text: &str) -> Option<(usize, String)> {
    let mut found: Option<(usize, String)> = None;
    for (number, line) in super::lines_outside_code(text) {
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
        if super::is_fence(line) {
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

#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum AnswerError {
    #[error("no question {0}")]
    UnknownQuestion(String),
    #[error("{0} has no **Answer:** line")]
    NoAnswerLine(String),
    #[error("the file has no **Notes:** line")]
    NoNotesLine,
    #[error("an answer line cannot start with \"#\" or \"**Answer:**\"")]
    Structure,
}

/// Refuses an answer with a line that would end it: a heading, or another marker.
fn check_lines(answer: &str) -> Result<(), AnswerError> {
    if answer.lines().any(|line| {
        let line = line.trim_start();
        line.starts_with('#')
            || line.starts_with(ANSWER)
            || NOTES.iter().any(|m| line.starts_with(m))
    }) {
        return Err(AnswerError::Structure);
    }
    Ok(())
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
    let document = super::document::parse(text, "");
    let subjects: Vec<String> = super::items::settled_points(&document, line)
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
    super::with_unix_newlines(text, |text| {
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

/// Writes an answer after a question's `**Answer:**` marker, replacing the earlier one. The id
/// `notes` writes the free notes after the `**Notes:**` marker, keeping the comments on settled
/// points after them.
pub fn set_answer(text: &str, id: &str, answer: &str) -> Result<String, AnswerError> {
    let answer = answer.replace("\r\n", "\n");
    check_lines(&answer)?;
    super::with_unix_newlines(text, |text| {
        if id == "notes" {
            let notes = round_notes(text).ok_or(AnswerError::NoNotesLine)?;
            return set_notes(text, &answer, &notes.comments);
        }
        let question = parse(text)
            .into_iter()
            .find(|question| question.id == id)
            .ok_or_else(|| AnswerError::UnknownQuestion(id.to_string()))?;
        if question.answer_line == 0 {
            return Err(AnswerError::NoAnswerLine(id.to_string()));
        }
        Ok(replace_after(
            text,
            question.answer_line,
            ANSWER,
            answer.trim(),
        ))
    })
}

/// The text with the marker on line `marker_line` followed by `answer`, in place of the marker's
/// line and the lines after it, up to the next heading.
fn replace_after(text: &str, marker_line: usize, marker: &str, answer: &str) -> String {
    let mut lines: Vec<&str> = text.split('\n').collect();
    let start = marker_line - 1;
    let mut end = start + 1;
    let mut in_code = false;
    while end < lines.len() {
        let line = lines[end];
        if super::is_fence(line) {
            in_code = !in_code;
        }
        if !in_code && line.starts_with('#') {
            break;
        }
        end += 1;
    }
    let first = if answer.is_empty() {
        marker.to_string()
    } else if answer.starts_with('\n') {
        format!("{marker}{answer}")
    } else {
        format!("{marker} {answer}")
    };
    // A blank line before the next heading, or the file's last newline.
    let replacement: Vec<&str> = first.split('\n').chain([""]).collect();
    lines.splice(start..end, replacement);
    lines.join("\n")
}

/// An answer from the letters picked and a comment, as the web UI composes it: `A`, `B and C`,
/// `A, B and C`, then `: <comment>`; a comment alone is written as it is.
pub fn compose_answer(letters: &[String], comment: &str) -> String {
    let mut letters: Vec<&str> = letters.iter().map(String::as_str).collect();
    letters.sort_unstable();
    letters.dedup();
    let comment = comment.trim();
    let picked = match letters.as_slice() {
        [] => return comment.to_string(),
        [one] => one.to_string(),
        [rest @ .., last] => format!("{} and {last}", rest.join(", ")),
    };
    if comment.is_empty() {
        picked
    } else {
        format!("{picked}: {comment}")
    }
}

/// An answer split into the option letters it starts with and its comment, when it starts with
/// letters joined by `, ` and ` and `, followed by `:` or its end. Any other answer is a comment.
pub fn split_answer(answer: &str, options: &[char]) -> (Vec<String>, String) {
    let whole = || (Vec::new(), answer.trim().to_string());
    let mut letters = Vec::new();
    let mut rest = answer.trim();
    loop {
        let mut chars = rest.chars();
        let Some(letter) = chars.next().filter(|c| options.contains(c)) else {
            return whole();
        };
        letters.push(letter.to_string());
        rest = chars.as_str();
        if rest.is_empty() {
            return (letters, String::new());
        }
        if let Some(comment) = rest.strip_prefix(':') {
            return (letters, comment.trim().to_string());
        }
        rest = match [", and ", " and ", ", "]
            .iter()
            .find_map(|joint| rest.strip_prefix(joint))
        {
            Some(next) => next,
            None => return whole(),
        };
    }
}

/// A question heading's id, its parent and the parent's option for a follow-up, and its title,
/// from a heading's level and text.
pub fn question_heading(level: u32, text: &str) -> Option<QuestionHeading> {
    heading(&format!("{} {text}", "#".repeat(level as usize)))
}

/// A question's option letter, `- **A (recommended). ...**`, from an item's first strong text,
/// with whether it is recommended and the text after it.
pub fn option_heading(strong: &str) -> Option<(char, bool, &str)> {
    let mut chars = strong.chars();
    let letter = chars.next().filter(|c| c.is_ascii_uppercase())?;
    let rest = chars.as_str();
    if let Some(text) = rest.strip_prefix(" (recommended).") {
        return Some((letter, true, text.trim_start()));
    }
    rest.strip_prefix(". ")
        .or_else(|| (rest == ".").then_some(""))
        .map(|text| (letter, false, text))
}

#[cfg(test)]
mod tests {
    use super::{join_notes, set_answer, split_notes};

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

    #[test]
    fn blank_notes_keep_their_comments_as_a_list() {
        let text = "## Settled without the human\n\n- **A point** settled.\n\n**Notes:** Old.\n\n- **A point**: Keep it.\n";

        assert_eq!(
            set_answer(text, "notes", "").unwrap(),
            "## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n\n- **A point**: Keep it.\n"
        );
    }
}
