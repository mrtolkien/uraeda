//! The notes of `INBOX.md`, by category, and the edits that add, change, move, and remove them.
//! The format is in the skill's `references/inbox.md`.

use pulldown_cmark::{Event, Parser, Tag, TagEnd};

use super::lines::{self, Item, item_marker};

mod diff;
mod found;
mod read;

pub use diff::{NoteChange, diff};
pub use found::{ids_of_lines, of_lines};
pub use read::{Inbox, InboxCategory, InboxNote, read};

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

/// The name of a `##` heading, or `None` for any other line. As in CommonMark, a closing run of
/// `#` after a space is not part of it: `## UI ##` is `UI`, and `## ##` is empty.
fn category_of(line: &str) -> Option<String> {
    let rest = line.strip_prefix("##")?;
    if !(rest.is_empty() || rest.starts_with([' ', '\t'])) {
        return None;
    }
    let name = rest.trim();
    let without = name.trim_end_matches('#');
    let name = if without.is_empty() || without.ends_with([' ', '\t']) {
        without.trim_end()
    } else {
        name
    };
    Some(name.to_string())
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

/// Whether `text` can be a note's `[<slug>]` mark: lowercase letters, digits, and `-`.
pub fn is_slug(text: &str) -> bool {
    !text.is_empty()
        && text
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// A `[<slug>] ` mark at the start of `text`, and the text after it, when some is left.
fn slug_mark(text: &str) -> Option<(&str, &str)> {
    let (slug, rest) = text.strip_prefix('[')?.split_once("] ")?;
    (is_slug(slug) && !rest.trim().is_empty()).then_some((slug, rest))
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
    // `triage` is the address of the inbox's triage in the web UI, `/inbox/triage`.
    let keys = lines::unique_keys_besides(slugs.collect(), &["triage"]);
    for (note, key) in notes.iter_mut().zip(keys) {
        note.key = key;
    }
    notes
}

/// The name of every `##` heading, in order, empty and repeated ones included.
pub fn category_names(text: &str) -> Vec<String> {
    category_headings(text)
        .into_iter()
        .map(|(_, name)| name)
        .collect()
}

/// Every `##` heading's line, from 1, and name, in order, empty and repeated ones included.
pub fn category_headings(text: &str) -> Vec<(usize, String)> {
    lines::headings(text)
        .filter_map(|(line, heading)| Some((line, category_of(heading)?)))
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

fn find(text: &str, id: &str) -> Option<Item> {
    let number: usize = id.strip_prefix("note-")?.parse().ok()?;
    let (_, item) = scan(text).into_iter().nth(number.checked_sub(1)?)?;
    Some(item)
}

/// Inserts `item`, a note's lines, before the note at `index` of a category, or at its end. A
/// category is the first `##` heading of its name, and a new one is added at the end of the text.
/// Notes without one go before the first `##` heading.
/// Gives the text, and the index of the item's first line in it, from 0.
fn insert_at(text: &str, category: Option<&str>, index: usize, item: &[String]) -> (String, usize) {
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
        return (lines.join("\n"), before.line - 1);
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

/// Adds a note's line at the end of a category, or of the notes without one, and gives its line,
/// from 1. A text without a title gets `# Inbox` first.
pub fn add(text: &str, category: Option<&str>, line: &str) -> (String, u32) {
    let unix = titled(&text.replace("\r\n", "\n"));
    let (edited, at) = insert_at(&unix, category, usize::MAX, &[line.to_string()]);
    let edited = match text.contains("\r\n") {
        true => edited.replace('\n', "\r\n"),
        false => edited,
    };
    (edited, u32::try_from(at + 1).unwrap_or(u32::MAX))
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
        Ok::<_, ()>(insert_at(text, category, index, lines).0)
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

/// The note with the id `id`.
pub fn note(text: &str, id: &str) -> Option<Note> {
    parse(text).into_iter().find(|note| note.id == id)
}

/// A note's lines as another file takes them, its marks dropped from its first line, and how many
/// of them are its text: the others are its nested lines.
pub fn unmarked_lines(text: &str, id: &str) -> Option<(Vec<String>, usize)> {
    let unix = text.replace("\r\n", "\n");
    let item = find(&unix, id)?;
    let lines: Vec<&str> = unix.split('\n').collect();
    let (_, first) = item_marker(lines[item.line - 1])?;
    let (_, _, rest) = marks(first);
    let mut unmarked = vec![format!("{} {rest}", item.marker.render())];
    unmarked.extend(lines[item.line..item.end].iter().map(|l| l.to_string()));
    Some((unmarked, item.text_end + 1 - item.line))
}

/// What a draft made from a note holds: the markdown of its text without its marks, on one line,
/// and its nested lines, code included, without the indent they share.
pub fn draft_parts(text: &str, id: &str) -> Option<(String, Vec<String>)> {
    let (lines, text_lines) = unmarked_lines(text, id)?;
    let (_, first) = item_marker(&lines[0])?;
    let title = std::iter::once(first)
        .chain(lines[1..text_lines].iter().map(|l| l.trim()))
        .collect::<Vec<_>>()
        .join(" ");
    let nested = lines::dedented(&lines[text_lines..]);
    Some((title.trim().to_string(), nested))
}

/// The markdown of the text of a note that is a whole link: what the link's text says, unescaped.
pub fn link_title(text: &str, id: &str) -> Option<String> {
    let (lines, _) = unmarked_lines(text, id)?;
    let (_, first) = item_marker(&lines[0])?;
    link_text(first)
}

/// What the text of a link starting `markdown` says, unescaped.
pub(crate) fn link_text(markdown: &str) -> Option<String> {
    let (inner, _) = markdown.strip_prefix('[')?.rsplit_once("](")?;
    Some(lines::unescape_link_text(inner))
}

/// The text, without markdown, of the entry Make a draft writes for the note `id`: its markdown as
/// the text of a link, escaped as [`link_to`] escapes it.
pub fn drafted_text(text: &str, id: &str) -> Option<String> {
    let (title, _) = draft_parts(text, id)?;
    Some(lines::plain(&link_to(&title, "draft.md")).0)
}

/// A note's text as a link to `target`, its markdown kept.
pub fn link_to(markdown: &str, target: &str) -> String {
    format!("[{}]({target})", lines::escape_link_text(markdown))
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
        Ok::<_, ()>(insert_at(&without, category, usize::MAX, &lines).0)
    })
    .ok()
}
