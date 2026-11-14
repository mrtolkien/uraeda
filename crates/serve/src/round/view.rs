//! The round page's HTML: the block, the context folded, the settled points with a comment each,
//! one card per question, the notes, and the bar at the foot. Every part of the file is drawn by
//! `draw`, the markdown renderer, so the page shows what the file says.
//!
//! The script reads these attributes: `data-id`, `data-answer` (the answer as last read, sent back
//! as `previous`), `data-combine`, `data-parent` and `data-letter` on a follow-up, `data-letter`
//! on a choice, `data-subject`, `data-number`, and `data-comment` on a settled point.

use std::fmt::Write as _;

use uraeda_core::files::clarifications::{self, RoundNotes};

use super::parts::{Asked, Lines, Part, Round};
use crate::html::escape;

/// What the page needs besides the round's text.
pub struct Page<'a> {
    /// The feature's name, as the human reads it.
    pub name: &'a str,
    /// The round's number.
    pub number: u32,
    /// Whether the round still waits on the human: an answered round is drawn without its forms.
    pub waiting: bool,
}

/// The `<main>` of a round's page.
pub fn main(text: &str, round: &Round, page: &Page<'_>, draw: &dyn Fn(&str) -> String) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let part = |range: Lines| marked(&draw(&range.of(&lines)));
    let questions = clarifications::parse(text);
    let asked: Vec<_> = questions.iter().filter(|q| q.asked(&questions)).collect();
    let answered = asked.iter().filter(|q| !q.answer.trim().is_empty()).count();
    let mut out = String::with_capacity(text.len() * 3);
    let _ = write!(
        out,
        "<main class=\"round\" data-waiting=\"{waiting}\">\
         <nav class=\"crumbs\"><a href=\"../../\">‹ What waits on you</a></nav>\
         <h1>{name}</h1><p class=\"muted subtitle\">Questions, round {number}</p>",
        waiting = page.waiting,
        name = escape(page.name),
        number = page.number,
    );
    if let Some(block) = round.block {
        out.push_str(&part(block));
    }
    if let Some(context) = round.context {
        let _ = write!(
            out,
            "<details class=\"context\"><summary>Context: the goal, what exists, and the \
             sources</summary>{}</details>",
            part(context)
        );
    }
    let notes = clarifications::round_notes(text);
    if !round.settled.is_empty() {
        settled(&mut out, round, notes.as_ref(), &part, page.waiting);
    }
    for question in &round.questions {
        card(&mut out, question, &questions, &part, page.waiting);
    }
    if let Some(notes) = &notes {
        let _ = write!(
            out,
            "<section class=\"notes\" id=\"notes\" data-answer=\"{previous}\"><h2>Anything \
             else?</h2><p class=\"muted small\">Optional: what the questions missed.</p>\
             <textarea name=\"notes\" rows=\"3\" aria-label=\"Anything else\"{disabled}>{free}\
             </textarea><p class=\"saved small muted\" aria-live=\"polite\"></p></section>",
            previous = escape(&notes.free),
            free = escape(&notes.free),
            disabled = if page.waiting { "" } else { " disabled" },
        );
    }
    let _ = write!(
        out,
        "</main><div class=\"bar\" role=\"region\" aria-label=\"Progress\">\
         <span class=\"progress\"><b class=\"count\">{answered}</b> of <b class=\"total\">{total}\
         </b> answered</span>",
        total = asked.len(),
    );
    if page.waiting {
        out.push_str(
            "<button type=\"button\" class=\"primary next\">Next question</button>\
             <button type=\"button\" class=\"primary submit\" hidden>Send answers</button>",
        );
    } else {
        out.push_str("<span class=\"muted\">Answers sent</span>");
    }
    out.push_str("</div>");
    out
}

/// The settled points, each with the human's comment, when there is one, and a field for it.
fn settled(
    out: &mut String,
    round: &Round,
    notes: Option<&RoundNotes>,
    part: &dyn Fn(Lines) -> String,
    waiting: bool,
) {
    out.push_str(
        "<section class=\"settled\" id=\"settled\"><h2>Settled without you</h2>\
         <p class=\"muted small\">Nothing to answer here. Comment on a point to change it.</p>",
    );
    for point in &round.settled {
        let comment = notes.and_then(|notes| {
            notes
                .comments
                .iter()
                .position(|(subject, _)| subject.trim() == point.subject)
                .map(|index| (index + 1, notes.comments[index].1.as_str()))
        });
        let (number, text) = comment.unwrap_or((0, ""));
        let _ = write!(
            out,
            "<div class=\"point\" data-subject=\"{subject}\" data-number=\"{number}\" \
             data-comment=\"{previous}\">{body}",
            subject = escape(&point.subject),
            previous = escape(text),
            body = part(point.lines),
        );
        if waiting || !text.is_empty() {
            let _ = write!(
                out,
                "<details class=\"comment\"{open}><summary>{label}</summary>\
                 <textarea rows=\"2\" aria-label=\"Your comment on {subject}\"{disabled}>{text}\
                 </textarea><p class=\"saved small muted\" aria-live=\"polite\"></p></details>",
                open = if text.is_empty() { "" } else { " open" },
                label = if text.is_empty() {
                    "Comment"
                } else {
                    "Your comment"
                },
                subject = escape(&point.subject),
                disabled = if waiting { "" } else { " disabled" },
                text = escape(text),
            );
        }
        out.push_str("</div>");
    }
    out.push_str("</section>");
}

