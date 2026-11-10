//! Visual mode: a selection from an anchor to the caret, both on a character, or whole lines.
//! The editor's selection has no character under its caret, so the layer keeps its own two ends
//! and gives the editor a range that covers both.

use crate::operator::Operator;
use crate::out::Out;
use crate::repeat::Shape;
use crate::select::{self, Selection};
use crate::state::{State, Vim};
use crate::text::{Doc, Pos, Span};

/// The place after the character at `pos`: the next line's start after a line's end, so a
/// selection that reaches a line's end takes its line break.
pub(crate) fn after(doc: Doc<'_>, pos: Pos) -> Pos {
    if pos.col < doc.len(pos.line) {
        Pos::new(pos.line, doc.next(pos))
    } else if pos.line < doc.last() {
        Pos::new(pos.line + 1, 0)
    } else {
        pos
    }
}

/// The place of the character before `pos`: the end of the line before, from a line's start.
pub(crate) fn before(doc: Doc<'_>, pos: Pos) -> Pos {
    if pos.col > 0 {
        Pos::new(pos.line, doc.prev(pos))
    } else if pos.line > 0 {
        Pos::new(pos.line - 1, doc.len(pos.line - 1))
    } else {
        pos
    }
}

/// What an operator takes from a selection.
pub(crate) fn span(doc: Doc<'_>, anchor: Pos, cursor: Pos, linewise: bool) -> Span {
    let (start, last) = if anchor <= cursor {
        (anchor, cursor)
    } else {
        (cursor, anchor)
    };
    if linewise {
        // The caret stays when it is on a line above the anchor's, and else goes to the first
        // line's start.
        let at = if cursor.line < anchor.line {
            cursor
        } else {
            Pos::new(anchor.line, 0)
        };
        Span::lines(start.line, last.line, at)
    } else {
        Span::chars(start, after(doc, last))
    }
}

/// The editor's selection for the layer's: its anchor, then its head.
pub(crate) fn selection(doc: Doc<'_>, anchor: Pos, cursor: Pos, linewise: bool) -> (Pos, Pos) {
    let span = span(doc, anchor, cursor, linewise);
    let (start, end) = if linewise {
        let last = span.end.line;
        let end = if last < doc.last() {
            Pos::new(last + 1, 0)
        } else {
            Pos::new(last, doc.len(last))
        };
        (span.start, end)
    } else {
        (span.start, span.end)
    };
    if anchor <= cursor {
        (start, end)
    } else {
        (end, start)
    }
}

impl Vim {
    /// A key of visual mode that is no motion and no operator.
    pub(crate) fn visual_command(&mut self, typed: char, out: &mut Out<'_>) {
        let State::Visual { anchor, linewise } = self.mode else {
            return;
        };
        match typed {
            'v' | 'V' if linewise == (typed == 'V') => self.mode = State::Normal,
            'v' | 'V' => {
                self.mode = State::Visual {
                    anchor,
                    linewise: typed == 'V',
                }
            }
            'o' => {
                self.mode = State::Visual {
                    anchor: self.cursor,
                    linewise,
                };
                self.cursor = anchor;
            }
            'x' => self.visual_operate(Operator::Delete, out),
            's' => self.visual_operate(Operator::Change, out),
            'J' => {
                let span = self.visual_span(out);
                let lines = anchor.max(self.cursor).line - span.start.line + 1;
                self.mode = State::Normal;
                self.cursor = span.start;
                self.join(span.start.line, lines.max(2), out);
            }
            '~' => self.switch_case(out),
            'p' | 'P' => self.put(typed == 'P', out),
            _ => {}
        }
    }

    /// The selection as an operator takes it, noted for `.` with its size.
    pub(crate) fn visual_span(&mut self, out: &Out<'_>) -> Span {
        let State::Visual { anchor, linewise } = self.mode else {
            return Span::chars(self.cursor, self.cursor);
        };
        let span = span(out.doc, anchor, self.cursor, linewise);
        self.note_change(Some(Shape::of(out.doc, &span)));
        span
    }

    /// An operator on the selection. A count before `>` or `<` is how many indents.
    pub(crate) fn visual_operate(&mut self, operator: Operator, out: &mut Out<'_>) {
        let State::Visual { anchor, linewise } = self.mode else {
            return;
        };
        if operator == Operator::Yank {
            return self.yank(span(out.doc, anchor, self.cursor, linewise), out);
        }
        let span = self.visual_span(out);
        match operator {
            Operator::Delete => self.delete(span, out),
            Operator::Change => self.change(span, out),
            _ => {
                // The lines the selection's two ends are on: a line break it takes adds none.
                let lines = Span::lines(
                    anchor.min(self.cursor).line,
                    anchor.max(self.cursor).line,
                    span.start,
                );
                self.shift(
                    lines,
                    self.pending.times(),
                    operator == Operator::Indent,
                    out,
                );
            }
        }
    }

    /// An object in visual mode: it selects itself, or extends the selection.
    pub(crate) fn visual_object(&mut self, name: char, around: bool, doc: Doc<'_>) {
        let State::Visual { anchor, linewise } = self.mode else {
            return;
        };
        let selection = Selection {
            anchor,
            cursor: self.cursor,
            linewise,
        };
        if let Some(found) = select::object(doc, selection, name, around, self.pending.times()) {
            self.mode = State::Visual {
                anchor: found.anchor,
                linewise: found.linewise,
            };
            self.cursor = found.cursor;
        }
    }
}
