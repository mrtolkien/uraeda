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

/// Whether a line is the `**Notes:**` marker.
fn is_notes(line: &str) -> bool {
    NOTES.iter().any(|marker| line.starts_with(marker))
}

/// The mark of a section that is not a question, or of the notes, at `line`: it ends the last
/// question, and is dropped once the file is read.
fn end_of_questions(line: usize) -> Question {
    Question {
        id: String::new(),
        parent: None,
        letter: None,
        title: String::new(),
        line,
        options: Vec::new(),
        answer: String::new(),
        answer_line: 0,
    }
}

/// Every question and follow-up of a clarifications file, in order. An answer keeps its code blocks
/// as written; a line of code is no heading, marker, or option.
pub fn parse(text: &str) -> Vec<Question> {
    let mut questions: Vec<Question> = Vec::new();
    let mut in_answer = false;
    let mut in_code = false;
    for (index, line) in text.lines().enumerate() {
        let number = index + 1;
        let fence = super::is_fence(line);
        let code = in_code || fence;
        in_code ^= fence;
        if code {
            if let Some(question) = questions.last_mut().filter(|_| in_answer) {
                question.answer.push('\n');
                question.answer.push_str(line);
            }
            continue;
        }
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
                questions.push(end_of_questions(number));
            }
            continue;
        }
        if is_notes(line) {
            // So do the notes, in a file with no section between the last question and them.
            in_answer = false;
            questions.push(end_of_questions(number));
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

/// Refuses an answer with a line that would end it: a heading, or another marker. A line of a code
/// block is code, which ends nothing; a fence left open is not one, as the file's next headings
/// would read as code.
fn check_lines(answer: &str) -> Result<(), AnswerError> {
    let lines: Vec<&str> = answer.lines().collect();
    let mut code = vec![false; lines.len()];
    let mut open = None;
    for (index, line) in lines.iter().enumerate() {
        if super::is_fence(line) {
            match open.take() {
                Some(start) => code[start..=index].fill(true),
                None => open = Some(index),
            }
        }
    }
    let ends = |line: &str| {
        let line = line.trim_start();
        line.starts_with('#') || line.starts_with(ANSWER) || is_notes(line)
    };
    if lines
        .iter()
        .zip(&code)
        .any(|(line, &code)| !code && ends(line))
    {
        return Err(AnswerError::Structure);
    }
    Ok(())
}

/// The fence a text leaves open, `` ``` `` or `~~~`, if any.
fn open_fence(text: &str) -> Option<&'static str> {
    let mut open = None;
    for line in text.lines().filter(|line| super::is_fence(line)) {
        open = match open {
            Some(_) => None,
            None if line.trim_start().starts_with('~') => Some("~~~"),
            None => Some("```"),
        };
    }
    open
}

/// A text with the fence it leaves open closed on a line of its own, so what follows it in the file
/// is not code.
fn closed(text: &str) -> String {
    match open_fence(text) {
        Some(fence) => format!("{text}\n{fence}"),
        None => text.to_string(),
    }
}

/// Writes an answer after a question's `**Answer:**` marker, replacing the earlier one, with a fence
/// it leaves open closed at its end, so the next questions are not code. The id `notes` writes the
/// free notes after the `**Notes:**` marker, keeping the comments on settled points after them.
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
            &closed(answer.trim()),
        ))
    })
}

/// The text with the marker on line `marker_line` followed by `answer`, in place of the marker's
/// line and the lines after it, up to the next heading or the notes. An answer starting with a
/// code block starts on the line after the marker, after a blank line.
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
        if !in_code && (line.starts_with('#') || is_notes(line)) {
            break;
        }
        end += 1;
    }
    let first = if answer.is_empty() {
        marker.to_string()
    } else if answer.starts_with('\n') {
        format!("{marker}{answer}")
    } else if answer.lines().next().is_some_and(super::is_fence) {
        // A fence is one only at the start of its line: a code block starts below the marker.
        format!("{marker}\n\n{answer}")
    } else {
        format!("{marker} {answer}")
    };
    // A blank line before the next heading, or the file's last newline.
    let replacement: Vec<&str> = first.split('\n').chain([""]).collect();
    lines.splice(start..end, replacement);
    lines.join("\n")
}

