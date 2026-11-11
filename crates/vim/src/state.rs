//! The state between keys, and the layer's doors: a key, the clipboard's text, a selection that
//! changed outside.

use crate::insert::Session;
use crate::motion::Find;
use crate::operator::Operator;
use crate::out::Out;
use crate::register::Registers;
use crate::repeat::{Paste, Repeat};
use crate::search::{Prompt, Search};
use crate::text::{Doc, Pos, Position, TextView};
use crate::visual;
use crate::{Edit, Key, Mode, Status};

/// The largest count a key takes: past it, a slip of the hand would fill the memory.
const MAX_COUNT: usize = 99_999;

/// Where the layer is, between keys.
#[derive(Debug, Default)]
pub(crate) enum State {
    #[default]
    Normal,
    Insert(Session),
    /// The selection runs from `anchor` to the caret, both on a character.
    Visual {
        anchor: Pos,
        linewise: bool,
    },
}

/// A key that waits for the one after it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Wait {
    /// `"`, for a register's name.
    Register,
    /// `g`, for `gg`.
    Go,
    /// `r`, for the character that replaces.
    Replace,
    /// `f`, `F`, `t`, or `T`, for the character to find.
    Find { forward: bool, till: bool },
    /// `i` or `a` after an operator or in visual mode, for an object's name.
    Object { around: bool },
}

/// What is typed of a command that has not run yet.
#[derive(Debug, Default)]
pub(crate) struct Pending {
    /// The count typed last: before the operator until one is typed, after it then.
    pub count: Option<usize>,
    pub operator: Option<Operator>,
    /// The count typed before the operator.
    pub operator_count: Option<usize>,
    pub register: Option<char>,
    pub wait: Option<Wait>,
}

impl Pending {
    /// The command's count: the counts before and after an operator multiply, as `2d3w` is `d6w`.
    pub fn total(&self) -> Option<usize> {
        match (self.operator_count, self.count) {
            (None, None) => None,
            (before, after) => Some(
                before
                    .unwrap_or(1)
                    .saturating_mul(after.unwrap_or(1))
                    .min(MAX_COUNT),
            ),
        }
    }

    pub fn times(&self) -> usize {
        self.total().unwrap_or(1)
    }

    pub fn digit(&mut self, digit: u32) {
        let count = self
            .count
            .unwrap_or(0)
            .saturating_mul(10)
            .saturating_add(digit as usize);
        self.count = Some(count.min(MAX_COUNT));
    }

    fn is_empty(&self) -> bool {
        self.count.is_none()
            && self.operator.is_none()
            && self.register.is_none()
            && self.wait.is_none()
    }
}

/// Vim's keys over a text, as a state machine: it reads a text and a selection, and returns what
/// the editor must do. It holds no text, draws nothing, and reaches nothing outside itself.
///
/// One `Vim` serves every text field, as one Vim serves every buffer: the registers, the last
/// search, and the change `.` repeats go from one field to the next. Call [`Vim::reset`] when the
/// focus moves to another field.
#[derive(Debug, Default)]
pub struct Vim {
    pub(crate) mode: State,
    /// The caret, in the text the current key runs on, then in the text after its replacement.
    pub(crate) cursor: Pos,
    pub(crate) pending: Pending,
    /// The keys of the command so far, as the status line shows them.
    pub(crate) typed: String,
    /// The same keys without their counts, which `.` plays again.
    pub(crate) record: Vec<Key>,
    /// The column `j` and `k` aim for, while motions between lines follow each other.
    pub(crate) want: Option<usize>,
    /// Whether the current key was a motion between lines, which keeps `want`.
    pub(crate) vertical: bool,
    /// Whether the current key ran an operator, which ends `want` even when the caret stays.
    pub(crate) operated: bool,
    pub(crate) registers: Registers,
    pub(crate) search: Search,
    pub(crate) prompt: Option<Prompt>,
    pub(crate) find: Option<Find>,
    pub(crate) repeat: Option<Repeat>,
    /// While `.` plays a change again: the text that change typed.
    pub(crate) replaying: Option<String>,
    /// A put that waits for the system clipboard's text.
    pub(crate) paste: Option<Paste>,
    /// The selection the layer last asked for: another one means it changed outside.
    expected: Option<(Position, Position)>,
    /// Whether the editor's history just moved: its selection then becomes a caret, not a
    /// selection of visual mode.
    settle: bool,
}

