//! The edits of `PRIORITIES.md`: adding, moving, linking, editing, and removing entries, each
//! splicing lines so every other line keeps its bytes.

use super::super::lines::{self, Marker};
use super::super::markdown::link_text as escaped;
use super::{Entry, Section, entry_id, keys, parse};

fn entry_at(text: &str, line: usize) -> Option<Entry> {
    parse(text).into_iter().find(|entry| entry.line == line)
}

/// Turns the entry starting at `line` into a link to `target`, keeping its sub-items.
pub fn link(text: &str, line: usize, target: &str) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let entry = entry_at(text, line).ok_or(())?;
        let item = format!(
            "{} [{}]({target})",
            entry.item.marker.render(),
            escaped(&entry.text)
        );
        Ok::<_, ()>(lines::replace(text, &entry.item, &[item]))
    })
    .ok()
}

/// Removes the entry starting at `line`, sub-items included, and adds a link to `target` at the
/// end of **Now**.
pub fn move_to_now(text: &str, line: usize, link_text: &str, target: &str) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let entry = entry_at(text, line).ok_or(())?;
        let without = lines::remove(text, &entry.item);
        Ok::<_, ()>(add_to_now(&without, link_text, target))
    })
    .ok()
}

/// Adds a link to `target` at the end of **Now**, in the style of its last item.
pub fn add_to_now(text: &str, link_text: &str, target: &str) -> String {
    let result: Result<String, ()> = super::super::with_unix_newlines(text, |text| {
        let entries = parse(text);
        let last = entries.iter().rfind(|e| e.section == Section::Now);
        let marker = match last.map(|entry| &entry.item.marker) {
            Some(Marker::Number(number)) => Marker::Number(number + 1),
            Some(Marker::Bullet(bullet)) => Marker::Bullet(*bullet),
            None => Marker::Bullet('-'),
        };
        let item = format!("{} [{}]({target})", marker.render(), escaped(link_text));
        Ok(insert(text, Section::Now, usize::MAX, &[item]))
    });
    result.unwrap_or_else(|()| text.to_string())
}

fn find(text: &str, id: &str) -> Option<Entry> {
    parse(text).into_iter().find(|entry| entry_id(entry) == id)
}

/// Inserts `item`, lines of an entry, in `section` before its entry at `index`, or at its end.
fn insert(text: &str, section: Section, index: usize, item: &[String]) -> String {
    let entries: Vec<Entry> = parse(text)
        .into_iter()
        .filter(|e| e.section == section)
        .collect();
    let Some(before) = entries.get(index) else {
        let heading = lines::headings(text)
            .find(|(_, line)| Section::from_heading(line) == Some(section))
            .map(|(number, _)| number);
        let last = entries.last().map(|entry| &entry.item);
        let title = format!("## {}", section.title());
        return lines::append_to_section(text, last, heading, &title, item).0;
    };
    let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
    let at = before.line - 1;
    lines.splice(at..at, item.iter().cloned());
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
    super::super::with_unix_newlines(text, |text| {
        Ok::<_, ()>(insert(text, section, index, lines))
    })
    .ok()
}

/// Adds a line at the end of a section. `None` when the line is empty.
pub fn add(text: &str, section: Section, line: &str) -> Option<String> {
    let line = lines::one_line(line);
    if line.is_empty() {
        return None;
    }
    super::super::with_unix_newlines(text, |text| {
        Ok::<_, ()>(insert(text, section, usize::MAX, &[format!("- {line}")]))
    })
    .ok()
}

/// Moves an entry, its nested lines included, before the entry at `index` of `section`, or to
/// its end.
pub fn move_entry(text: &str, id: &str, section: Section, index: usize) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let entry = find(text, id).ok_or(())?;
        let item: Vec<String> = text.split('\n').collect::<Vec<_>>()
            [entry.item.line - 1..entry.item.end]
            .iter()
            .map(|l| l.to_string())
            .collect();
        let without = lines::remove(text, &entry.item);
        // An entry moved within its section counts its old place out.
        Ok::<_, ()>(insert(&without, section, index, &item))
    })
    .ok()
}

/// Replaces an entry's text with `line`, its marker and nested lines kept.
pub fn edit(text: &str, id: &str, line: &str) -> Option<String> {
    let line = lines::one_line(line);
    if line.is_empty() {
        return None;
    }
    super::super::with_unix_newlines(text, |text| {
        let entry = find(text, id).ok_or(())?;
        let item = format!("{} {line}", entry.item.marker.render());
        Ok::<_, ()>(lines::replace(text, &entry.item, &[item]))
    })
    .ok()
}

/// Removes the entry of `section` whose lines, nested ones included, are exactly `lines`: the one
/// there is, or among several, the one whose key is `key`. `None` when there is none, or several
/// and none has that key: an entry of the same text the human wrote is never taken for it.
pub fn remove_written(
    text: &str,
    section: Section,
    lines: &[String],
    key: Option<&str>,
) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let all: Vec<&str> = text.split('\n').collect();
        let entries = parse(text);
        let keys = keys(&entries);
        let same: Vec<(&Entry, &String)> = entries
            .iter()
            .zip(&keys)
            .filter(|(entry, _)| {
                entry.section == section
                    && all[entry.item.line - 1..entry.item.end]
                        .iter()
                        .copied()
                        .eq(lines.iter().map(String::as_str))
            })
            .collect();
        let found = match same.as_slice() {
            [(one, _)] => *one,
            _ => same
                .iter()
                .find(|(_, found)| key == Some(found.as_str()))
                .map(|(entry, _)| *entry)
                .ok_or(())?,
        };
        Ok::<_, ()>(lines::remove(text, &found.item))
    })
    .ok()
}

/// Removes an entry, with its nested lines.
pub fn remove(text: &str, id: &str) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let entry = find(text, id).ok_or(())?;
        Ok::<_, ()>(lines::remove(text, &entry.item))
    })
    .ok()
}
