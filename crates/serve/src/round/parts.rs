//! A round's file cut into what its page draws: the block, the context, the settled points, each
//! question with its parts and options, and the notes. Each part is a range of the file's lines,
//! 1-based and inclusive, so the page draws each with the markdown renderer, and the file stays
//! the only source.

use uraeda_core::files::clarifications::{self, Question};

/// Lines `start` to `end` of the file, 1-based, both included.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Lines {
    pub start: usize,
    pub end: usize,
}

impl Lines {
    /// The text of these lines in `lines`, the file's lines.
    pub fn of(&self, lines: &[&str]) -> String {
        lines
            .get(self.start - 1..self.end.min(lines.len()))
            .unwrap_or_default()
            .join("\n")
    }
}

/// A part of a question before its options: a plain run of paragraphs, its "Why it matters:"
/// paragraph, or its "Example:" paragraph.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Part {
    Text(Lines),
    Why(Lines),
    Example(Lines),
}

/// An option of a question.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Choice {
    pub letter: char,
    pub recommended: bool,
    /// From its `- **A. ...**` line to its last line.
    pub lines: Lines,
}

/// A question or a follow-up, with its parts and options.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Asked {
    pub question: Question,
    pub parts: Vec<Part>,
    pub choices: Vec<Choice>,
    /// Whether the question says its options combine.
    pub combine: bool,
}

/// A settled point: its bold subject and its lines.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Settled {
    pub subject: String,
    pub lines: Lines,
}

/// A round, cut into parts.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Round {
    /// `Clarifications, round 01: Recurring tasks`.
    pub title: String,
    /// The `> [!IMPORTANT]` or `> [!NOTE]` block under the title.
    pub block: Option<Lines>,
    /// The `## Context` section, without its heading.
    pub context: Option<Lines>,
    /// The points settled without the human, from "Check these" then "Settled without the human".
    pub settled: Vec<Settled>,
    pub questions: Vec<Asked>,
}

/// The `## ` sections of the file: their title, heading line, and last line.
fn sections(lines: &[&str]) -> Vec<(String, usize, usize)> {
    let mut found: Vec<(String, usize, usize)> = Vec::new();
    let mut fenced = false;
    for (index, line) in lines.iter().enumerate() {
        if line.trim_start().starts_with("```") {
            fenced = !fenced;
        }
        if !fenced && let Some(title) = line.strip_prefix("## ") {
            if let Some(last) = found.last_mut() {
                last.2 = index;
            }
            found.push((title.trim().to_string(), index + 1, lines.len()));
        }
    }
    found
}

/// The line after the frontmatter, 1-based.
fn body_start(lines: &[&str]) -> usize {
    if lines.first().map(|l| l.trim_end()) != Some("---") {
        return 1;
    }
    lines
        .iter()
        .skip(1)
        .position(|l| l.trim_end() == "---")
        .map_or(1, |end| end + 3)
}

/// `range` without its blank lines at both ends, or `None` when it holds only blanks.
fn trimmed(lines: &[&str], start: usize, end: usize) -> Option<Lines> {
    let blank = |n: usize| lines.get(n - 1).is_none_or(|l| l.trim().is_empty());
    let (mut start, mut end) = (start, end.min(lines.len()));
    while start <= end && blank(start) {
        start += 1;
    }
    while end >= start && blank(end) {
        end -= 1;
    }
    (start <= end).then_some(Lines { start, end })
}

/// Cuts a round's text into its parts.
pub fn cut(text: &str) -> Round {
    let lines: Vec<&str> = text.lines().collect();
    let start = body_start(&lines);
    let title = lines
        .iter()
        .skip(start - 1)
        .find_map(|l| l.strip_prefix("# "))
        .unwrap_or_default()
        .trim()
        .to_string();
    let all = sections(&lines);
    let first_section = all.first().map_or(lines.len() + 1, |s| s.1);
    let block = lines
        .iter()
        .enumerate()
        .take(first_section - 1)
        .find(|(_, l)| l.starts_with("> [!"))
        .map(|(index, _)| {
            let end = lines[index..]
                .iter()
                .position(|l| !l.starts_with('>'))
                .map_or(lines.len(), |n| index + n);
            Lines {
                start: index + 1,
                end,
            }
        });
    let context = all
        .iter()
        .find(|s| s.0 == "Context")
        .and_then(|s| trimmed(&lines, s.1 + 1, s.2));
    let notes_line = clarifications::notes(text).map_or(lines.len() + 1, |(line, _)| line);
    let settled = all
        .iter()
        .filter(|s| s.0 == "Check these" || s.0.starts_with("Settled without"))
        .flat_map(|s| settled_points(&lines, s.1 + 1, s.2.min(notes_line - 1)))
        .collect();
    let parsed = clarifications::parse(text);
    let questions = parsed
        .iter()
        .map(|question| asked(&lines, question, &parsed))
        .collect();
    Round {
        title,
        block,
        context,
        settled,
        questions,
    }
}

/// The points of a settled section's list, `- **Subject** ...`, between `start` and `end`.
fn settled_points(lines: &[&str], start: usize, end: usize) -> Vec<Settled> {
    let mut points: Vec<Settled> = Vec::new();
    for n in start..=end.min(lines.len()) {
        let line = lines[n - 1];
        if let Some(rest) = line.strip_prefix("- **")
            && let Some((subject, _)) = rest.split_once("**")
        {
            if let Some(last) = points.last_mut() {
                last.lines.end = n - 1;
            }
            points.push(Settled {
                subject: subject.trim().to_string(),
                lines: Lines { start: n, end },
            });
        } else if !line.is_empty() && !line.starts_with(' ') && !line.starts_with('-') {
            // A paragraph after the list ends its last point.
            if let Some(last) = points.last_mut()
                && last.lines.end >= n
            {
                last.lines.end = n - 1;
            }
        }
    }
    for point in &mut points {
        point.lines = trimmed(lines, point.lines.start, point.lines.end).unwrap_or(point.lines);
    }
    points
}

