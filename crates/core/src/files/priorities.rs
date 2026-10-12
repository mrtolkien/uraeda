//! The entries of `PRIORITIES.md`, by section, and the edits drafting and starting make.

use pulldown_cmark::{Event, Parser, Tag};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Section {
    Now,
    Next,
    Later,
    Blocked,
}

impl Section {
    pub fn title(&self) -> &'static str {
        match self {
            Section::Now => "Now",
            Section::Next => "Next",
            Section::Later => "Later",
            Section::Blocked => "Blocked",
        }
    }

    fn from_heading(line: &str) -> Option<Section> {
        let title = line.strip_prefix("## ")?.trim();
        [
            Section::Now,
            Section::Next,
            Section::Later,
            Section::Blocked,
        ]
        .into_iter()
        .find(|section| section.title().eq_ignore_ascii_case(title))
    }
}

/// A top-level item of a section.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub section: Section,
    /// From 1, in its section.
    pub position: usize,
    /// Its text without markdown, links replaced by their text.
    pub text: String,
    /// Its first link's target.
    pub link: Option<String>,
    /// Its first line.
    pub line: usize,
    /// The last line of its text, before any sub-item.
    text_end: usize,
    /// Its last line, sub-items included.
    end: usize,
    /// `-`, `*`, or the number of a numbered item.
    marker: Marker,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum Marker {
    Bullet(char),
    Number(usize),
}

fn item_marker(line: &str) -> Option<(Marker, &str)> {
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

/// The plain text and first link of an item's markdown.
fn plain(markdown: &str) -> (String, Option<String>) {
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

/// Every entry of `PRIORITIES.md`, in order.
pub fn parse(text: &str) -> Vec<Entry> {
    let lines: Vec<&str> = text.lines().collect();
    let mut entries = Vec::new();
    let mut section = None;
    let mut position = 0;
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        if line.starts_with('#') {
            section = Section::from_heading(line);
            position = 0;
            index += 1;
            continue;
        }
        let (Some(current), Some((marker, first))) = (section, item_marker(line)) else {
            index += 1;
            continue;
        };
        let mut markdown = first.to_string();
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
                markdown.push('\n');
                markdown.push_str(next.trim());
                text_end = end;
            }
        }
        position += 1;
        let (text, link) = plain(&markdown);
        entries.push(Entry {
            section: current,
            position,
            text,
            link,
            line: index + 1,
            text_end: text_end + 1,
            end: end + 1,
            marker,
        });
        index = end + 1;
    }
    entries
}

fn entry_at(text: &str, line: usize) -> Option<Entry> {
    parse(text).into_iter().find(|entry| entry.line == line)
}

/// Turns the entry starting at `line` into a link to `target`, keeping its sub-items.
pub fn link(text: &str, line: usize, target: &str) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let entry = entry_at(text, line).ok_or(())?;
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        let item = format!("{} [{}]({target})", entry.marker.render(), entry.text);
        lines.splice(entry.line - 1..entry.text_end, [item]);
        Ok::<_, ()>(lines.join("\n"))
    })
    .ok()
}

/// Removes the entry starting at `line`, sub-items included, and adds a link to `target` at the
/// end of **Now**.
pub fn move_to_now(text: &str, line: usize, link_text: &str, target: &str) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let entry = entry_at(text, line).ok_or(())?;
        let mut lines: Vec<&str> = text.split('\n').collect();
        lines.drain(entry.line - 1..entry.end);
        Ok::<_, ()>(add_to_now(&lines.join("\n"), link_text, target))
    })
    .ok()
}

