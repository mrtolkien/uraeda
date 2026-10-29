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

/// The level of an ATX heading's line: its count of `#`, followed by a space, a tab, or nothing.
fn level(line: &str) -> Option<usize> {
    let hashes = line.len() - line.trim_start_matches('#').len();
    let rest = &line[hashes..];
    ((1..=6).contains(&hashes) && (rest.is_empty() || rest.starts_with([' ', '\t'])))
        .then_some(hashes)
}

/// The `## <name>` section of a text with `\n` line endings: its heading's line, from 1, and the
/// index, from 0, of the line after it ends, at the next `#` or `##` heading outside fenced code, a
/// `###` subsection being part of it, or at the end of the text.
fn section(text: &str, name: &str) -> Option<(usize, usize)> {
    let heading = format!("## {name}");
    let mut headings =
        super::lines::headings(text).filter(|(_, line)| level(line).is_some_and(|l| l <= 2));
    let (found, _) = headings
        .by_ref()
        .find(|(_, line)| line.trim_end() == heading)?;
    let end = headings
        .next()
        .map_or(text.split('\n').count(), |(n, _)| n - 1);
    Some((found, end))
}

/// The `## What` section of a text with `\n` line endings, as [`section`] gives it.
fn what_section(text: &str) -> Option<(usize, usize)> {
    section(text, "What")
}

/// A note file's text as a subsection of a proposal file's `## Notes`: `### <title>`, then the
/// file's text without its frontmatter, without its `#` title when it is `title`, and without its
/// empty sections, as the template leaves them, its headings shifted so the shallowest is a `####`.
/// `title` is the markdown of the note's title.
pub fn note_subsection(note: &str, title: &str) -> Vec<String> {
    let unix = note.replace("\r\n", "\n");
    let body = match frontmatter::block(&unix) {
        Ok((_, end)) => unix.split('\n').skip(end).collect::<Vec<_>>().join("\n"),
        Err(_) => unix,
    };
    let mut lines: Vec<String> = body.split('\n').map(String::from).collect();
    // The headings outside fenced code, by their index, from 0.
    let headings = |lines: &[String]| -> Vec<(usize, usize)> {
        let mut in_code = false;
        let mut found = Vec::new();
        for (at, line) in lines.iter().enumerate() {
            if super::is_fence(line) {
                in_code = !in_code;
            } else if !in_code && let Some(level) = level(line) {
                found.push((at, level));
            }
        }
        found
    };
    let text_of = |line: &str| {
        let inner = line.trim_start_matches('#').trim();
        let inner = inner.trim_end_matches('#').trim_end();
        super::lines::plain(inner).0
    };
    let first = lines.iter().position(|line| !line.trim().is_empty());
    if let Some(first) = first
        && level(&lines[first]) == Some(1)
        && text_of(&lines[first]) == super::lines::plain(title).0
    {
        lines.remove(first);
    }
    // A heading with no text and no subsection under it goes, until none is left.
    loop {
        let found = headings(&lines);
        let empty = (0..found.len()).find(|&i| {
            let (at, level) = found[i];
            let next = found.get(i + 1).copied();
            let end = next.map_or(lines.len(), |(next, _)| next);
            let own = lines[at + 1..end].iter().all(|line| line.trim().is_empty());
            own && next.is_none_or(|(_, next)| next <= level)
        });
        let Some(i) = empty else { break };
        lines.remove(found[i].0);
    }
    let found = headings(&lines);
    if let Some(shallowest) = found.iter().map(|(_, level)| *level).min() {
        for (at, level) in found {
            let shifted = (level + 4 - shallowest).min(6);
            lines[at] = format!("{}{}", "#".repeat(shifted), &lines[at][level..]);
        }
    }
    // Blank lines run together where sections left.
    let mut kept: Vec<String> = Vec::new();
    for line in lines {
        let blank = line.trim().is_empty();
        if blank
            && kept
                .last()
                .is_none_or(|last: &String| last.trim().is_empty())
        {
            continue;
        }
        kept.push(line);
    }
    while kept.last().is_some_and(|line| line.trim().is_empty()) {
        kept.pop();
    }
    let mut subsection = vec![format!("### {title}")];
    if !kept.is_empty() {
        subsection.push(String::new());
        subsection.extend(kept);
    }
    subsection
}

