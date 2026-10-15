//! The links of `PRIORITIES.md` and `INBOX.md` to a draft that moved, as it becomes a folder.

use pulldown_cmark::{Event, LinkType, Parser, Tag, TagEnd};

/// Points every link of `PRIORITIES.md` or `INBOX.md` to the file `from` at `to` instead, both
/// paths from the top level, `to` under the folder holding `from`: inline links and reference
/// definitions, anywhere in the file. Only each destination's path changes: its `<…>`, its anchor,
/// its title, and the rest of the text stay as written.
pub fn retarget(text: &str, from: &str, to: &str) -> String {
    let Some((folder, file)) = from.rsplit_once('/') else {
        return text.to_string();
    };
    let Some(moved) = to.strip_prefix(folder).and_then(|to| to.strip_prefix('/')) else {
        return text.to_string();
    };
    let parser = Parser::new_ext(text, crate::files::markdown::options());
    // Each destination's place in the text, without its `<…>`.
    let mut places: Vec<std::ops::Range<usize>> = parser
        .reference_definitions()
        .iter()
        .filter(|(_, definition)| links_to(&definition.dest, from))
        .filter_map(|(_, definition)| {
            let label_end = label_end(text, definition.span.start)?;
            destination(text, label_end + 1)
        })
        .collect();
    // The link being read: its destination's file, and where its text ends so far.
    let mut link: Option<(bool, usize)> = None;
    for (event, range) in parser.into_offset_iter() {
        match event {
            Event::Start(Tag::Link {
                link_type: LinkType::Inline,
                dest_url,
                ..
            }) => link = Some((links_to(&dest_url, from), range.start + 1)),
            Event::End(TagEnd::Link) => {
                if let Some((true, text_end)) = link.take() {
                    let after = text[text_end..range.end]
                        .find("](")
                        .map(|at| text_end + at + 2);
                    places.extend(after.and_then(|after| destination(text, after)));
                }
            }
            _ => {
                if let Some((_, text_end)) = &mut link {
                    *text_end = (*text_end).max(range.end);
                }
            }
        }
    }
    places.sort_by_key(|place| place.start);
    places.dedup();
    let mut edited = text.to_string();
    for place in places.into_iter().rev() {
        let raw = &text[place.clone()];
        let (target, anchor) = match raw.split_once('#') {
            Some((target, anchor)) => (target, format!("#{anchor}")),
            None => (raw, String::new()),
        };
        if let Some(prefix) = target.strip_suffix(file) {
            edited.replace_range(place, &format!("{prefix}{moved}{anchor}"));
        }
    }
    edited
}

/// Whether a link's destination, written in a file of `specs/`, is the file `path`.
fn links_to(destination: &str, path: &str) -> bool {
    crate::workspace::resolve("specs", destination).as_deref() == Some(path)
}

/// The place of the `]` closing a reference definition's label, which starts at `start`.
fn label_end(text: &str, start: usize) -> Option<usize> {
    let mut escaped = false;
    for (at, c) in text[start..].char_indices().skip(1) {
        match c {
            _ if escaped => escaped = false,
            '\\' => escaped = true,
            ']' => {
                return text[start + at + 1..]
                    .starts_with(':')
                    .then_some(start + at + 1);
            }
            _ => {}
        }
    }
    None
}

/// The place of the link destination after `start`, past spaces and at most one line break, as
/// CommonMark reads it: inside `<…>`, else up to a space or an unbalanced `)`.
fn destination(text: &str, start: usize) -> Option<std::ops::Range<usize>> {
    let rest = &text[start..];
    let skipped = rest.len() - rest.trim_start_matches([' ', '\t']).len();
    let mut at = start + skipped;
    if text[at..].starts_with("\r\n") {
        at += 2;
    } else if text[at..].starts_with('\n') {
        at += 1;
    }
    let rest = &text[at..];
    let at = at + (rest.len() - rest.trim_start_matches([' ', '\t']).len());
    let rest = &text[at..];
    let mut escaped = false;
    if let Some(inner) = rest.strip_prefix('<') {
        for (end, c) in inner.char_indices() {
            match c {
                _ if escaped => escaped = false,
                '\\' => escaped = true,
                '>' => return Some(at + 1..at + 1 + end),
                '\n' | '<' => return None,
                _ => {}
            }
        }
        return None;
    }
    let mut depth = 0usize;
    for (end, c) in rest.char_indices() {
        match c {
            _ if escaped => escaped = false,
            '\\' => escaped = true,
            '(' => depth += 1,
            ')' if depth == 0 => return Some(at..at + end),
            ')' => depth -= 1,
            c if c.is_ascii_whitespace() || c.is_ascii_control() => return Some(at..at + end),
            _ => {}
        }
    }
    Some(at..text.len())
}
