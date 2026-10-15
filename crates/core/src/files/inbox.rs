//! The notes of `INBOX.md`, by category, and the edits that add, change, move, and remove them.
//! The format is in the skill's `references/inbox.md`.

use pulldown_cmark::{Event, Parser, Tag, TagEnd};

use super::lines::{self, Item, item_marker};

mod diff;

pub use diff::{NoteChange, diff};

/// What an empty inbox holds.
const TITLE: &str = "# Inbox\n";

/// A note: a bullet at column 0 with the lines indented under it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Note {
    /// `note-<n>`, counted from 1 in file order.
    pub id: String,
    /// The slug of its text, made unique.
    pub key: String,
    /// The name of the `##` heading it is under; `None` before the first one.
    pub category: Option<String>,
    /// Its text without its marks or markdown, links replaced by their text.
    pub text: String,
    /// Whether it starts with the `[agent]` mark.
    pub agent: bool,
    /// The slug of its `[<slug>]` mark.
    pub about: Option<String>,
    /// The target of the link covering its whole text.
    pub link: Option<String>,
    /// Its first line, from 1.
    pub line: usize,
    /// Its last line, sub-items included.
    pub end: usize,
}

/// A category's heading: its line, from 1, and its name. `None` before the first `##` heading.
type Heading = Option<(usize, String)>;

fn category_of(line: &str) -> Option<String> {
    Some(line.strip_prefix("## ")?.trim().to_string())
}

/// Every note, with the heading of its category. A `#` or `###` heading does not change the
/// category: only a `##` one does.
fn scan(text: &str) -> Vec<(Heading, Item)> {
    let mut current: Heading = None;
    lines::items(text, |number, line| {
        if let Some(name) = category_of(line) {
            current = Some((number, name));
        }
        Some(current.clone())
    })
}

/// A `[<slug>] ` mark at the start of `text`, and the text after it, when some is left.
fn slug_mark(text: &str) -> Option<(&str, &str)> {
    let (slug, rest) = text.strip_prefix('[')?.split_once("] ")?;
    let valid = slug
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    (!slug.is_empty() && valid && !rest.trim().is_empty()).then_some((slug, rest))
}

/// The marks at the start of a note's first line, `[agent]` then a slug, and the text after them.
fn marks(first: &str) -> (bool, Option<String>, &str) {
    let mut rest = first;
    let agent = match first.strip_prefix("[agent] ") {
        Some(after) if !after.trim().is_empty() => {
            rest = after;
            true
        }
        _ => false,
    };
    let about = slug_mark(rest).map(|(slug, after)| {
        rest = after;
        slug.to_string()
    });
    (agent, about, rest)
}

/// A note's marks and the lines of its text, without them. `lines` are the text's lines.
fn body<'a>(lines: &[&'a str], item: &Item) -> (bool, Option<String>, Vec<&'a str>) {
    let mut text = lines::item_text(lines, item);
    let (agent, about, first) = marks(text[0]);
    text[0] = first;
    (agent, about, text)
}

/// The target of a link covering the whole of `markdown`.
fn whole_link(markdown: &str) -> Option<String> {
    let events: Vec<Event> = Parser::new_ext(markdown, super::markdown::options())
        .filter(|e| {
            !matches!(
                e,
                Event::Start(Tag::Paragraph) | Event::End(TagEnd::Paragraph)
            )
        })
        .collect();
    let links = events
        .iter()
        .filter(|e| matches!(e, Event::Start(Tag::Link { .. })))
        .count();
    match (events.first(), events.last()) {
        (Some(Event::Start(Tag::Link { dest_url, .. })), Some(Event::End(TagEnd::Link)))
            if links == 1 =>
        {
            Some(dest_url.to_string())
        }
        _ => None,
    }
}

/// Every note of `INBOX.md`, in file order. Lines inside fenced code are not notes, and other
/// text is ignored.
pub fn parse(text: &str) -> Vec<Note> {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    let mut notes: Vec<Note> = scan(&unix)
        .into_iter()
        .enumerate()
        .map(|(index, (heading, item))| {
            let (agent, about, text) = body(&lines, &item);
            let markdown = text.join("\n");
            Note {
                id: format!("note-{}", index + 1),
                key: String::new(),
                category: heading.map(|(_, name)| name),
                text: lines::plain(&markdown).0,
                agent,
                about,
                link: whole_link(&markdown),
                line: item.line,
                end: item.end,
            }
        })
        .collect();
    let slugs = notes.iter().map(|n| crate::slug::from_text(&n.text));
    let keys = lines::unique_keys(slugs.collect());
    for (note, key) in notes.iter_mut().zip(keys) {
        note.key = key;
    }
    notes
}

