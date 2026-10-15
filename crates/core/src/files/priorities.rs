//! The entries of `PRIORITIES.md`, by section, and the edits drafting and starting make.

use super::lines::{self, Item, Marker, item_marker};

use super::markdown::link_text as escaped;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Section {
    Now,
    Next,
    Later,
    Blocked,
}

impl Section {
    const ALL: [Section; 4] = [
        Section::Now,
        Section::Next,
        Section::Later,
        Section::Blocked,
    ];

    pub fn title(&self) -> &'static str {
        match self {
            Section::Now => "Now",
            Section::Next => "Next",
            Section::Later => "Later",
            Section::Blocked => "Blocked",
        }
    }

    /// A section's kebab-case name, as entry ids use it.
    pub fn id(&self) -> &'static str {
        match self {
            Section::Now => "now",
            Section::Next => "next",
            Section::Later => "later",
            Section::Blocked => "blocked",
        }
    }

    pub fn from_id(id: &str) -> Option<Section> {
        Section::ALL.into_iter().find(|section| section.id() == id)
    }

    fn from_heading(line: &str) -> Option<Section> {
        let title = line.strip_prefix("## ")?.trim();
        Section::ALL
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
    /// Its lines.
    item: Item,
}

/// Every entry of `PRIORITIES.md`, in order.
pub fn parse(text: &str) -> Vec<Entry> {
    let lines: Vec<&str> = text.lines().collect();
    // Each heading counts, so an entry's position restarts under a repeated heading.
    let mut headings = 0;
    let found = lines::items(text, |line| {
        headings += 1;
        Section::from_heading(line).map(|section| (section, headings))
    });
    let mut entries: Vec<Entry> = Vec::new();
    let mut previous = None;
    for ((section, heading), item) in found {
        let position = if previous == Some(heading) {
            entries.last().map_or(0, |e| e.position) + 1
        } else {
            1
        };
        previous = Some(heading);
        let markdown = lines::item_text(&lines, &item).join("\n");
        let (text, link) = lines::plain(&markdown);
        entries.push(Entry {
            section,
            position,
            text,
            link,
            line: item.line,
            item,
        });
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
    super::with_unix_newlines(text, |text| {
        let entry = entry_at(text, line).ok_or(())?;
        let without = lines::remove(text, &entry.item);
        Ok::<_, ()>(add_to_now(&without, link_text, target))
    })
    .ok()
}

/// Adds a link to `target` at the end of **Now**, in the style of its last item.
pub fn add_to_now(text: &str, link_text: &str, target: &str) -> String {
    let result: Result<String, ()> = super::with_unix_newlines(text, |text| {
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
    /// Its lines as written, its marker, wrapped text, and nested lines included: what an Undo of
    /// its removal writes back.
    pub lines: Vec<String>,
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
    let slugs = entries.iter().map(|entry| {
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
        draft.unwrap_or_else(|| crate::slug::from_text(&entry.text))
    });
    lines::unique_keys(slugs.collect())
}

fn entry_id(entry: &Entry) -> String {
    format!("{}-{}", entry.section.id(), entry.position)
}

/// The sections of `PRIORITIES.md`, in order, with their entries. `committed` is the text at the
/// last commit, to count the changes.
pub fn read(text: &str, committed: Option<&str>) -> Priorities {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    let entries = parse(&unix);
    let keys = keys(&entries);
    let sections = Section::ALL
        .into_iter()
        .map(|section| SectionItems {
            section: section.id().to_string(),
            title: section.title().to_string(),
            entries: entries
                .iter()
                .zip(&keys)
                .filter(|(entry, _)| entry.section == section)
                .map(|(entry, key)| {
                    let markdown = lines::item_text(&lines, &entry.item).join(" ");
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
                        end_line: entry.item.end as u32,
                        lines: lines[entry.line - 1..entry.item.end]
                            .iter()
                            .map(|l| l.to_string())
                            .collect(),
                        nested: lines[entry.item.text_end..entry.item.end]
                            .iter()
                            .map(|l| l.to_string())
                            .collect(),
                        nested_spans: lines::nested_spans(
                            &lines[entry.item.text_end..entry.item.end],
                        ),
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
            let rest = lines[entry.line..entry.item.end].join("\n");
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

/// Inserts `item`, lines of an entry, in `section` before its entry at `index`, or at its end.
fn insert(text: &str, section: Section, index: usize, item: &[String]) -> String {
    let before = parse(text)
        .into_iter()
        .filter(|e| e.section == section)
        .nth(index);
    let Some(before) = before else {
        let heading = format!("## {}", section.title());
        let is_heading = |line: &str| Section::from_heading(line) == Some(section);
        return lines::append_to_section(text, is_heading, &heading, item);
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
    super::with_unix_newlines(text, |text| {
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
    super::with_unix_newlines(text, |text| {
        let entry = find(text, id).ok_or(())?;
        let item = format!("{} {line}", entry.item.marker.render());
        Ok::<_, ()>(lines::replace(text, &entry.item, &[item]))
    })
    .ok()
}

/// Removes an entry, with its nested lines.
pub fn remove(text: &str, id: &str) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let entry = find(text, id).ok_or(())?;
        Ok::<_, ()>(lines::remove(text, &entry.item))
    })
    .ok()
}
