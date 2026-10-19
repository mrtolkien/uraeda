//! A proposal, a feature's or a change's: how far discovery researches it, and which of its `##` sections
//! are written yet.

use crate::check::allowed_values;
use crate::workspace::FileKind;

use super::{frontmatter, markdown};

/// The effort discovery puts in when the proposal names none, or a value that is not one.
const DEFAULT_DISCOVERY: &str = "high";

/// The discovery efforts a proposal may ask for, from the least research to the most.
pub fn discovery_levels() -> &'static [&'static str] {
    allowed_values(FileKind::Proposal, "discovery")
}

/// The effort a proposal's `discovery` field asks for: `high` without the field, or with a value
/// that is not one of the levels.
pub fn discovery(text: &str) -> &'static str {
    let front = frontmatter::parse(text).ok();
    let value = front.as_ref().and_then(|front| front.raw("discovery"));
    discovery_levels()
        .iter()
        .find(|level| Some(**level) == value)
        .copied()
        .unwrap_or(DEFAULT_DISCOVERY)
}

/// The text with its `discovery` field set to `level`, its comment kept; refused for a value that
/// is not a level.
pub fn set_discovery(text: &str, level: &str) -> Result<String, String> {
    let levels = discovery_levels();
    if !levels.contains(&level) {
        return Err(format!(
            "discovery \"{level}\" is not one of {}",
            levels.join(", ")
        ));
    }
    Ok(frontmatter::set(text, "discovery", level))
}

/// A part of the text: before its first `##` heading, without one, or under one.
struct Section {
    heading: Option<String>,
    text: String,
}

/// The text's parts: what comes before the first `##` heading, then each `##` section, without
/// the frontmatter and the `#` title.
fn sections(text: &str) -> Vec<Section> {
    let document = markdown::Document::parse(text);
    let body_start = frontmatter::block(text).map_or(1, |(_, end_line)| end_line + 1);
    let mut found = vec![Section {
        heading: None,
        text: String::new(),
    }];
    for (index, line) in text.lines().enumerate() {
        let number = index + 1;
        if number < body_start {
            continue;
        }
        match document.headings.iter().find(|h| h.line == number) {
            Some(heading) if heading.level == 2 => found.push(Section {
                heading: Some(heading.text.clone()),
                text: String::new(),
            }),
            Some(heading) if heading.level == 1 => {}
            _ => {
                let last = found.last_mut().expect("the part before any heading");
                last.text.push_str(line);
                last.text.push('\n');
            }
        }
    }
    found
}

/// Whether a proposal holds more than its title and What: text in any other part of it.
pub fn is_written(text: &str) -> bool {
    sections(text).iter().any(|section| {
        section.heading.as_deref() != Some("What") && !section.text.trim().is_empty()
    })
}

/// The headings of the `##` sections that hold no text yet, in order.
pub fn empty_sections(text: &str) -> Vec<String> {
    sections(text)
        .into_iter()
        .filter(|section| section.text.trim().is_empty())
        .filter_map(|section| section.heading)
        .collect()
}

/// Whether the line at `at` belongs to a list: an item at column 0, or a line indented under one,
/// blank lines between them included. Indented code under a paragraph is not.
fn in_list(lines: &[String], at: usize) -> bool {
    lines[..=at]
        .iter()
        .rev()
        .find(|line| !line.trim().is_empty() && !line.starts_with([' ', '\t']))
        .is_some_and(|line| super::lines::item_marker(line).is_some())
}

/// The `## What` section of a text with `\n` line endings: its heading's line, from 1, and the index,
/// from 0, of the line after it ends, at the next `#` or `##` heading outside fenced code, a `###`
/// subsection being part of it, or at the end of the text.
fn what_section(text: &str) -> Option<(usize, usize)> {
    let level = |line: &str| {
        let hashes = line.len() - line.trim_start_matches('#').len();
        let rest = &line[hashes..];
        (rest.is_empty() || rest.starts_with([' ', '\t'])).then_some(hashes)
    };
    let mut headings =
        super::lines::headings(text).filter(|(_, line)| level(line).is_some_and(|l| l <= 2));
    let (what, _) = headings
        .by_ref()
        .find(|(_, line)| line.trim_end() == "## What")?;
    let end = headings
        .next()
        .map_or(text.split('\n').count(), |(n, _)| n - 1);
    Some((what, end))
}

/// The text with `item`, a list item's lines, at the end of its `## What` section: right after a
/// list that ends it, or else after a blank line. `None` without a `## What` section.
pub fn append_to_what(text: &str, item: &[String]) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let (what, end) = what_section(text).ok_or(())?;
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        let last = (what..end).rev().find(|&i| !lines[i].trim().is_empty());
        let mut block = Vec::new();
        if !last.is_some_and(|i| in_list(&lines, i)) {
            block.push(String::new());
        }
        block.extend(item.iter().cloned());
        let at = last.unwrap_or(what - 1) + 1;
        if lines.get(at).is_some_and(|line| !line.trim().is_empty()) {
            block.push(String::new());
        }
        lines.splice(at..at, block);
        Ok::<_, ()>(lines.join("\n"))
    })
    .ok()
}

/// A draft's text without the last list item of its `## What` whose markdown is `markdown`, nested
/// lines included, and the blank line its addition put before it: a note's lines taken back out of
/// the section [`append_to_what`] put them in, every other edit kept, a same item elsewhere too.
/// `None` when no item of the What has that markdown.
pub fn without_item(text: &str, markdown: &str) -> Option<String> {
    super::with_unix_newlines(text, |text| {
        let all: Vec<&str> = text.split('\n').collect();
        let (what, end) = what_section(text).ok_or(())?;
        let (_, item) = super::lines::items(text, |_, _| Some(()))
            .into_iter()
            .filter(|(_, item)| item.line > what && item.line <= end)
            .rfind(|(_, item)| super::lines::signed_markdown(&all, item) == markdown)
            .ok_or(())?;
        let mut kept: Vec<&str> = all.clone();
        let at = item.line - 1;
        kept.drain(at..item.end);
        let blank = |i: usize| kept.get(i).is_none_or(|line| line.trim().is_empty());
        if at > 0 && blank(at - 1) && blank(at) && at < kept.len() {
            kept.remove(at - 1);
        }
        Ok::<_, ()>(kept.join("\n"))
    })
    .ok()
}

/// The file name of the image a line links, when the line is only an image of the `images/`
/// folder beside the file, as the core writes an attached image's link: `![alt](images/name.webp)`,
/// its alt text without brackets, and its name a WebP or a GIF, the core's encoded outputs.
pub fn image_file(line: &str) -> Option<&str> {
    let inner = line.trim_end().strip_prefix("![")?.strip_suffix(')')?;
    let (alt, name) = inner.split_once("](images/")?;
    let (stem, extension) = name.rsplit_once('.')?;
    let plain = !alt.contains(['[', ']'])
        && !stem.is_empty()
        && !stem.starts_with('.')
        && matches!(extension, "webp" | "gif")
        && !name.contains(['/', '\\', ' ', '(', ')', '<', '>', '[', ']']);
    plain.then_some(name)
}

/// Whether a draft a move wrote as `written` holds it still, with at most lines of images added at
/// the end of its `## What`, as a note's image adds them: the human typed nothing in it.
pub fn holds_written(text: &str, written: &str) -> bool {
    let images: Vec<String> = text
        .lines()
        .filter(|line| image_file(line).is_some())
        .map(String::from)
        .collect();
    if images.is_empty() {
        return text == written;
    }
    append_to_what(written, &images).is_some_and(|expected| expected == text)
}
