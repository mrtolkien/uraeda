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
