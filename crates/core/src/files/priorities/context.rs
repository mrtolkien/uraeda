//! A section's context: the first callout under its heading, before its first entry.

use super::{Section, lines};

/// The callout that tells what a section holds.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SectionContext {
    pub section: Section,
    /// The callout's first line, from 1.
    pub line: usize,
    /// The first paragraph after the marker as plain text: `None` when the marker stands alone.
    pub text: Option<String>,
}

/// The type of a callout's marker line, `[!TIP]`, and what follows it on the line.
fn marker(quote_line: &str) -> Option<&str> {
    let rest = quote_line.trim_start().strip_prefix("[!")?;
    let (kind, after) = rest.split_once(']')?;
    (!kind.is_empty() && kind.chars().all(|c| c.is_ascii_alphabetic())).then_some(after)
}

/// A quote line without its `>`, when it is one.
fn quoted(line: &str) -> Option<&str> {
    line.strip_prefix('>')
        .map(|rest| rest.strip_prefix(' ').unwrap_or(rest))
}

/// The text of the callout whose marker line is `lines[0]`, `after` the marker: its first paragraph.
fn text_of<'a>(after: &'a str, rest: &[&'a str]) -> Option<String> {
    let mut paragraph: Vec<&str> = Vec::new();
    let mut next = rest.iter().map_while(|line| quoted(line));
    let after = after.trim();
    if after.is_empty() {
        // The marker alone on its line: the text is the quote's next paragraph.
        for line in next.by_ref() {
            if !line.trim().is_empty() {
                paragraph.push(line.trim());
                break;
            }
        }
    } else {
        paragraph.push(after);
    }
    if paragraph.is_empty() {
        return None;
    }
    paragraph.extend(
        next.take_while(|line| !line.trim().is_empty())
            .map(str::trim),
    );
    let (text, _) = lines::plain(&paragraph.join(" "));
    Some(text).filter(|text| !text.is_empty())
}

/// One per heading of a section that has a callout before its first entry, in order.
pub fn contexts(text: &str) -> Vec<SectionContext> {
    let unix = text.replace("\r\n", "\n");
    let all: Vec<&str> = unix.split('\n').collect();
    let mut found = Vec::new();
    let mut index = 0;
    while index < all.len() {
        let Some(section) = Section::from_heading(all[index]) else {
            index += 1;
            continue;
        };
        index += 1;
        while index < all.len()
            && !all[index].starts_with('#')
            && lines::item_marker(all[index]).is_none()
        {
            let after = quoted(all[index]).and_then(marker);
            if let Some(after) = after {
                found.push(SectionContext {
                    section,
                    line: index + 1,
                    text: text_of(after, &all[index + 1..]),
                });
                break;
            }
            index += 1;
        }
    }
    found
}
