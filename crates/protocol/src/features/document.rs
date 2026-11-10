//! The core's document tree, as the core writes it: the blocks of one workflow file, their
//! spans, and what its paragraphs embed. A client draws a document from it, and never parses
//! Markdown.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// The tree of one workflow file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub blocks: Vec<Block>,
    pub frontmatter_lines: Option<LineRange>,
    /// The SHA-256 of the text, in hexadecimal, to refuse saves over a change made elsewhere.
    pub hash: String,
}

/// A block, its place in the tree, its lines, and the fields of its kind.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
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

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
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

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum CalloutKind {
    Note,
    Tip,
    Important,
    Warning,
    Caution,
    Question,
}

/// What a list item is, from its marker: a task, a typed bullet (`[pro]`, `[con]`, `[?]`, `[!]`),
/// or a list callout (`!`, `?`, `&`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
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

/// Lines of a file, 1-based and inclusive.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

/// A run of text with the same marks. An image's span holds its alt text.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Span {
    pub text: String,
    pub strong: bool,
    pub emphasis: bool,
    pub code: bool,
    pub strike: bool,
    pub link: Option<SpanLink>,
    pub image: Option<SpanImage>,
}

/// A link of a span: its target as written, and the file it points to in the repository.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SpanLink {
    pub target: String,
    pub wiki: bool,
    /// The file from the repository's top level; absent for a web link, a URI, or an anchor in
    /// the page.
    pub path: Option<String>,
    /// The story it names, when it is a story link.
    pub story: Option<StoryTarget>,
    /// The part of its target after `#`, when not empty: a heading of the file it opens.
    pub anchor: Option<String>,
}

/// An image of a span: its target as written, and the file it shows in the repository.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SpanImage {
    pub target: String,
    /// The file from the repository's top level; absent for an image on the web or in a URI,
    /// such as `data:`.
    pub path: Option<String>,
}

/// The story a link names.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StoryTarget {
    /// The stories file, from the repository's top level.
    pub path: String,
    /// The export's name.
    pub export: String,
}

/// A paragraph that embeds a story.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StoryLink {
    /// The stories file, from the repository's top level.
    pub path: String,
    /// The export's name.
    pub export: String,
    /// The link's text.
    pub label: String,
    /// The paragraph's block.
    pub block: u32,
}

/// A paragraph that embeds an HTML mockup.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MockupEmbed {
    /// The mockup's page, from the repository's top level, without its query or anchor.
    pub path: String,
    /// The link's anchor, after its `#`.
    pub anchor: Option<String>,
    /// The link's query, after its `?` and before its `#`, as written, `w` included: the state the
    /// page shows, as `doc=plan&w=1440`.
    pub query: Option<String>,
    /// The width it shows at, in pixels: its `?w=` query's, or 1440.
    pub width: u32,
    /// The link's text.
    pub label: String,
    /// The paragraph's block.
    pub block: u32,
}
