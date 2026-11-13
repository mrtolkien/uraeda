//! A place that steps through a text one character at a time, over line breaks, as Vim's cursor
//! does inside its word motions and objects: a line's end is a place of its own, between the
//! line's last character and the next line's first.

use std::borrow::Cow;

use crate::text::{Doc, Pos, is_blank};

/// What one step did.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum Step {
    /// Onto another character of the line.
    Within,
    /// Onto another line.
    Line,
    /// Onto the line's end, after its last character.
    End,
    /// Nowhere: the text ends there.
    Stuck,
}

impl Step {
    /// Whether the step left the line's characters.
    pub fn left_line(self) -> bool {
        matches!(self, Step::Line | Step::End)
    }
}

/// The class of a character, for word motions.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum Class {
    Blank,
    Punctuation,
    Word,
    /// Scripts written without spaces, where a change of script starts a word.
    Script(u8),
}

/// The class of `c`. With `big`, everything that is not blank is one class, as for `W`.
pub(crate) fn class(c: Option<char>, big: bool) -> Class {
    let Some(c) = c else { return Class::Blank };
    if c.is_whitespace() {
        return Class::Blank;
    }
    if big {
        return Class::Word;
    }
    match c {
        '\u{3040}'..='\u{309f}' => Class::Script(0),
        '\u{30a0}'..='\u{30ff}' => Class::Script(1),
        '\u{3400}'..='\u{4dbf}' | '\u{4e00}'..='\u{9fff}' => Class::Script(2),
        '\u{ac00}'..='\u{d7af}' => Class::Script(3),
        _ if c.is_alphanumeric() || c == '_' => Class::Word,
        _ => Class::Punctuation,
    }
}

pub(crate) struct Walker<'a> {
    doc: Doc<'a>,
    pub pos: Pos,
    line: Cow<'a, str>,
}

impl<'a> Walker<'a> {
    pub fn new(doc: Doc<'a>, pos: Pos) -> Walker<'a> {
        Walker {
            doc,
            pos,
            line: doc.line(pos.line),
        }
    }

    pub fn set(&mut self, pos: Pos) {
        if pos.line != self.pos.line {
            self.line = self.doc.line(pos.line);
        }
        self.pos = pos;
    }

    /// The character under the place: none at a line's end.
    pub fn char(&self) -> Option<char> {
        self.line.get(self.pos.col..)?.chars().next()
    }

    pub fn class(&self, big: bool) -> Class {
        class(self.char(), big)
    }

    pub fn on_blank(&self) -> bool {
        self.char().is_none_or(is_blank)
    }

    pub fn line_is_empty(&self) -> bool {
        self.line.is_empty()
    }

    pub fn on_last_line(&self) -> bool {
        self.pos.line == self.doc.last()
    }

    /// One character forward: onto the line's end after its last character, then the next line.
    pub fn inc(&mut self) -> Step {
        if self.pos.col < self.line.len() {
            self.pos.col = self.doc.next(self.pos);
            return if self.pos.col < self.line.len() {
                Step::Within
            } else {
                Step::End
            };
        }
        if self.on_last_line() {
            return Step::Stuck;
        }
        self.set(Pos::new(self.pos.line + 1, 0));
        Step::Line
    }

    /// One character back: from a line's start onto the end of the line before.
    pub fn dec(&mut self) -> Step {
        if self.pos.col > 0 {
            self.pos.col = self.doc.prev(self.pos);
            return Step::Within;
        }
        if self.pos.line == 0 {
            return Step::Stuck;
        }
        let line = self.pos.line - 1;
        self.set(Pos::new(line, self.doc.len(line)));
        Step::Line
    }

    /// One character forward, never stopping on the end of a line that has characters.
    pub fn inc_over_end(&mut self) -> Step {
        let step = self.inc();
        if step.left_line() && self.pos.col > 0 {
            self.inc()
        } else {
            step
        }
    }

    /// One character back, never stopping on the end of a line that has characters.
    pub fn dec_over_end(&mut self) -> Step {
        let step = self.dec();
        if step == Step::Line && self.pos.col > 0 {
            self.dec()
        } else {
            step
        }
    }
}