/// A question's card: its title, its parts, its options, and the human's words.
fn card(
    out: &mut String,
    asked: &Asked,
    all: &[clarifications::Question],
    part: &dyn Fn(Lines) -> String,
    waiting: bool,
) {
    let question = &asked.question;
    let (letters, comment) = clarifications::split_answer(&question.answer, &question.options);
    let shown = question.asked(all);
    let _ = write!(
        out,
        "<section class=\"q\" id=\"{id}\" data-id=\"{id}\" data-answer=\"{answer}\"{combine}{follow}{hidden}>\
         <h2><span class=\"qid\">{id}</span> {title}</h2>",
        id = escape(&question.id),
        answer = escape(&question.answer),
        combine = if asked.combine {
            " data-combine=\"1\""
        } else {
            ""
        },
        follow = match (&question.parent, question.letter) {
            (Some(parent), Some(letter)) => format!(
                " data-parent=\"{}\" data-letter=\"{letter}\"",
                escape(parent)
            ),
            _ => String::new(),
        },
        hidden = if shown || !question.answer.is_empty() {
            ""
        } else {
            " hidden"
        },
        title = escape(&question.title),
    );
    for item in &asked.parts {
        match item {
            Part::Text(range) => out.push_str(&part(*range)),
            Part::Why(range) => {
                let _ = write!(out, "<div class=\"why\">{}</div>", part(*range));
            }
            Part::Example(range) => {
                let _ = write!(out, "<div class=\"example\">{}</div>", part(*range));
            }
        }
    }
    let role = if asked.combine { "checkbox" } else { "radio" };
    let _ = write!(
        out,
        "<div class=\"choices\" role=\"{group}\" aria-label=\"Options of {id}\">",
        group = if asked.combine { "group" } else { "radiogroup" },
        id = escape(&question.id),
    );
    if asked.combine {
        out.push_str("<p class=\"muted small\">You can pick more than one.</p>");
    }
    for choice in &asked.choices {
        let picked = letters.iter().any(|l| l.starts_with(choice.letter));
        let _ = write!(
            out,
            "<div class=\"choice{recommended}\" role=\"{role}\" tabindex=\"{tab}\" \
             aria-checked=\"{picked}\" aria-disabled=\"{disabled}\" data-letter=\"{letter}\">\
             <span class=\"tick\" aria-hidden=\"true\"></span><span class=\"letter\">{letter}</span>\
             {tag}{body}</div>",
            recommended = if choice.recommended {
                " recommended"
            } else {
                ""
            },
            tab = if waiting { 0 } else { -1 },
            disabled = !waiting,
            letter = choice.letter,
            tag = if choice.recommended {
                "<span class=\"tag\">★ Recommended</span>"
            } else {
                ""
            },
            body = option_body(&part(choice.lines)),
        );
    }
    out.push_str("</div>");
    let _ = write!(
        out,
        "<label class=\"words\"><span class=\"small muted\">In your words, optional: your words \
         win over the option's</span><textarea rows=\"2\"{disabled}>{comment}</textarea></label>\
         <p class=\"saved small muted\" aria-live=\"polite\"></p></section>",
        disabled = if waiting { "" } else { " disabled" },
        comment = escape(&comment),
    );
}

/// An option's drawn markdown, its `[pro]`, `[con]`, and "Why recommended" lines marked, and its
/// sentence's `A (recommended).` or `A.` dropped: the card shows the letter and the tag.
fn option_body(html: &str) -> String {
    let html = html
        .replace(
            "[pro] ",
            "<span class=\"pro\" aria-label=\"For:\" title=\"For\">+</span> ",
        )
        .replace(
            "[con] ",
            "<span class=\"con\" aria-label=\"Against:\" title=\"Against\">−</span> ",
        )
        .replace(
            "Why recommended:",
            "<span class=\"star\" aria-hidden=\"true\">★</span> Why recommended:",
        );
    let mut out = html;
    for letter in 'A'..='Z' {
        for prefix in [format!("{letter} (recommended). "), format!("{letter}. ")] {
            if let Some(at) = out.find(&format!("<strong>{prefix}")) {
                out.replace_range(at + 8..at + 8 + prefix.len(), "");
                return out;
            }
        }
    }
    out
}

/// A part's HTML, as drawn: kept as is. The hook where a part could be marked for comments later.
fn marked(html: &str) -> String {
    html.to_string()
}

#[cfg(test)]
mod tests {
    use super::option_body;

    #[test]
    fn an_options_letter_leaves_its_sentence_and_its_lines_are_marked() {
        let html = option_body(
            "<li><strong>A (recommended). Presets.</strong><ul><li>[pro] one.</li><li>[con] two.\
             </li></ul></li>",
        );
        assert!(html.starts_with("<li><strong>Presets.</strong>"), "{html}");
        assert!(html.contains("class=\"pro\""));
        assert!(html.contains("class=\"con\""));
    }
}
