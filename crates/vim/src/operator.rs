//! The operators, `d`, `c`, `y`, `>`, and `<`: what text a motion gives them, and what each does
//! with it. An operator runs once on the whole text its counted motion crossed, so it is one
//! replacement, and one step of undo.

use crate::Edit;
use crate::insert::Opened;
use crate::motion::{Kind, Target};
use crate::out::Out;
use crate::register::Entry;
use crate::state::{State, Vim};
use crate::text::{Doc, Pos, Span, TAB, is_blank};

/// The blanks one `>` adds to a line.
const INDENT: usize = 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Operator {
    Delete,
    Change,
    Yank,
    Indent,
    Outdent,
}

impl Operator {
    pub fn of(typed: char) -> Option<Operator> {
        Some(match typed {
            'd' => Operator::Delete,
            'c' => Operator::Change,
            'y' => Operator::Yank,
            '>' => Operator::Indent,
            '<' => Operator::Outdent,
            _ => return None,
        })
    }
}

/// The text a motion from `from` to `target` crosses.
pub(crate) fn span(doc: Doc<'_>, from: Pos, target: Target) -> Span {
    let (start, end) = if from <= target.pos {
        (from, target.pos)
    } else {
        (target.pos, from)
    };
    match target.kind {
        Kind::Line => Span::lines(start.line, end.line, start),
        Kind::Inclusive => Span::chars(start, Pos::new(end.line, doc.next(end))),
        Kind::Exclusive => Span::up_to(start, end),
    }
}

/// The text an operator takes of a motion's or an object's, by Vim's rules:
///
/// - an exclusive end at a line's first column, lines below the start, leaves that line alone:
///   the text ends at the end of the line before, and is whole lines when it starts in the indent;
/// - `d` over several lines, from the indent to a line's last blanks, takes whole lines.
fn settle(doc: Doc<'_>, span: Span, operator: Operator) -> Span {
    if span.linewise {
        return span;
    }
    let (start, mut end) = (span.start, span.end);
    if span.exclusive && end.col == 0 && end.line > start.line {
        if doc.in_indent(start) {
            return Span {
                exclusive: true,
                ..Span::lines(start.line, end.line - 1, start)
            };
        }
        end = Pos::new(end.line - 1, doc.len(end.line - 1));
    }
    let rest = doc.line(end.line);
    let to_line_end = rest
        .get(end.col..)
        .is_some_and(|rest| rest.chars().all(is_blank));
    if operator == Operator::Delete && end.line > start.line && to_line_end && doc.in_indent(start)
    {
        return Span::lines(start.line, end.line, start);
    }
    Span::chars(start, end)
}

/// A line with `levels` indents more, or less. An empty line stays empty.
fn shifted(line: &str, levels: usize, indent: bool) -> String {
    if line.is_empty() {
        return String::new();
    }
    let blanks = line.find(|c| !is_blank(c)).unwrap_or(line.len());
    let width = line[..blanks].chars().fold(0, |width, c| {
        if c == '\t' {
            (width / TAB + 1) * TAB
        } else {
            width + 1
        }
    });
    let width = if indent {
        width + INDENT * levels
    } else {
        width.saturating_sub(INDENT * levels)
    };
    format!("{}{}", " ".repeat(width), &line[blanks..])
}

impl Vim {
    /// Runs `operator` on `span`, and leaves operator-pending mode.
    pub(crate) fn operate(&mut self, operator: Operator, span: Span, out: &mut Out<'_>) {
        let span = settle(out.doc, span, operator);
        match operator {
            Operator::Yank => self.yank(span, out),
            Operator::Delete => {
                self.note_change(None);
                self.delete(span, out);
            }
            Operator::Change => {
                self.note_change(None);
                self.change(span, out);
            }
            Operator::Indent | Operator::Outdent => {
                self.note_change(None);
                self.shift(span, 1, operator == Operator::Indent, out);
            }
        }
    }

