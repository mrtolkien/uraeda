//! A clarifications round's items: its questions and their options, its context, the points
//! settled without the human, and the notes.

use super::{
    Choice, ContextPart, QuestionItem, RoundItems, RoundVerdict, SettledComment, SettledGroup,
    SettledKind, SettledPoint, VerdictKind, headings,
};
use crate::files::clarifications::{self, Applicability};
use crate::files::document::{Block, BlockKind, Document, ItemMarker, Span, plain};
use crate::files::frontmatter;

/// The parts of the level-2 section titled `title`, in order: the blocks before its first `###`
/// sub-heading when there are some, then each sub-heading's index in blocks and its top-level
/// blocks. Deeper headings are left out, as `section` leaves them. Only top-level headings delimit
/// the section and its parts: one in a quote or a callout, like a source's, is the quote's.
fn parts(doc: &Document, title: &str) -> Vec<(Option<usize>, Vec<u32>)> {
    let Some(start) = top_section(doc, title) else {
        return Vec::new();
    };
    let mut parts: Vec<(Option<usize>, Vec<u32>)> = vec![(None, Vec::new())];
    for (index, block) in doc.blocks.iter().enumerate().skip(start + 1) {
        if block.parent.is_some() {
            continue;
        }
        let level = block.level.unwrap_or(1);
        if block.kind == BlockKind::Heading && level <= 2 {
            break;
        }
        if block.kind == BlockKind::Heading && level == 3 {
            parts.push((Some(index), Vec::new()));
        } else if block.kind != BlockKind::Heading {
            parts.last_mut().expect("a part").1.push(block.id);
        }
    }
    if parts[0].1.is_empty() {
        parts.remove(0);
    }
    parts
}

/// The index in blocks of the top-level `##` heading titled `title`, outside quotes and callouts.
fn top_section(doc: &Document, title: &str) -> Option<usize> {
    headings(doc)
        .into_iter()
        .find(|(index, level, text)| {
            *level == 2 && text == title && doc.blocks[*index].parent.is_none()
        })
        .map(|(index, _, _)| index)
}

/// The round's context parts: its `###` sub-headings, or the triage's one free part.
fn context_parts(doc: &Document) -> Vec<ContextPart> {
    parts(doc, "Context")
        .into_iter()
        .map(|(heading, blocks)| ContextPart {
            heading: heading.map(|i| doc.blocks[i].id),
            title: heading.map_or_else(String::new, |i| plain(&doc.blocks[i].spans)),
            blocks,
        })
        .collect()
}

/// The settled groups, all before the `**Notes:**` line: `## Check these`, with its blocks before
/// any sub-heading, then the settled section's `### Behaviour` and `### Under the hood`. Each is its
/// heading and its top-level blocks. An unknown sub-heading, which `ura check` reports, like the old
/// format's `### Check these` or any heading under `## Check these`, makes no group: the blocks
/// under it are in none.
fn settled_groups(doc: &Document, notes_line: usize) -> Vec<SettledGroup> {
    let check = top_section(doc, "Check these").map(|index| {
        let blocks = parts(doc, "Check these")
            .into_iter()
            .find(|(heading, _)| heading.is_none())
            .map(|(_, blocks)| blocks)
            .unwrap_or_default();
        (index, SettledKind::Check, blocks)
    });
    let settled = parts(doc, "Settled without the human")
        .into_iter()
        .filter_map(|(heading, blocks)| {
            let heading = heading?;
            let kind = match plain(&doc.blocks[heading].spans).as_str() {
                "Behaviour" => SettledKind::Behaviour,
                "Under the hood" => SettledKind::Hood,
                _ => return None,
            };
            Some((heading, kind, blocks))
        });
    check
        .into_iter()
        .chain(settled)
        .map(|(heading, kind, blocks)| {
            let blocks: Vec<u32> = blocks
                .into_iter()
                .filter(|&id| (doc.blocks[id as usize].start_line as usize) < notes_line)
                .collect();
            SettledGroup {
                heading: doc.blocks[heading].id,
                kind,
                points: u32::try_from(points_in(doc, &blocks).count()).unwrap_or(u32::MAX),
                blocks,
            }
        })
        .collect()
}

