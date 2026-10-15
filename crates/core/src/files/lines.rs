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
/// heading, which it gets with its line number, from 1. Any line starting with `#` is a heading.
/// Lines inside fenced code are neither: see [`is_fence`]. An item runs on over its indented lines, up to a blank or
/// unindented line; its text ends at its first sub-item.
pub(crate) fn items<S: Clone>(
    text: &str,
    mut heading: impl FnMut(usize, &str) -> Option<S>,
) -> Vec<(S, Item)> {
    let lines: Vec<&str> = text.lines().collect();
    let mut items = Vec::new();
    let mut section = None;
    let mut in_code = false;
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        if is_fence(line) {
            in_code = !in_code;
            index += 1;
            continue;
        }
        if in_code {
            index += 1;
            continue;
        }
        if line.starts_with('#') {
            section = heading(index + 1, line);
            index += 1;
            continue;
        }
        let (Some(current), Some((marker, _))) = (&section, item_marker(line)) else {
            index += 1;
            continue;
        };
        let item = item_at(&lines, index, marker);
        index = item.end;
        items.push((current.clone(), item));
    }
    items
}

/// The item starting at `index`, from 0, with its indented lines.
fn item_at(lines: &[&str], index: usize, marker: Marker) -> Item {
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
    Item {
        line: index + 1,
        text_end: text_end + 1,
        end: end + 1,
        marker,
    }
}

/// The headings of a text outside fenced code, with their line numbers, from 1.
pub(crate) fn headings(text: &str) -> impl Iterator<Item = (usize, &str)> {
    let mut in_code = false;
    text.lines().enumerate().filter_map(move |(index, line)| {
        if is_fence(line) {
            in_code = !in_code;
            return None;
        }
        (!in_code && line.starts_with('#')).then_some((index + 1, line))
    })
}

/// Whether a line opens or closes fenced code between items. Only a fence at column 0 does: an
/// indented one is part of the item above it, whose lines a blank line inside the fence ends.
fn is_fence(line: &str) -> bool {
    line.starts_with("```") || line.starts_with("~~~")
}

/// Adds `item`, the lines of an item, after `last`, the last item of a section, or else after the
/// heading at line `heading`, from 1, or else at the end of the text under `new_heading`. Takes
/// and gives `\n` line endings, and a text ending with a line ending keeps it. Gives the text, and
/// the index of the item's first line, from 0.
pub(crate) fn append_to_section(
    text: &str,
    last: Option<&Item>,
    heading: Option<usize>,
    new_heading: &str,
    item: &[String],
) -> (String, usize) {
    let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
    let at = if let Some(last) = last {
        lines.splice(last.end..last.end, item.iter().cloned());
        last.end
    } else if let Some(heading) = heading {
        let mut at = heading;
        if lines.get(at).is_some_and(|line| line.trim().is_empty()) {
            at += 1;
        } else {
            lines.insert(at, String::new());
            at += 1;
        }
        let count = item.len();
        lines.splice(at..at, item.iter().cloned());
        match lines.get(at + count) {
            Some(line) if !line.trim().is_empty() => lines.insert(at + count, String::new()),
            None => lines.push(String::new()),
            Some(_) => {}
        }
        at
    } else {
        if lines.last().is_some_and(|line| line.is_empty()) {
            lines.pop();
        }
        lines.extend(["".into(), new_heading.into(), "".into()]);
        let at = lines.len();
        lines.extend(item.iter().cloned());
        lines.push(String::new());
        at
    };
    (lines.join("\n"), at)
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

/// An item compared across two texts: its section, its whole markdown, nested lines included,
/// and its text without markdown.
pub(crate) struct Signed<S> {
    pub section: S,
    pub markdown: String,
    pub text: String,
}

/// An item's markdown after its marker, nested lines included, to compare it across texts.
pub(crate) fn signed_markdown(lines: &[&str], item: &Item) -> String {
    let (_, first) = item_marker(lines[item.line - 1]).unwrap_or((Marker::Bullet('-'), ""));
    let rest = lines[item.line..item.end].join("\n");
    format!("{first}\n{rest}")
}

/// The markdown of an item given by its lines, as [`signed_markdown`] gives it from a text: what an
/// item another file holds is found by.
pub(crate) fn markdown_of(lines: &[String]) -> Option<String> {
    let (first, rest) = lines.split_first()?;
    let (_, first) = item_marker(first)?;
    Some(format!("{first}\n{}", rest.join("\n")))
}

/// A change to one item between two texts, each item named by its text without markdown.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Change<S> {
    Added {
        section: S,
        text: String,
    },
    Removed {
        section: S,
        text: String,
    },
    /// To another section, or to another place in the same one.
    Moved {
        from: S,
        to: S,
        text: String,
    },
    Edited {
        section: S,
        before: String,
        after: String,
    },
}

use Change::{Added, Edited, Moved, Removed};

