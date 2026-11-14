//! Link destinations rewritten in place: any file's links to files that moved or were deleted.

use std::ops::Range;

use pulldown_cmark::{Event, LinkType, Parser, Tag, TagEnd};

use crate::moves::{Move, Went};

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
/// `moves` pointing where it went, and the number of links changed. The most specific move taking
/// a link wins, a file's over its folder's, and the first of moves as specific; moves are never
/// chained. A moved file is linked rooted when it was, else relative to
/// `folder`, its `?query` and anchor kept unless the move gives its own anchor, or matched on the
/// link's anchor. A record keeps the anchor of a question of a clarifications file, and no other.
/// An inline link or image to a deleted file becomes its words: a link's text as written, an
/// image's alt; so does one to a finished folder's file that is not markdown, such as an image. A
/// reference definition to a deleted file stays, and so do code and wikilinks.
pub fn relink(text: &str, folder: &str, moves: &[Move]) -> (String, usize) {
    edit_links(text, |found| {
        let raw = found.destination;
        let path = crate::workspace::resolve(folder, raw)?;
        let anchor = raw.split_once('#').map(|(_, anchor)| anchor);
        // The most specific move wins: the shortest rest, the first of equals.
        let (rest, went, on_anchor) = moves
            .iter()
            .filter_map(|each| {
                let rest = each.rest(&path, anchor)?;
                Some((rest, &each.went, each.from.contains('#')))
            })
            .min_by_key(|(rest, ..)| rest.len())?;
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
                // A link to a moved folder stays a link to a folder, unless the folder went into a
                // markdown file, as a merged note's folder goes into a proposal file.
                let to = format!("{new}{rest}");
                let slash = if target.ends_with('/') && !to.ends_with('/') && !to.ends_with(".md") {
                    "/"
                } else {
                    ""
                };
                written(raw, folder, &format!("{to}{slash}"), query, anchor)
            }
            // The finish deletes a folder's images and every other file but its markdown, whether
            // the move is the folder's or, from `ura check --fix`, the image's own.
            Went::Record(_) if !path.ends_with(".md") && (!rest.is_empty() || is_file(&path)) => {
                return found.words.map(|_| Edit::Words);
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

/// The destination `raw`, written in `folder`, pointing at `path` from the top level instead, with
/// `query` and `anchor`: rooted when `raw` was, else relative to `folder`. `None` when it would
/// climb out of the top level. The path's spaces and `%` are percent-encoded, unless `raw` holds a
/// space, as it can only inside `<…>`.
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
    let encoded;
    let path = if raw.contains(' ') {
        path
    } else {
        encoded = path.replace('%', "%25").replace(' ', "%20");
        encoded.as_str()
    };
    if raw.starts_with('/') {
        return Some(format!("/{path}{query}{anchor}"));
    }
    rebased(&format!("{path}{query}{anchor}"), "", folder)
}

/// Whether `anchor`, on a link to the file `path`, is a question of a clarifications file:
/// `clarifications-NN.md#q6-…`.
/// Whether `path` names a file by its extension, not a folder.
fn is_file(path: &str) -> bool {
    path.rsplit('/').next().is_some_and(|name| {
        name.rsplit_once('.')
            .is_some_and(|(stem, _)| !stem.is_empty())
    })
}

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
    use super::relink;
    use crate::moves::{Move, Went};

    #[test]
    fn links_follow_their_moves() {
        let moved = |from: &str, to: &str| Move {
            from: from.to_string(),
            went: Went::Moved {
                path: to.to_string(),
                anchor: None,
            },
        };
        let moves = [
            moved("specs/proposals/a.md", "specs/2026-11-10-a/proposal.md"),
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
            moved("specs/old", "specs/new"),
            moved("specs/proposals/s.md", "specs/my notes/s.md"),
            moved("specs/proposals/p.md#note-x", "specs/notes/x.md"),
            // `ura check --fix` finds a finished folder's image by its own path.
            Move {
                from: "specs/2026-10-12-gone/images/b.png".to_string(),
                went: Went::Record("specs/done/2026-10-12-gone.md".to_string()),
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
            ("[[../proposals/a.md]]", "[[../proposals/a.md]]"),
            ("![shot](../2026-10-10-cli-core/images/a.png)", "shot"),
            ("![shot](../2026-10-12-gone/images/b.png)", "shot"),
            ("[d](../old/my%20file.md)", "[d](../new/my%20file.md)"),
            ("[d](<../old/my file.md>)", "[d](<../new/my file.md>)"),
            ("[s](../proposals/s.md)", "[s](../my%20notes/s.md)"),
            ("[n](../proposals/p.md#Note-X)", "[n](../notes/x.md)"),
            (
                "[n](../proposals/p.md#other)",
                "[n](../proposals/p.md#other)",
            ),
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
}