/// The name of every `##` heading, in order, empty and repeated ones included.
pub fn category_names(text: &str) -> Vec<String> {
    lines::headings(text)
        .filter_map(|(_, line)| category_of(line))
        .collect()
}

/// A note's text after its marks, as one line.
fn with_marks(agent: bool, about: Option<&str>, text: &str) -> String {
    let mut line = String::new();
    if agent {
        line.push_str("[agent] ");
    }
    if let Some(slug) = about {
        line.push_str(&format!("[{slug}] "));
    }
    line + &lines::one_line(text)
}

/// A note's line, with its marks: `- [agent] [run-ui] text`.
pub fn note_line(agent: bool, about: Option<&str>, text: &str) -> String {
    format!("- {}", with_marks(agent, about, text))
}

/// A note of `INBOX.md`, for editing.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxNote {
    /// `note-3`: its place in the file, from 1.
    pub id: String,
    /// Its address: the slug of its text, made unique.
    pub key: String,
    /// The markdown of its text, after its marker and marks, on one line.
    pub text: String,
    pub spans: Vec<super::document::Span>,
    pub agent: bool,
    /// The slug of the feature or bug it is about.
    pub about: Option<String>,
    /// The path of the draft its whole text links to, from the repository's top level.
    pub draft: Option<String>,
    pub start_line: u32,
    pub end_line: u32,
    /// Its lines as written, sub-items included: what an Undo of its removal writes back.
    pub lines: Vec<String>,
}

#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxCategory {
    /// `None` for the notes before the first category.
    pub name: Option<String>,
    pub notes: Vec<InboxNote>,
}

/// `INBOX.md` read for editing.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inbox {
    /// The SHA-256 of the text, to refuse edits over a change made elsewhere.
    pub hash: String,
    /// The categories that hold notes, the notes without one first, then in file order. Notes
    /// under two headings of the same name are in one category.
    pub categories: Vec<InboxCategory>,
    /// Every category's name, once, in file order, empty ones included: what the add form offers.
    pub names: Vec<String>,
    /// How many notes it holds.
    pub count: u32,
    /// How many changes wait for a commit.
    pub changes: u32,
    /// The status of `INBOX-TRIAGE.md`, when there is one.
    pub triage: Option<String>,
}

fn inbox_note(lines: &[&str], note: Note, item: &Item) -> InboxNote {
    let (_, _, text) = body(lines, item);
    let markdown = text.join(" ");
    let doc = super::document::parse(&markdown, "specs");
    let draft = note
        .link
        .as_deref()
        .and_then(|link| crate::workspace::resolve("specs", link))
        .filter(|path| path.starts_with("specs/drafts/"));
    InboxNote {
        id: note.id,
        key: note.key,
        text: markdown,
        spans: doc
            .blocks
            .first()
            .map(|b| b.spans.clone())
            .unwrap_or_default(),
        agent: note.agent,
        about: note.about,
        draft,
        start_line: note.line as u32,
        end_line: note.end as u32,
        lines: lines[note.line - 1..note.end]
            .iter()
            .map(|l| l.to_string())
            .collect(),
    }
}

/// The notes of `INBOX.md` by category.
pub fn read(text: &str) -> Inbox {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    let notes = parse(&unix);
    let count = notes.len() as u32;
    let mut categories: Vec<InboxCategory> = vec![InboxCategory {
        name: None,
        notes: Vec::new(),
    }];
    for (note, (_, item)) in notes.into_iter().zip(scan(&unix)) {
        let name = note.category.clone();
        let note = inbox_note(&lines, note, &item);
        match categories.iter_mut().find(|c| c.name == name) {
            Some(category) => category.notes.push(note),
            None => categories.push(InboxCategory {
                name,
                notes: vec![note],
            }),
        }
    }
    categories.retain(|c| !c.notes.is_empty());
    let mut names = category_names(&unix);
    let mut seen = std::collections::HashSet::new();
    names.retain(|name| seen.insert(name.clone()));
    Inbox {
        hash: super::document::hash(text),
        categories,
        names,
        count,
        changes: 0,
        triage: None,
    }
}

fn find(text: &str, id: &str) -> Option<Item> {
    let number: usize = id.strip_prefix("note-")?.parse().ok()?;
    let (_, item) = scan(text).into_iter().nth(number.checked_sub(1)?)?;
    Some(item)
}

