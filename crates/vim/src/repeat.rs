//! `.`, which plays the last change again, and a put that waits for the system clipboard.

use crate::Key;
use crate::out::Out;
use crate::state::{Pending, State, Vim};
use crate::text::{Doc, Pos, Span};

/// The last change, as `.` plays it again.
#[derive(Clone, Debug)]
pub(crate) struct Repeat {
    /// The command's keys, without its counts.
    pub keys: Vec<Key>,
    /// Its count: the counts before and after an operator, multiplied.
    pub count: Option<usize>,
    /// What it typed in insert mode.
    pub typed: Option<String>,
    /// The size of the selection it ran on, for a change made in visual mode.
    pub shape: Option<Shape>,
}

/// The size of a selection: `.` runs a change of visual mode on as much text from the caret.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Shape {
    linewise: bool,
    /// How many lines it reaches below its first.
    lines: usize,
    /// How many characters it holds on its last line.
    chars: usize,
}

impl Shape {
    pub fn of(doc: Doc<'_>, span: &Span) -> Shape {
        let lines = span.end.line - span.start.line;
        let from = if lines == 0 {
            doc.column(span.start)
        } else {
            0
        };
        Shape {
            linewise: span.linewise,
            lines,
            chars: doc.column(span.end).saturating_sub(from).max(1),
        }
    }

    /// The other end of a selection of this size that starts at `from`.
    fn end(self, doc: Doc<'_>, from: Pos) -> Pos {
        let line = (from.line + self.lines).min(doc.last());
        if self.linewise {
            return Pos::new(line, from.col);
        }
        let first = if self.lines == 0 { doc.column(from) } else { 0 };
        Pos::new(
            line,
            doc.at_column(line, first + self.chars - 1)
                .min(doc.last_col(line)),
        )
    }
}

/// A put that asked for the system clipboard's text.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Paste {
    pub before: bool,
    pub count: usize,
}

impl Vim {
    /// Notes the command being run as the change `.` repeats. A change played by `.` is not noted.
    pub(crate) fn note_change(&mut self, shape: Option<Shape>) {
        if self.replaying.is_none() {
            self.repeat = Some(Repeat {
                keys: self.record.clone(),
                count: self.pending.total(),
                typed: None,
                shape,
            });
        }
    }

    /// `.`: the last change's keys again, with what it typed. A count takes the place of the
    /// change's own, for this time and the next.
    pub(crate) fn repeat(&mut self, out: &mut Out<'_>) {
        let Some(mut repeat) = self.repeat.take() else {
            return;
        };
        if let Some(count) = self.pending.total() {
            repeat.count = Some(count);
        }
        self.pending = Pending {
            count: repeat.count,
            ..Pending::default()
        };
        self.replaying = Some(repeat.typed.clone().unwrap_or_default());
        if let Some(shape) = repeat.shape {
            self.mode = State::Visual {
                anchor: self.cursor,
                linewise: shape.linewise,
            };
            self.cursor = shape.end(out.doc, self.cursor);
        }
        for key in &repeat.keys {
            self.feed(*key, out);
        }
        if matches!(self.mode, State::Visual { .. }) {
            self.mode = State::Normal;
        }
        self.prompt = None;
        self.replaying = None;
        self.repeat = Some(repeat);
    }
}