/// Adds a link to `target` at the end of **Now**, in the style of its last item.
pub fn add_to_now(text: &str, link_text: &str, target: &str) -> String {
    let result: Result<String, ()> = super::with_unix_newlines(text, |text| {
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        let entries = parse(text);
        let last = entries.iter().rfind(|e| e.section == Section::Now);
        let marker = match last.map(|entry| &entry.marker) {
            Some(Marker::Number(number)) => Marker::Number(number + 1),
            Some(Marker::Bullet(bullet)) => Marker::Bullet(*bullet),
            None => Marker::Bullet('-'),
        };
        let item = format!("{} [{link_text}]({target})", marker.render());
        if let Some(last) = last {
            lines.insert(last.end, item);
        } else if let Some(heading) = lines
            .iter()
            .position(|line| Section::from_heading(line) == Some(Section::Now))
        {
            let mut at = heading + 1;
            if lines.get(at).is_some_and(|line| line.trim().is_empty()) {
                at += 1;
            } else {
                lines.insert(at, String::new());
                at += 1;
            }
            lines.insert(at, item);
            if lines
                .get(at + 1)
                .is_some_and(|line| !line.trim().is_empty())
            {
                lines.insert(at + 1, String::new());
            }
        } else {
            if lines.last().is_some_and(|line| line.is_empty()) {
                lines.pop();
            }
            lines.extend(["".into(), "## Now".into(), "".into(), item, "".into()]);
        }
        Ok(lines.join("\n"))
    });
    result.unwrap_or_else(|()| text.to_string())
}

impl Marker {
    fn render(&self) -> String {
        match self {
            Marker::Bullet(bullet) => bullet.to_string(),
            Marker::Number(number) => format!("{number}."),
        }
    }
}

/// A section's kebab-case name, as entry ids use it.
impl Section {
    pub fn id(&self) -> &'static str {
        match self {
            Section::Now => "now",
            Section::Next => "next",
            Section::Later => "later",
            Section::Blocked => "blocked",
        }
    }

    pub fn from_id(id: &str) -> Option<Section> {
        [
            Section::Now,
            Section::Next,
            Section::Later,
            Section::Blocked,
        ]
        .into_iter()
        .find(|section| section.id() == id)
    }
}

/// An entry of `PRIORITIES.md`, for editing: its markdown, its spans, and its nested lines.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryItem {
    /// `next-2`: its section and its position in it, from 1.
    pub id: String,
    /// Its address, stable while its text or draft stays: see [`keys`].
    pub key: String,
    /// The markdown of its text, after its marker, on one line.
    pub text: String,
    pub spans: Vec<super::document::Span>,
    pub start_line: u32,
    pub end_line: u32,
    /// Its nested lines, as written.
    pub nested: Vec<String>,
    /// The text of each nested item, without its marker.
    pub nested_spans: Vec<Vec<super::document::Span>>,
}

#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionItems {
    /// `now`, `next`, `later`, or `blocked`.
    pub section: String,
    pub title: String,
    pub entries: Vec<EntryItem>,
}

/// `PRIORITIES.md` read for editing.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Priorities {
    /// The SHA-256 of the text, to refuse edits over a change made elsewhere.
    pub hash: String,
    pub sections: Vec<SectionItems>,
    /// How many entries were added, moved, edited, or removed since the last commit.
    pub changes: u32,
}

