//! Link destinations rewritten in place: the links of `PRIORITIES.md` and `INBOX.md` to a file
//! that moved, as it becomes a folder or as a note file becomes a proposal file, a note's
//! relative links, as it moves into a file, and any file's links to files that moved or were
//! deleted.

use std::ops::Range;

use pulldown_cmark::{Event, LinkType, Parser, Tag, TagEnd};

use crate::moves::{Move, Went};

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

/// Points every link of `PRIORITIES.md` or `INBOX.md` to the file `from` at `to` instead, both
/// paths from the top level, wherever `to` is: a note file moved to the proposals. A rooted
/// destination stays rooted, and its anchor stays.
pub fn moved(text: &str, from: &str, to: &str) -> String {
    rewrite(text, |raw| {
        if !links_to(raw, from) {
            return None;
        }
        let anchor = raw.find('#').map_or("", |at| &raw[at..]);
        if raw.starts_with('/') {
            return Some(format!("/{to}{anchor}"));
        }
        Some(format!("{}{anchor}", rebased(to, "", "specs")?))
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

/// The text written in the folder `from`, from the top level, as written in the folder `to`, the
/// files of `moved` gone from each first path to its second: a link to one of them points where it
/// went, rooted when it was, and every other relative link is rebased, as [`rebase`] does. A note
/// file's text, its images moved, merged into a proposal file.
pub fn relocated(text: &str, from: &str, to: &str, moved: &[(String, String)]) -> String {
    rewrite(text, |raw| {
        let path = crate::workspace::resolve(from, raw)?;
        let Some((_, new)) = moved.iter().find(|(old, _)| *old == path) else {
            return (!raw.starts_with('/') && from != to)
                .then(|| rebased(raw, from, to))
                .flatten();
        };
        let rest = raw.find(['?', '#']).map_or("", |at| &raw[at..]);
        if raw.starts_with('/') {
            return Some(format!("/{new}{rest}"));
        }
        rebased(&format!("{new}{rest}"), "", to)
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

/// The text written in the folder `folder`, from the top level, with each link to a file of
/// `moves` pointing where it went, and the number of links changed. The first move taking a link
/// wins; moves are never chained. A moved file is linked rooted when it was, else relative to
/// `folder`, its `?query` and anchor kept unless the move gives its own anchor, or matched on the
/// link's anchor. A record keeps the anchor of a question of a clarifications file, and no other.
/// An inline link or image to a deleted file becomes its words: a link's text as written, an
/// image's alt. A reference definition to a deleted file stays, and so do code and wikilinks.
pub fn relink(text: &str, folder: &str, moves: &[Move]) -> (String, usize) {
    edit_links(text, |found| {
        let raw = found.destination;
        let path = crate::workspace::resolve(folder, raw)?;
        let anchor = raw.split_once('#').map(|(_, anchor)| anchor);
        let (rest, went, on_anchor) = moves.iter().find_map(|each| {
            let rest = each.rest(&path, anchor)?;
            Some((rest, &each.went, each.from.contains('#')))
        })?;
        let before_anchor = raw.split('#').next().unwrap_or(raw);
        let (target, query) =
            before_anchor.split_at(before_anchor.find('?').unwrap_or(before_anchor.len()));
        let written = match went {
            Went::Moved {
                path: new,
                anchor: given,
            } => {
                let anchor = match (given.as_deref(), on_anchor) {
                    (Some(given), _) => Some(given),
                    (None, true) => None,
                    (None, false) => anchor,
                };
                // A link to a moved folder stays a link to a folder.
                let slash = if target.ends_with('/') && !rest.ends_with('/') {
                    "/"
                } else {
                    ""
                };
                written(raw, folder, &format!("{new}{rest}{slash}"), query, anchor)
            }
            Went::Record(record) => {
                let question = anchor.filter(|anchor| is_question(&path, anchor));
                written(raw, folder, record, "", question)
            }
            Went::Deleted { .. } => return found.words.map(|_| Edit::Words),
        };
        written.map(Edit::Destination)
    })
}

/// Whether `now` differs from `then` only by link destinations, or by links turned into their
/// words; true when they are equal. Every inline link and image of `now` has one in `then`, in
/// order, with the same words: a link added where `then` had plain words is a change.
pub fn only_links_changed(then: &str, now: &str) -> bool {
    if then == now {
        return true;
    }
    let (then, then_links) = reduced(then);
    let (now, now_links) = reduced(now);
    let mut then_links = then_links.iter();
    then == now
        && now_links
            .iter()
            .all(|link| then_links.any(|each| each == link))
}

/// The text with each inline link and image reduced to its words and each reference definition's
/// destination emptied, and the words of its inline links and images, in the order of their
/// destinations.
fn reduced(text: &str) -> (String, Vec<String>) {
    let mut links = Vec::new();
    let (reduced, _) = edit_links(text, |found| match found.words {
        Some(words) => {
            links.push(words.to_string());
            Some(Edit::Words)
        }
        None => Some(Edit::Destination(String::new())),
    });
    (reduced, links)
}

/// The destination `raw`, written in `folder`, pointing at `path` from the top level instead, with
/// `query` and `anchor`: rooted when `raw` was, else relative to `folder`. `None` when it would
/// climb out of the top level.
fn written(
    raw: &str,
    folder: &str,
    path: &str,
    query: &str,
    anchor: Option<&str>,
) -> Option<String> {
    let anchor = anchor
        .map(|anchor| format!("#{anchor}"))
        .unwrap_or_default();
    if raw.starts_with('/') {
        return Some(format!("/{path}{query}{anchor}"));
    }
    rebased(&format!("{path}{query}{anchor}"), "", folder)
}

/// Whether `anchor`, on a link to the file `path`, is a question of a clarifications file:
/// `clarifications-NN.md#q6-…`.
fn is_question(path: &str, anchor: &str) -> bool {
    let name = path.rsplit('/').next().unwrap_or(path);
    let clarifications = name
        .strip_prefix("clarifications-")
        .and_then(|rest| rest.strip_suffix(".md"))
        .is_some_and(|number| !number.is_empty() && number.bytes().all(|b| b.is_ascii_digit()));
    let mut chars = anchor.chars();
    clarifications
        && chars.next().is_some_and(|c| c.eq_ignore_ascii_case(&'q'))
        && chars.next().is_some_and(|c| c.is_ascii_digit())
}

/// A link destination met in a text, as written without its `<…>`, and the words of its inline
/// link or image: a link's text as written, an image's alt. A reference definition has none.
struct Found<'a> {
    destination: &'a str,
    words: Option<&'a str>,
}

/// What an edit makes of a link.
enum Edit {
    /// Its destination, written anew.
    Destination(String),
    /// Its words alone, without the link: for an inline link or image only.
    Words,
}

/// A destination's place in the text, without its `<…>`, and for an inline link or image, the
/// places of the whole link and of its words.
struct Place {
    destination: Range<usize>,
    link: Option<(Range<usize>, Range<usize>)>,
}

/// The text with each link destination `edit` gives a new one for, as written without its `<…>`:
/// inline links' and images', and reference definitions'.
fn rewrite(text: &str, edit: impl Fn(&str) -> Option<String>) -> String {
    edit_links(text, |found| edit(found.destination).map(Edit::Destination)).0
}

/// The text with each link edited as `edit` says, and the number of links it changed. A link
/// nested in one turned into its words is edited too, inside those words.
fn edit_links(text: &str, mut edit: impl FnMut(Found<'_>) -> Option<Edit>) -> (String, usize) {
    let mut replacements: Vec<(Range<usize>, String)> = Vec::new();
    let mut changed = 0;
    for place in places(text) {
        let destination = &text[place.destination.clone()];
        let words = place.link.as_ref().map(|(_, words)| &text[words.clone()]);
        match (edit(Found { destination, words }), place.link) {
            (Some(Edit::Destination(new)), _) if new != destination => {
                replacements.push((place.destination, new));
                changed += 1;
            }
            (Some(Edit::Words), Some((whole, words))) => {
                replacements.push((whole.start..words.start, String::new()));
                replacements.push((words.end..whole.end, String::new()));
                changed += 1;
            }
            _ => {}
        }
    }
    replacements.sort_by_key(|(place, _)| place.start);
    let mut edited = text.to_string();
    for (place, new) in replacements.into_iter().rev() {
        edited.replace_range(place, &new);
    }
    (edited, changed)
}

/// The places of a text's link destinations, in order: inline links' and images', nested ones
/// included, and reference definitions'. Code and wikilinks hold none.
fn places(text: &str) -> Vec<Place> {
    let parser = Parser::new_ext(text, crate::files::markdown::options());
    let mut places: Vec<Place> = parser
        .reference_definitions()
        .iter()
        .filter_map(|(_, definition)| {
            let label_end = label_end(text, definition.span.start)?;
            let destination = destination(text, label_end + 1)?;
            Some(Place {
                destination,
                link: None,
            })
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
                    places.extend(inline(text, range.clone(), text_end));
                }
            }
            _ => {}
        }
        for (_, text_end) in &mut open {
            *text_end = (*text_end).max(range.end);
        }
    }
    places.sort_by_key(|place| place.destination.start);
    places.dedup_by_key(|place| place.destination.clone());
    places
}

/// The place of the inline link or image at `whole`, whose text ends at `text_end` or after.
fn inline(text: &str, whole: Range<usize>, text_end: usize) -> Option<Place> {
    let words_end = text_end + text[text_end..whole.end].find("](")?;
    let words_start = whole.start + text[whole.start..].find('[')? + 1;
    let destination = destination(text, words_end + 2)?;
    Some(Place {
        destination,
        link: Some((whole, words_start..words_end)),
    })
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
    use super::{only_links_changed, rebase, relink, relocated};
    use crate::moves::{Move, Went};

    #[test]
    fn links_follow_their_moves() {
        let moves = [
            Move {
                from: "specs/proposals/a.md".to_string(),
                went: Went::Moved {
                    path: "specs/2026-11-10-a/proposal.md".to_string(),
                    anchor: None,
                },
            },
            Move {
                from: "specs/2026-10-10-cli-core".to_string(),
                went: Went::Record("specs/done/2026-10-10-cli-core.md".to_string()),
            },
            Move {
                from: "specs/2026-11-05-dark-mode".to_string(),
                went: Went::Deleted {
                    commit: "1a2b3c4".to_string(),
                    subject: "drop(dark-mode): no longer needed".to_string(),
                },
            },
        ];
        let cases = [
            ("[d](../proposals/a.md)", "[d](../2026-11-10-a/proposal.md)"),
            (
                "[d](/specs/proposals/a.md#why \"t\")",
                "[d](/specs/2026-11-10-a/proposal.md#why \"t\")",
            ),
            (
                "[d](<../proposals/a.md>)",
                "[d](<../2026-11-10-a/proposal.md>)",
            ),
            (
                "[q](../2026-10-10-cli-core/clarifications-01.md#q6-how-does-ura-run-git)",
                "[q](2026-10-10-cli-core.md#q6-how-does-ura-run-git)",
            ),
            (
                "[q](../2026-10-10-cli-core/discovery-01.md#important-reads)",
                "[q](2026-10-10-cli-core.md)",
            ),
            (
                "[f](../2026-10-10-cli-core/)",
                "[f](2026-10-10-cli-core.md)",
            ),
            (
                "[Dark mode](/specs/2026-11-05-dark-mode/proposal.md)",
                "Dark mode",
            ),
            ("![alt](../2026-11-05-dark-mode/x.png)", "alt"),
            (
                "[![i](../x.png)](/specs/2026-11-05-dark-mode/proposal.md)",
                "![i](../x.png)",
            ),
            ("`[d](../proposals/a.md)`", "`[d](../proposals/a.md)`"),
            ("[[a]]", "[[a]]"),
            ("[d](../proposals/b.md)", "[d](../proposals/b.md)"),
            (
                "[d][x]\n\n[x]: ../2026-11-05-dark-mode/proposal.md",
                "[d][x]\n\n[x]: ../2026-11-05-dark-mode/proposal.md",
            ),
        ];
        for (text, expected) in cases {
            assert_eq!(relink(text, "specs/done", &moves).0, expected, "{text}");
        }
        assert_eq!(
            relink(
                "[a](../proposals/a.md), [b](../2026-11-05-dark-mode/) and [c](c.md)",
                "specs/done",
                &moves
            ),
            (
                "[a](../2026-11-10-a/proposal.md), b and [c](c.md)".to_string(),
                2
            )
        );
    }

    #[test]
    fn only_links_changed_reads_link_edits_alone() {
        let then = "See [the spec](../a/spec.md) and [old](../gone.md).";
        let cases = [
            ("See [the spec](../b/spec.md) and [old](../gone.md).", true),
            ("See [the spec](../a/spec.md) and old.", true),
            (then, true),
            ("See [the spec](../a/spec.md) and [old](../gone.md)!", false),
            ("See [a spec](../a/spec.md) and [old](../gone.md).", false),
        ];
        for (now, expected) in cases {
            assert_eq!(only_links_changed(then, now), expected, "{now}");
        }
        assert!(!only_links_changed(
            "See the spec and old.",
            "See [the spec](../a/spec.md) and old."
        ));
    }

    #[test]
    fn moved_files_are_linked_where_they_went_and_the_others_rebased() {
        let moved = [(
            "specs/notes/dark/images/a.webp".to_string(),
            "specs/proposals/look/images/a-2.webp".to_string(),
        )];
        let cases = [
            ("![a](images/a.webp)", "![a](images/a-2.webp)"),
            ("![a](./images/a.webp#x)", "![a](images/a-2.webp#x)"),
            (
                "![a](/specs/notes/dark/images/a.webp)",
                "![a](/specs/proposals/look/images/a-2.webp)",
            ),
            ("[b](../other.md)", "[b](../../notes/other.md)"),
            ("[c](../../README.md)", "[c](../../README.md)"),
            ("[d](images/b.webp)", "[d](../../notes/dark/images/b.webp)"),
            ("[e](https://x.y) [f](#f)", "[e](https://x.y) [f](#f)"),
        ];
        for (text, expected) in cases {
            assert_eq!(
                relocated(text, "specs/notes/dark", "specs/proposals/look", &moved),
                expected,
                "{text}"
            );
        }
        assert_eq!(
            relocated("![a](images/a.webp)", "specs/notes", "specs/notes", &[]),
            "![a](images/a.webp)"
        );
    }

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
            ("[a](proposals/b.md)", "[a](b.md)"),
            (
                "[a](/README.md) [b](https://x.y) [c](#c) [d](mailto:a@b.c)",
                "[a](/README.md) [b](https://x.y) [c](#c) [d](mailto:a@b.c)",
            ),
            ("[a](../../out.md)", "[a](../../out.md)"),
            ("`[a](../x.md)`", "`[a](../x.md)`"),
        ];
        for (text, rebased) in cases {
            assert_eq!(rebase(text, "specs", "specs/proposals"), rebased, "{text}");
        }
    }
}
