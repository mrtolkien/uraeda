//! Lists of items under headings, read and edited by splicing lines, so every other line keeps
//! its bytes. `PRIORITIES.md` and `INBOX.md` share them.

use pulldown_cmark::{Event, Parser, Tag};

/// `-`, `*`, or the number of a numbered item.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Marker {
    Bullet(char),
    Number(usize),
}

impl Marker {
    pub(crate) fn render(&self) -> String {
        match self {
            Marker::Bullet(bullet) => bullet.to_string(),
            Marker::Number(number) => format!("{number}."),
        }
    }
}

/// An item's marker and the text after it, when the line starts an item at column 0.
pub(crate) fn item_marker(line: &str) -> Option<(Marker, &str)> {
    for bullet in ['-', '*'] {
        if let Some(rest) = line.strip_prefix(bullet).and_then(|r| r.strip_prefix(' ')) {
            return Some((Marker::Bullet(bullet), rest));
        }
    }
    let digits = line.bytes().take_while(u8::is_ascii_digit).count();
    let rest = line[digits..].strip_prefix(". ")?;
    if digits == 0 {
        return None;
    }
    Some((Marker::Number(line[..digits].parse().ok()?), rest))
}

/// A top-level item, its lines numbered from 1.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Item {
    /// Its first line.
    pub line: usize,
    /// The last line of its text, before any sub-item.
    pub text_end: usize,
    /// Its last line, sub-items included.
    pub end: usize,
    pub marker: Marker,
}

/// The lines of an item's text: its first line after its marker, then its continuation lines,
/// trimmed. `lines` are the text's lines.
pub(crate) fn item_text<'a>(lines: &[&'a str], item: &Item) -> Vec<&'a str> {
    let (_, first) = item_marker(lines[item.line - 1]).unwrap_or((Marker::Bullet('-'), ""));
    std::iter::once(first)
        .chain(lines[item.line..item.text_end].iter().map(|l| l.trim()))
        .collect()
}

/// Every item at column 0 under a heading `heading` accepts, with what it returned for that
/// heading. Any line starting with `#` is a heading. An item runs on over its indented lines, up
/// to a blank or unindented line; its text ends at its first sub-item.
pub(crate) fn items<S: Clone>(
    text: &str,
    mut heading: impl FnMut(&str) -> Option<S>,
) -> Vec<(S, Item)> {
    let lines: Vec<&str> = text.lines().collect();
    let mut items = Vec::new();
    let mut section = None;
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        if line.starts_with('#') {
            section = heading(line);
            index += 1;
            continue;
        }
        let (Some(current), Some((marker, _))) = (&section, item_marker(line)) else {
            index += 1;
            continue;
        };
        let mut text_end = index;
        let mut end = index;
        let mut in_text = true;
        for (offset, next) in lines[index + 1..].iter().enumerate() {
            let indented = next.starts_with(' ') || next.starts_with('\t');
            if !indented || next.trim().is_empty() {
                break;
            }
            end = index + 1 + offset;
            if item_marker(next.trim_start()).is_some() {
                in_text = false;
            }
            if in_text {
                text_end = end;
            }
        }
        let item = Item {
            line: index + 1,
            text_end: text_end + 1,
            end: end + 1,
            marker,
        };
        items.push((current.clone(), item));
        index = end + 1;
    }
    items
}

/// Adds `item`, the lines of an item, after the last item under the first heading `is_heading`
/// accepts, or after that heading, or at the end of the text under `new_heading`. Takes and gives
/// `\n` line endings.
pub(crate) fn append_to_section(
    text: &str,
    is_heading: impl Fn(&str) -> bool,
    new_heading: &str,
    item: &[String],
) -> String {
    let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
    let last = items(text, |line| Some(is_heading(line)))
        .into_iter()
        .rfind(|(under, _)| *under);
    if let Some((_, last)) = last {
        lines.splice(last.end..last.end, item.iter().cloned());
    } else if let Some(heading) = lines.iter().position(|line| is_heading(line)) {
        let mut at = heading + 1;
        if lines.get(at).is_some_and(|line| line.trim().is_empty()) {
            at += 1;
        } else {
            lines.insert(at, String::new());
            at += 1;
        }
        let count = item.len();
        lines.splice(at..at, item.iter().cloned());
        if lines
            .get(at + count)
            .is_some_and(|line| !line.trim().is_empty())
        {
            lines.insert(at + count, String::new());
        }
    } else {
        if lines.last().is_some_and(|line| line.is_empty()) {
            lines.pop();
        }
        lines.extend(["".into(), new_heading.into(), "".into()]);
        lines.extend(item.iter().cloned());
        lines.push(String::new());
    }
    lines.join("\n")
}

/// Replaces the lines of an item's text with `lines`, its sub-items kept. Takes and gives `\n`
/// line endings.
pub(crate) fn replace(text: &str, item: &Item, lines: &[String]) -> String {
    let mut all: Vec<String> = text.split('\n').map(String::from).collect();
    all.splice(item.line - 1..item.text_end, lines.iter().cloned());
    all.join("\n")
}

/// Removes an item, sub-items included. Takes and gives `\n` line endings.
pub(crate) fn remove(text: &str, item: &Item) -> String {
    let mut lines: Vec<&str> = text.split('\n').collect();
    lines.drain(item.line - 1..item.end);
    lines.join("\n")
}

/// The text of each item of nested lines, read as markdown.
pub(crate) fn nested_spans(lines: &[&str]) -> Vec<Vec<super::document::Span>> {
    let indent = lines
        .iter()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.len() - l.trim_start().len())
        .min()
        .unwrap_or(0);
    let text: Vec<&str> = lines
        .iter()
        .map(|l| l.get(indent..).unwrap_or(""))
        .collect();
    let doc = super::document::parse(&text.join("\n"), "specs");
    doc.blocks
        .iter()
        .filter(|b| b.kind == super::document::BlockKind::Item)
        .map(|b| b.spans.clone())
        .collect()
}

/// The plain text and first link of an item's markdown.
pub(crate) fn plain(markdown: &str) -> (String, Option<String>) {
    let mut text = String::new();
    let mut link = None;
    for event in Parser::new_ext(markdown, super::markdown::options()) {
        match event {
            Event::Text(part) | Event::Code(part) => text.push_str(&part),
            Event::SoftBreak | Event::HardBreak => text.push(' '),
            Event::Start(Tag::Link { dest_url, .. }) if link.is_none() => {
                link = Some(dest_url.to_string());
            }
            _ => {}
        }
    }
    (text.split_whitespace().collect::<Vec<_>>().join(" "), link)
}

/// A line as one line: line breaks become spaces.
pub(crate) fn one_line(line: &str) -> String {
    line.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The slugs made unique, in order: a slug already taken by an earlier one gets `-2`, `-3`, ...,
/// and an empty slug becomes `line`.
pub(crate) fn unique_keys(slugs: Vec<String>) -> Vec<String> {
    let mut taken = std::collections::HashSet::new();
    slugs
        .into_iter()
        .map(|slug| {
            let base = if slug.is_empty() {
                "line".to_string()
            } else {
                slug
            };
            let mut key = base.clone();
            let mut count = 1;
            while taken.contains(&key) {
                count += 1;
                key = format!("{base}-{count}");
            }
            taken.insert(key.clone());
            key
        })
        .collect()
}