impl Vim {
    /// A layer in normal mode, with empty registers.
    #[must_use]
    pub fn new() -> Vim {
        Vim::default()
    }

    /// Back to normal mode with nothing pending, for another text field: the registers, the last
    /// search, and the change `.` repeats stay.
    pub fn reset(&mut self) {
        self.mode = State::Normal;
        self.prompt = None;
        self.paste = None;
        self.expected = None;
        self.settle = false;
        self.want = None;
        self.end_command();
    }

    /// Back to nothing pending, then insert mode at the caret, as a field that opens typing: the
    /// caret stays where it is, at a line's end too, where `i` would step back onto a character.
    /// What is typed then is the change `.` repeats, as after `i`.
    pub fn insert(&mut self, text: &TextView<'_>) -> Vec<Edit> {
        self.reset();
        let doc = Doc::new(text.text);
        let mut out = Out::new(doc);
        self.record = vec![Key::Char('i')];
        self.note_change(None);
        self.start_insert(doc.snap(doc.pos(text.head)), 1, None, &mut out);
        self.record.clear();
        self.finish(out, text)
    }

    /// The mode and the keys typed so far, for the status line.
    #[must_use]
    pub fn status(&self) -> Status {
        let mode = match &self.mode {
            State::Insert(_) => Mode::Insert,
            _ if self.pending.wait == Some(Wait::Replace) => Mode::Replace,
            _ if self.pending.operator.is_some() => Mode::OperatorPending,
            State::Visual { linewise: true, .. } => Mode::VisualLine,
            State::Visual {
                linewise: false, ..
            } => Mode::Visual,
            State::Normal => Mode::Normal,
        };
        Status {
            mode,
            pending: self.typed.clone(),
        }
    }

    /// Takes one key on `text`, and returns what the editor must do, in order, as one step of
    /// undo. In insert mode every key but Escape is left to the editor: [`Edit::Pass`].
    pub fn key(&mut self, key: Key, text: &TextView<'_>) -> Vec<Edit> {
        self.paste = None;
        if matches!(self.mode, State::Insert(_)) && key != Key::Escape {
            return vec![Edit::Pass];
        }
        let doc = Doc::new(text.text);
        self.adopt(doc, text);
        let mut out = Out::new(doc);
        let from = self.cursor;
        (self.vertical, self.operated) = (false, false);
        if !self.feed(key, &mut out) {
            self.end_command();
        }
        // The column `j` and `k` aim for lasts until the caret moves another way, the text
        // changes, or an operator runs.
        if !self.vertical && (self.operated || out.change.is_some() || self.cursor != from) {
            self.want = None;
        }
        self.finish(out, text)
    }

    /// Takes the system clipboard's text, which the layer asked for with
    /// [`Edit::ReadClipboard`], and puts it. Without such a request it does nothing.
    pub fn clipboard(&mut self, contents: &str, text: &TextView<'_>) -> Vec<Edit> {
        let Some(paste) = self.paste.take() else {
            return Vec::new();
        };
        let doc = Doc::new(text.text);
        self.adopt(doc, text);
        let mut out = Out::new(doc);
        let entry = self.registers.of_clipboard(contents);
        self.put_entry(&entry, paste, &mut out);
        self.finish(out, text)
    }