/// The changes between two lists of items, in the order of `new`. The items outside their longest
/// common sequence are moves when their markdown is the same, edits when one replaces another in
/// the same section and place, and otherwise additions and removals, so a swap of two items is
/// one move.
pub(crate) fn diff<S: Clone + PartialEq>(old: &[Signed<S>], new: &[Signed<S>]) -> Vec<Change<S>> {
    let same =
        |i: usize, j: usize| old[i].section == new[j].section && old[i].markdown == new[j].markdown;
    let mut table = vec![vec![0u32; new.len() + 1]; old.len() + 1];
    for i in (0..old.len()).rev() {
        for j in (0..new.len()).rev() {
            table[i][j] = if same(i, j) {
                table[i + 1][j + 1] + 1
            } else {
                table[i + 1][j].max(table[i][j + 1])
            };
        }
    }
    // Each item left out, with its gap, counted by the items kept before it, and its place in
    // `new`.
    let (mut removed, mut added) = (Vec::new(), Vec::new());
    let (mut i, mut j, mut gap) = (0, 0, 0);
    while i < old.len() || j < new.len() {
        if i < old.len() && j < new.len() && same(i, j) {
            i += 1;
            j += 1;
            gap += 1;
        } else if j < new.len() && (i == old.len() || table[i][j + 1] >= table[i + 1][j]) {
            added.push((gap, j));
            j += 1;
        } else {
            removed.push((gap, j, i));
            i += 1;
        }
    }
    let mut changes = Vec::new();
    // The same markdown elsewhere: a move.
    removed.retain(|&(_, _, i)| {
        let Some(at) = added
            .iter()
            .position(|&(_, j)| old[i].markdown == new[j].markdown)
        else {
            return true;
        };
        let (_, j) = added.remove(at);
        let (from, to, text) = (
            old[i].section.clone(),
            new[j].section.clone(),
            new[j].text.clone(),
        );
        changes.push((j, Moved { from, to, text }));
        false
    });
    // Another item in the same gap and section: an edit.
    removed.retain(|&(gap, _, i)| {
        let Some(at) = added
            .iter()
            .position(|&(other, j)| other == gap && new[j].section == old[i].section)
        else {
            return true;
        };
        let (_, j) = added.remove(at);
        let (before, after) = (old[i].text.clone(), new[j].text.clone());
        let section = new[j].section.clone();
        changes.push((
            j,
            Edited {
                section,
                before,
                after,
            },
        ));
        false
    });
    changes.extend(added.into_iter().map(|(_, j)| {
        let (section, text) = (new[j].section.clone(), new[j].text.clone());
        (j, Added { section, text })
    }));
    changes.extend(removed.into_iter().map(|(_, at, i)| {
        let (section, text) = (old[i].section.clone(), old[i].text.clone());
        (at, Removed { section, text })
    }));
    changes.sort_by_key(|(at, _)| *at);
    changes.into_iter().map(|(_, change)| change).collect()
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
    unique_keys_besides(slugs, &[])
}

/// `unique_keys`, with `reserved` taken from the start, like an address that is not an item's.
pub(crate) fn unique_keys_besides(slugs: Vec<String>, reserved: &[&str]) -> Vec<String> {
    let mut taken: std::collections::HashSet<String> =
        reserved.iter().map(|key| key.to_string()).collect();
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

/// Runs `escape` on each character of `markdown` outside its code spans, which keep their bytes.
fn outside_code(markdown: &str, mut escape: impl FnMut(&mut String, char, Option<char>)) -> String {
    let chars: Vec<char> = markdown.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '`' {
            let run = chars[i..].iter().take_while(|&&c| c == '`').count();
            let close = (i + run..chars.len()).find(|&j| {
                chars[j..].iter().take_while(|&&c| c == '`').count() == run
                    && (j == 0 || chars[j - 1] != '`')
            });
            let end = close.map_or(i + run, |j| j + run);
            out.extend(&chars[i..end]);
            i = end;
            continue;
        }
        escape(&mut out, chars[i], chars.get(i + 1).copied());
        i += 1;
    }
    out
}

/// Markdown as a link's text: its brackets and backslashes escaped outside code spans, so the
/// link parses whatever the text holds.
pub(crate) fn escape_link_text(markdown: &str) -> String {
    outside_code(markdown, |out, c, _| {
        if matches!(c, '[' | ']' | '\\') {
            out.push('\\');
        }
        out.push(c);
    })
}

/// The markdown a link's text escaped with [`escape_link_text`].
pub(crate) fn unescape_link_text(text: &str) -> String {
    let mut skip = false;
    outside_code(text, |out, c, next| {
        if std::mem::take(&mut skip) {
            out.push(c);
        } else if c == '\\' && matches!(next, Some('[' | ']' | '\\')) {
            skip = true;
        } else {
            out.push(c);
        }
    })
}
