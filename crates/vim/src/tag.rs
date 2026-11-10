//! The tag objects, `it` and `at`: an opening tag, its closing tag, and what they hold. This is
//! the one object that reads the whole text, as tags pair up from its start.

use crate::text::{Doc, Pos, Span};

/// One tag of the text, as byte offsets of the whole text.
struct Tag<'a> {
    name: &'a str,
    closing: bool,
    start: usize,
    /// The offset after its `>`.
    end: usize,
}

/// The tag pair around `pos`, `levels` pairs out: what it holds, or with `around` the tags too.
pub(crate) fn find(doc: Doc<'_>, pos: Pos, around: bool, levels: usize) -> Option<Span> {
    let text = doc.slice(Pos::new(0, 0), doc.end());
    let starts = line_starts(&text);
    let caret = starts[pos.line] + pos.col;
    let tags = tags(&text);
    let mut pairs = pairs(&tags);
    pairs.retain(|(open, close)| open.start <= caret && caret < close.end);
    pairs.sort_by_key(|(open, close)| close.end - open.start);
    let (open, close) = pairs.get(levels - 1)?;
    let (start, end) = if around {
        (open.start, close.end)
    } else {
        (open.end, close.start)
    };
    Some(Span::chars(place(&starts, start), place(&starts, end)))
}

fn line_starts(text: &str) -> Vec<usize> {
    std::iter::once(0)
        .chain(text.match_indices('\n').map(|(at, _)| at + 1))
        .collect()
}

fn place(starts: &[usize], offset: usize) -> Pos {
    let line = starts.partition_point(|start| *start <= offset) - 1;
    Pos::new(line, offset - starts[line])
}

/// Every opening and closing tag of a text, in order. A tag that closes itself, `<br/>`, is none.
fn tags(text: &str) -> Vec<Tag<'_>> {
    let mut tags = Vec::new();
    for (start, _) in text.match_indices('<') {
        let rest = &text[start + 1..];
        let closing = rest.starts_with('/');
        let rest = rest.strip_prefix('/').unwrap_or(rest);
        let name_end = rest
            .find(|c: char| !(c.is_alphanumeric() || matches!(c, '-' | '_' | ':' | '.')))
            .unwrap_or(rest.len());
        let Some(length) = rest.find('>') else {
            continue;
        };
        if name_end == 0
            || length < name_end
            || rest[..length].contains('<')
            || rest[..length].ends_with('/')
        {
            continue;
        }
        let end = start + 1 + usize::from(closing) + length + 1;
        tags.push(Tag {
            name: &rest[..name_end],
            closing,
            start,
            end,
        });
    }
    tags
}

/// The opening tags with the closing tags that end them: a closing tag ends the nearest open tag
/// of its name, and the tags left open inside it are dropped, as `<br>` is.
fn pairs<'a, 'b>(tags: &'b [Tag<'a>]) -> Vec<(&'b Tag<'a>, &'b Tag<'a>)> {
    let mut open: Vec<&Tag<'_>> = Vec::new();
    let mut pairs = Vec::new();
    for tag in tags {
        if !tag.closing {
            open.push(tag);
        } else if let Some(index) = open
            .iter()
            .rposition(|candidate| candidate.name == tag.name)
        {
            pairs.push((open[index], tag));
            open.truncate(index);
        }
    }
    pairs
}