/// The text with `subsection`'s lines at the end of its `## Notes` section, after a blank line, or
/// under a `## Notes` added at its end when it has none.
pub fn append_to_notes(text: &str, subsection: &[String]) -> String {
    let edited = super::with_unix_newlines(text, |text| {
        let Some((notes, end)) = section(text, "Notes") else {
            let kept = text.trim_end_matches('\n');
            let before = if kept.is_empty() { "" } else { "\n\n" };
            return Ok::<_, ()>(format!(
                "{kept}{before}## Notes\n\n{}\n",
                subsection.join("\n")
            ));
        };
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        let last = (notes..end).rev().find(|&i| !lines[i].trim().is_empty());
        let at = last.unwrap_or(notes - 1) + 1;
        let mut block = vec![String::new()];
        block.extend(subsection.iter().cloned());
        if lines.get(at).is_some_and(|line| !line.trim().is_empty()) {
            block.push(String::new());
        }
        lines.splice(at..at, block);
        Ok(lines.join("\n"))
    });
    edited.unwrap_or_else(|()| text.to_string())
}

/// The `###` subsections of the `## Notes` section of a text with `\n` line endings: each one's
/// title without markdown, the index, from 0, of its heading's line, and the index of the line
/// after it ends, at the next heading of its level or above, or at the end of the section.
fn note_subsections(text: &str) -> Vec<(String, usize, usize)> {
    let Some((notes, end)) = section(text, "Notes") else {
        return Vec::new();
    };
    let headings: Vec<(usize, usize, &str)> = super::lines::headings(text)
        .filter(|(number, _)| *number > notes && *number <= end)
        .filter_map(|(number, line)| Some((number - 1, level(line)?, line)))
        .collect();
    headings
        .iter()
        .enumerate()
        .filter(|(_, (_, level, _))| *level == 3)
        .map(|(i, (at, _, line))| {
            let after = headings[i + 1..]
                .iter()
                .find(|(_, level, _)| *level <= 3)
                .map_or(end, |(next, _, _)| *next);
            let inner = line.trim_start_matches('#').trim();
            let inner = inner.trim_end_matches('#').trim_end();
            (super::lines::plain(inner).0, *at, after)
        })
        .collect()
}

/// Whether a proposal file's text has a `## Notes` section.
pub fn has_notes(text: &str) -> bool {
    section(&text.replace("\r\n", "\n"), "Notes").is_some()
}

/// The titles, without markdown, of the `###` subsections of a proposal file's `## Notes`: the
/// notes with a note file added to it, among others.
pub fn note_titles(text: &str) -> Vec<String> {
    note_subsections(&text.replace("\r\n", "\n"))
        .into_iter()
        .map(|(title, _, _)| title)
        .collect()
}

