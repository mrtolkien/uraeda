//! Insert mode. The editor types: the layer only knows where typing started, and reads what was
//! typed when Escape comes, for `.` and for a count.

use crate::out::Out;
use crate::state::{State, Vim};
use crate::text::{Doc, Pos, end_of};

/// A line the command opened or emptied before inserting.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Opened {
    /// The indent the line starts with, the one of the line the command was typed on.
    pub indent: String,
    /// Whether a count opens more lines, as for `o` and `O`: `cc` has one line whatever its count.
    pub line: bool,
}

/// One stay in insert mode.
#[derive(Debug)]
pub(crate) struct Session {
    /// Where typing started.
    start: Pos,
    /// The lines from `start`'s to the last one, and the bytes after `start` on its line: typing
    /// moves neither, so they tell what was typed from what was there.
    lines_below: usize,
    tail: usize,
    /// How many times the typed text goes in.
    count: usize,
    opened: Option<Opened>,
}

impl Session {
    /// What was typed from the session's start to `caret`: none when the caret left the place
    /// typing started at, or the text changed around it.
    fn typed(&self, doc: Doc<'_>, caret: Pos) -> Option<String> {
        let same_tail = doc.len(caret.line).checked_sub(caret.col) == Some(self.tail);
        let same_lines = doc.lines().checked_sub(caret.line) == Some(self.lines_below);
        (caret >= self.start && same_tail && same_lines).then(|| doc.slice(self.start, caret))
    }
}

/// `times` more copies of a typed text: each on a line of its own for an opened line.
fn copies(typed: &str, times: usize, opened: Option<&Opened>) -> String {
    match opened.filter(|opened| opened.line) {
        Some(opened) => format!("\n{}{typed}", opened.indent).repeat(times),
        None => typed.repeat(times),
    }
}

impl Vim {
    /// `i`, `a`, `I`, `A`, `o`, and `O`. A new line takes the indent of the caret's line.
    pub(crate) fn insert_command(&mut self, typed: char, out: &mut Out<'_>) {
        let (doc, cursor) = (out.doc, self.cursor);
        let (line, count) = (cursor.line, self.pending.times());
        self.note_change(None);
        let indent = doc.indent(line);
        let opened = Some(Opened {
            indent: indent.clone(),
            line: true,
        });
        match typed {
            'i' => self.start_insert(cursor, count, None, out),
            'a' => self.start_insert(Pos::new(line, doc.next(cursor)), count, None, out),
            'I' => self.start_insert(Pos::new(line, indent.len()), count, None, out),
            'A' => self.start_insert(Pos::new(line, doc.len(line)), count, None, out),
            'o' => {
                let end = Pos::new(line, doc.len(line));
                out.replace(end, end, format!("\n{indent}"));
                self.start_insert(Pos::new(line + 1, indent.len()), count, opened, out);
            }
            _ => {
                out.replace(Pos::new(line, 0), Pos::new(line, 0), format!("{indent}\n"));
                self.start_insert(Pos::new(line, indent.len()), count, opened, out);
            }
        }
    }

    /// Enters insert mode at `at`, a place of the text after the key's replacement. When `.`
    /// plays a change again, what that change typed goes in at once, and the mode stays normal.
    pub(crate) fn start_insert(
        &mut self,
        at: Pos,
        count: usize,
        opened: Option<Opened>,
        out: &mut Out<'_>,
    ) {
        if let Some(typed) = self.replaying.clone() {
            let text = format!("{typed}{}", copies(&typed, count - 1, opened.as_ref()));
            if !text.is_empty() {
                out.insert(at, &text);
            }
            self.mode = State::Normal;
            self.cursor = end_of(at, &text);
            self.step_back(out);
            return;
        }
        let after = out.after();
        let doc = after.doc();
        let session = Session {
            start: at,
            lines_below: doc.lines() - at.line,
            tail: doc.len(at.line) - at.col,
            count,
            opened,
        };
        self.mode = State::Insert(session);
        self.cursor = at;
    }

    /// Escape in insert mode: the typed text goes to `.`, a count puts it in again, an opened
    /// line left empty loses its indent, and the caret steps back onto a character.
    pub(crate) fn leave_insert(&mut self, out: &mut Out<'_>) {
        let State::Insert(session) = std::mem::take(&mut self.mode) else {
            return;
        };
        let (doc, caret) = (out.doc, self.cursor);
        let typed = session.typed(doc, caret);
        if let Some(repeat) = &mut self.repeat {
            repeat.typed.clone_from(&typed);
        }
        let typed = typed.unwrap_or_default();
        let line_end = Pos::new(caret.line, doc.len(caret.line));
        if typed.is_empty()
            && session.opened.is_some()
            && line_end.col > 0
            && doc.is_white(caret.line)
        {
            out.replace(Pos::new(caret.line, 0), line_end, "");
            self.cursor = Pos::new(caret.line, 0);
        } else if session.count > 1 && !typed.is_empty() {
            let more = copies(&typed, session.count - 1, session.opened.as_ref());
            out.insert(caret, &more);
            self.cursor = end_of(caret, &more);
        }
        self.step_back(out);
    }

    /// The caret one character back in its line, as Vim's steps back when it leaves insert mode.
    fn step_back(&mut self, out: &Out<'_>) {
        let after = out.after();
        let caret = after.doc().snap(self.cursor);
        self.cursor = Pos::new(caret.line, after.doc().prev(caret));
    }
}