/// The points among a group's blocks, in order: the items of its lists that start in bold.
fn points_in<'a>(doc: &'a Document, blocks: &'a [u32]) -> impl Iterator<Item = SettledPoint> + 'a {
    blocks.iter().flat_map(move |&id| {
        doc.children(id).filter_map(|item| {
            leading_strong(item).map(|subject| SettledPoint {
                block: item.id,
                subject: subject.trim().to_string(),
            })
        })
    })
}

/// The settled points that start in bold, in order: the items of the lists of every group.
fn points_of(doc: &Document, groups: &[SettledGroup]) -> Vec<SettledPoint> {
    groups
        .iter()
        .flat_map(|group| points_in(doc, &group.blocks))
        .collect()
}

/// The settled points that start in bold, in order, before the `**Notes:**` line.
pub(crate) fn settled_points(doc: &Document, notes_line: usize) -> Vec<SettledPoint> {
    points_of(doc, &settled_groups(doc, notes_line))
}

/// The notes split into the free notes and the comments on the settled points, each pointing at
/// the first point with its subject.
fn split(notes: &str, points: &[SettledPoint]) -> (String, Vec<SettledComment>) {
    let subjects: Vec<String> = points.iter().map(|p| p.subject.clone()).collect();
    let (free, comments) = clarifications::split_notes(notes, &subjects);
    let comments = comments
        .into_iter()
        .zip(1..)
        .filter_map(|((subject, text), number)| {
            let point = points.iter().find(|p| p.subject == subject)?.block;
            Some(SettledComment {
                number,
                subject,
                point,
                text,
            })
        })
        .collect();
    (free, comments)
}

/// The verdict of the round's block: its first list item starting "Verdict: ", by the phrase after
/// it, with the item's spans after the phrase and its ":" or ",", trimmed: none when only a full
/// stop follows the phrase.
fn verdict(doc: &Document, block: u32) -> Option<RoundVerdict> {
    const PHRASES: [(&str, VerdictKind); 3] = [
        ("worth building as proposed", VerdictKind::AsProposed),
        ("worth building, with changes", VerdictKind::WithChanges),
        ("not as proposed", VerdictKind::NotAsProposed),
    ];
    let item = doc
        .children(block)
        .filter(|b| b.kind == BlockKind::List)
        .flat_map(|list| doc.children(list.id))
        .find(|item| plain(&item.spans).starts_with("Verdict: "))?;
    let text = plain(&item.spans);
    let rest = &text["Verdict: ".len()..];
    let (phrase, kind) = PHRASES
        .iter()
        .find(|(phrase, _)| rest.starts_with(phrase))?;
    let mark = usize::from(rest[phrase.len()..].starts_with([':', ',']));
    let skip = "Verdict: ".len() + phrase.len() + mark;
    let mut text = trimmed(drop_start(&item.spans, skip));
    // The phrase alone, closed by its full stop, has no text after it.
    if plain(&text) == "." {
        text.clear();
    }
    Some(RoundVerdict {
        kind: *kind,
        item: item.id,
        text,
    })
}

/// Spans without their first `count` bytes of text, which end on a character boundary.
fn drop_start(spans: &[Span], mut count: usize) -> Vec<Span> {
    let mut rest = Vec::new();
    for span in spans {
        if count >= span.text.len() {
            count -= span.text.len();
            continue;
        }
        let mut span = span.clone();
        span.text = span.text[count..].to_string();
        count = 0;
        rest.push(span);
    }
    rest
}

/// Spans without the white space at their start and end, and without the spans left empty.
fn trimmed(mut spans: Vec<Span>) -> Vec<Span> {
    while let Some(first) = spans.first_mut() {
        first.text = first.text.trim_start().to_string();
        if !first.text.is_empty() {
            break;
        }
        spans.remove(0);
    }
    while let Some(last) = spans.last_mut() {
        last.text = last.text.trim_end().to_string();
        if !last.text.is_empty() {
            break;
        }
        spans.pop();
    }
    spans
}

