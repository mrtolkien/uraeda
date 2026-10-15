//! Link destinations rewritten in place: the links of `PRIORITIES.md` and `INBOX.md` to a draft
//! that moved, as it becomes a folder, and a note's relative links, as it moves into a draft.

use std::ops::Range;

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
    rewrite(text, |raw| {
        if !links_to(raw, from) {
            return None;
        }
        let (target, anchor) = match raw.split_once('#') {
            Some((target, anchor)) => (target, format!("#{anchor}")),
            None => (raw, String::new()),
        };
        let prefix = target.strip_suffix(file)?;
        Some(format!("{prefix}{moved}{anchor}"))
    })
}

/// The text written in the folder `from`, from the top level, with its relative links and images
/// pointing at the same files from the folder `to`: inline ones and reference definitions. Rooted
/// paths (`/…`), URLs, and anchors stay, and so does a link climbing out of the top level.
pub fn rebase(text: &str, from: &str, to: &str) -> String {
    if from == to {
        return text.to_string();
    }
    rewrite(text, |raw| {
        let is_file = !raw.starts_with('/') && crate::workspace::resolve(from, raw).is_some();
        is_file.then(|| rebased(raw, from, to)).flatten()
    })
}

/// A relative destination written in the folder `from`, as written in the folder `to`: its path
/// through their common folder, its `?query` and `#anchor` kept. `None` when it climbs out of the
/// top level.
fn rebased(raw: &str, from: &str, to: &str) -> Option<String> {
    let (path, rest) = raw.split_at(raw.find(['?', '#']).unwrap_or(raw.len()));
    let mut parts: Vec<&str> = from.split('/').filter(|part| !part.is_empty()).collect();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            part => parts.push(part),
        }
    }
    let base: Vec<&str> = to.split('/').filter(|part| !part.is_empty()).collect();
    let common = base.iter().zip(&parts).take_while(|(a, b)| a == b).count();
    let mut written = vec![".."; base.len() - common];
    written.extend(&parts[common..]);
    let mut joined = written.join("/");
    if joined.is_empty() {
        joined.push('.');
    }
    if path.ends_with('/') {
        joined.push('/');
    }
    Some(joined + rest)
}

/// The text with each link destination `edit` gives a new one for, as written without its `<…>`:
/// inline links' and images', and reference definitions'.
fn rewrite(text: &str, edit: impl Fn(&str) -> Option<String>) -> String {
    let parser = Parser::new_ext(text, crate::files::markdown::options());
    // Each destination's place in the text, without its `<…>`.
    let mut places: Vec<Range<usize>> = parser
        .reference_definitions()
        .iter()
        .filter_map(|(_, definition)| {
            let label_end = label_end(text, definition.span.start)?;
            destination(text, label_end + 1)
        })
        .collect();
    // The links and images being read, nested ones included: whether inline, and where their text
    // ends so far.
    let mut open: Vec<(bool, usize)> = Vec::new();
    for (event, range) in parser.into_offset_iter() {
        match event {
            Event::Start(Tag::Link { link_type, .. } | Tag::Image { link_type, .. }) => {
                open.push((link_type == LinkType::Inline, range.start + 1));
                continue;
            }
            Event::End(TagEnd::Link | TagEnd::Image) => {
                if let Some((true, text_end)) = open.pop() {
                    let after = text[text_end..range.end]
                        .find("](")
                        .map(|at| text_end + at + 2);
                    places.extend(after.and_then(|after| destination(text, after)));
                }
            }
            _ => {}
        }
        for (_, text_end) in &mut open {
            *text_end = (*text_end).max(range.end);
        }
    }
    places.sort_by_key(|place| place.start);
    places.dedup();
    let mut edited = text.to_string();
    for place in places.into_iter().rev() {
        if let Some(new) = edit(&text[place.clone()]) {
            edited.replace_range(place, &new);
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
fn destination(text: &str, start: usize) -> Option<Range<usize>> {
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

#[cfg(test)]
mod tests {
    use super::rebase;

    #[test]
    fn relative_links_are_rebased_and_the_others_kept() {
        let cases = [
            ("[a](../README.md)", "[a](../../README.md)"),
            ("[a](done/x.md#why)", "[a](../done/x.md#why)"),
            ("[a](<my file.md>)", "[a](<../my file.md>)"),
            (
                "[![i](images/a.png)](../x.md)",
                "[![i](../images/a.png)](../../x.md)",
            ),
            ("[a]\n\n[a]: ../x.md", "[a]\n\n[a]: ../../x.md"),
            ("[a](drafts/b.md)", "[a](b.md)"),
            (
                "[a](/README.md) [b](https://x.y) [c](#c) [d](mailto:a@b.c)",
                "[a](/README.md) [b](https://x.y) [c](#c) [d](mailto:a@b.c)",
            ),
            ("[a](../../out.md)", "[a](../../out.md)"),
            ("`[a](../x.md)`", "`[a](../x.md)`"),
        ];
        for (text, rebased) in cases {
            assert_eq!(rebase(text, "specs", "specs/drafts"), rebased, "{text}");
        }
    }
}