/// A proposal file's text without the last `###` subsection of its `## Notes` titled `title`,
/// without markdown, and the text it held: a note file's text taken back out of the section
/// [`append_to_notes`] put it in, every other edit kept. With `drop_notes`, a `## Notes` left
/// empty goes too, as the add wrote it. `None` when no subsection has that title.
pub fn without_note(text: &str, title: &str, drop_notes: bool) -> Option<(String, String)> {
    let mut removed = String::new();
    let edited = super::with_unix_newlines(text, |text| {
        let (_, at, end) = note_subsections(text)
            .into_iter()
            .rfind(|(found, _, _)| found == title)
            .ok_or(())?;
        let mut lines: Vec<&str> = text.split('\n').collect();
        removed = lines.drain(at..end).collect::<Vec<_>>().join("\n");
        let kept = lines.join("\n");
        let Some((notes, end)) = section(&kept, "Notes").filter(|_| drop_notes) else {
            return Ok(kept);
        };
        let lines: Vec<&str> = kept.split('\n').collect();
        if !lines[notes..end].iter().all(|line| line.trim().is_empty()) {
            return Ok(kept);
        }
        let last = end == lines.len();
        let blank_before = notes >= 2 && lines[notes - 2].trim().is_empty();
        let start = if last && blank_before {
            notes - 2
        } else {
            notes - 1
        };
        let mut left: Vec<&str> = lines[..start].to_vec();
        left.extend(&lines[end..]);
        if last {
            left.push("");
        }
        Ok::<_, ()>(left.join("\n"))
    })
    .ok()?;
    Some((edited, removed))
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

/// A proposal file's text without the last list item of its `## What` whose markdown is `markdown`,
/// nested lines included, and the blank line its addition put before it: a note's lines taken back
/// out of the section [`append_to_what`] put them in, every other edit kept, a same item elsewhere
/// too. `None` when no item of the What has that markdown.
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

/// Whether a proposal file a move wrote as `written` holds it still, with at most lines of images
/// added at the end of its `## What`, as a note's image adds them: the human typed nothing in it.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_image_line_is_one_the_core_encoded_beside_the_file() {
        let cases = [
            (
                "![spec-headings](images/spec-headings.webp)",
                Some("spec-headings.webp"),
            ),
            ("![a](images/a-2.gif)", Some("a-2.gif")),
            ("![a](images/a.png)", None),
            ("![a](images/a)", None),
            ("![a\\]](images/a.webp)", None),
            ("![a](x)](images/a.webp)", None),
            ("![a](images/../a.webp)", None),
            ("![a](images/.webp)", None),
            ("![a](other/a.webp)", None),
            ("Text ![a](images/a.webp)", None),
        ];
        for (line, name) in cases {
            assert_eq!(image_file(line), name, "{line}");
        }
    }

    #[test]
    fn a_note_file_is_a_subsection_its_title_and_empty_sections_dropped() {
        let note = "---\ndiscovery: high\n---\n\n# Dark mode\n\n## What\n\nThe dark.\n\n\
                    ![a](images/a.webp)\n\n## Why\n\n## Notes\n\n### Kept\n\nYes.\n\n```\n# code\n```\n";
        assert_eq!(
            note_subsection(note, "Dark mode").join("\n"),
            "### Dark mode\n\n#### What\n\nThe dark.\n\n![a](images/a.webp)\n\n#### Notes\n\n\
             ##### Kept\n\nYes.\n\n```\n# code\n```"
        );
        // A title that is not the note's stays, nested under it.
        assert_eq!(
            note_subsection("# Other\n\nText.\n\n## What\n\nMore.\n", "Dark mode").join("\n"),
            "### Dark mode\n\n#### Other\n\nText.\n\n##### What\n\nMore."
        );
        assert_eq!(
            note_subsection("# Dark mode\n", "Dark mode"),
            ["### Dark mode"]
        );
    }

    #[test]
    fn a_subsection_goes_at_the_end_of_notes_or_under_a_new_notes() {
        let subsection = ["### Dark".to_string(), String::new(), "Text.".to_string()];
        let cases = [
            (
                "# A\n\n## What\n\nX.\n",
                "# A\n\n## What\n\nX.\n\n## Notes\n\n### Dark\n\nText.\n",
            ),
            (
                "# A\n\n## Notes\n\n- a\n\n## After\n\nY.\n",
                "# A\n\n## Notes\n\n- a\n\n### Dark\n\nText.\n\n## After\n\nY.\n",
            ),
            (
                "# A\n\n## Notes\n\n### First\n\nB.\n",
                "# A\n\n## Notes\n\n### First\n\nB.\n\n### Dark\n\nText.\n",
            ),
            (
                "# A\n\n## Notes\n",
                "# A\n\n## Notes\n\n### Dark\n\nText.\n",
            ),
            (
                "# A\r\n\r\n## Notes\r\n",
                "# A\r\n\r\n## Notes\r\n\r\n### Dark\r\n\r\nText.\r\n",
            ),
        ];
        for (text, expected) in cases {
            assert_eq!(append_to_notes(text, &subsection), expected, "{text}");
            assert_eq!(
                note_titles(expected).last().map(String::as_str),
                Some("Dark")
            );
            let drop_notes = !text.contains("## Notes");
            let (without, removed) = without_note(expected, "Dark", drop_notes).unwrap();
            assert_eq!(without, text, "{expected}");
            assert!(removed.contains("Text."), "{removed}");
        }
        assert_eq!(
            without_note("# A\n\n## Notes\n\n### Other\n", "Dark", true),
            None
        );
    }
}