/// Each entry's key, in order: the slug of its linked draft's file name when it links a file of
/// `specs/drafts/`, otherwise the slug of its text, links replaced by their text, or `line` when
/// that slug is empty. A key already taken by an earlier entry gets `-2`, `-3`, ...
pub fn keys(entries: &[Entry]) -> Vec<String> {
    let mut taken = std::collections::HashSet::new();
    entries
        .iter()
        .map(|entry| {
            let draft = entry
                .link
                .as_deref()
                .and_then(|link| crate::workspace::resolve("specs", link))
                .and_then(|path| {
                    let name = path.strip_prefix("specs/drafts/")?;
                    Some(crate::slug::from_text(
                        name.strip_suffix(".md").unwrap_or(name),
                    ))
                })
                .filter(|slug| !slug.is_empty());
            let base = draft.unwrap_or_else(|| crate::slug::from_text(&entry.text));
            let base = if base.is_empty() {
                "line".to_string()
            } else {
                base
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

fn entry_id(entry: &Entry) -> String {
    format!("{}-{}", entry.section.id(), entry.position)
}

/// An entry's markdown after its marker, its continuation lines joined with spaces.
fn entry_markdown(lines: &[&str], entry: &Entry) -> String {
    let (_, first) = item_marker(lines[entry.line - 1]).unwrap_or((Marker::Bullet('-'), ""));
    std::iter::once(first)
        .chain(lines[entry.line..entry.text_end].iter().map(|l| l.trim()))
        .collect::<Vec<_>>()
        .join(" ")
}

/// The sections of `PRIORITIES.md`, in order, with their entries. `committed` is the text at the
/// last commit, to count the changes.
pub fn read(text: &str, committed: Option<&str>) -> Priorities {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    let entries = parse(&unix);
    let keys = keys(&entries);
    let sections = [
        Section::Now,
        Section::Next,
        Section::Later,
        Section::Blocked,
    ]
    .into_iter()
    .map(|section| SectionItems {
        section: section.id().to_string(),
        title: section.title().to_string(),
        entries: entries
            .iter()
            .zip(&keys)
            .filter(|(entry, _)| entry.section == section)
            .map(|(entry, key)| {
                let markdown = entry_markdown(&lines, entry);
                let doc = super::document::parse(&markdown, "specs");
                EntryItem {
                    id: entry_id(entry),
                    key: key.clone(),
                    spans: doc
                        .blocks
                        .first()
                        .map(|b| b.spans.clone())
                        .unwrap_or_default(),
                    text: markdown,
                    start_line: entry.line as u32,
                    end_line: entry.end as u32,
                    nested: lines[entry.text_end..entry.end]
                        .iter()
                        .map(|l| l.to_string())
                        .collect(),
                    nested_spans: nested_spans(&lines[entry.text_end..entry.end]),
                }
            })
            .collect(),
    })
    .collect();
    Priorities {
        hash: super::document::hash(text),
        sections,
        changes: committed.map_or(0, |committed| changes(committed, text)),
    }
}

/// An entry compared across two texts: its section, its whole markdown, nested lines included,
/// and its text without markdown.
struct Signed {
    section: Section,
    markdown: String,
    text: String,
}

fn signature(text: &str) -> Vec<Signed> {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    parse(&unix)
        .into_iter()
        .map(|entry| {
            let (_, first) =
                item_marker(lines[entry.line - 1]).unwrap_or((Marker::Bullet('-'), ""));
            let rest = lines[entry.line..entry.end].join("\n");
            Signed {
                section: entry.section,
                markdown: format!("{first}\n{rest}"),
                text: entry.text,
            }
        })
        .collect()
}

/// A change to one entry between two texts, each entry named by its text without markdown.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EntryChange {
    Added {
        section: Section,
        text: String,
    },
    Removed {
        section: Section,
        text: String,
    },
    /// To another section, or to another place in the same one.
    Moved {
        from: Section,
        to: Section,
        text: String,
    },
    Edited {
        section: Section,
        before: String,
        after: String,
    },
}

use EntryChange::{Added, Edited, Moved, Removed};

/// The changes between two texts, in the order of `after`. The entries outside their longest
/// common sequence are moves when their markdown is the same, edits when one replaces another in
/// the same section and place, and otherwise additions and removals, so a swap of two entries is
/// one move.
pub fn diff(before: &str, after: &str) -> Vec<EntryChange> {
    let old = signature(before);
    let new = signature(after);
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
    // Each entry left out, with its gap, counted by the entries kept before it, and its place
    // in `after`.
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
        let (from, to, text) = (old[i].section, new[j].section, new[j].text.clone());
        changes.push((j, Moved { from, to, text }));
        false
    });
    // Another entry in the same gap and section: an edit.
    removed.retain(|&(gap, _, i)| {
        let Some(at) = added
            .iter()
            .position(|&(other, j)| other == gap && new[j].section == old[i].section)
        else {
            return true;
        };
        let (_, j) = added.remove(at);
        let (before, after) = (old[i].text.clone(), new[j].text.clone());
        let section = new[j].section;
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
        let (section, text) = (new[j].section, new[j].text.clone());
        (j, Added { section, text })
    }));
    changes.extend(removed.into_iter().map(|(_, at, i)| {
        let (section, text) = (old[i].section, old[i].text.clone());
        (at, Removed { section, text })
    }));
    changes.sort_by_key(|(at, _)| *at);
    changes.into_iter().map(|(_, change)| change).collect()
}