    /// Hears that the selection or the text changed outside the layer: a click, a drag, or the
    /// editor's history after [`Edit::Undo`] and [`Edit::Redo`]. A selection made with the
    /// pointer becomes visual mode, a click leaves it, and the caret of normal mode goes back on
    /// a character. [`Vim::key`] does the same before each key.
    pub fn sync(&mut self, text: &TextView<'_>) -> Vec<Edit> {
        let doc = Doc::new(text.text);
        self.adopt(doc, text);
        self.finish(Out::new(doc), text)
    }

    /// One key through the parser. True while the command waits for more keys.
    pub(crate) fn feed(&mut self, key: Key, out: &mut Out<'_>) -> bool {
        if self.prompt.is_some() {
            return self.prompt_key(key, out);
        }
        if key == Key::Escape {
            self.escape(out);
            return false;
        }
        self.step(key, out)
    }

    /// Forgets the command typed so far.
    pub(crate) fn end_command(&mut self) {
        self.pending = Pending::default();
        self.typed.clear();
        self.record.clear();
    }

    /// Escape drops what is pending, then leaves insert or visual mode; in normal mode with
    /// nothing pending it is the field's own Escape.
    fn escape(&mut self, out: &mut Out<'_>) {
        if !self.pending.is_empty() {
            return;
        }
        match self.mode {
            State::Visual { .. } => self.mode = State::Normal,
            State::Insert(_) => self.leave_insert(out),
            State::Normal => out.effects.push(Edit::Pass),
        }
    }

    /// Reads the view's selection: the layer's own, or one made outside.
    fn adopt(&mut self, doc: Doc<'_>, view: &TextView<'_>) {
        let (anchor, head) = (doc.pos(view.anchor), doc.pos(view.head));
        let settle = std::mem::take(&mut self.settle);
        if matches!(self.mode, State::Insert(_)) {
            self.cursor = head;
            return;
        }
        if self.expected == Some((view.anchor, view.head)) {
            if matches!(self.mode, State::Normal) {
                self.cursor = doc.on_char(head);
            }
            return;
        }
        self.prompt = None;
        self.want = None;
        self.end_command();
        if anchor == head || settle {
            self.mode = State::Normal;
            self.cursor = doc.on_char(anchor.min(head));
        } else if anchor < head {
            self.mode = State::Visual {
                anchor,
                linewise: false,
            };
            self.cursor = visual::before(doc, head);
        } else {
            self.mode = State::Visual {
                anchor: visual::before(doc, anchor),
                linewise: false,
            };
            self.cursor = head;
        }
    }

    /// The edits of one key, in the order the editor carries them out.
    fn finish(&mut self, out: Out<'_>, view: &TextView<'_>) -> Vec<Edit> {
        if out
            .effects
            .iter()
            .any(|effect| matches!(effect, Edit::Undo | Edit::Redo))
        {
            self.expected = None;
            self.settle = true;
            return out.effects;
        }
        let (anchor, head) = {
            let after = out.after();
            let doc = after.doc();
            let (anchor, head) = self.selection(doc);
            (doc.position(anchor), doc.position(head))
        };
        let mut edits = Vec::new();
        let changed = out.change.is_some();
        if let Some(change) = out.change {
            let (start, end) = (out.doc.position(change.start), out.doc.position(change.end));
            edits.push(Edit::Replace {
                start,
                end,
                text: change.text,
            });
        }
        if changed || (anchor, head) != (view.anchor, view.head) {
            edits.push(Edit::Select { anchor, head });
        }
        self.expected = Some((anchor, head));
        edits.extend(out.effects);
        edits
    }

    /// The selection the editor shows for the mode, in `doc`.
    fn selection(&mut self, doc: Doc<'_>) -> (Pos, Pos) {
        match self.mode {
            State::Normal => {
                self.cursor = doc.on_char(self.cursor);
                (self.cursor, self.cursor)
            }
            State::Insert(_) => {
                self.cursor = doc.snap(self.cursor);
                (self.cursor, self.cursor)
            }
            State::Visual { anchor, linewise } => {
                visual::selection(doc, anchor, self.cursor, linewise)
            }
        }
    }
}
