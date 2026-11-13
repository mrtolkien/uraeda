//! Text objects in visual mode. On a selection of one character an object selects itself; on a
//! longer one it extends the selection, each kind its own way, as Vim does: a word takes the
//! next word, a paragraph the next paragraph, and a pair or a tag the one around it.

use crate::object;
use crate::tag;
use crate::text::{Doc, Pos, Span};
use crate::visual::before;
use crate::walk::Walker;

/// The two ends of a selection of visual mode, both on a character.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Selection {
    pub anchor: Pos,
    pub cursor: Pos,
    pub linewise: bool,
}

impl Selection {
    fn is_one_character(&self) -> bool {
        self.anchor == self.cursor
    }

    fn low(&self) -> Pos {
        self.anchor.min(self.cursor)
    }

    /// Whether `span` holds nothing outside the selection.
    fn covers(&self, doc: Doc<'_>, span: &Span) -> bool {
        span.start >= self.low() && before(doc, span.end) <= self.anchor.max(self.cursor)
    }

    /// The selection of exactly `span`, as characters.
    fn of(doc: Doc<'_>, span: &Span) -> Option<Selection> {
        (span.start < span.end).then(|| Selection {
            anchor: span.start,
            cursor: before(doc, span.end),
            linewise: false,
        })
    }
}

/// The selection after the object `name`: none when there is no such object to take.
pub(crate) fn object(
    doc: Doc<'_>,
    selection: Selection,
    name: char,
    around: bool,
    count: usize,
) -> Option<Selection> {
    let Selection { anchor, cursor, .. } = selection;
    match name {
        'w' | 'W' => {
            let words = object::words(doc, cursor, Some(anchor), around, name == 'W', count)?;
            Some(Selection {
                anchor: words.start.unwrap_or(anchor),
                cursor: words.end,
                linewise: false,
            })
        }
        'p' => paragraphs(doc, selection, around, count),
        '(' | '[' | '{' => pair(doc, selection, name, around, count),
        't' => tags(doc, selection, around, count),
        _ => Selection::of(doc, &object::find(doc, cursor, name, around, count)?),
    }
}

/// A paragraph selects its lines. When the selection already spans lines, or is that paragraph,
/// the next paragraphs join it.
fn paragraphs(doc: Doc<'_>, selection: Selection, around: bool, count: usize) -> Option<Selection> {
    let Selection {
        anchor,
        cursor,
        linewise,
    } = selection;
    if cursor.line == anchor.line {
        let span = object::find(doc, cursor, 'p', around, count)?;
        if !(linewise && span.start.line == cursor.line) {
            let anchor = if anchor.line == span.start.line {
                anchor
            } else {
                span.start
            };
            return Some(Selection {
                anchor,
                cursor: span.end,
                linewise: true,
            });
        }
    }
    let line = more_paragraphs(doc, cursor.line, cursor.line < anchor.line, around, count);
    Some(Selection {
        anchor,
        cursor: Pos::new(line, 0),
        linewise,
    })
}

/// The line a selection reaches when `count` paragraphs join it, from `line`. Without `around`,
/// a run of blank lines counts as a paragraph.
fn more_paragraphs(doc: Doc<'_>, line: usize, backward: bool, around: bool, count: usize) -> usize {
    let edge = if backward { 0 } else { doc.last() };
    let step = |line: usize| if backward { line - 1 } else { line + 1 };
    let mut line = line;
    for _ in 0..count {
        let mut before_it = None;
        for _ in 0..2 {
            if line == edge {
                break;
            }
            let white = doc.is_white(step(line));
            if before_it == Some(white) {
                break;
            }
            line = step(line);
            while line != edge && doc.is_white(step(line)) == white {
                line = step(line);
            }
            if !around {
                break;
            }
            before_it = Some(white);
        }
    }
    line
}

/// A bracket pair around the selection's first end. An inner form that the selection already
/// holds takes the pair around it.
fn pair(
    doc: Doc<'_>,
    selection: Selection,
    name: char,
    around: bool,
    count: usize,
) -> Option<Selection> {
    if selection.is_one_character() {
        return Selection::of(
            doc,
            &object::find(doc, selection.cursor, name, around, count)?,
        );
    }
    let low = selection.low();
    let mut span = object::block(doc, low, name, around, count, false)?;
    if !around && span.start < span.end && selection.covers(doc, &span) {
        let mut outside = Walker::new(doc, low);
        outside.dec_over_end();
        span = object::block(doc, outside.pos, name, around, 1, false)?;
    }
    Selection::of(doc, &span)
}

/// A tag pair around the selection's first end, one more level out while the selection already
/// holds it.
fn tags(doc: Doc<'_>, selection: Selection, around: bool, count: usize) -> Option<Selection> {
    let mut levels = count;
    loop {
        let span = tag::find(doc, selection.low(), around, levels)?;
        if selection.is_one_character() || !selection.covers(doc, &span) {
            return Selection::of(doc, &span);
        }
        levels += 1;
    }
}
