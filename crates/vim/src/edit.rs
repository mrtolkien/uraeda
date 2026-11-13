//! The commands that change the text without an operator: `J`, `~`, `r`, `p`, and `P`.

use unicode_segmentation::UnicodeSegmentation;

use crate::Edit;
use crate::operator::Operator;
use crate::out::Out;
use crate::register::Entry;
use crate::repeat::Paste;
use crate::state::{State, Vim};
use crate::text::{Pos, Span, is_blank};
use crate::visual;

/// A text with the case of each letter switched.
fn switched(text: &str) -> String {
    let switch = |c: char| -> String {
        if c.is_lowercase() {
            c.to_uppercase().collect()
        } else {
            c.to_lowercase().collect()
        }
    };
    text.chars().map(switch).collect()
}

/// A span as characters: whole lines run from the first one's start to the last one's end.
fn whole(span: Span, out: &Out<'_>) -> Span {
    if !span.linewise {
        return span;
    }
    Span {
        at: span.at,
        ..Span::chars(
            span.start,
            Pos::new(span.end.line, out.doc.len(span.end.line)),
        )
    }
}

impl Vim {
    /// `J`: joins `lines` lines from `first`, as many as there are. Each line break and the
    /// blanks after it become one space, or none before a `)`, after a blank, or beside an empty
    /// line. The caret goes where the last two lines met.
    pub(crate) fn join(&mut self, first: usize, lines: usize, out: &mut Out<'_>) {
        let doc = out.doc;
        let last = (first + lines - 1).min(doc.last());
        if last == first {
            // Vim's own: a count of three or more on the last line sends the caret to its start.
            if lines > 2 {
                self.cursor.col = 0;
            }
            return;
        }
        let head = doc.line(first);
        let mut joined = String::new();
        let mut end = Pos::new(first, head.len());
        let mut meeting = head.len();
        for line in first + 1..=last {
            let text = doc.line(line);
            let rest = text.trim_start_matches(is_blank);
            let before = joined
                .chars()
                .next_back()
                .or_else(|| head.chars().next_back());
            let spaced =
                !rest.is_empty() && !rest.starts_with(')') && before.is_some_and(|c| !is_blank(c));
            meeting = head.len() + joined.len();
            joined.push_str(if spaced { " " } else { "" });
            end = Pos::new(line, text.len() - rest.len());
            if line < last {
                joined.push_str(rest);
            }
        }
        out.replace(Pos::new(first, head.len()), end, joined);
        self.cursor = Pos::new(first, meeting);
    }

    /// `~`: switches the case of `count` characters and moves past them, or of the selection.
    pub(crate) fn switch_case(&mut self, out: &mut Out<'_>) {
        let doc = out.doc;
        if matches!(self.mode, State::Visual { .. }) {
            let span = self.visual_span(out);
            let span = whole(span, out);
            out.replace(
                span.start,
                span.end,
                switched(&doc.slice(span.start, span.end)),
            );
            self.mode = State::Normal;
            self.cursor = span.at;
            return;
        }
        self.note_change(None);
        let start = self.cursor;
        let mut end = start;
        for _ in 0..self.pending.times() {
            end.col = doc.next(end);
        }
        if start < end {
            let text = switched(&doc.slice(start, end));
            self.cursor = Pos::new(start.line, start.col + text.len());
            out.replace(start, end, text);
        }
    }

    /// `r`: replaces `count` characters with `with`, and nothing when the line has fewer; in
    /// visual mode, every character of the selection.
    pub(crate) fn replace_char(&mut self, with: char, out: &mut Out<'_>) {
        let doc = out.doc;
        if matches!(self.mode, State::Visual { .. }) {
            let span = self.visual_span(out);
            let span = whole(span, out);
            let text = doc.slice(span.start, span.end);
            let replaced: String = text
                .graphemes(true)
                .map(|c| if c == "\n" { '\n' } else { with })
                .collect();
            out.replace(span.start, span.end, replaced);
            self.mode = State::Normal;
            self.cursor = span.at;
            return;
        }
        self.note_change(None);
        let (start, count) = (self.cursor, self.pending.times());
        let mut end = start;
        for _ in 0..count {
            if end.col >= doc.len(end.line) {
                return;
            }
            end.col = doc.next(end);
        }
        out.replace(start, end, with.to_string().repeat(count));
        self.cursor = Pos::new(start.line, start.col + with.len_utf8() * (count - 1));
    }