/// The first strong span of an item, when the item's text starts with it.
fn leading_strong(block: &Block) -> Option<&str> {
    block
        .spans
        .first()
        .filter(|span| span.strong)
        .map(|span| span.text.as_str())
}

pub(crate) fn round(text: &str, doc: &Document) -> RoundItems {
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
            _ => "yes",
        };
        let QuestionBlocks {
            context,
            why,
            example,
            options,
        } = question_blocks(doc, &doc.blocks[*index + 1..end_index], answer_line);
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
            why_text: lead_free(doc, why, WHY_LEAD),
            why,
            example_text: lead_free(doc, example, EXAMPLE_LEAD),
            example,
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
    let notes_line = notes.as_ref().map_or(usize::MAX, |(line, _)| *line);
    let settled_groups = settled_groups(doc, notes_line);
    let settled_points = points_of(doc, &settled_groups);
    let (free, settled_comments) = notes
        .as_ref()
        .map(|(_, notes)| split(notes, &settled_points))
        .unzip();
    RoundItems {
        status,
        verdict: block.and_then(|block| verdict(doc, block)),
        block,
        context: context_parts(doc),
        questions,
        settled_groups,
        settled_points,
        notes: free,
        notes_line: notes.map(|(line, _)| line as u32),
        settled_comments: settled_comments.unwrap_or_default(),
    }
}

/// The lead of a question's "Why it matters" paragraph.
const WHY_LEAD: &str = "Why it matters";

/// The lead of a question's example.
const EXAMPLE_LEAD: &str = "Example:";

/// A paragraph's spans without its lead, `lead`, nor the white space and the one ":", "." or "—"
/// after it, its first letter capitalised: empty without the paragraph.
fn lead_free(doc: &Document, block: Option<u32>, lead: &str) -> Vec<Span> {
    let Some(block) = block.map(|id| &doc.blocks[id as usize]) else {
        return Vec::new();
    };
    let text = plain(&block.spans);
    let rest = text.get(lead.len()..).unwrap_or_default().trim_start();
    let rest = rest
        .strip_prefix([':', '.', '—'])
        .unwrap_or(rest)
        .trim_start();
    let mut spans = trimmed(drop_start(&block.spans, text.len() - rest.len()));
    if let Some(first) = spans.first_mut() {
        let mut chars = first.text.chars();
        if let Some(letter) = chars.next() {
            first.text = letter.to_uppercase().chain(chars).collect();
        }
    }
    spans
}

/// A question's top-level blocks before its answer, split into its context, its "Why it matters"
/// and "Example:" paragraphs, and its options.
struct QuestionBlocks {
    context: Vec<u32>,
    why: Option<u32>,
    example: Option<u32>,
    options: Vec<Choice>,
}

fn question_blocks(doc: &Document, blocks: &[Block], answer_line: u32) -> QuestionBlocks {
    let mut parts = QuestionBlocks {
        context: Vec::new(),
        why: None,
        example: None,
        options: Vec::new(),
    };
    for block in blocks {
        if block.parent.is_some() || block.kind == BlockKind::Heading {
            continue;
        }
        if answer_line > 0 && block.start_line >= answer_line {
            continue;
        }
        let choices = choices(doc, block);
        let paragraph = (block.kind == BlockKind::Paragraph).then(|| plain(&block.spans));
        let starts = |start: &str| {
            paragraph
                .as_ref()
                .is_some_and(|text| text.starts_with(start))
        };
        if parts.why.is_none() && starts(WHY_LEAD) {
            parts.why = Some(block.id);
        } else if parts.example.is_none() && starts(EXAMPLE_LEAD) {
            parts.example = Some(block.id);
        } else if choices.is_empty() {
            parts.context.push(block.id);
        } else {
            parts.options.extend(choices);
        }
    }
    parts
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
