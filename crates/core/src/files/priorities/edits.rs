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

/// Removes the entry starting at `line`, sub-items included, and adds a link to `target` on top
/// of **Now**, as [`add_started`] does.
pub fn move_to_started(text: &str, line: usize, link_text: &str, target: &str) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let entry = entry_at(text, line).ok_or(())?;
        let without = lines::remove(text, &entry.item);
        Ok::<_, ()>(add_started(&without, link_text, target))
    })
    .ok()
}

/// Whether an entry links a started feature's or change's proposal:
/// `/specs/<YYYY-MM-DD-slug>/proposal.md` or `/specs/changes/<YYYY-MM-DD-slug>/proposal.md`.
fn is_started(entry: &Entry) -> bool {
    let Some(path) =
        (entry.link.as_deref()).and_then(|link| crate::workspace::resolve("specs", link))
    else {
        return false;
    };
    match path.split('/').collect::<Vec<_>>().as_slice() {
        ["specs", folder, "proposal.md"] | ["specs", "changes", folder, "proposal.md"] => {
            crate::workspace::folder_slug(folder).is_some()
        }
        _ => false,
    }
}

/// Adds a link to `target`, a started feature's or change's proposal, on top of **Now**: after the
/// last started entry of Now's first block, the entries before its first blank line, numbered after
/// it, or else first, in the style of the first entry. A blank line then parts it from the entries
/// that are not started, and none is added when none follows.
pub fn add_started(text: &str, link_text: &str, target: &str) -> String {
    let result: Result<String, ()> = super::super::with_unix_newlines(text, |text| {
        let now: Vec<Entry> = parse(text)
            .into_iter()
            .filter(|e| e.section == Section::Now)
            .collect();
        let link =
            |marker: &Marker| format!("{} [{}]({target})", marker.render(), escaped(link_text));
        let Some(first) = now.first() else {
            return Ok(insert(
                text,
                Section::Now,
                usize::MAX,
                &[link(&Marker::Bullet('-'))],
            ));
        };
        let block = 1 + now
            .windows(2)
            .take_while(|pair| pair[1].line == pair[0].item.end + 1)
            .count();
        let (at, item) = match now[..block].iter().rfind(|entry| is_started(entry)) {
            Some(last) => {
                let marker = match &last.item.marker {
                    Marker::Number(number) => Marker::Number(number + 1),
                    bullet => bullet.clone(),
                };
                (last.item.end, link(&marker))
            }
            None => (first.line - 1, link(&first.item.marker)),
        };
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        // The next line starts an entry that is not started, in the same block: a blank line parts it.
        let parted = lines
            .get(at)
            .is_some_and(|next| lines::item_marker(next).is_some());
        let added = if parted {
            vec![item, String::new()]
        } else {
            vec![item]
        };
        lines.splice(at..at, added);
        Ok(lines.join("\n"))
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
