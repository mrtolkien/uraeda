//! The text as the layer reads it: line by line, so an editor that keeps a rope hands its lines
//! over without copying the whole text. Positions cross the boundary as an editor's own, a line
//! and a column in UTF-16 code units; inside, a column is a byte of its line.

use std::borrow::Cow;

use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthStr;

/// The cells between two tab stops.
pub(crate) const TAB: usize = 8;

/// A text, read one line at a time.
pub trait Text {
    /// How many lines the text has: one more than its line breaks, so an empty text has one.
    fn line_count(&self) -> usize;

    /// Line `index`, from 0, without its line break.
    fn line(&self, index: usize) -> Cow<'_, str>;
}

/// A place in a text: a line and a column, both from 0. The column counts UTF-16 code units, as
/// Native Shell's `EditorPosition` does.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Position {
    /// The line, from 0.
    pub line: u32,
    /// The UTF-16 code units before it in its line.
    pub column: u32,
}

/// What a key is run on: the text, and its selection. A caret is a selection whose ends are equal.
#[derive(Clone, Copy)]
pub struct TextView<'a> {
    /// The text.
    pub text: &'a dyn Text,
    /// Where the selection started.
    pub anchor: Position,
    /// Where the caret is.
    pub head: Position,
}

/// A text held as its lines, for a caller that has one string.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Lines {
    lines: Vec<String>,
}

impl Lines {
    /// The lines of `text`, split at `\n`.
    #[must_use]
    pub fn new(text: &str) -> Lines {
        Lines {
            lines: text.split('\n').map(str::to_owned).collect(),
        }
    }
}

impl Text for Lines {
    fn line_count(&self) -> usize {
        self.lines.len()
    }

    fn line(&self, index: usize) -> Cow<'_, str> {
        Cow::Borrowed(self.lines.get(index).map_or("", String::as_str))
    }
}

/// A place in a text, inside the layer: a line, and a byte of that line.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct Pos {
    pub line: usize,
    pub col: usize,
}

impl Pos {
    pub fn new(line: usize, col: usize) -> Pos {
        Pos { line, col }
    }
}

/// One replacement of the text: what lies from `start` to `end` becomes `text`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Change {
    pub start: Pos,
    pub end: Pos,
    pub text: String,
}

/// What an operator acts on: the characters from `start` to `end`, or whole lines.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Span {
    pub start: Pos,
    /// The place after the last character; for lines, a place on the last line.
    pub end: Pos,
    pub linewise: bool,
    /// Whether the end is the place an exclusive motion reached: at a line's first column, an
    /// operator then leaves that line alone.
    pub exclusive: bool,
    /// Where the caret stands when the operator starts: the end of the range that comes first.
    pub at: Pos,
}

impl Span {
    pub fn chars(start: Pos, end: Pos) -> Span {
        Span {
            start,
            end,
            linewise: false,
            exclusive: false,
            at: start,
        }
    }

    /// Characters up to the place an exclusive motion reached.
    pub fn up_to(start: Pos, end: Pos) -> Span {
        Span {
            exclusive: true,
            ..Span::chars(start, end)
        }
    }

    pub fn lines(first: usize, last: usize, at: Pos) -> Span {
        Span {
            start: Pos::new(first, 0),
            end: Pos::new(last, 0),
            linewise: true,
            exclusive: false,
            at,
        }
    }
}

/// Whether a character is a blank inside a line.
pub(crate) fn is_blank(c: char) -> bool {
    c == ' ' || c == '\t'
}

/// A reader over a text.
#[derive(Clone, Copy)]
pub(crate) struct Doc<'a> {
    text: &'a dyn Text,
}

impl<'a> Doc<'a> {
    pub fn new(text: &'a dyn Text) -> Doc<'a> {
        Doc { text }
    }

    pub fn lines(&self) -> usize {
        self.text.line_count().max(1)
    }

    /// The last line's index.
    pub fn last(&self) -> usize {
        self.lines() - 1
    }

    pub fn line(&self, index: usize) -> Cow<'a, str> {
        if index < self.text.line_count() {
            self.text.line(index)
        } else {
            Cow::Borrowed("")
        }
    }

    pub fn len(&self, line: usize) -> usize {
        self.line(line).len()
    }

    /// The end of the text.
    pub fn end(&self) -> Pos {
        Pos::new(self.last(), self.len(self.last()))
    }

    /// The layer's place for an editor's position, on a character's first byte.
    pub fn pos(&self, position: Position) -> Pos {
        let line = (position.line as usize).min(self.last());
        let text = self.line(line);
        let mut units = 0;
        let mut col = text.len();
        for (index, c) in text.char_indices() {
            if units >= position.column as usize {
                col = index;
                break;
            }
            units += c.len_utf16();
        }
        self.snap(Pos::new(line, col))
    }

    /// An editor's position for the layer's place.
    pub fn position(&self, pos: Pos) -> Position {
        let pos = self.snap(pos);
        let column = self.line(pos.line)[..pos.col].encode_utf16().count();
        Position {
            line: narrow(pos.line),
            column: narrow(column),
        }
    }

    /// `pos` inside the text, on a character's first byte or at its line's end.
    pub fn snap(&self, pos: Pos) -> Pos {
        let line = pos.line.min(self.last());
        let text = self.line(line);
        if pos.col >= text.len() {
            return Pos::new(line, text.len());
        }
        let col = text
            .grapheme_indices(true)
            .map(|(index, _)| index)
            .take_while(|index| *index <= pos.col)
            .last();
        Pos::new(line, col.unwrap_or(0))
    }

