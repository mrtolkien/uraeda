//! The document tree of a workflow file: its blocks in source order, each with its lines, and the
//! spans of their text, sent flat so napi-rs can generate their types. The UI draws it without
//! parsing markdown (see `specs/decisions/stack.md`).

#[cfg(feature = "napi")]
use napi_derive::napi;
use pulldown_cmark::{
    Alignment, BlockQuoteKind, CodeBlockKind, Event, HeadingLevel, LinkType, Parser, Tag, TagEnd,
};
use serde::Serialize;
use sha2::{Digest, Sha256};

use super::markdown::{Lines, options, slug};
use crate::workspace::resolve;

/// Lines of a file, 1-based and inclusive.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

#[cfg_attr(feature = "napi", napi(string_enum = "kebab-case"))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum BlockKind {
    Heading,
    Paragraph,
    List,
    Item,
    Callout,
    Quote,
    Table,
    Row,
    Cell,
    Code,
    Rule,
    Html,
}

impl BlockKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            BlockKind::Heading => "heading",
            BlockKind::Paragraph => "paragraph",
            BlockKind::List => "list",
            BlockKind::Item => "item",
            BlockKind::Callout => "callout",
            BlockKind::Quote => "quote",
            BlockKind::Table => "table",
            BlockKind::Row => "row",
            BlockKind::Cell => "cell",
            BlockKind::Code => "code",
            BlockKind::Rule => "rule",
            BlockKind::Html => "html",
        }
    }
}

/// What a list item is, from its marker: a task, a typed bullet (`[pro]`, `[con]`, `[?]`, `[!]`),
/// or a list callout (`!`, `?`, `&`).
#[cfg_attr(feature = "napi", napi(string_enum = "kebab-case"))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ItemMarker {
    Plain,
    Task,
    Pro,
    Con,
    Question,
    Important,
    Warning,
    Ask,
    Note,
}

#[cfg_attr(feature = "napi", napi(string_enum = "kebab-case"))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CalloutKind {
    Note,
    Tip,
    Important,
    Warning,
    Caution,
    Question,
}

/// A link of a span: its target as written, and the file it points to in the repository.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpanLink {
    pub target: String,
    pub wiki: bool,
    /// The file from the repository's top level, `None` for a web link or an anchor in the page.
    pub path: Option<String>,
}

/// A run of text with the same marks.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Span {
    pub text: String,
    pub strong: bool,
    pub emphasis: bool,
    pub code: bool,
    pub strike: bool,
    pub link: Option<SpanLink>,
}

/// A block, its place in the tree, its lines, and the fields of its kind.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Block {
    /// Its index in the document's blocks.
    pub id: u32,
    pub parent: Option<u32>,
    pub kind: BlockKind,
    pub start_line: u32,
    pub end_line: u32,
    /// The text of the nearest heading at or above its first line, for review anchors.
    pub heading: Option<String>,
    /// A heading's level.
    pub level: Option<u32>,
    /// A heading's anchor, numbered like GitHub's when several share a slug.
    pub anchor: Option<String>,
    /// The text of a heading, a paragraph, a cell, an item's own text, or a callout's title.
    pub spans: Vec<Span>,
    /// A list's kind, and the number of its first item.
    pub ordered: Option<bool>,
    pub start: Option<u32>,
    pub marker: Option<ItemMarker>,
    /// A task's checkbox.
    pub checked: Option<bool>,
    pub callout_kind: Option<CalloutKind>,
    /// Whether a row is the table's header.
    pub header: Option<bool>,
    /// A cell's alignment: `left`, `center`, `right`, or `None`.
    pub align: Option<String>,
    /// A code block's language.
    pub language: Option<String>,
    /// A code block's or an HTML block's text, shown as text.
    pub text: Option<String>,
}

/// The tree of one workflow file.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub blocks: Vec<Block>,
    pub frontmatter_lines: Option<LineRange>,
    /// The SHA-256 of the text, in hexadecimal, to refuse saves over a change made elsewhere.
    pub hash: String,
}