/// How many entries were added, moved, edited, or removed between two texts, as [`diff`] finds
/// them.
pub fn changes(before: &str, after: &str) -> u32 {
    diff(before, after).len() as u32
}

fn find(text: &str, id: &str) -> Option<Entry> {
    parse(text).into_iter().find(|entry| entry_id(entry) == id)
}

/// A line as one line: line breaks become spaces.
fn one_line(line: &str) -> String {
    line.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Inserts `item`, lines of an entry, in `section` before its entry at `index`, or at its end.
fn insert(text: &str, section: Section, index: usize, item: &[String]) -> String {
    let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
    let entries: Vec<Entry> = parse(text)
        .into_iter()
        .filter(|e| e.section == section)
        .collect();
    if let Some(before) = entries.get(index) {
        let at = before.line - 1;
        lines.splice(at..at, item.iter().cloned());
    } else if let Some(last) = entries.last() {
        lines.splice(last.end..last.end, item.iter().cloned());
    } else if let Some(heading) = lines
        .iter()
        .position(|line| Section::from_heading(line) == Some(section))
    {
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
        lines.extend(["".into(), format!("## {}", section.title()), "".into()]);
        lines.extend(item.iter().cloned());
        lines.push(String::new());
    }
    lines.join("\n")
}

/// Inserts the lines of an entry, nested lines included, as written, before the entry at `index`
/// of `section`, or at its end when `index` is past it. `None` when there is no line.
pub fn insert_entry(
    text: &str,
    section: Section,
    index: usize,
    lines: &[String],
) -> Option<String> {
    if lines.is_empty() {
        return None;
    }
    super::with_unix_newlines(text, |text| {
        Ok::<_, ()>(insert(text, section, index, lines))
    })
    .ok()
}

/// Adds a line at the end of a section. `None` when the line is empty.
pub fn add(text: &str, section: Section, line: &str) -> Option<String> {
    let line = one_line(line);
    if line.is_empty() {
        return None;
    }
    super::with_unix_newlines(text, |text| {
        Ok::<_, ()>(insert(text, section, usize::MAX, &[format!("- {line}")]))
    })
    .ok()
}

/// Moves an entry, its nested lines included, before the entry at `index` of `section`, or to
/// its end.
pub fn move_entry(text: &str, id: &str, section: Section, index: usize) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let entry = find(text, id).ok_or(())?;
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        let item: Vec<String> = lines.drain(entry.line - 1..entry.end).collect();
        let without = lines.join("\n");
        // An entry moved within its section counts its old place out.
        Ok::<_, ()>(insert(&without, section, index, &item))
    })
    .ok()
}

/// Replaces an entry's text with `line`, its marker and nested lines kept.
pub fn edit(text: &str, id: &str, line: &str) -> Option<String> {
    let line = one_line(line);
    if line.is_empty() {
        return None;
    }
    super::with_unix_newlines(text, |text| {
        let entry = find(text, id).ok_or(())?;
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        lines.splice(
            entry.line - 1..entry.text_end,
            [format!("{} {line}", entry.marker.render())],
        );
        Ok::<_, ()>(lines.join("\n"))
    })
    .ok()
}

/// Removes an entry, with its nested lines.
pub fn remove(text: &str, id: &str) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let entry = find(text, id).ok_or(())?;
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        lines.drain(entry.line - 1..entry.end);
        Ok::<_, ()>(lines.join("\n"))
    })
    .ok()
}

/// The text of each item of nested lines, read as markdown.
fn nested_spans(lines: &[&str]) -> Vec<Vec<super::document::Span>> {
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
