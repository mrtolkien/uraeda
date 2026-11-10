//! The text objects: a word, a paragraph, a quoted string, a bracket pair, a tag, each in its
//! inner form (`i`) and its form with what surrounds it (`a`).

use crate::pair;
use crate::tag;
use crate::text::{Doc, Pos, Span, is_blank};
use crate::walk::{Class, Step, Walker};
use crate::word;

/// The object `name` at `pos`, `count` of them or `count` levels out: none when the caret is in
/// no such object.
pub(crate) fn find(doc: Doc<'_>, pos: Pos, name: char, around: bool, count: usize) -> Option<Span> {
    match name {
        'w' => a_word(doc, pos, around, false, count),
        'W' => a_word(doc, pos, around, true, count),
        'p' => paragraph(doc, pos.line, around, count),
        '"' | '\'' | '`' => quoted(doc, pos, name, around, count),
        '(' | '[' | '{' => block(doc, pos, name, around, count, true),
        't' => tag::find(doc, pos, around, count),
        _ => None,
    }
}

/// A word object: where it ends, and where it starts when it does not extend a selection.
pub(crate) struct Words {
    /// The start: none when the object only extends a selection, whose other end stays.
    pub start: Option<Pos>,
    pub end: Pos,
    /// Whether the character at `end` is part of it.
    pub inclusive: bool,
}

/// `iw` and `aw`, as Vim selects them: the run of one class under the caret, and with `around`
/// the blanks after it, or the blanks before it when none follow. Each count more takes the next
/// run. With `anchor`, the other end of a selection of more than one character, the object
/// extends the selection instead, forward or backward as the selection runs.
pub(crate) fn words(
    doc: Doc<'_>,
    pos: Pos,
    anchor: Option<Pos>,
    around: bool,
    big: bool,
    count: usize,
) -> Option<Words> {
    let mut walker = Walker::new(doc, pos);
    let mut start = None;
    let mut inclusive = true;
    let mut white_before = false;
    let mut left = count;
    if anchor.is_none_or(|anchor| anchor == pos) {
        word::back_in_line(&mut walker, big);
        start = Some(walker.pos);
        if (walker.class(big) == Class::Blank) == around {
            word::end(&mut walker, 1, big, true, true).then_some(())?;
        } else {
            word::forward(&mut walker, 1, big, true);
            step_back(&mut walker);
            white_before = around;
        }
        left -= 1;
    }
    // Only a selection runs backward: an operator's object always grows forward.
    let backward = anchor.is_some() && start.or(anchor).is_some_and(|anchor| walker.pos < anchor);
    for left in (0..left).rev() {
        let more = if backward {
            one_back(&mut walker, around, big)
        } else {
            one_more(&mut walker, around, big, left > 0)
        };
        match more {
            Some(found) => inclusive = found,
            // A selection keeps what the object crossed before it failed, as Vim's does.
            None if anchor.is_some() => break,
            None => return None,
        }
    }
    if white_before && (walker.class(big) != Class::Blank || (walker.pos.col == 0 && !inclusive)) {
        start = start.map(|start| blanks_before(doc, start, big).unwrap_or(start));
    }
    Some(Words {
        start,
        end: walker.pos,
        inclusive,
    })
}

/// One more word or run of blanks, forward. Returns whether the place it stops on is part of it:
/// it is not after a line break.
fn one_more(walker: &mut Walker<'_>, around: bool, big: bool, more: bool) -> Option<bool> {
    (walker.inc_over_end() != Step::Stuck).then_some(())?;
    if around == (walker.class(big) == Class::Blank) {
        return word::end(walker, 1, big, true, true).then_some(true);
    }
    if !word::forward(walker, 1, big, true) && more {
        return None;
    }
    if walker.pos.col == 0 {
        return Some(false);
    }
    walker.dec();
    Some(true)
}

/// One more word or run of blanks, backward.
fn one_back(walker: &mut Walker<'_>, around: bool, big: bool) -> Option<bool> {
    (walker.dec_over_end() != Step::Stuck).then_some(())?;
    if around != (walker.class(big) != Class::Blank) {
        return word::backward(walker, 1, big, true).then_some(true);
    }
    word::back_to_end(walker, 1, big, true).then_some(())?;
    walker.inc_over_end();
    Some(true)
}

fn a_word(doc: Doc<'_>, pos: Pos, around: bool, big: bool, count: usize) -> Option<Span> {
    let words = words(doc, pos, None, around, big, count)?;
    let start = words.start?;
    // On the text's last line, when it is empty, Vim's object runs back onto the line before.
    let (start, end) = if words.end < start {
        (words.end, start)
    } else {
        (start, words.end)
    };
    if words.inclusive {
        return Some(Span::chars(start, Pos::new(end.line, doc.next(end))));
    }
    Some(Span::up_to(start, end))
}

/// Back onto the last character crossed: from a line's start, onto the line before.
fn step_back(walker: &mut Walker<'_>) {
    if walker.pos.col == 0 {
        walker.dec_over_end();
    } else {
        walker.dec();
    }
}

