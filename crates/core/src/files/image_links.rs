//! A markdown file without its links to one image: what taking an image out of a note's file
//! writes. Each link is found by the parser, so a title, angle brackets, or brackets in its text
//! are cut with it.

use std::ops::Range;

use pulldown_cmark::{Event, LinkType, Parser, Tag, TagEnd};

use super::markdown::options;
use super::with_unix_newlines;

/// The byte ranges of the image links, `![alt](target)`, whose target `linked` takes: an image in
/// another's alt text and an Obsidian embed, `![[shot.png]]`, are no links of their own.
fn ranges(text: &str, linked: &impl Fn(&str) -> bool) -> Vec<Range<usize>> {
    let mut found = Vec::new();
    let mut depth = 0u32;
    for (event, range) in Parser::new_ext(text, options()).into_offset_iter() {
        match event {
            Event::Start(Tag::Image {
                link_type,
                dest_url,
                ..
            }) => {
                depth += 1;
                let wiki = matches!(link_type, LinkType::WikiLink { .. });
                if depth == 1 && !wiki && linked(&dest_url) {
                    found.push(range);
                }
            }
            Event::End(TagEnd::Image) => depth -= 1,
            _ => {}
        }
    }
    found
}

/// `line` without the parts the `cuts` take, from its offset `start` in the text; the spaces left
/// between two words become one, its indent kept, and none is left at its end.
fn cut(line: &str, start: usize, cuts: &[Range<usize>]) -> String {
    let kept: String = line
        .char_indices()
        .filter(|(at, _)| !cuts.iter().any(|range| range.contains(&(start + at))))
        .map(|(_, c)| c)
        .collect();
    let mut joined = String::new();
    let mut spaces = 0;
    for c in kept.trim_end().chars() {
        if c == ' ' {
            spaces += 1;
            continue;
        }
        let between = joined.chars().last().is_some_and(|last| last != ' ');
        let run = if between && spaces > 1 { 1 } else { spaces };
        joined.extend(std::iter::repeat_n(' ', run));
        joined.push(c);
        spaces = 0;
    }
    joined
}

/// The lines of `text` without the links `cuts` take: a line left empty goes, with the blank line
/// before it when a blank line or the end follows it, as each image is linked after a blank line.
fn without_ranges(text: &str, cuts: &[Range<usize>]) -> String {
    let lines: Vec<&str> = text.split('\n').collect();
    let mut kept: Vec<String> = Vec::new();
    let mut start = 0;
    for (index, line) in lines.iter().enumerate() {
        let (begin, end) = (start, start + line.len());
        let inside: Vec<Range<usize>> = cuts
            .iter()
            .filter(|range| range.start < end && range.end > start)
            .cloned()
            .collect();
        start = end + 1;
        if inside.is_empty() {
            kept.push((*line).to_string());
            continue;
        }
        let rest = cut(line, begin, &inside);
        if !rest.trim().is_empty() {
            kept.push(rest);
            continue;
        }
        let blank_next = lines
            .get(index + 1)
            .is_none_or(|next| next.trim().is_empty());
        if blank_next && kept.last().is_some_and(|last| last.trim().is_empty()) {
            kept.pop();
        }
    }
    kept.join("\n")
}

/// `text` without its image links whose target, as written, `linked` takes, or `None` when it has
/// none. Windows line endings are kept.
pub fn without_image(text: &str, linked: impl Fn(&str) -> bool) -> Option<String> {
    with_unix_newlines(text, |text| {
        let cuts = ranges(text, &linked);
        if cuts.is_empty() {
            return Err(());
        }
        Ok(without_ranges(text, &cuts))
    })
    .ok()
}