/// The option an option line opens: its letter and whether it is recommended.
fn option_line(line: &str) -> Option<(char, bool)> {
    let (letter, recommended, _) = clarifications::option_heading(line.strip_prefix("- **")?)?;
    Some((letter, recommended))
}

/// A question's parts and options, from its heading to its `**Answer:**` line, or to the next
/// question's heading.
fn asked(lines: &[&str], question: &Question, all: &[Question]) -> Asked {
    let next_heading = all
        .iter()
        .map(|q| q.line)
        .filter(|&line| line > question.line)
        .min()
        .unwrap_or(lines.len() + 1);
    let end = if question.answer_line > question.line {
        question.answer_line - 1
    } else {
        next_heading - 1
    };
    let end = sections(lines)
        .iter()
        .map(|s| s.1)
        .filter(|&line| line > question.line)
        .min()
        .map_or(end, |section| end.min(section - 1));
    let first_option = (question.line + 1..=end).find(|&n| option_line(lines[n - 1]).is_some());
    let intro_end = first_option.map_or(end, |n| n - 1);
    let parts = intro_parts(lines, question.line + 1, intro_end);
    let mut choices: Vec<Choice> = Vec::new();
    if let Some(first) = first_option {
        for n in first..=end {
            let line = lines[n - 1];
            if let Some((letter, recommended)) = option_line(line) {
                if let Some(last) = choices.last_mut() {
                    last.lines.end = n - 1;
                }
                choices.push(Choice {
                    letter,
                    recommended,
                    lines: Lines { start: n, end },
                });
            } else if !line.is_empty()
                && !line.starts_with(' ')
                && let Some(last) = choices.last_mut()
                && last.lines.end >= n
            {
                last.lines.end = n - 1;
            }
        }
    }
    for choice in &mut choices {
        choice.lines = trimmed(lines, choice.lines.start, choice.lines.end).unwrap_or(choice.lines);
    }
    let intro = Lines {
        start: question.line,
        end: intro_end,
    }
    .of(lines)
    .to_lowercase();
    Asked {
        question: question.clone(),
        parts,
        choices,
        combine: intro.contains("options combine") || intro.contains("several options"),
    }
}

/// The paragraphs before a question's options, the "Why it matters:" and "Example:" ones apart.
fn intro_parts(lines: &[&str], start: usize, end: usize) -> Vec<Part> {
    let mut parts: Vec<Part> = Vec::new();
    let mut fenced = false;
    let mut paragraph_start: Option<usize> = None;
    let push = |parts: &mut Vec<Part>, from: usize, to: usize| {
        let Some(range) = trimmed(lines, from, to) else {
            return;
        };
        let first = lines[range.start - 1];
        let part = if first.starts_with("Why it matters:") {
            Part::Why(range)
        } else if first.starts_with("Example:") {
            Part::Example(range)
        } else if let Some(Part::Text(previous)) = parts.last_mut() {
            previous.end = range.end;
            return;
        } else {
            Part::Text(range)
        };
        parts.push(part);
    };
    for n in start..=end {
        let line = lines[n - 1];
        if line.trim_start().starts_with("```") {
            fenced = !fenced;
        }
        if line.trim().is_empty() && !fenced {
            if let Some(from) = paragraph_start.take() {
                push(&mut parts, from, n - 1);
            }
        } else if paragraph_start.is_none() {
            paragraph_start = Some(n);
        }
    }
    if let Some(from) = paragraph_start {
        push(&mut parts, from, end);
    }
    parts
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXAMPLE: &str = include_str!(
        "../../../../skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md"
    );

    fn text(lines: Lines) -> String {
        lines.of(&EXAMPLE.lines().collect::<Vec<_>>())
    }

    #[test]
    fn the_example_round_is_cut_into_its_parts() {
        let round = cut(EXAMPLE);
        assert_eq!(round.title, "Clarifications, round 01: Recurring tasks");
        assert!(text(round.block.unwrap()).starts_with("> [!NOTE]"));
        assert!(text(round.context.unwrap()).starts_with("### Goal"));
        let subjects: Vec<_> = round.settled.iter().map(|s| s.subject.as_str()).collect();
        assert_eq!(
            subjects,
            [
                "Skipping one occurrence",
                "Monthly repeats on the 29th to 31st",
                "Repeating tasks show a repeat icon"
            ]
        );
        assert!(
            text(round.settled[2].lines).ends_with("[discovery](discovery-01.md#important-reads).")
        );
        let q1 = &round.questions[0];
        assert_eq!(q1.question.id, "Q1");
        assert!(q1.combine);
        let letters: Vec<_> = q1
            .choices
            .iter()
            .map(|c| (c.letter, c.recommended))
            .collect();
        assert_eq!(letters, [('A', true), ('B', false), ('C', false)]);
        assert!(text(q1.choices[2].lines).ends_with("clear error messages."));
        assert!(matches!(q1.parts[1], Part::Why(_)), "{:?}", q1.parts);
        let q2 = &round.questions[1];
        assert!(!q2.combine);
        assert!(
            q2.parts
                .iter()
                .any(|p| matches!(p, Part::Text(l) if text(*l).contains("```mermaid")))
        );
        let follow_up = &round.questions[2];
        assert_eq!(follow_up.question.id, "Q2.B");
        assert_eq!(follow_up.choices.len(), 2);
    }
}