/// An answer from the letters picked and a comment, as the web UI composes it: `A`, `B and C`,
/// `A, B and C`, then `: <comment>`; a comment alone is written as it is. A comment starting with
/// a code block starts on the line after the letters, after a blank line.
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
    } else if comment.lines().next().is_some_and(super::is_fence) {
        // A fence is one only at the start of its line: a code block starts below the letters.
        format!("{picked}:\n\n{comment}")
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
    use super::{AnswerError, compose_answer, parse, set_answer, split_answer};

    #[test]
    fn blank_notes_keep_their_comments_as_a_list() {
        let text = "## Settled without the human\n\n- **A point** settled.\n\n**Notes:** Old.\n\n- **A point**: Keep it.\n";

        assert_eq!(
            set_answer(text, "notes", "").unwrap(),
            "## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n\n- **A point**: Keep it.\n"
        );
    }

    #[test]
    fn a_heading_in_a_closed_code_block_ends_nothing() {
        let text = "## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n";
        let rows: [(&str, bool); 4] = [
            ("```sh\n# a shell comment\n```", true),
            ("~~~\n**Answer:** quoted\n~~~", true),
            ("```\n# left open", false),
            ("# a heading", false),
        ];
        for (notes, kept) in rows {
            let written = set_answer(text, "notes", notes).map(|_| ());
            let expected = if kept {
                Ok(())
            } else {
                Err(AnswerError::Structure)
            };
            assert_eq!(written, expected, "{notes:?}");
        }
    }

    #[test]
    fn code_blocks_in_a_question_answer_are_kept_as_written() {
        let text = "## Q1: Which?\n\n- **A. One**\n- **B. Two**\n\n**Answer:**\n\n## Q2: Next?\n\n**Answer:**\n";
        let options = ['A', 'B'];
        let comments = [
            "See:\n\n```sh\n# a shell comment\n**Answer:** quoted\n```\n\nThen.",
            "```\n## Not a heading\n```",
        ];
        for comment in comments {
            for letters in [vec![], vec!["A".to_string()]] {
                let written = set_answer(text, "Q1", &compose_answer(&letters, comment)).unwrap();
                let questions = parse(&written);
                assert_eq!(questions.len(), 2, "{written:?}");
                let answer = &questions[0].answer;
                assert_eq!(
                    split_answer(answer, &options),
                    (letters.clone(), comment.to_string()),
                    "{written:?}"
                );
                // Saving the answer read keeps the file as it is.
                assert_eq!(set_answer(&written, "Q1", answer).unwrap(), written);
            }
        }
    }

    #[test]
    fn a_fence_left_open_in_an_answer_is_closed_before_the_next_question() {
        let text =
            "## Q1: Which?\n\n- **A. One**\n\n**Answer:**\n\n## Q2: Next?\n\n**Answer:** Kept.\n";
        let rows = [
            ("```\ncode", "```\ncode\n```"),
            ("See:\n\n~~~sh\ncode", "See:\n\n~~~sh\ncode\n~~~"),
        ];
        for (comment, read) in rows {
            for letters in [vec![], vec!["A".to_string()]] {
                let written = set_answer(text, "Q1", &compose_answer(&letters, comment)).unwrap();
                let questions = parse(&written);
                assert_eq!(questions.len(), 2, "{written:?}");
                assert_eq!(questions[1].answer, "Kept.", "{written:?}");
                let answer = &questions[0].answer;
                assert_eq!(
                    split_answer(answer, &['A']),
                    (letters.clone(), read.to_string()),
                    "{written:?}"
                );
                // Saving the answer read keeps the file as it is.
                assert_eq!(set_answer(&written, "Q1", answer).unwrap(), written);
            }
        }
    }
}
