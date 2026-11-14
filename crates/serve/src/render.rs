//! A workflow file's markdown as HTML, for the round page and the review page: safe, readable
//! without a script, and mapped back to the file's lines, which a review's comments name.
//!
//! What a page relies on:
//!
//! - **Blocks** (`p`, `h1`-`h6`, `li`, `tr`, `pre`, `blockquote`, `aside.callout`, `figure.diagram`,
//!   `img`, `ul`, `ol`, `table`, `hr`, `div.footnote`) carry `data-lines="<start>-<end>"`, their
//!   first and last 1-based lines in the file's whole text, its frontmatter included. Every list
//!   item and every table row has its own; an outer item holds its inner items.
//! - **Lines in a block's text**: in a paragraph, a heading, a tight list item, and a table cell,
//!   the text of each source line sits in a `<span data-line="N">`, N the 1-based line. A soft
//!   break is a `\n` between two spans; an inline element that runs over a line break is closed
//!   at its end and opened again in the next line's span. A selection's lines are the `data-line`
//!   of its first and last span.
//! - **Headings** have an `id`: their text's slug, GitHub's, numbered `-1`, `-2` when repeated.
//! - **Callouts**, `> [!NOTE]` and the four others, are `<aside class="callout callout-note">`,
//!   their first child `<p class="callout-title">Note</p>`. Other quotes stay `<blockquote>`.
//! - **Links**: see [`Links`]. A link that leaves the repository, or has another scheme than
//!   `http`, `https`, or `mailto`, is its text alone.
//! - **Diagrams**, ```` ```mermaid ````, are `<figure class="diagram">` holding an inline `<svg>`,
//!   or, when the source cannot be drawn, `<figure class="diagram diagram-failed">` with a
//!   `<p class="diagram-error">` and the source in a `<pre>`.
//! - **Raw HTML** is shown as text, escaped; an HTML comment is left out, as GitHub hides it.
//! - The frontmatter is not drawn.

mod diagram;
mod ends;
mod links;
mod pieces;

use std::collections::HashSet;
use std::fmt::Write as _;
use std::ops::Range;

use pulldown_cmark::{
    Alignment, CodeBlockKind, Event, HeadingLevel, LinkType, Options, Parser, Tag, TagEnd,
};
use uraeda_text::markdown::{self, Lines, slug};

use crate::html::escape;

pub use links::Links;
use links::Target;
use pieces::{callout, closed_image, is_comment, title_attribute, unescape};

/// The HTML of the workflow file `text`, frontmatter dropped. See the module's documentation for
/// what it holds.
pub fn render(text: &str, links: &Links) -> String {
    let mut writer = Writer {
        text,
        lines: Lines::new(text),
        links,
        out: String::with_capacity(text.len() * 2),
        saved: Vec::new(),
        inline: Vec::new(),
        span: None,
        anchors: HashSet::new(),
        heading: None,
        alt: None,
        code: None,
        table_head: false,
        cell: 0,
        alignments: Vec::new(),
        footnotes: Vec::new(),
        metadata: false,
        html: HtmlBlock::None,
    };
    let options = markdown::options() | Options::ENABLE_FOOTNOTES;
    for (event, range) in Parser::new_ext(text, options).into_offset_iter() {
        writer.event(event, range);
    }
    writer.close_span();
    writer.out
}

/// An inline element open in a block's text: how it opens and closes, to reopen it in the next
/// line's span.
struct Open {
    start: String,
    end: &'static str,
}

/// A heading being written: its text, for its id.
struct Heading {
    level: HeadingLevel,
    lines: String,
    text: String,
}

/// A code block being read.
struct Code {
    language: String,
    lines: String,
    source: String,
}

