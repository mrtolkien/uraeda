//! `answers.*`: questions numbered from Q1, follow-ups on an option of their parent, an answer
//! marker for each, and, once answered, an answer for every question that applies.

use crate::files::clarifications::{self, Applicability};
use crate::files::frontmatter::Frontmatter;
use crate::workspace::Problem;

use super::File;

pub(super) fn check_answers(
    file: &File<'_>,
    front: Option<&Frontmatter>,
    problems: &mut Vec<Problem>,
) {
    let questions = clarifications::parse(file.text);
    for (expected, question) in (1..).zip(questions.iter().filter(|q| q.parent.is_none())) {
        let number = &question.id[1..];
        if number != expected.to_string() {
            problems.push(file.problem(
                Some(question.line),
                "answers.numbering",
                format!("{} should be Q{expected}", question.id),
            ));
        }
    }
    for question in &questions {
        if let (Some(parent), Some(letter)) = (&question.parent, question.letter) {
            let parent_options = questions
                .iter()
                .find(|q| &q.id == parent)
                .map(|q| q.options.clone())
                .unwrap_or_default();
            if !parent_options.contains(&letter) {
                problems.push(file.problem(
                    Some(question.line),
                    "answers.follow-up",
                    format!("{} follows no option {letter} of {parent}", question.id),
                ));
            }
        }
        if question.answer_line == 0 {
            problems.push(file.problem(
                Some(question.line),
                "answers.marker",
                format!("{} has no **Answer:** line", question.id),
            ));
        }
    }
    let answered = front.is_some_and(|front| front.text("status") == Some("answered"));
    if !answered {
        return;
    }
    for question in &questions {
        if !question.answer.is_empty()
            || question.answer_line == 0
            || question.applies(&questions) == Applicability::No
        {
            continue;
        }
        problems.push(file.problem(
            Some(question.answer_line),
            "answers.blank",
            format!("{} has no answer", question.id),
        ));
    }
}
