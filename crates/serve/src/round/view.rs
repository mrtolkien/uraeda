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
         <p class=\"badge{sent}\">Questions, round {number}</p><h1>{name}</h1>",
        sent = if page.waiting { "" } else { " quiet" },
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
            "<details class=\"context\" id=\"context\"><summary>Context: the goal, what exists, and the \
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
    out.push_str("</main>");
    outline(&mut out, round, &questions, notes.is_some());
    let _ = write!(
        out,
        "<div class=\"bar\" role=\"region\" aria-label=\"Progress\">\
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

/// The outline beside the page at a desk: how far the answers are, and a link to each part, an
/// answered question marked and a follow-up not asked left out.
fn outline(out: &mut String, round: &Round, all: &[clarifications::Question], notes: bool) {
    let asked: Vec<_> = all.iter().filter(|q| q.asked(all)).collect();
    let done = asked.iter().filter(|q| !q.answer.trim().is_empty()).count();
    let _ = write!(
        out,
        "<aside class=\"outline\" aria-label=\"Outline\"><p class=\"outline-progress\">\
         <b class=\"count\">{done}</b> of <b class=\"total\">{total}</b> answered</p>\
         <div class=\"meter-bar\" style=\"--done:{done};--total:{total}\"><i></i></div><ul>",
        total = asked.len().max(1),
    );
    if round.context.is_some() {
        out.push_str("<li><a href=\"#context\">Context</a></li>");
    }
    if !round.settled.is_empty() {
        let _ = write!(
            out,
            "<li><a href=\"#settled\">Settled without you · {}</a></li>",
            round.settled.len()
        );
    }
    out.push_str("</ul><ul class=\"outline-questions\">");
    for item in &round.questions {
        let question = &item.question;
        let answered = !question.answer.trim().is_empty();
        let _ = write!(
            out,
            "<li{hidden}><a href=\"#{id}\" data-for=\"{id}\"{class}><span class=\"qid\">{id}\
             </span> {title}</a></li>",
            hidden = if question.asked(all) || answered {
                ""
            } else {
                " hidden"
            },
            id = escape(&question.id),
            class = if answered { " class=\"answered\"" } else { "" },
            title = escape(&question.title),
        );
    }
    out.push_str("</ul>");
    if notes {
        out.push_str("<ul><li><a href=\"#notes\">Anything else?</a></li></ul>");
    }
    out.push_str("</aside>");
}

/// A framed box with its label cut into the frame: a question's "Why it matters" or "Example",
/// whose paragraph loses the same words at its start.
fn boxed(out: &mut String, class: &str, label: &str, html: &str) {
    let lead = format!("{label}: ");
    let body = match html.find(&lead) {
        Some(at) => {
            let rest = &html[at + lead.len()..];
            let mut chars = rest.chars();
            let first = chars.next().map(|c| c.to_uppercase().to_string());
            format!(
                "{}{}{}",
                &html[..at],
                first.unwrap_or_default(),
                chars.as_str()
            )
        }
        None => html.to_string(),
    };
    let _ = write!(
        out,
        "<div class=\"{class} box\"><span class=\"legend\">{label}</span>{body}</div>"
    );
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
         <p class=\"muted small\">Nothing to answer here. Click a point to comment on it.</p>",
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
                "<div class=\"comment\"{hidden}>\
                 <textarea rows=\"2\" aria-label=\"Your comment on {subject}\"{disabled}>{text}\
                 </textarea><p class=\"saved small muted\" aria-live=\"polite\"></p></div>",
                hidden = if text.is_empty() { " hidden" } else { "" },
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
            Part::Why(range) => boxed(out, "why", "Why it matters", &part(*range)),
            Part::Example(range) => boxed(out, "example", "Example", &part(*range)),
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
             <span class=\"legend\"><span class=\"letter\">{letter}</span>{tag}</span>{body}</div>",
            recommended = if choice.recommended {
                " recommended"
            } else {
                ""
            },
            tab = if waiting { 0 } else { -1 },
            disabled = !waiting,
            letter = choice.letter,
            tag = if choice.recommended {
                " ★ Recommended"
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
