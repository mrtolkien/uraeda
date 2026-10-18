//! A spec's parts, cut by their level-2 headings, and what each part holds: the block, the answers
//! to the last review, the listed decisions, the edge cases, the architecture's units and
//! tradeoffs, and the constitution's principles.

use crate::files::document::{Block, BlockKind, Document, plain};
use crate::files::items::{EdgeCase, ListedDecision, Principle, ReviewAnswer, SpecPart};

/// Each top-level level-2 heading, with its top-level blocks up to the next level-1 or level-2
/// heading. A heading in a quote or a callout is the quote's, and starts nothing.
pub(super) fn parts(doc: &Document) -> Vec<SpecPart> {
    let mut parts: Vec<SpecPart> = Vec::new();
    let mut open = false;
    for block in doc.blocks.iter().filter(|b| b.parent.is_none()) {
        let level = block.level.unwrap_or(1);
        if block.kind == BlockKind::Heading && level <= 2 {
            open = level == 2;
            if open {
                parts.push(SpecPart {
                    title: plain(&block.spans),
                    anchor: block.anchor.clone().unwrap_or_default(),
                    heading: block.id,
                    blocks: Vec::new(),
                });
            }
        } else if open && let Some(part) = parts.last_mut() {
            part.blocks.push(block.id);
        }
    }
    parts
}

/// The blocks of the part titled `title`, or none.
pub(super) fn part<'a>(parts: &'a [SpecPart], title: &str) -> &'a [u32] {
    parts
        .iter()
        .find(|part| part.title == title)
        .map_or(&[], |part| part.blocks.as_slice())
}

/// The items of the top-level lists among `blocks`, in order.
fn items<'a>(doc: &'a Document, blocks: &[u32]) -> Vec<&'a Block> {
    blocks
        .iter()
        .filter(|&&id| doc.blocks[id as usize].kind == BlockKind::List)
        .flat_map(|&list| doc.children(list))
        .collect()
}

/// The block, the first top-level callout before the first level-2 heading; its time, the number
/// before "minutes" in its first paragraph; and its first list item starting "You approve".
pub(super) fn block(doc: &Document) -> (Option<u32>, Option<u32>, Option<u32>) {
    let callout = doc
        .blocks
        .iter()
        .filter(|b| b.parent.is_none())
        .take_while(|b| b.kind != BlockKind::Heading || b.level != Some(2))
        .find(|b| b.kind == BlockKind::Callout);
    let Some(callout) = callout else {
        return (None, None, None);
    };
    let children: Vec<u32> = doc.children(callout.id).map(|b| b.id).collect();
    let minutes = children
        .iter()
        .find(|&&id| doc.blocks[id as usize].kind == BlockKind::Paragraph)
        .and_then(|&id| {
            let text = doc.text(id);
            let words: Vec<&str> = text.split_whitespace().collect();
            let at = words.iter().position(|w| w.starts_with("minutes"))?;
            words.get(at.checked_sub(1)?)?.parse().ok()
        });
    let approve = items(doc, &children)
        .into_iter()
        .find(|item| plain(&item.spans).starts_with("You approve"))
        .map(|item| item.id);
    (Some(callout.id), minutes, approve)
}

/// The items of `## Your review` opening with a bold `C<n>`, then the comment in a few words in
/// parentheses, a colon, and `done` or `declined`.
pub(super) fn answers(doc: &Document, blocks: &[u32]) -> Vec<ReviewAnswer> {
    items(doc, blocks).into_iter().filter_map(answer).collect()
}

/// The items of `## Your review` that `answers` does not read.
pub(super) fn unread_answers(doc: &Document, blocks: &[u32]) -> Vec<u32> {
    unread(items(doc, blocks), |item| answer(item).is_some())
}

fn answer(item: &Block) -> Option<ReviewAnswer> {
    let (first, rest) = item.spans.split_first()?;
    let number = first
        .strong
        .then(|| first.text.trim().strip_prefix('C'))??
        .parse()
        .ok()?;
    let rest = plain(rest);
    let rest = rest.trim_start().strip_prefix('(')?;
    rest.match_indices("):").find_map(|(at, _)| {
        let verdict = ["done", "declined"]
            .into_iter()
            .find(|v| word_starts(rest[at + 2..].trim_start(), v))?;
        Some(ReviewAnswer {
            number,
            summary: rest[..at].trim().to_string(),
            verdict: verdict.to_string(),
            block: item.id,
        })
    })
}

/// The ids of the `items` that `reads` refuses.
fn unread(items: Vec<&Block>, reads: impl Fn(&Block) -> bool) -> Vec<u32> {
    items
        .into_iter()
        .filter(|item| !reads(item))
        .map(|item| item.id)
        .collect()
}

/// Whether `text` starts with the word `word`.
fn word_starts(text: &str, word: &str) -> bool {
    text.strip_prefix(word)
        .is_some_and(|rest| !rest.starts_with(|c: char| c.is_alphanumeric()))
}

