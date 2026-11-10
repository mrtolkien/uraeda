//! The motions: where a key takes the caret, and how an operator reads the text it crossed.

use crate::operator::Operator;
use crate::pair;
use crate::text::{Doc, Pos};
use crate::walk::Walker;
use crate::word;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Motion {
    Left,
    Right,
    Up,
    Down,
    Word { big: bool },
    Back { big: bool },
    End { big: bool },
    LineStart,
    FirstNonBlank,
    LineEnd,
    FirstLine,
    LastLine,
    Find(Find),
    Match,
    Paragraph { forward: bool },
}

/// A search for a character on the caret's line: `f`, `F`, `t`, and `T`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Find {
    pub target: char,
    pub forward: bool,
    /// Whether the caret stops one character short, as for `t` and `T`.
    pub till: bool,
    /// Whether `;` or `,` asked for it again.
    pub again: bool,
}

/// How an operator reads a motion.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Kind {
    /// Up to the place the motion reached, without its character.
    Exclusive,
    /// With the character it reached.
    Inclusive,
    /// The whole lines between its two ends.
    Line,
}

/// Where a motion goes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Target {
    pub pos: Pos,
    pub kind: Kind,
    /// The column `j` and `k` aim for after a motion between lines: a count of characters.
    pub want: Option<usize>,
}

impl Target {
    pub fn new(pos: Pos, kind: Kind) -> Target {
        Target {
            pos,
            kind,
            want: None,
        }
    }
}

/// What a motion runs on.
#[derive(Clone, Copy)]
pub(crate) struct Env<'a> {
    pub doc: Doc<'a>,
    pub from: Pos,
    pub count: Option<usize>,
    pub operator: Option<Operator>,
    pub visual: bool,
    /// The column a motion between lines aims for, when the last one set it.
    pub want: Option<usize>,
}

impl Env<'_> {
    fn times(&self) -> usize {
        self.count.unwrap_or(1)
    }
}

/// Where `motion` goes: none when it cannot move, as Vim beeps.
pub(crate) fn run(motion: Motion, env: &Env<'_>) -> Option<Target> {
    let (doc, from) = (env.doc, env.from);
    match motion {
        Motion::Left => left(env),
        Motion::Right => right(env),
        Motion::Up | Motion::Down => vertical(env, motion == Motion::Down),
        Motion::Word { big } => word_start(env, big),
        Motion::Back { big } => word_back(env, big),
        Motion::End { big } => word_end(env, big),
        Motion::LineStart => Some(Target::new(Pos::new(from.line, 0), Kind::Exclusive)),
        Motion::FirstNonBlank => Some(Target::new(
            Pos::new(from.line, doc.first_non_blank(from.line)),
            Kind::Exclusive,
        )),
        Motion::LineEnd => line_end(env),
        Motion::FirstLine => Some(to_line(env, env.count.map_or(0, |line| line - 1))),
        Motion::LastLine => Some(to_line(env, env.count.map_or(doc.last(), |line| line - 1))),
        Motion::Find(find) => find_char(env, find),
        Motion::Match => pair::percent(doc, from).map(|pos| Target::new(pos, Kind::Inclusive)),
        Motion::Paragraph { forward } => paragraph(env, forward),
    }
}

/// `h` stops at the line's start. Under an operator it never fails: `ch` there inserts.
fn left(env: &Env<'_>) -> Option<Target> {
    let mut pos = env.from;
    if pos.col == 0 && env.operator.is_none() {
        return None;
    }
    for _ in 0..env.times() {
        pos.col = env.doc.prev(pos);
    }
    Some(Target::new(pos, Kind::Exclusive))
}

/// `l` stops on the line's last character. Under an operator it reaches the line's end, so `x`
/// takes the last character, and in visual mode too, where the selection then takes the line
/// break.
fn right(env: &Env<'_>) -> Option<Target> {
    let line = env.from.line;
    let past = env.operator.is_some() || env.visual;
    let limit = if past {
        env.doc.len(line)
    } else {
        env.doc.last_col(line)
    };
    if env.from.col >= limit && env.operator.is_none() {
        return None;
    }
    let mut pos = env.from;
    for _ in 0..env.times() {
        pos.col = env.doc.next(pos).min(limit);
    }
    Some(Target::new(pos, Kind::Exclusive))
}

/// `j` and `k`: as many lines as there are, and none from the text's edge.
fn vertical(env: &Env<'_>, down: bool) -> Option<Target> {
    let line = env.from.line;
    let edge = if down { env.doc.last() } else { 0 };
    if line == edge {
        return None;
    }
    let line = if down {
        (line + env.times()).min(edge)
    } else {
        line.saturating_sub(env.times())
    };
    Some(to_line(env, line))
}

/// The caret's column on another line, as a motion over whole lines.
fn to_line(env: &Env<'_>, line: usize) -> Target {
    let line = line.min(env.doc.last());
    let want = env.want.unwrap_or_else(|| env.doc.column(env.from));
    let pos = Pos::new(line, env.doc.at_column(line, want));
    Target {
        pos,
        kind: Kind::Line,
        want: Some(want),
    }
}