impl Document {
    /// The ids of a block's children, in order.
    pub fn children(&self, id: u32) -> impl Iterator<Item = &Block> {
        self.blocks
            .iter()
            .filter(move |block| block.parent == Some(id))
    }

    /// The plain text of a block's spans.
    pub fn text(&self, id: u32) -> String {
        self.blocks
            .get(id as usize)
            .map(|block| plain(&block.spans))
            .unwrap_or_default()
    }
}

/// The plain text of spans.
pub fn plain(spans: &[Span]) -> String {
    spans.iter().map(|span| span.text.as_str()).collect()
}

/// The SHA-256 of a text, in hexadecimal.
pub fn hash(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}

fn block(id: u32, parent: Option<u32>, kind: BlockKind, start: u32, end: u32) -> Block {
    Block {
        id,
        parent,
        kind,
        start_line: start,
        end_line: end,
        heading: None,
        level: None,
        anchor: None,
        spans: Vec::new(),
        ordered: None,
        start: None,
        marker: None,
        checked: None,
        callout_kind: None,
        header: None,
        align: None,
        language: None,
        text: None,
    }
}

/// The marks in effect while reading inline text.
#[derive(Default, Clone)]
struct Marks {
    strong: u32,
    emphasis: u32,
    strike: u32,
    link: Option<SpanLink>,
}

struct Builder<'a> {
    text: &'a str,
    dir: &'a str,
    lines: Lines,
    blocks: Vec<Block>,
    /// Open blocks, innermost last.
    open: Vec<u32>,
    /// The block whose spans inline text goes to.
    target: Option<u32>,
    marks: Marks,
    /// The alignments of the table being read, and the column of the next cell.
    alignments: Vec<Alignment>,
    column: usize,
    /// Each item's first paragraph, which becomes the item's own text.
    item_paragraph: Vec<(u32, bool)>,
    /// Whether the text of a `> [!QUESTION]` marker is being skipped.
    question_marker: bool,
}

impl Builder<'_> {
    fn lines_of(&self, range: &std::ops::Range<usize>) -> (u32, u32) {
        let slice = &self.text[range.clone()];
        let end = range.start + slice.trim_end().len();
        let start_line = self.lines.of(range.start) as u32;
        let end_line = self.lines.of(end.saturating_sub(1).max(range.start)) as u32;
        (start_line, end_line.max(start_line))
    }

    fn push(&mut self, kind: BlockKind, range: &std::ops::Range<usize>) -> u32 {
        let (start, end) = self.lines_of(range);
        let id = self.blocks.len() as u32;
        self.blocks
            .push(block(id, self.open.last().copied(), kind, start, end));
        self.open.push(id);
        id
    }

    fn close(&mut self) {
        self.open.pop();
    }

    fn span(&mut self, text: &str, code: bool) {
        let Some(target) = self.target else {
            return;
        };
        let marks = self.marks.clone();
        let spans = &mut self.blocks[target as usize].spans;
        if let Some(last) = spans.last_mut()
            && !code
            && !last.code
            && last.strong == (marks.strong > 0)
            && last.emphasis == (marks.emphasis > 0)
            && last.strike == (marks.strike > 0)
            && last.link == marks.link
        {
            last.text.push_str(text);
            return;
        }
        spans.push(Span {
            text: text.to_string(),
            strong: marks.strong > 0,
            emphasis: marks.emphasis > 0,
            code,
            strike: marks.strike > 0,
            link: marks.link,
        });
    }

    fn link(&self, target: &str, wiki: bool) -> SpanLink {
        let path = if wiki || target.starts_with('#') {
            None
        } else {
            resolve(self.dir, target)
        };
        SpanLink {
            target: target.to_string(),
            wiki,
            path,
        }
    }
}

const TYPED: [(&str, ItemMarker); 7] = [
    ("[pro] ", ItemMarker::Pro),
    ("[con] ", ItemMarker::Con),
    ("[?] ", ItemMarker::Question),
    ("[!] ", ItemMarker::Important),
    ("! ", ItemMarker::Warning),
    ("? ", ItemMarker::Ask),
    ("& ", ItemMarker::Note),
];

