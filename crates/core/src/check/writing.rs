//! The writing limits of a round of questions waiting for the human, as warnings: the block's
//! counts and length, and the length of the agent's sentences. They do not fail the check.

use std::collections::HashSet;

use super::File;
use crate::files::document::{Block, BlockKind, Document, Span};
use crate::files::items::{RoundItems, round};
use crate::workspace::Problem;

/// The most words a sentence holds.
pub const SENTENCE_WORDS: usize = 25;

/// The most items the block holds.
pub const BLOCK_ITEMS: usize = 7;

/// Warns when a waiting round's writing drifts from the limits: its block's counts differ from the
/// round's (`block.count`), its block holds more than `BLOCK_ITEMS` items (`block.items`), or a
/// sentence of the agent's runs over `SENTENCE_WORDS` words (`writing.sentence`).
pub(crate) fn check_writing(file: &File<'_>, document: &Document, problems: &mut Vec<Problem>) {
    let items = round(file.text, document);
    if let Some(block) = items.block {
        check_block(file, document, &items, block, problems);
    }
    check_sentences(file, document, &items, problems);
}

/// The block's counts, read from its first paragraph, and its number of items.
fn check_block(
    file: &File<'_>,
    document: &Document,
    items: &RoundItems,
    block: u32,
    problems: &mut Vec<Problem>,
) {
    let children: Vec<&Block> = document.children(block).collect();
    if let Some(first) = children.iter().find(|b| b.kind == BlockKind::Paragraph) {
        let follow_ups = items
            .questions
            .iter()
            .filter(|q| q.parent.is_some())
            .count();
        let questions = items.questions.len() - follow_ups;
        let line = Some(first.start_line as usize);
        for (noun, said, has) in said_counts(&document.text(first.id), questions, follow_ups) {
            let noun = if said == 1 {
                noun.to_string()
            } else {
                format!("{noun}s")
            };
            problems.push(file.warning(
                line,
                "block.count",
                format!("the block says {said} {noun}, the round has {has}"),
            ));
        }
    }
    let listed: Vec<&Block> = children
        .iter()
        .filter(|b| b.kind == BlockKind::List)
        .flat_map(|list| document.children(list.id))
        .filter(|b| b.kind == BlockKind::Item)
        .collect();
    if let Some(over) = listed.get(BLOCK_ITEMS) {
        problems.push(file.warning(
            Some(over.start_line as usize),
            "block.items",
            format!(
                "the block has {} items: keep at most {BLOCK_ITEMS}",
                listed.len()
            ),
        ));
    }
}

/// The counts a block's first line gives that differ from the round's, as (noun, said, has). A
/// line that gives no count of questions in digits is not compared, and one that gives no count of
/// follow-ups says 0 (R3).
fn said_counts(
    first_line: &str,
    questions: usize,
    follow_ups: usize,
) -> Vec<(&'static str, usize, usize)> {
    let words: Vec<&str> = first_line.split_whitespace().collect();
    let count = |nouns: [&str; 2]| {
        words.windows(2).find_map(|pair| {
            let noun = pair[1].trim_end_matches(|c: char| !c.is_alphanumeric());
            nouns
                .contains(&noun)
                .then(|| pair[0].parse::<usize>().ok())
                .flatten()
        })
    };
    let Some(said_questions) = count(["question", "questions"]) else {
        return Vec::new();
    };
    let said_follow_ups = count(["follow-up", "follow-ups"]).unwrap_or(0);
    [
        ("question", said_questions, questions),
        ("follow-up", said_follow_ups, follow_ups),
    ]
    .into_iter()
    .filter(|(_, said, has)| said != has)
    .collect()
}

/// The blocks whose sentences are measured, with what they hold (R2): the block, the Context, the
/// questions' context, "Why it matters", and the options, and the settled points. The headings,
/// the answers, and the notes are outside them.
fn measured_roots(items: &RoundItems) -> HashSet<u32> {
    let mut roots: HashSet<u32> = items.block.into_iter().collect();
    roots.extend(items.context.iter().flat_map(|part| part.blocks.iter()));
    for question in &items.questions {
        roots.extend(&question.context);
        roots.extend(question.why);
        roots.extend(question.options.iter().map(|option| option.block));
    }
    roots.extend(items.settled_groups.iter().flat_map(|g| g.blocks.iter()));
    roots
}