    /// Keeps a text in the register the command names, and says when the system clipboard gets
    /// it. Every operator that takes text comes through here.
    pub(crate) fn store(&mut self, text: String, linewise: bool, yank: bool, out: &mut Out<'_>) {
        self.operated = true;
        if let Some(copied) =
            self.registers
                .write(self.pending.register, Entry { text, linewise }, yank)
        {
            out.effects.push(Edit::Clipboard(copied));
        }
    }

    pub(crate) fn yank(&mut self, span: Span, out: &mut Out<'_>) {
        let text = if span.linewise {
            out.doc.whole_lines(span.start.line, span.end.line)
        } else {
            out.doc.slice(span.start, span.end)
        };
        self.store(text, span.linewise, true, out);
        self.mode = State::Normal;
        self.cursor = span.at;
    }

    pub(crate) fn delete(&mut self, span: Span, out: &mut Out<'_>) {
        self.mode = State::Normal;
        let doc = out.doc;
        if !span.linewise {
            if span.start < span.end {
                self.store(doc.slice(span.start, span.end), false, false, out);
                out.replace(span.start, span.end, "");
            }
            self.cursor = span.start;
            return;
        }
        let (first, last) = (span.start.line, span.end.line);
        let column = self.column(doc);
        self.store(doc.whole_lines(first, last), true, false, out);
        // The lines go with the line break after them, or the one before the last lines.
        let (start, end) = if last < doc.last() {
            (Pos::new(first, 0), Pos::new(last + 1, 0))
        } else if first > 0 {
            (
                Pos::new(first - 1, doc.len(first - 1)),
                Pos::new(last, doc.len(last)),
            )
        } else {
            (Pos::new(0, 0), Pos::new(last, doc.len(last)))
        };
        out.replace(start, end, "");
        let after = out.after();
        let line = first.min(after.doc().last());
        // Lines an exclusive motion gave up its last line for leave the caret on the first
        // character that is not blank; any other lines leave it in its column, as Neovim does.
        let col = if span.exclusive {
            after.doc().first_non_blank(line)
        } else {
            after.doc().at_column(line, column)
        };
        self.cursor = Pos::new(line, col);
    }

    /// `c`: deletes, then inserts. Whole lines leave one line, with the first one's indent.
    pub(crate) fn change(&mut self, span: Span, out: &mut Out<'_>) {
        let doc = out.doc;
        if !span.linewise {
            if span.start < span.end {
                self.store(doc.slice(span.start, span.end), false, false, out);
                out.replace(span.start, span.end, "");
            }
            self.start_insert(span.start, 1, None, out);
            return;
        }
        let (first, last) = (span.start.line, span.end.line);
        self.store(doc.whole_lines(first, last), true, false, out);
        let indent = doc.indent(first);
        let at = Pos::new(first, indent.len());
        out.replace(at, Pos::new(last, doc.len(last)), "");
        self.start_insert(
            at,
            1,
            Some(Opened {
                indent,
                line: false,
            }),
            out,
        );
    }

    /// `>` and `<` on the span's lines, `levels` indents at once.
    pub(crate) fn shift(&mut self, span: Span, levels: usize, indent: bool, out: &mut Out<'_>) {
        let doc = out.doc;
        let (first, last) = (span.start.line, span.end.line);
        let column = self.column(doc);
        let lines: Vec<String> = (first..=last)
            .map(|line| shifted(&doc.line(line), levels, indent))
            .collect();
        out.replace(
            Pos::new(first, 0),
            Pos::new(last, doc.len(last)),
            lines.join("\n"),
        );
        self.mode = State::Normal;
        let after = out.after();
        self.cursor = Pos::new(first, after.doc().at_column(first, column));
    }

    /// The column the caret keeps when its line changes under it, as Neovim keeps it.
    fn column(&self, doc: Doc<'_>) -> usize {
        self.want.unwrap_or_else(|| doc.column(self.cursor))
    }
}