/// Reads an item's typed bullet or list callout from the start of its text, and removes it.
fn item_marker(item: &mut Block) {
    if item.marker == Some(ItemMarker::Task) {
        return;
    }
    let Some(first) = item.spans.first_mut() else {
        item.marker = Some(ItemMarker::Plain);
        return;
    };
    let found = (!first.code && !first.strong)
        .then(|| {
            TYPED
                .iter()
                .find(|(prefix, _)| first.text.starts_with(prefix))
        })
        .flatten();
    match found {
        Some((prefix, marker)) => {
            first.text.drain(..prefix.len());
            if first.text.is_empty() {
                item.spans.remove(0);
            }
            item.marker = Some(*marker);
        }
        None => item.marker = Some(ItemMarker::Plain),
    }
}

fn callout_kind(kind: BlockQuoteKind) -> CalloutKind {
    match kind {
        BlockQuoteKind::Note => CalloutKind::Note,
        BlockQuoteKind::Tip => CalloutKind::Tip,
        BlockQuoteKind::Important => CalloutKind::Important,
        BlockQuoteKind::Warning => CalloutKind::Warning,
        BlockQuoteKind::Caution => CalloutKind::Caution,
    }
}

fn level(level: HeadingLevel) -> u32 {
    level as u32
}

/// Turns a file's text into its document tree. `dir` is the folder holding the file, from the
/// repository's top level, to resolve its links.
pub fn parse(text: &str, dir: &str) -> Document {
    let mut builder = Builder {
        text,
        dir,
        lines: Lines::new(text),
        blocks: Vec::new(),
        open: Vec::new(),
        target: None,
        marks: Marks::default(),
        alignments: Vec::new(),
        column: 0,
        item_paragraph: Vec::new(),
        question_marker: false,
    };
    let mut frontmatter_lines = None;
    let mut in_metadata = false;
    for (event, range) in Parser::new_ext(text, options()).into_offset_iter() {
        match event {
            Event::Start(Tag::MetadataBlock(_)) => {
                in_metadata = true;
                let (start, end) = builder.lines_of(&range);
                frontmatter_lines = Some(LineRange { start, end });
            }
            Event::End(TagEnd::MetadataBlock(_)) => in_metadata = false,
            _ if in_metadata => {}
            Event::Start(Tag::Heading { level: l, .. }) => {
                let id = builder.push(BlockKind::Heading, &range);
                builder.blocks[id as usize].level = Some(level(l));
                builder.target = Some(id);
            }
            Event::End(TagEnd::Heading(_)) => {
                builder.target = None;
                builder.close();
            }
            Event::Start(Tag::Paragraph) => {
                // An item's first paragraph is the item's own text.
                if let Some((item, false)) = builder.item_paragraph.last().copied()
                    && builder.open.last() == Some(&item)
                {
                    builder.item_paragraph.last_mut().unwrap().1 = true;
                    builder.target = Some(item);
                    builder.open.push(u32::MAX);
                    continue;
                }
                let quote_start = builder.open.last().and_then(|&id| {
                    let block = builder.blocks.get(id as usize)?;
                    (block.kind == BlockKind::Quote
                        && builder.children_count(id) == 0
                        && is_question_marker(text, &range))
                    .then_some(id)
                });
                if let Some(quote) = quote_start {
                    let block = &mut builder.blocks[quote as usize];
                    block.kind = BlockKind::Callout;
                    block.callout_kind = Some(CalloutKind::Question);
                    builder.question_marker = true;
                    builder.target = Some(quote);
                    builder.open.push(u32::MAX);
                    continue;
                }
                let id = builder.push(BlockKind::Paragraph, &range);
                builder.target = Some(id);
            }
            Event::End(TagEnd::Paragraph) => {
                if let Some(&id) = builder.open.last()
                    && let Some(block) = builder.blocks.get_mut(id as usize)
                    && block.kind == BlockKind::Paragraph
                {
                    let (_, end) = builder.lines_of(&range);
                    builder.blocks[id as usize].end_line = end;
                }
                builder.target = None;
                builder.question_marker = false;
                builder.close();
            }
            Event::Start(Tag::List(first)) => {
                let id = builder.push(BlockKind::List, &range);
                let block = &mut builder.blocks[id as usize];
                block.ordered = Some(first.is_some());
                block.start = first.map(|n| n as u32);
            }
            Event::End(TagEnd::List(_)) => builder.close(),
            Event::Start(Tag::Item) => {
                let id = builder.push(BlockKind::Item, &range);
                builder.item_paragraph.push((id, false));
                builder.target = Some(id);
            }
            Event::End(TagEnd::Item) => {
                if let Some((item, _)) = builder.item_paragraph.pop() {
                    item_marker(&mut builder.blocks[item as usize]);
                }
                builder.target = None;
                builder.close();
            }
            Event::TaskListMarker(checked) => {
                if let Some((item, _)) = builder.item_paragraph.last().copied() {
                    let block = &mut builder.blocks[item as usize];
                    block.marker = Some(ItemMarker::Task);
                    block.checked = Some(checked);
                }
            }
            Event::Start(Tag::BlockQuote(kind)) => {
                let id = builder.push(BlockKind::Quote, &range);
                if let Some(kind) = kind {
                    let block = &mut builder.blocks[id as usize];
                    block.kind = BlockKind::Callout;
                    block.callout_kind = Some(callout_kind(kind));
                }
                builder.target = None;
            }
            Event::End(TagEnd::BlockQuote(_)) => builder.close(),
            Event::Start(Tag::CodeBlock(kind)) => {
                let id = builder.push(BlockKind::Code, &range);
                let block = &mut builder.blocks[id as usize];
                block.language = match kind {
                    CodeBlockKind::Fenced(info) => info
                        .split_whitespace()
                        .next()
                        .map(String::from)
                        .filter(|l| !l.is_empty()),
                    CodeBlockKind::Indented => None,
                };
                block.text = Some(String::new());
                builder.target = None;
            }
            Event::End(TagEnd::CodeBlock) => builder.close(),
            Event::Start(Tag::HtmlBlock) => {
                let id = builder.push(BlockKind::Html, &range);
                builder.blocks[id as usize].text = Some(String::new());
            }
            Event::End(TagEnd::HtmlBlock) => builder.close(),
            Event::Start(Tag::Table(alignments)) => {
                builder.push(BlockKind::Table, &range);
                builder.alignments = alignments;
            }
            Event::End(TagEnd::Table) => builder.close(),
            Event::Start(Tag::TableHead) => {
                let id = builder.push(BlockKind::Row, &range);
                builder.blocks[id as usize].header = Some(true);
                builder.column = 0;
            }
            Event::Start(Tag::TableRow) => {
                let id = builder.push(BlockKind::Row, &range);
                builder.blocks[id as usize].header = Some(false);
                builder.column = 0;
            }
            Event::End(TagEnd::TableHead | TagEnd::TableRow) => builder.close(),
            Event::Start(Tag::TableCell) => {
                let id = builder.push(BlockKind::Cell, &range);
                let align = match builder.alignments.get(builder.column) {
                    Some(Alignment::Left) => Some("left"),
                    Some(Alignment::Center) => Some("center"),
                    Some(Alignment::Right) => Some("right"),
                    _ => None,
                };
                builder.blocks[id as usize].align = align.map(String::from);
                builder.column += 1;
                builder.target = Some(id);
            }
            Event::End(TagEnd::TableCell) => {
                builder.target = None;
                builder.close();
            }
            Event::Rule => {
                builder.push(BlockKind::Rule, &range);
                builder.close();
            }
            Event::Start(Tag::Strong) => builder.marks.strong += 1,
            Event::End(TagEnd::Strong) => builder.marks.strong -= 1,
            Event::Start(Tag::Emphasis) => builder.marks.emphasis += 1,
            Event::End(TagEnd::Emphasis) => builder.marks.emphasis -= 1,
            Event::Start(Tag::Strikethrough) => builder.marks.strike += 1,
            Event::End(TagEnd::Strikethrough) => builder.marks.strike -= 1,
            Event::Start(Tag::Link {
                link_type,
                dest_url,
                ..
            }) => {
                let wiki = matches!(link_type, LinkType::WikiLink { .. });
                builder.marks.link = Some(builder.link(&dest_url, wiki));
            }
            Event::End(TagEnd::Link) => builder.marks.link = None,
            Event::Text(part) => {
                if let Some(&id) = builder.open.last()
                    && let Some(block) = builder.blocks.get_mut(id as usize)
                    && matches!(block.kind, BlockKind::Code | BlockKind::Html)
                {
                    block.text.get_or_insert_default().push_str(&part);
                    continue;
                }
                if builder.question_marker {
                    // The marker line's own text, then the callout's title on the same line.
                    let rest = strip_question_marker(&part);
                    if let Some(rest) = rest {
                        if !rest.trim().is_empty() {
                            builder.span(rest.trim_start(), false);
                        }
                        continue;
                    }
                }
                builder.span(&part, false);
            }
            Event::Code(part) => builder.span(&part, true),
            Event::Html(part) => {
                if let Some(&id) = builder.open.last()
                    && let Some(block) = builder.blocks.get_mut(id as usize)
                    && block.kind == BlockKind::Html
                {
                    block.text.get_or_insert_default().push_str(&part);
                }
            }
            Event::InlineHtml(part) => builder.span(&part, false),
            Event::SoftBreak => {
                if builder.question_marker {
                    // The question callout's body starts on the line after its marker.
                    builder.question_marker = false;
                    builder.open.pop();
                    let line = builder.lines.of(range.end) as u32;
                    let id = builder.blocks.len() as u32;
                    builder.blocks.push(block(
                        id,
                        builder.open.last().copied(),
                        BlockKind::Paragraph,
                        line,
                        line,
                    ));
                    builder.open.push(id);
                    builder.target = Some(id);
                    continue;
                }
                builder.span(" ", false);
            }
            Event::HardBreak => builder.span("\n", false),
            _ => {}
        }
    }
    let mut blocks = builder.blocks;
    // Empty items keep their marker; trailing spaces of item text go.
    let mut current: Option<String> = None;
    let mut taken: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    let mut order: Vec<usize> = (0..blocks.len()).collect();
    order.sort_by_key(|&i| (blocks[i].start_line, i));
    for index in order {
        let block = &mut blocks[index];
        if block.kind == BlockKind::Heading {
            let text = plain(&block.spans);
            let base = slug(&text);
            let anchor = match taken.get(&base).copied() {
                None => base.clone(),
                Some(n) => format!("{base}-{n}"),
            };
            *taken.entry(base).or_insert(0) += 1;
            block.anchor = Some(anchor);
            current = Some(text);
        }
        block.heading = current.clone();
        if let Some(last) = block.spans.last_mut() {
            let trimmed = last.text.trim_end().len();
            last.text.truncate(trimmed);
        }
    }
    Document {
        blocks,
        frontmatter_lines,
        hash: hash(text),
    }
}

impl Builder<'_> {
    fn children_count(&self, id: u32) -> usize {
        self.blocks
            .iter()
            .filter(|block| block.parent == Some(id))
            .count()
    }
}

/// Whether a paragraph starts with the `[!QUESTION]` marker, which pulldown-cmark does not know.
fn is_question_marker(text: &str, range: &std::ops::Range<usize>) -> bool {
    text[range.clone()]
        .trim_start()
        .to_ascii_uppercase()
        .starts_with("[!QUESTION]")
}

/// The text after the `[!QUESTION]` marker, when this text holds it, in one piece or split around
/// its brackets.
fn strip_question_marker(part: &str) -> Option<&str> {
    let upper = part.to_ascii_uppercase();
    for marker in ["[!QUESTION]", "!QUESTION]", "!QUESTION", "[", "]"] {
        if upper.trim_start().starts_with(marker) && (marker.len() > 1 || part.trim() == marker) {
            let start = part.len() - part.trim_start().len() + marker.len();
            return Some(&part[start..]);
        }
    }
    None
}