struct Writer<'a> {
    text: &'a str,
    lines: Lines,
    links: &'a Links,
    out: String,
    /// What was written before a heading started, its text written apart until its id is known.
    saved: Vec<String>,
    inline: Vec<Open>,
    /// The line of the open `data-line` span.
    span: Option<usize>,
    anchors: HashSet<String>,
    heading: Option<Heading>,
    /// An image's alt text being read, its nesting depth, and its tag before `alt`.
    alt: Option<(usize, String, String)>,
    code: Option<Code>,
    table_head: bool,
    cell: usize,
    alignments: Vec<Alignment>,
    /// Footnotes' names, in their first appearance's order: their numbers.
    footnotes: Vec<String>,
    metadata: bool,
    html: HtmlBlock,
}

/// The HTML block being read: shown as text, or a comment, left out.
#[derive(Clone, Copy, PartialEq, Eq)]
enum HtmlBlock {
    None,
    Shown,
    Comment,
}

impl Writer<'_> {
    /// `data-lines="a-b"` of a source range.
    fn lines_of(&self, range: &Range<usize>) -> String {
        let start = self.lines.of(range.start);
        let body = self.text[range.clone()].trim_end();
        let end = if body.is_empty() {
            start
        } else {
            self.lines.of(range.start + body.len() - 1)
        };
        format!("data-lines=\"{start}-{end}\"")
    }

    fn event(&mut self, event: Event<'_>, range: Range<usize>) {
        if self.metadata {
            self.metadata = !matches!(event, Event::End(TagEnd::MetadataBlock(_)));
            return;
        }
        if let Some(code) = self.code.as_mut() {
            match event {
                Event::Text(text) => code.source.push_str(&text),
                Event::End(TagEnd::CodeBlock) => self.end_code(),
                _ => {}
            }
            return;
        }
        if let Some((depth, _, alt)) = self.alt.as_mut() {
            match event {
                Event::Start(Tag::Image { .. }) => *depth += 1,
                Event::End(TagEnd::Image) if *depth > 0 => *depth -= 1,
                Event::End(TagEnd::Image) => {
                    let (_, tag, alt) = self.alt.take().unwrap_or_default();
                    self.out.push_str(&closed_image(&tag, &alt));
                }
                Event::Text(text) | Event::Code(text) => alt.push_str(&text),
                _ => {}
            }
            return;
        }
        match event {
            Event::Start(tag) => self.start(tag, range),
            Event::End(tag) => self.end(tag),
            Event::Text(text) => {
                self.mark(&range);
                self.write_text(&escape(&text));
            }
            Event::Code(text) => {
                self.mark(&range);
                let _ = write!(self.out, "<code>{}</code>", escape(&text));
                self.heading_text(&text);
            }
            Event::Html(html) => {
                if self.html == HtmlBlock::Shown {
                    self.out.push_str(&escape(&html));
                }
            }
            Event::InlineHtml(html) => {
                if !is_comment(&html) {
                    self.mark(&range);
                    self.write_text(&escape(&html));
                }
            }
            Event::SoftBreak => {
                // The next line's text opens its own span.
                self.close_span();
                self.out.push('\n');
                self.heading_text(" ");
            }
            Event::HardBreak => {
                self.mark(&range);
                self.out.push_str("<br>");
                self.heading_text(" ");
            }
            Event::Rule => {
                self.close_span();
                let _ = write!(self.out, "<hr {}>", self.lines_of(&range));
            }
            Event::TaskListMarker(checked) => {
                self.mark(&range);
                let checked = if checked { " checked" } else { "" };
                let _ = write!(self.out, "<input type=\"checkbox\" disabled{checked}> ");
            }
            Event::FootnoteReference(name) => {
                self.mark(&range);
                let number = self.footnote(&name);
                let id = slug(&name);
                let _ = write!(
                    self.out,
                    "<sup class=\"footnote-ref\"><a href=\"#fn-{id}\" id=\"fnref-{id}\">{number}</a></sup>"
                );
            }
            Event::InlineMath(text) | Event::DisplayMath(text) => {
                self.mark(&range);
                self.write_text(&escape(&text));
            }
        }
    }

    fn write_text(&mut self, html: &str) {
        self.out.push_str(html);
        if let Some(heading) = self.heading.as_mut() {
            // The id is the plain text: entities would only be dropped by the slug.
            heading.text.push_str(html);
        }
    }

    fn heading_text(&mut self, text: &str) {
        if let Some(heading) = self.heading.as_mut() {
            heading.text.push_str(text);
        }
    }

    /// Opens the span of the line `range` starts on, unless it is open already.
    fn mark(&mut self, range: &Range<usize>) {
        let line = self.lines.of(range.start);
        if self.span == Some(line) {
            return;
        }
        if self.span.is_some() {
            self.close_span();
        }
        let _ = write!(self.out, "<span data-line=\"{line}\">");
        for open in &self.inline {
            self.out.push_str(&open.start);
        }
        self.span = Some(line);
    }

    /// Closes the open line span, and the inline elements in it.
    fn close_span(&mut self) {
        if self.span.take().is_some() {
            for open in self.inline.iter().rev() {
                self.out.push_str(open.end);
            }
            self.out.push_str("</span>");
        }
    }

    /// Opens an inline element, in the span of its line.
    fn open_inline(&mut self, range: &Range<usize>, start: String, end: &'static str) {
        self.mark(range);
        self.out.push_str(&start);
        self.inline.push(Open { start, end });
    }

    fn close_inline(&mut self) {
        if let Some(open) = self.inline.pop()
            && self.span.is_some()
        {
            self.out.push_str(open.end);
        }
    }

    /// Opens a block: no line span crosses it.
    fn block(&mut self, html: &str) {
        self.close_span();
        self.out.push_str(html);
    }

    fn start(&mut self, tag: Tag<'_>, range: Range<usize>) {
        let lines = self.lines_of(&range);
        match tag {
            Tag::Paragraph => self.block(&format!("<p {lines}>")),
            Tag::Heading { level, .. } => {
                self.close_span();
                self.saved.push(std::mem::take(&mut self.out));
                self.heading = Some(Heading {
                    level,
                    lines,
                    text: String::new(),
                });
            }
            Tag::BlockQuote(kind) => match kind.map(callout) {
                Some((class, title)) => self.block(&format!(
                    "<aside class=\"callout callout-{class}\" {lines}><p class=\"callout-title\">{title}</p>"
                )),
                None => self.block(&format!("<blockquote {lines}>")),
            },
            Tag::CodeBlock(kind) => {
                self.close_span();
                let language = match kind {
                    CodeBlockKind::Fenced(info) => {
                        info.split_whitespace().next().unwrap_or("").to_owned()
                    }
                    CodeBlockKind::Indented => String::new(),
                };
                self.code = Some(Code {
                    language,
                    lines,
                    source: String::new(),
                });
            }
            Tag::HtmlBlock => {
                if is_comment(&self.text[range.clone()]) {
                    self.html = HtmlBlock::Comment;
                    return;
                }
                self.html = HtmlBlock::Shown;
                self.block(&format!("<pre class=\"html\" {lines}>"));
            }
            Tag::List(Some(first)) if first != 1 => {
                self.block(&format!("<ol start=\"{first}\" {lines}>"))
            }
            Tag::List(Some(_)) => self.block(&format!("<ol {lines}>")),
            Tag::List(None) => self.block(&format!("<ul {lines}>")),
            Tag::FootnoteDefinition(name) => {
                let number = self.footnote(&name);
                let id = slug(&name);
                self.block(&format!(
                    "<div class=\"footnote\" id=\"fn-{id}\" {lines}><a class=\"footnote-label\" href=\"#fnref-{id}\">{number}</a>"
                ));
            }
            Tag::Table(alignments) => {
                self.alignments = alignments;
                self.block(&format!("<table {lines}>"));
            }
            Tag::TableHead => {
                self.table_head = true;
                self.cell = 0;
                self.block(&format!("<thead><tr {lines}>"));
            }
            Tag::TableRow => {
                self.cell = 0;
                self.block(&format!("<tr {lines}>"));
            }
            Tag::Emphasis => self.open_inline(&range, "<em>".into(), "</em>"),
            Tag::Strong => self.open_inline(&range, "<strong>".into(), "</strong>"),
            Tag::Strikethrough => self.open_inline(&range, "<del>".into(), "</del>"),
            Tag::Superscript => self.open_inline(&range, "<sup>".into(), "</sup>"),
            Tag::Subscript => self.open_inline(&range, "<sub>".into(), "</sub>"),
            Tag::Item => self.item(&range, &lines),
            Tag::TableCell => self.cell(),
            Tag::Link {
                link_type,
                dest_url,
                title,
                ..
            } => self.link(&range, link_type, &dest_url, &title),
            Tag::Image {
                dest_url, title, ..
            } => {
                self.mark(&range);
                let tag = self.image_tag(&dest_url, &title, &lines);
                self.alt = Some((0, tag, String::new()));
            }
            Tag::MetadataBlock(_) => self.metadata = true,
            Tag::DefinitionList
            | Tag::DefinitionListTitle
            | Tag::DefinitionListDefinition
            => self.close_span(),
        }
    }

    /// The opening of an image's tag, closed with its alt text by `closed_image`: an image of
    /// another site is a link, never fetched as the page is read; one out of the repository is its
    /// alt text alone.
    fn image_tag(&self, dest_url: &str, title: &str, lines: &str) -> String {
        match self.links.href(dest_url, true) {
            Some(Target::Inside(src)) => format!(
                "<img src=\"{}\" loading=\"lazy\" {lines}{}",
                escape(&src),
                title_attribute(title)
            ),
            Some(Target::Outside(src)) => format!(
                "<a class=\"image-link\" href=\"{}\" rel=\"noreferrer noopener\" target=\"_blank\"",
                escape(&src)
            ),
            None => String::new(),
        }
    }

    fn item(&mut self, range: &Range<usize>, lines: &str) {
        let after_marker = self.text[range.clone()].trim_start_matches(|c: char| {
            c.is_ascii_digit() || matches!(c, '-' | '*' | '+' | '.' | ')' | ' ' | '\t')
        });
        let task = ["[ ]", "[x]", "[X]"]
            .iter()
            .any(|box_| after_marker.starts_with(box_));
        let class = if task { " class=\"task\"" } else { "" };
        self.block(&format!("<li{class} {lines}>"));
    }

    fn cell(&mut self) {
        let name = if self.table_head { "th" } else { "td" };
        let align = match self.alignments.get(self.cell) {
            Some(Alignment::Left) => " style=\"text-align:left\"",
            Some(Alignment::Center) => " style=\"text-align:center\"",
            Some(Alignment::Right) => " style=\"text-align:right\"",
            _ => "",
        };
        self.block(&format!("<{name}{align}>"));
    }

    fn link(&mut self, range: &Range<usize>, link_type: LinkType, target: &str, title: &str) {
        let target = match link_type {
            LinkType::WikiLink { .. } => None,
            _ => self.links.href(target, false),
        };
        let start = match target {
            Some(Target::Outside(href)) => format!(
                "<a href=\"{}\" rel=\"noreferrer noopener\" target=\"_blank\"{}>",
                escape(&href),
                title_attribute(title)
            ),
            Some(Target::Inside(href)) => {
                format!("<a href=\"{}\"{}>", escape(&href), title_attribute(title))
            }
            None => String::new(),
        };
        let end = if start.is_empty() { "" } else { "</a>" };
        self.open_inline(range, start, end);
    }
}

/// A part of `file`, a path from the repository's top level, drawn for a page of the feature at
/// `base`, the path from the page back to the feature's folder of pages: `./` for the round, `../`
/// for a review.
pub fn draw(markdown: &str, file: &str, base: &str) -> String {
    let folder = file.rsplit_once('/').map_or("", |(folder, _)| folder);
    render(
        markdown,
        &Links {
            folder: folder.to_string(),
            base: base.to_string(),
        },
    )
}