/// The start of the blanks before `start` on its line, unless they are the line's indent.
fn blanks_before(doc: Doc<'_>, start: Pos, big: bool) -> Option<Pos> {
    if start.col == 0 {
        return None;
    }
    let mut walker = Walker::new(doc, start);
    walker.dec();
    word::back_in_line(&mut walker, big);
    (walker.class(big) == Class::Blank && walker.pos.col > 0).then_some(walker.pos)
}

/// `ip` and `ap`: the lines of the paragraph, and with `around` the blank lines after it, or
/// before it when none follow. On blank lines, the object is the blank lines.
fn paragraph(doc: Doc<'_>, line: usize, around: bool, count: usize) -> Option<Span> {
    // Lines count from 1 here, as in Vim, so `end` can stand one line before the paragraph.
    let lines = doc.lines();
    let white = |line: usize| doc.is_white(line - 1);
    let mut start = line + 1;
    let white_in_front = white(start);
    while start > 1 && white(start - 1) == white_in_front {
        start -= 1;
    }
    let mut end = start;
    while end <= lines && white(end) {
        end += 1;
    }
    end -= 1;
    let mut left = if !around && white_in_front {
        count - 1
    } else {
        count
    };
    while left > 0 {
        left -= 1;
        if end == lines {
            return None;
        }
        let do_white = !around && white(end + 1);
        if around || !do_white {
            end += 1;
            while end < lines && !white(end + 1) {
                end += 1;
            }
        }
        if left == 0 && white_in_front && around {
            break;
        }
        while (around || do_white) && end < lines && white(end + 1) {
            end += 1;
        }
    }
    if !white_in_front && !white(end) && around {
        while start > 1 && white(start - 1) {
            start -= 1;
        }
    }
    Some(Span::lines(start - 1, end - 1, Pos::new(start - 1, 0)))
}

/// `i"` and `a"`, and the same for `'` and a backtick, on the caret's line. A caret on a quote
/// takes the string that quote opens or closes, counting quotes from the line's start; a caret
/// before every quote takes the line's first string. A count before the inner form takes the
/// quotes too.
fn quoted(doc: Doc<'_>, pos: Pos, quote: char, around: bool, count: usize) -> Option<Span> {
    let line = doc.line(pos.line);
    let quotes = unescaped(&line, quote);
    let (open, close) = if quotes.contains(&pos.col) {
        let pair = quotes
            .chunks_exact(2)
            .find(|pair| pair[0] <= pos.col && pos.col <= pair[1])?;
        (pair[0], pair[1])
    } else {
        match quotes.iter().rposition(|col| *col < pos.col) {
            Some(index) => (quotes[index], *quotes.get(index + 1)?),
            None => (*quotes.first()?, *quotes.get(1)?),
        }
    };
    // A count takes the quotes with the inner form, and no blank.
    let (mut start, mut end) = if count > 1 {
        (open, close + 1)
    } else {
        (open + 1, close)
    };
    if around {
        let after = line[close + 1..]
            .find(|c| !is_blank(c))
            .unwrap_or(line.len() - close - 1);
        let before = line[..open].len() - line[..open].trim_end_matches(is_blank).len();
        (start, end) = if after > 0 {
            (open, close + 1 + after)
        } else {
            (open - before, close + 1)
        };
    }
    Some(Span::chars(
        Pos::new(pos.line, start),
        Pos::new(pos.line, end),
    ))
}

/// The columns of the quotes of a line that no backslash escapes.
fn unescaped(line: &str, quote: char) -> Vec<usize> {
    let mut quotes = Vec::new();
    let mut escaped = false;
    for (col, c) in line.char_indices() {
        if c == quote && !escaped {
            quotes.push(col);
        }
        escaped = c == '\\' && !escaped;
    }
    quotes
}

/// A bracket pair and what it holds. The inner form of a pair that spans lines leaves each
/// bracket on its line: it starts after the line break that follows the opening one, and ends
/// before the indent of the closing one. With `own`, a bracket under `pos` is its own pair.
pub(crate) fn block(
    doc: Doc<'_>,
    pos: Pos,
    open: char,
    around: bool,
    count: usize,
    own: bool,
) -> Option<Span> {
    let close = match open {
        '(' => ')',
        '[' => ']',
        _ => '}',
    };
    let mut from = pos;
    if own && open == '{' && doc.in_indent(pos) && doc.char_at(pos).is_some_and(is_blank) {
        from.col = doc.first_non_blank(pos.line);
    }
    let opening = pair::enclosing(doc, from, (open, close), count, own)?;
    let closing = pair::matching(doc, opening)?;
    if around {
        return Some(Span::chars(
            opening,
            Pos::new(closing.line, doc.next(closing)),
        ));
    }
    let mut first = Walker::new(doc, opening);
    first.inc_over_end();
    let start = first.pos;
    let mut end = Walker::new(doc, closing);
    let mut line_start = closing.col == 0;
    end.dec_over_end();
    while end.char().is_some_and(is_blank) && doc.in_indent(end.pos) {
        line_start = true;
        if end.dec_over_end() != Step::Within {
            break;
        }
    }
    if line_start {
        end.inc_over_end();
        return Some(Span::up_to(start, end.pos.max(start)));
    }
    let last = Pos::new(end.pos.line, doc.next(end.pos));
    Some(Span::chars(start, last.max(start)))
}
