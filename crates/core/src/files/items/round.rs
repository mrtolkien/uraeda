//! A clarifications round's items: its questions and their options, its context, the points
//! settled without the human, and the notes.

use super::{Choice, QuestionItem, RoundItems, headings, section};
use crate::files::clarifications::{self, Applicability};
use crate::files::document::{Block, BlockKind, Document, ItemMarker, plain};
use crate::files::frontmatter;

/// The top-level blocks of the level-2 section titled `title`.
fn named_section(doc: &Document, title: &str) -> Vec<u32> {
    headings(doc)
        .into_iter()
        .find(|(_, level, text)| *level == 2 && text == title)
        .map(|(index, _, _)| section(doc, index, 2))
        .unwrap_or_default()
}

/// The first strong span of an item, when the item's text starts with it.
fn leading_strong(block: &Block) -> Option<&str> {
    block
        .spans
        .first()
        .filter(|span| span.strong)
        .map(|span| span.text.as_str())
}

pub(super) fn round(text: &str, doc: &Document) -> RoundItems {
    let status = frontmatter::parse(text)
        .ok()
        .and_then(|front| front.text("status").map(String::from));
    let first_section = doc
        .blocks
        .iter()
        .find(|b| b.kind == BlockKind::Heading && b.level == Some(2))
        .map_or(u32::MAX, |b| b.start_line);
    let block = doc
        .blocks
        .iter()
        .find(|b| {
            b.parent.is_none() && b.kind == BlockKind::Callout && b.start_line < first_section
        })
        .map(|b| b.id);
    let parsed = clarifications::parse(text);
    let all_headings = headings(doc);
    let mut questions = Vec::new();
    for (position, (index, level, title)) in all_headings.iter().enumerate() {
        let Some((id, parent, question_title)) = clarifications::question_heading(*level, title)
        else {
            continue;
        };
        let heading = &doc.blocks[*index];
        // A question ends at the next heading of level 3 or above: a follow-up is its own.
        let end_index = all_headings[position + 1..]
            .iter()
            .find(|(_, l, _)| *l <= 3)
            .map_or(doc.blocks.len(), |(i, _, _)| *i);
        let end_line = doc.blocks[*index..end_index]
            .iter()
            .map(|b| b.end_line)
            .max()
            .unwrap_or(heading.end_line);
        let found = parsed.iter().find(|q| q.id == id);
        let answer = found.map(|q| q.answer.clone()).unwrap_or_default();
        let answer_line = found.map_or(0, |q| q.answer_line as u32);
        let letters: Vec<char> = found.map(|q| q.options.clone()).unwrap_or_default();
        let (picked, comment) = clarifications::split_answer(&answer, &letters);
        let applies = match found.map(|q| q.applies(&parsed)) {
            Some(Applicability::No) => "no",
            Some(Applicability::Unclear) => "unclear",
            _ => "yes",
        };
        let mut context = Vec::new();
        let mut options = Vec::new();
        for block in &doc.blocks[*index + 1..end_index] {
            if block.parent.is_some() || block.kind == BlockKind::Heading {
                continue;
            }
            if answer_line > 0 && block.start_line >= answer_line {
                continue;
            }
            let choices = choices(doc, block);
            if choices.is_empty() {
                context.push(block.id);
            } else {
                options.extend(choices);
            }
        }
        let parent_id = parent.as_ref().map(|(p, _)| p.clone());
        questions.push(QuestionItem {
            id,
            parent: parent_id.clone(),
            parent_letter: parent.map(|(_, letter)| letter.to_string()),
            title: question_title,
            start_line: heading.start_line,
            end_line,
            heading_block: heading.id,
            context,
            options,
            answer,
            letters: picked,
            comment,
            applies: applies.to_string(),
            asked: found.map_or(parent_id.is_none(), |q| q.asked(&parsed)),
            answer_line,
        });
    }
    let notes = clarifications::notes(text);
    RoundItems {
        status,
        block,
        context: named_section(doc, "Context"),
        questions,
        settled: named_section(doc, "Settled without the human"),
        notes: notes.as_ref().map(|(_, notes)| notes.clone()),
        notes_line: notes.map(|(line, _)| line as u32),
    }
}

/// The options of a list whose items are `- **A. ...**`, or nothing for any other block.
fn choices(doc: &Document, list: &Block) -> Vec<Choice> {
    if list.kind != BlockKind::List {
        return Vec::new();
    }
    let mut choices = Vec::new();
    for item in doc.children(list.id) {
        let Some((letter, recommended, rest)) =
            leading_strong(item).and_then(clarifications::option_heading)
        else {
            return Vec::new();
        };
        let mut summary = item.spans.clone();
        summary[0].text = rest.to_string();
        if summary[0].text.is_empty() {
            summary.remove(0);
        }
        let mut choice = Choice {
            letter: letter.to_string(),
            recommended,
            summary,
            pros: Vec::new(),
            cons: Vec::new(),
            why: None,
            other: Vec::new(),
            block: item.id,
        };
        for child in doc.children(item.id) {
            if child.kind != BlockKind::List {
                choice.other.push(child.id);
                continue;
            }
            for bullet in doc.children(child.id) {
                match bullet.marker {
                    Some(ItemMarker::Pro) => choice.pros.push(bullet.id),
                    Some(ItemMarker::Con) => choice.cons.push(bullet.id),
                    _ if plain(&bullet.spans).starts_with("Why recommended") => {
                        choice.why = Some(bullet.id);
                    }
                    _ => choice.other.push(bullet.id),
                }
            }
        }
        choices.push(choice);
    }
    choices
}