/// `$`: the last character of the line, `count - 1` lines down. In visual mode it is the line's
/// end, so the selection takes the line break. `j` and `k` then stay at the lines' ends.
fn line_end(env: &Env<'_>) -> Option<Target> {
    let down = env.times() - 1;
    if down > 0 && env.from.line == env.doc.last() {
        return None;
    }
    let line = (env.from.line + down).min(env.doc.last());
    let col = if env.visual {
        env.doc.len(line)
    } else {
        env.doc.last_col(line)
    };
    Some(Target {
        pos: Pos::new(line, col),
        kind: Kind::Inclusive,
        want: Some(usize::MAX),
    })
}

/// `w` and `W`. Under `c`, on a word, it is `e`: the blanks after the word stay.
fn word_start(env: &Env<'_>, big: bool) -> Option<Target> {
    let mut walker = Walker::new(env.doc, env.from);
    let as_end = env.operator == Some(Operator::Change) && !walker.on_blank();
    let reached = if as_end {
        word::end(&mut walker, env.times(), big, true, false)
    } else {
        word::forward(&mut walker, env.times(), big, env.operator.is_some())
    };
    let kind = settle(
        &mut walker,
        env,
        if as_end {
            Kind::Inclusive
        } else {
            Kind::Exclusive
        },
    );
    (reached || env.operator.is_some() || walker.pos != env.from)
        .then(|| Target::new(walker.pos, kind))
}

fn word_end(env: &Env<'_>, big: bool) -> Option<Target> {
    let mut walker = Walker::new(env.doc, env.from);
    let reached = word::end(&mut walker, env.times(), big, false, false);
    let kind = settle(&mut walker, env, Kind::Inclusive);
    (reached || env.operator.is_some() || walker.pos != env.from)
        .then(|| Target::new(walker.pos, kind))
}

fn word_back(env: &Env<'_>, big: bool) -> Option<Target> {
    let mut walker = Walker::new(env.doc, env.from);
    let reached = word::backward(&mut walker, env.times(), big, false);
    (reached || (env.operator.is_none() && walker.pos != env.from))
        .then(|| Target::new(walker.pos, Kind::Exclusive))
}

/// A word motion never leaves the caret on a line's end, unless it did not move or the mode is
/// visual: it steps back onto the last character, which the operator then takes.
fn settle(walker: &mut Walker<'_>, env: &Env<'_>, kind: Kind) -> Kind {
    if walker.pos > env.from && walker.pos.col > 0 && walker.char().is_none() && !env.visual {
        walker.dec();
        return Kind::Inclusive;
    }
    kind
}

/// `f`, `F`, `t`, and `T`, on the caret's line. `;` after `t` does not stay before the character
/// it already stands before.
fn find_char(env: &Env<'_>, find: Find) -> Option<Target> {
    let (doc, from) = (env.doc, env.from);
    let line = doc.line(from.line);
    let skip = (find.till && find.again && env.times() == 1).then(|| {
        if find.forward {
            doc.next(from)
        } else {
            doc.prev(from)
        }
    });
    let hits = line
        .char_indices()
        .filter(|(col, c)| *c == find.target && Some(*col) != skip)
        .map(|(col, _)| col);
    let col = if find.forward {
        hits.filter(|col| *col > from.col).nth(env.times() - 1)?
    } else {
        let before: Vec<usize> = hits.filter(|col| *col < from.col).collect();
        *before.iter().rev().nth(env.times() - 1)?
    };
    let found = Pos::new(from.line, col);
    Some(match (find.forward, find.till) {
        (true, false) => Target::new(found, Kind::Inclusive),
        (true, true) => Target::new(Pos::new(from.line, doc.prev(found)), Kind::Inclusive),
        (false, false) => Target::new(found, Kind::Exclusive),
        (false, true) => Target::new(Pos::new(from.line, doc.next(found)), Kind::Exclusive),
    })
}

/// `{` and `}`: to the empty line that ends the paragraph. Past the last paragraph, `}` goes to
/// the text's last character and takes it.
fn paragraph(env: &Env<'_>, forward: bool) -> Option<Target> {
    let doc = env.doc;
    let mut line = env.from.line;
    for left in (0..env.times()).rev() {
        let mut in_text = false;
        let mut first = true;
        loop {
            in_text |= doc.len(line) > 0;
            if !first && in_text && doc.len(line) == 0 {
                break;
            }
            first = false;
            let edge = if forward { doc.last() } else { 0 };
            if line == edge {
                if left > 0 {
                    return None;
                }
                break;
            }
            line = if forward { line + 1 } else { line - 1 };
        }
    }
    if forward && line == doc.last() && doc.len(line) > 0 {
        return Some(Target::new(
            Pos::new(line, doc.last_col(line)),
            Kind::Inclusive,
        ));
    }
    Some(Target::new(Pos::new(line, 0), Kind::Exclusive))
}
