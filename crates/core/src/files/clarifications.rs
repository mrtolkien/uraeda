//! The questions of a clarifications file, their options, and their answers.

mod notes;

pub use notes::{RoundNotes, join_notes, notes, round_notes, set_notes, split_notes};

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
    use super::set_answer;

    #[test]
    fn blank_notes_keep_their_comments_as_a_list() {
        let text = "## Settled without the human\n\n- **A point** settled.\n\n**Notes:** Old.\n\n- **A point**: Keep it.\n";

        assert_eq!(
            set_answer(text, "notes", "").unwrap(),
            "## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n\n- **A point**: Keep it.\n"
        );
    }
}
