//! The parts of a markdown file the workflow relies on: headings, links, and the review callout.

use std::collections::HashSet;

use pulldown_cmark::{BlockQuoteKind, Event, HeadingLevel, LinkType, Options, Parser, Tag, TagEnd};

/// A heading, with its plain text.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Heading {
    pub level: u8,
    pub text: String,
    pub line: usize,
}

/// A link: a markdown link's or image's destination, or a wikilink's target.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Link {
    pub target: String,
    pub wiki: bool,
    /// Whether it is an image, `![alt](images/name.webp)`.
    pub image: bool,
    pub line: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CalloutKind {
    Important,
    Note,
}

/// The `> [!IMPORTANT]` or `> [!NOTE]` block after a file's title.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Callout {
    pub kind: CalloutKind,
    /// Its first paragraph, on one line: "16 questions, about 50 minutes."
    pub first_line: String,
    pub start: usize,
    pub end: usize,
}

/// A parsed markdown file.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Document {
    pub headings: Vec<Heading>,
    pub links: Vec<Link>,
    /// The targets of Obsidian embeds, `![[shot.png]]`, which `links` leaves out: only a commit's
    /// image pass reads them.
    pub embeds: Vec<String>,
    pub callout: Option<Callout>,
    pub line_count: usize,
}

pub(crate) fn options() -> Options {
    Options::ENABLE_GFM
        | Options::ENABLE_TABLES
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_YAML_STYLE_METADATA_BLOCKS
        | Options::ENABLE_WIKILINKS
}

/// The 1-based line of each byte offset.
pub(crate) struct Lines(Vec<usize>);

impl Lines {
    pub(crate) fn new(text: &str) -> Lines {
        Lines(
            std::iter::once(0)
                .chain(text.match_indices('\n').map(|(index, _)| index + 1))
                .collect(),
        )
    }

    pub(crate) fn of(&self, offset: usize) -> usize {
        self.0.partition_point(|&start| start <= offset)
    }
}

impl Document {
    pub fn parse(text: &str) -> Document {
        let lines = Lines::new(text);
        let mut headings = Vec::new();
        let mut links = Vec::new();
        let mut embeds = Vec::new();
        let mut callout = None;
        let mut heading: Option<Heading> = None;
        let mut seen_section = false;
        let mut quote_depth = 0;
        // Open images: one inside another's alt text is not a link of its own.
        let mut image_depth = 0u32;
        for (event, range) in Parser::new_ext(text, options()).into_offset_iter() {
            match event {
                Event::Start(Tag::Heading { level, .. }) => {
                    heading = Some(Heading {
                        level: heading_level(level),
                        text: String::new(),
                        line: lines.of(range.start),
                    });
                }
                Event::End(TagEnd::Heading(_)) => {
                    if let Some(done) = heading.take() {
                        seen_section |= done.level >= 2;
                        headings.push(done);
                    }
                }
                Event::Text(text) | Event::Code(text) => {
                    if let Some(heading) = heading.as_mut() {
                        heading.text.push_str(&text);
                    }
                }
                Event::Start(Tag::Link {
                    link_type,
                    dest_url,
                    ..
                }) => links.push(Link {
                    target: dest_url.to_string(),
                    wiki: matches!(link_type, LinkType::WikiLink { .. }),
                    image: false,
                    line: lines.of(range.start),
                }),
                // An Obsidian embed, `![[shot.png]]`, is not checked.
                Event::Start(Tag::Image {
                    link_type,
                    dest_url,
                    ..
                }) => {
                    image_depth += 1;
                    if image_depth == 1 && matches!(link_type, LinkType::WikiLink { .. }) {
                        embeds.push(dest_url.to_string());
                    } else if image_depth == 1 {
                        links.push(Link {
                            target: dest_url.to_string(),
                            wiki: false,
                            image: true,
                            line: lines.of(range.start),
                        });
                    }
                }
                Event::End(TagEnd::Image) => image_depth -= 1,
                Event::Start(Tag::BlockQuote(kind)) => {
                    quote_depth += 1;
                    let kind = match kind {
                        Some(BlockQuoteKind::Important) => Some(CalloutKind::Important),
                        Some(BlockQuoteKind::Note) => Some(CalloutKind::Note),
                        _ => None,
                    };
                    if let (Some(kind), None, false, 1) =
                        (kind, &callout, seen_section, quote_depth)
                    {
                        let start = lines.of(range.start);
                        let end = lines.of(range.end.saturating_sub(1));
                        callout = Some(Callout {
                            kind,
                            first_line: first_paragraph(text, start, end),
                            start,
                            end,
                        });
                    }
                }
                Event::End(TagEnd::BlockQuote(_)) => quote_depth -= 1,
                _ => {}
            }
        }
        Document {
            headings,
            links,
            embeds,
            callout,
            line_count: text.lines().count(),
        }
    }

    /// Every heading's anchor, numbered like GitHub's when several share a slug.
    pub fn anchors(&self) -> HashSet<String> {
        let mut anchors = HashSet::new();
        for heading in &self.headings {
            let slug = slug(&heading.text);
            let mut candidate = slug.clone();
            let mut number = 0;
            while anchors.contains(&candidate) {
                number += 1;
                candidate = format!("{slug}-{number}");
            }
            anchors.insert(candidate);
        }
        anchors
    }
}

fn heading_level(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

/// The text of a quoted line, without its `>` marker.
fn unquote(line: &str) -> &str {
    let line = line.trim_start();
    let line = line.strip_prefix('>').unwrap_or(line);
    line.strip_prefix(' ').unwrap_or(line)
}

/// The first paragraph of a callout, after its `[!KIND]` line, on one line.
fn first_paragraph(text: &str, start: usize, end: usize) -> String {
    text.lines()
        .skip(start)
        .take(end - start)
        .map(unquote)
        .skip_while(|line| line.trim().is_empty())
        .take_while(|line| !line.trim().is_empty() && !line.starts_with("- "))
        .map(str::trim)
        .collect::<Vec<_>>()
        .join(" ")
}

/// A link's or an image's text, with `[`, `]`, and `\` escaped, so it stays one link.
pub(crate) fn link_text(text: &str) -> String {
    let mut escaped = String::new();
    for c in text.chars() {
        if matches!(c, '[' | ']' | '\\') {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    escaped
}

/// GitHub's anchor for a heading: lowercase, spaces to hyphens, punctuation removed.
pub fn slug(heading: &str) -> String {
    heading
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == ' ')
        .map(|c| if c == ' ' { '-' } else { c })
        .collect()
}

/// Turns the first `> [!IMPORTANT]` block into a `> [!NOTE]` record whose first paragraph is
/// `outcome`, its items kept. `None` when the text has no such block.
pub fn record_block(text: &str, outcome: &str) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        let marker = lines
            .iter()
            .position(|line| line.trim_end() == "> [!IMPORTANT]")
            .ok_or(())?;
        lines[marker] = "> [!NOTE]".to_string();
        let quoted = |line: &String| line.trim_start().starts_with('>');
        let mut first = marker + 1;
        while first < lines.len()
            && quoted(&lines[first])
            && unquote(&lines[first]).trim().is_empty()
        {
            first += 1;
        }
        let mut last = first;
        while last < lines.len()
            && quoted(&lines[last])
            && !unquote(&lines[last]).trim().is_empty()
            && !unquote(&lines[last]).starts_with("- ")
        {
            last += 1;
        }
        lines.splice(first..last, [format!("> {outcome}")]);
        Ok::<_, ()>(lines.join("\n"))
    })
    .ok()
}
