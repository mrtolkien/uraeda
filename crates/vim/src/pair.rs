//! Brackets and their matches, for `%` and the bracket objects.

use crate::text::{Doc, Pos};
use crate::walk::{Step, Walker};

const PAIRS: [(char, char); 3] = [('(', ')'), ('[', ']'), ('{', '}')];

/// The place of the bracket that matches the one at `pos`.
pub(crate) fn matching(doc: Doc<'_>, pos: Pos) -> Option<Pos> {
    let bracket = doc.char_at(pos)?;
    let (open, close) = PAIRS
        .into_iter()
        .find(|(open, close)| bracket == *open || bracket == *close)?;
    let forward = bracket == open;
    let other = if forward { close } else { open };
    let mut walker = Walker::new(doc, pos);
    let mut depth = 0;
    loop {
        let step = if forward { walker.inc() } else { walker.dec() };
        if step == Step::Stuck {
            return None;
        }
        match walker.char() {
            Some(found) if found == bracket => depth += 1,
            Some(found) if found == other && depth == 0 => return Some(walker.pos),
            Some(found) if found == other => depth -= 1,
            _ => {}
        }
    }
}

/// `%`: the match of the first bracket at or after `pos` on its line.
pub(crate) fn percent(doc: Doc<'_>, pos: Pos) -> Option<Pos> {
    let line = doc.line(pos.line);
    let is_bracket = |c: char| PAIRS.iter().any(|(open, close)| c == *open || c == *close);
    let offset = line.get(pos.col..)?.find(is_bracket)?;
    matching(doc, Pos::new(pos.line, pos.col + offset))
}

/// The nearest `open` before `pos` that nothing closes before `pos`.
fn open_before(doc: Doc<'_>, pos: Pos, open: char, close: char) -> Option<Pos> {
    let mut walker = Walker::new(doc, pos);
    let mut depth = 0;
    loop {
        if walker.dec() == Step::Stuck {
            return None;
        }
        match walker.char() {
            Some(found) if found == close => depth += 1,
            Some(found) if found == open && depth == 0 => return Some(walker.pos),
            Some(found) if found == open => depth -= 1,
            _ => {}
        }
    }
}

/// The first `open` after `pos`, on any line. With `inside`, `pos` is an opening bracket, and
/// the one found must be inside its pair.
fn open_after(doc: Doc<'_>, pos: Pos, (open, close): (char, char), inside: bool) -> Option<Pos> {
    let mut walker = Walker::new(doc, pos);
    while walker.inc() != Step::Stuck {
        match walker.char() {
            Some(found) if found == open => return Some(walker.pos),
            Some(found) if found == close && inside => return None,
            _ => {}
        }
    }
    None
}

/// The opening bracket of the pair around `pos`, `levels` pairs out. With `own`, a bracket under
/// `pos` is its own pair. With no pair around, it is the first opening bracket after `pos`, as
/// Neovim takes it, and `levels` then count inward.
pub(crate) fn enclosing(
    doc: Doc<'_>,
    pos: Pos,
    pair: (char, char),
    levels: usize,
    own: bool,
) -> Option<Pos> {
    let (open, close) = pair;
    let innermost = if own && doc.char_at(pos) == Some(open) {
        Some(pos)
    } else {
        open_before(doc, pos, open, close)
    };
    let mut found = innermost.or_else(|| open_after(doc, pos, pair, false))?;
    for _ in 1..levels {
        found = if innermost.is_some() {
            open_before(doc, found, open, close)?
        } else {
            open_after(doc, found, pair, true)?
        };
    }
    Some(found)
}