/// Whether a block is inside a measured root, outside any quote, table, code, or HTML: a callout
/// other than the round's block reads as a quote.
fn is_measured(
    document: &Document,
    roots: &HashSet<u32>,
    round_block: Option<u32>,
    block: &Block,
) -> bool {
    let mut current = Some(block);
    while let Some(block) = current {
        if round_block == Some(block.id) {
            return true;
        }
        if matches!(
            block.kind,
            BlockKind::Quote
                | BlockKind::Callout
                | BlockKind::Table
                | BlockKind::Row
                | BlockKind::Cell
                | BlockKind::Code
                | BlockKind::Html
        ) {
            return false;
        }
        if roots.contains(&block.id) {
            return true;
        }
        current = block.parent.and_then(|id| document.blocks.get(id as usize));
    }
    false
}

/// Every sentence over `SENTENCE_WORDS` words of the measured paragraphs and items, on the line it
/// starts on.
fn check_sentences(
    file: &File<'_>,
    document: &Document,
    items: &RoundItems,
    problems: &mut Vec<Problem>,
) {
    let roots = measured_roots(items);
    let lines: Vec<&str> = file.text.split('\n').collect();
    for block in &document.blocks {
        let prose = matches!(block.kind, BlockKind::Paragraph | BlockKind::Item);
        if !prose || !is_measured(document, &roots, items.block, block) {
            continue;
        }
        let mut cursor = Cursor {
            line: block.start_line as usize,
            offset: 0,
            last: block.end_line as usize,
        };
        for sentence in sentences(&measured_text(&block.spans)) {
            let line = cursor.find(&lines, sentence.first().copied().unwrap_or_default());
            let words = sentence.iter().filter(|w| is_word(w)).count();
            if words > SENTENCE_WORDS {
                problems.push(file.warning(
                    Some(line),
                    "writing.sentence",
                    format!("a sentence of {words} words: split it at {SENTENCE_WORDS}"),
                ));
            }
        }
    }
}

/// The text of spans that is measured: links' text, code, and images count for nothing.
fn measured_text(spans: &[Span]) -> String {
    spans
        .iter()
        .map(|span| {
            if span.code || span.link.is_some() || span.image.is_some() {
                " "
            } else {
                span.text.as_str()
            }
        })
        .collect()
}

/// A text's sentences, as their words: a sentence ends at a word ending in `.`, `!`, or `?`,
/// closing quotes and brackets aside.
fn sentences(text: &str) -> Vec<Vec<&str>> {
    let mut found = Vec::new();
    let mut current = Vec::new();
    for word in text.split_whitespace() {
        current.push(word);
        let bare = word.trim_end_matches(['"', '\'', ')', ']', '*', '_', '\u{201d}', '\u{2019}']);
        if bare.ends_with(['.', '!', '?']) {
            found.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        found.push(current);
    }
    found
}

/// Whether a token is a word: it holds a letter or a digit, so a dash is not one.
fn is_word(token: &str) -> bool {
    token.chars().any(char::is_alphanumeric)
}

/// Where the search for the next sentence starts in a block's lines, from 1.
struct Cursor {
    line: usize,
    offset: usize,
    last: usize,
}

impl Cursor {
    /// The line of the first match of a sentence's first word, at or after the cursor, which moves
    /// past it; the cursor's line when it is not found.
    fn find(&mut self, lines: &[&str], word: &str) -> usize {
        let needle = word.trim_matches(|c: char| !c.is_alphanumeric());
        if needle.is_empty() {
            return self.line;
        }
        for line in self.line..=self.last.min(lines.len()) {
            let from = if line == self.line { self.offset } else { 0 };
            let found = lines[line - 1]
                .get(from..)
                .and_then(|rest| rest.find(needle));
            if let Some(at) = found {
                self.line = line;
                self.offset = from + at + needle.len();
                return line;
            }
        }
        self.line
    }
}
