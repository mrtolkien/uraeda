//! Vim's word motions, `w`, `b`, and `e`, step by step as Vim makes them: a word is a run of one
//! class of characters, an empty line is a word, and a line's end is a blank.

use crate::walk::{Class, Step, Walker};

/// `count` words forward, to a word's start. False when it started on the text's last character.
/// With `eol`, as under an operator, the last word stops at its line's end.
pub(crate) fn forward(walker: &mut Walker<'_>, count: usize, big: bool, eol: bool) -> bool {
    for left in (0..count).rev() {
        let start = walker.class(big);
        let last_line = walker.on_last_line();
        let stop_at_end = eol && left == 0;
        let step = walker.inc();
        if step == Step::Stuck || (step.left_line() && last_line) {
            return false;
        }
        if step.left_line() && stop_at_end {
            return true;
        }
        if (start != Class::Blank && skip(walker, big, start, stop_at_end))
            || skip_blanks(walker, big, stop_at_end)
        {
            return true;
        }
    }
    true
}

/// Steps past the rest of a run of `class`. True when the motion ends there.
fn skip(walker: &mut Walker<'_>, big: bool, class: Class, stop_at_end: bool) -> bool {
    while walker.class(big) == class {
        let step = walker.inc();
        if step == Step::Stuck || (step.left_line() && stop_at_end) {
            return true;
        }
    }
    false
}

/// Steps to the next character that is not blank, or onto an empty line. True when the motion
/// ends before one.
fn skip_blanks(walker: &mut Walker<'_>, big: bool, stop_at_end: bool) -> bool {
    while walker.class(big) == Class::Blank {
        if walker.pos.col == 0 && walker.line_is_empty() {
            break;
        }
        let step = walker.inc();
        if step == Step::Stuck || (step.left_line() && stop_at_end) {
            return true;
        }
    }
    false
}

/// `count` words back, to a word's start. False when it started at the text's start. With `stop`,
/// a place already on a word's start counts as one.
pub(crate) fn backward(walker: &mut Walker<'_>, count: usize, big: bool, stop: bool) -> bool {
    let mut stop = stop;
    for _ in 0..count {
        let start = walker.class(big);
        if walker.dec() == Step::Stuck {
            return false;
        }
        if !stop || start == walker.class(big) || start == Class::Blank {
            match back_to_start(walker, big) {
                Back::TextStart => return true,
                Back::EmptyLine => {
                    stop = false;
                    continue;
                }
                Back::Overshot => {}
            }
        }
        walker.inc();
        stop = false;
    }
    true
}

enum Back {
    /// The text's start came first: the motion ends there.
    TextStart,
    /// An empty line came first: it is a word.
    EmptyLine,
    /// One character before the word's start.
    Overshot,
}

/// Over the blanks before a word, then over the word.
fn back_to_start(walker: &mut Walker<'_>, big: bool) -> Back {
    while walker.class(big) == Class::Blank {
        if walker.pos.col == 0 && walker.line_is_empty() {
            return Back::EmptyLine;
        }
        if walker.dec() == Step::Stuck {
            return Back::TextStart;
        }
    }
    if run(walker, big, false) {
        Back::TextStart
    } else {
        Back::Overshot
    }
}

/// `count` words back, to a word's last character. False when it started at the text's start.
/// With `eol`, it stops at the end of the line before.
pub(crate) fn back_to_end(walker: &mut Walker<'_>, count: usize, big: bool, eol: bool) -> bool {
    for _ in 0..count {
        let start = walker.class(big);
        let step = walker.dec();
        if step == Step::Stuck {
            return false;
        }
        if eol && step == Step::Line {
            return true;
        }
        let ends = |step: Step| step == Step::Stuck || (eol && step == Step::Line);
        while start != Class::Blank && walker.class(big) == start {
            if ends(walker.dec()) {
                return true;
            }
        }
        while walker.class(big) == Class::Blank && !(walker.pos.col == 0 && walker.line_is_empty())
        {
            if ends(walker.dec()) {
                return true;
            }
        }
    }
    true
}

/// `count` words forward, to a word's last character. False when the text ends first. With
/// `stop`, a place already on a word's last character counts as its end, as `cw` wants; with
/// `empty`, an empty line is a word.
pub(crate) fn end(
    walker: &mut Walker<'_>,
    count: usize,
    big: bool,
    stop: bool,
    empty: bool,
) -> bool {
    let mut stop = stop;
    for _ in 0..count {
        let start = walker.class(big);
        if walker.inc() == Step::Stuck {
            return false;
        }
        if walker.class(big) == start && start != Class::Blank {
            if run(walker, big, true) {
                return false;
            }
        } else if !stop || start == Class::Blank {
            match to_next_end(walker, big, empty) {
                Some(true) => {}
                Some(false) => return false,
                None => {
                    stop = false;
                    continue;
                }
            }
        }
        walker.dec();
        stop = false;
    }
    true
}

/// Over blanks, then to the end of the word after them. None when it stops on an empty line.
fn to_next_end(walker: &mut Walker<'_>, big: bool, empty: bool) -> Option<bool> {
    while walker.class(big) == Class::Blank {
        if empty && walker.pos.col == 0 && walker.line_is_empty() {
            return None;
        }
        if walker.inc() == Step::Stuck {
            return Some(false);
        }
    }
    Some(!run(walker, big, true))
}

/// Steps over the run of characters of the place's class. True when the text ends first.
fn run(walker: &mut Walker<'_>, big: bool, forward: bool) -> bool {
    let class = walker.class(big);
    while walker.class(big) == class {
        let step = if forward { walker.inc() } else { walker.dec() };
        if step == Step::Stuck {
            return true;
        }
    }
    false
}

/// Back to the start of the run of one class the place is in, inside its line.
pub(crate) fn back_in_line(walker: &mut Walker<'_>, big: bool) {
    let class = walker.class(big);
    while walker.pos.col > 0 {
        walker.dec();
        if walker.class(big) != class {
            walker.inc();
            break;
        }
    }
}