/// The items of `## Decisions` opening with a bold "New:", "Changed:", or "Removed:", each
/// decision once, at its first item. A new or changed one is named by its link, kept only when it
/// points into the decisions folder; a removed one by its file name, in code.
pub(super) fn decisions(doc: &Document, blocks: &[u32]) -> Vec<ListedDecision> {
    let mut listed: Vec<ListedDecision> = Vec::new();
    for item in items(doc, blocks) {
        let Some(found) = listed_decision(item) else {
            continue;
        };
        if !listed.iter().any(|d| d.name == found.name) {
            listed.push(found);
        }
    }
    listed
}

/// The items of `## Decisions` that `decisions` does not read.
pub(super) fn unread_decisions(doc: &Document, blocks: &[u32]) -> Vec<u32> {
    unread(items(doc, blocks), |item| listed_decision(item).is_some())
}

fn listed_decision(item: &Block) -> Option<ListedDecision> {
    let first = item.spans.first().filter(|s| s.strong)?;
    let (kind, after) = first.text.split_once(':')?;
    let kind = kind.trim().to_lowercase();
    let (name, title) = match kind.as_str() {
        "new" | "changed" => {
            let link = item.spans.iter().find_map(|s| s.link.as_ref())?;
            let title: String = item
                .spans
                .iter()
                .filter(|s| s.link.as_ref() == Some(link))
                .map(|s| s.text.as_str())
                .collect();
            (decision_name(link.path.as_deref()?)?, title)
        }
        "removed" => {
            let strong: String = item
                .spans
                .iter()
                .take_while(|s| s.strong)
                .map(|s| s.text.as_str())
                .collect();
            let title = strong.split_once(':').map_or(after, |(_, title)| title);
            let file = item.spans.iter().find(|s| s.code)?;
            (
                file.text.trim().strip_suffix(".md")?.to_string(),
                title.to_string(),
            )
        }
        _ => return None,
    };
    Some(ListedDecision {
        kind,
        name,
        title: title.trim().to_string(),
        block: item.id,
    })
}

/// The stem of a decision's file, `specs/decisions/<name>.md`, wherever the `specs/` folder is.
fn decision_name(path: &str) -> Option<String> {
    let mut parts = path.rsplit('/');
    let name = parts.next()?.strip_suffix(".md")?;
    (parts.next() == Some("decisions") && parts.next() == Some("specs")).then(|| name.to_string())
}

/// The rows of the first table among `blocks`, each with its cells' text.
fn table_rows<'a>(doc: &'a Document, blocks: &[u32]) -> Vec<(&'a Block, Vec<String>)> {
    let Some(&table) = blocks
        .iter()
        .find(|&&id| doc.blocks[id as usize].kind == BlockKind::Table)
    else {
        return Vec::new();
    };
    doc.children(table)
        .map(|row| {
            let cells = doc.children(row.id).map(|c| plain(&c.spans)).collect();
            (row, cells)
        })
        .collect()
}

/// The rows of the edge cases' table, its header aside, by their first cell, lowercased.
pub(super) fn edges(doc: &Document, blocks: &[u32]) -> Vec<EdgeCase> {
    table_rows(doc, blocks)
        .into_iter()
        .filter(|(row, _)| row.header != Some(true))
        .map(|(row, cells)| EdgeCase {
            importance: cells
                .first()
                .map(|c| c.trim().to_lowercase())
                .unwrap_or_default(),
            row: row.id,
        })
        .collect()
}

/// The architecture's units, its bold-led items before the paragraph "Tradeoffs:", and its
/// tradeoffs, the items after it.
pub(super) fn architecture(doc: &Document, blocks: &[u32]) -> (Vec<u32>, Vec<u32>) {
    let split = blocks
        .iter()
        .position(|&id| doc.text(id).trim() == "Tradeoffs:")
        .unwrap_or(blocks.len());
    let units = items(doc, &blocks[..split])
        .into_iter()
        .filter(|item| item.spans.first().is_some_and(|s| s.strong))
        .map(|item| item.id)
        .collect();
    let tradeoffs = items(doc, &blocks[split..])
        .into_iter()
        .map(|item| item.id)
        .collect();
    (units, tradeoffs)
}

/// The constitution check's principles: each header cell, ok when its cell below holds ✅.
pub(super) fn principles(doc: &Document, blocks: &[u32]) -> Vec<Principle> {
    let rows = table_rows(doc, blocks);
    let Some((_, labels)) = rows.iter().find(|(row, _)| row.header == Some(true)) else {
        return Vec::new();
    };
    let marks = rows
        .iter()
        .find(|(row, _)| row.header != Some(true))
        .map(|(_, cells)| cells.clone())
        .unwrap_or_default();
    labels
        .iter()
        .enumerate()
        .map(|(index, label)| Principle {
            label: label.trim().to_string(),
            ok: marks.get(index).is_some_and(|mark| mark.contains('✅')),
        })
        .collect()
}