    /// The column after the character at `pos`: its line's end at most.
    pub fn next(&self, pos: Pos) -> usize {
        let text = self.line(pos.line);
        let Some(rest) = text.get(pos.col..) else {
            return text.len();
        };
        rest.graphemes(true)
            .next()
            .map_or(text.len(), |grapheme| pos.col + grapheme.len())
    }

    /// The column of the character before `pos`: 0 at least.
    pub fn prev(&self, pos: Pos) -> usize {
        let text = self.line(pos.line);
        let Some(before) = text.get(..pos.col) else {
            return 0;
        };
        before
            .grapheme_indices(true)
            .next_back()
            .map_or(0, |(index, _)| index)
    }

    /// The column of a line's last character: 0 on an empty line.
    pub fn last_col(&self, line: usize) -> usize {
        self.prev(Pos::new(line, self.len(line)))
    }

    /// `pos` on a character, as the caret of normal mode is: never past a line's last one.
    pub fn on_char(&self, pos: Pos) -> Pos {
        let pos = self.snap(pos);
        Pos::new(pos.line, pos.col.min(self.last_col(pos.line)))
    }

    /// The column of a line's first character that is not blank: its last character when all are.
    pub fn first_non_blank(&self, line: usize) -> usize {
        let text = self.line(line);
        text.find(|c| !is_blank(c))
            .unwrap_or_else(|| self.last_col(line))
    }

    /// The blanks a line starts with.
    pub fn indent(&self, line: usize) -> String {
        let text = self.line(line);
        text[..text.find(|c| !is_blank(c)).unwrap_or(text.len())].to_owned()
    }

    /// Whether only blanks lie before `pos` on its line.
    pub fn in_indent(&self, pos: Pos) -> bool {
        self.line(pos.line)
            .get(..pos.col)
            .is_some_and(|before| before.chars().all(is_blank))
    }

    /// Whether a line holds nothing but blanks.
    pub fn is_white(&self, line: usize) -> bool {
        self.line(line).chars().all(is_blank)
    }

    /// The character at `pos`: none at a line's end.
    pub fn char_at(&self, pos: Pos) -> Option<char> {
        self.line(pos.line).get(pos.col..)?.chars().next()
    }

    /// The column of `pos` as a terminal counts it: the cells before it on its line, where a
    /// wide character takes two and a tab runs to the next multiple of eight. A caret on a tab
    /// stands on the tab's last cell, as Vim's does.
    pub fn column(&self, pos: Pos) -> usize {
        let text = self.line(pos.line);
        let mut cells = 0;
        for (index, grapheme) in text.grapheme_indices(true) {
            let width = cell_width(grapheme, cells);
            if index >= pos.col {
                return if grapheme == "\t" {
                    cells + width - 1
                } else {
                    cells
                };
            }
            cells += width;
        }
        cells
    }

    /// The byte of the character that covers cell `column` of a line: the line's end past its
    /// last one.
    pub fn at_column(&self, line: usize, column: usize) -> usize {
        let text = self.line(line);
        let mut cells = 0;
        for (index, grapheme) in text.grapheme_indices(true) {
            cells += cell_width(grapheme, cells);
            if cells > column {
                return index;
            }
        }
        text.len()
    }

    /// The text from `start` to `end`, line breaks included.
    pub fn slice(&self, start: Pos, end: Pos) -> String {
        if start >= end {
            return String::new();
        }
        if start.line == end.line {
            return self.line(start.line)[start.col..end.col].to_owned();
        }
        let mut text = self.line(start.line)[start.col..].to_owned();
        for line in start.line + 1..end.line {
            text.push('\n');
            text.push_str(&self.line(line));
        }
        text.push('\n');
        text.push_str(&self.line(end.line)[..end.col]);
        text
    }

    /// Lines `first` to `last`, each with its line break.
    pub fn whole_lines(&self, first: usize, last: usize) -> String {
        (first..=last)
            .map(|line| format!("{}\n", self.line(line)))
            .collect()
    }
}

/// The cells a character takes when it starts at cell `at`.
fn cell_width(grapheme: &str, at: usize) -> usize {
    if grapheme == "\t" {
        TAB - at % TAB
    } else {
        grapheme.width()
    }
}

fn narrow(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

/// The place where a text put at `at` ends.
pub(crate) fn end_of(at: Pos, text: &str) -> Pos {
    match text.rfind('\n') {
        Some(last_break) => Pos::new(
            at.line + text.matches('\n').count(),
            text.len() - last_break - 1,
        ),
        None => Pos::new(at.line, at.col + text.len()),
    }
}

/// A text with one change applied, read without building the whole text again.
pub(crate) struct Patched<'a> {
    base: Doc<'a>,
    /// The first line the change touches.
    first: usize,
    /// How many lines of the base it replaces.
    removed: usize,
    /// The lines that take their place.
    lines: Vec<String>,
}

impl<'a> Patched<'a> {
    pub fn new(base: Doc<'a>, change: &Change) -> Patched<'a> {
        let head = base.line(change.start.line);
        let tail = base.line(change.end.line);
        let joined = format!(
            "{}{}{}",
            &head[..change.start.col],
            change.text,
            &tail[change.end.col..]
        );
        Patched {
            base,
            first: change.start.line,
            removed: change.end.line - change.start.line + 1,
            lines: joined.split('\n').map(str::to_owned).collect(),
        }
    }
}

impl Text for Patched<'_> {
    fn line_count(&self) -> usize {
        self.base.lines() - self.removed + self.lines.len()
    }

    fn line(&self, index: usize) -> Cow<'_, str> {
        if index < self.first {
            self.base.line(index)
        } else if index < self.first + self.lines.len() {
            Cow::Borrowed(&self.lines[index - self.first])
        } else {
            self.base.line(index - self.lines.len() + self.removed)
        }
    }
}