    /// `p` and `P`: puts the register the command names. The system clipboard's text is not the
    /// layer's to read: it asks for it, and puts it when [`Vim::clipboard`] brings it.
    pub(crate) fn put(&mut self, before: bool, out: &mut Out<'_>) {
        let paste = Paste {
            before,
            count: self.pending.times(),
        };
        if !matches!(self.mode, State::Visual { .. }) {
            self.note_change(None);
        }
        if self.pending.register == Some('+') {
            self.paste = Some(paste);
            out.effects.push(Edit::ReadClipboard);
            return;
        }
        match self.registers.read(self.pending.register).cloned() {
            Some(entry) => self.put_entry(&entry, paste, out),
            // Vim deletes the selection before it finds the register empty.
            None if matches!(self.mode, State::Visual { .. }) => {
                self.visual_operate(Operator::Delete, out)
            }
            None => {}
        }
    }

    /// Puts a register's text: lines go above or below the caret's line, other text before or
    /// after the caret, and either takes the selection's place in visual mode.
    pub(crate) fn put_entry(&mut self, entry: &Entry, paste: Paste, out: &mut Out<'_>) {
        if matches!(self.mode, State::Visual { .. }) {
            return self.put_over(entry, paste, out);
        }
        let (doc, cursor) = (out.doc, self.cursor);
        let line = cursor.line;
        if !entry.linewise {
            let text = entry.text.repeat(paste.count);
            let at = if paste.before {
                cursor
            } else {
                Pos::new(line, doc.next(cursor))
            };
            self.cursor = Self::put_end(at, &text);
            out.replace(at, at, text);
            return;
        }
        let lines = vec![entry.text.trim_end_matches('\n'); paste.count].join("\n");
        let target = if paste.before {
            out.replace(Pos::new(line, 0), Pos::new(line, 0), format!("{lines}\n"));
            line
        } else {
            let end = Pos::new(line, doc.len(line));
            out.replace(end, end, format!("\n{lines}"));
            line + 1
        };
        let after = out.after();
        self.cursor = Pos::new(target, after.doc().first_non_blank(target));
    }

    /// Where the caret goes after a text put at `at`: on its last character, or on its first when
    /// it has several lines.
    fn put_end(at: Pos, text: &str) -> Pos {
        if text.contains('\n') || text.is_empty() {
            return at;
        }
        let last = text
            .grapheme_indices(true)
            .next_back()
            .map_or(0, |(index, _)| index);
        Pos::new(at.line, at.col + last)
    }

    /// A put over the selection. `p` keeps what it replaced in the unnamed register, `P` does not.
    fn put_over(&mut self, entry: &Entry, paste: Paste, out: &mut Out<'_>) {
        let State::Visual { anchor, linewise } = self.mode else {
            return;
        };
        let doc = out.doc;
        let span = visual::span(doc, anchor, self.cursor, linewise);
        let whole = whole(span, out);
        let replaced = if linewise {
            doc.whole_lines(span.start.line, span.end.line)
        } else {
            doc.slice(span.start, span.end)
        };
        let body = entry.text.trim_end_matches('\n');
        let text = match (linewise, entry.linewise) {
            (false, true) => format!("\n{}\n", vec![body; paste.count].join("\n")),
            (true, true) => vec![body; paste.count].join("\n"),
            _ => entry.text.repeat(paste.count),
        };
        self.mode = State::Normal;
        self.cursor = match (linewise, entry.linewise) {
            (false, true) => Pos::new(whole.start.line + 1, 0),
            (true, _) => whole.start,
            (false, false) => Self::put_end(whole.start, &text),
        };
        out.replace(whole.start, whole.end, text);
        if !paste.before {
            self.pending.register = None;
            self.store(replaced, linewise, false, out);
        }
    }
}