/// Inserts `item`, a note's lines, before the note at `index` of a category, or at its end. A
/// category is the first `##` heading of its name, and a new one is added at the end of the text.
/// Notes without one go before the first `##` heading.
fn insert_at(text: &str, category: Option<&str>, index: usize, item: &[String]) -> String {
    let category = category.map(str::trim);
    let titled = match category {
        Some(_) => text.to_string(),
        None => titled(text),
    };
    let text = titled.as_str();
    let headings: Vec<(usize, &str)> = lines::headings(text).collect();
    let heading = match category {
        Some(name) => headings
            .iter()
            .find(|(_, line)| category_of(line).as_deref() == Some(name)),
        None => headings
            .first()
            .filter(|(_, line)| category_of(line).is_none()),
    }
    .map(|(number, _)| *number);
    let notes: Vec<Item> = scan(text)
        .into_iter()
        .filter(|(under, _)| match category {
            Some(_) => heading.is_some() && under.as_ref().map(|(n, _)| *n) == heading,
            None => under.is_none(),
        })
        .map(|(_, item)| item)
        .collect();
    let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
    if let Some(before) = notes.get(index) {
        lines.splice(before.line - 1..before.line - 1, item.iter().cloned());
        return lines.join("\n");
    }
    let new_heading = format!("## {}", category.unwrap_or_default());
    lines::append_to_section(text, notes.last(), heading, &new_heading, item)
}

/// The text with the title `# Inbox` first when it has no `# ` heading, so a note added without a
/// category is under a heading, and so a note.
fn titled(text: &str) -> String {
    if lines::headings(text).any(|(_, line)| line.starts_with("# ")) {
        text.to_string()
    } else if text.trim().is_empty() {
        TITLE.to_string()
    } else {
        format!("{TITLE}\n{text}")
    }
}

/// Adds a note's line at the end of a category, or of the notes without one. A text without a
/// title gets `# Inbox` first.
pub fn add(text: &str, category: Option<&str>, line: &str) -> String {
    let result: Result<String, ()> = super::with_unix_newlines(text, |text| {
        let text = titled(text);
        Ok(insert_at(&text, category, usize::MAX, &[line.to_string()]))
    });
    result.unwrap_or_else(|()| text.to_string())
}

/// Inserts a note's lines, as written, before the note at `index` of a category, or at its end:
/// what an Undo of a removal writes back. `None` when there is no line.
pub fn insert(
    text: &str,
    category: Option<&str>,
    index: usize,
    lines: &[String],
) -> Option<String> {
    if lines.is_empty() {
        return None;
    }
    super::with_unix_newlines(text, |text| {
        Ok::<_, ()>(insert_at(text, category, index, lines))
    })
    .ok()
}

/// A note's lines as written, sub-items included.
pub fn note_lines(text: &str, id: &str) -> Option<Vec<String>> {
    let unix = text.replace("\r\n", "\n");
    let item = find(&unix, id)?;
    let lines: Vec<&str> = unix.split('\n').collect();
    Some(
        lines[item.line - 1..item.end]
            .iter()
            .map(|l| l.to_string())
            .collect(),
    )
}

/// Replaces a note's text with `new_text`, its marker, marks, and sub-items kept. `None` when the
/// note is gone or the text is blank.
pub fn edit(text: &str, id: &str, new_text: &str) -> Option<String> {
    if new_text.trim().is_empty() {
        return None;
    }
    super::with_unix_newlines(text, |text| {
        let item = find(text, id).ok_or(())?;
        let lines: Vec<&str> = text.split('\n').collect();
        let (_, first) = item_marker(lines[item.line - 1]).ok_or(())?;
        let (agent, about, _) = marks(first);
        let marked = with_marks(agent, about.as_deref(), new_text);
        let line = format!("{} {marked}", item.marker.render());
        Ok::<_, ()>(lines::replace(text, &item, &[line]))
    })
    .ok()
}

/// Removes a note, sub-items included.
pub fn remove(text: &str, id: &str) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let item = find(text, id).ok_or(())?;
        Ok::<_, ()>(lines::remove(text, &item))
    })
    .ok()
}

/// Moves a note, sub-items included, to the end of a category, or of the notes without one.
pub fn move_to(text: &str, id: &str, category: Option<&str>) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let item = find(text, id).ok_or(())?;
        let lines: Vec<String> = text.split('\n').collect::<Vec<_>>()[item.line - 1..item.end]
            .iter()
            .map(|l| l.to_string())
            .collect();
        let without = lines::remove(text, &item);
        Ok::<_, ()>(insert_at(&without, category, usize::MAX, &lines))
    })
    .ok()
}
