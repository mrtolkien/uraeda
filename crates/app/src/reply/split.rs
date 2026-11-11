//! A reply's text split at its blocks' boundaries, as it grows: each piece is read once, line by
//! line, and only the block still being written is kept. A block is finished once nothing that
//! comes later can change it: a blank line ends a paragraph, a quote, or a table; a closing fence
//! ends code; a heading or a rule is one line; a list ends at the first line after a blank one
//! that neither is indented nor starts an item.

use super::lines::{Line, fence_closes, fence_opens};

/// What is still being written: plain text, or the code of a fence still open.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Growing {
    Text(String),
    Code { language: String, text: String },
}

/// The kind of the block being written, which says what ends it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    /// A paragraph, a quote, a table, or HTML: ended by a blank line.
    Lines,
    /// A list, `blank` once a blank line followed it, and the fence an item holds open.
    List {
        blank: bool,
        fence: Option<(u8, usize)>,
    },
    /// Fenced code, its marker and the length of its fence, from the end of its first line.
    Fence {
        marker: u8,
        length: usize,
        body: usize,
    },
}

/// Splits a reply's text into blocks as it grows.
#[derive(Default)]
pub struct Splitter {
    /// The text from the start of the block being written, or of the line being read.
    text: String,
    /// The bytes of a character a piece cut, until the next piece completes it.
    cut: Vec<u8>,
    /// Where the next line to read starts in `text`.
    read: usize,
    /// The block being written, and where it starts in `text`.
    open: Option<(Kind, usize)>,
    /// The blocks finished by the piece being read.
    finished: Vec<String>,
}

impl Splitter {
    /// Reads `piece`, the next bytes of the reply, and returns the text of each block it
    /// finished, in order. A piece may end inside a character: its rest comes with the next.
    pub fn push(&mut self, piece: &[u8]) -> Vec<String> {
        self.take(piece);
        while let Some(end) = self.text[self.read..].find('\n') {
            let end = self.read + end + 1;
            self.line(self.read, end);
            self.read = end;
        }
        self.forget();
        std::mem::take(&mut self.finished)
    }

    /// The reply ended: the block being written is finished, a fence left open included.
    pub fn end(&mut self) -> Vec<String> {
        if !self.cut.is_empty() {
            self.text.push_str(&String::from_utf8_lossy(&self.cut));
            self.cut.clear();
        }
        let end = self.text.len();
        match self.open {
            Some((_, start)) => self.finish(start, end),
            None if !self.text[self.read..].trim().is_empty() => self.finish(self.read, end),
            None => {}
        }
        self.read = end;
        self.open = None;
        self.forget();
        std::mem::take(&mut self.finished)
    }

    /// What is still being written: the block not finished yet, and the line being read.
    pub fn growing(&self) -> Growing {
        match self.open {
            Some((Kind::Fence { marker, body, .. }, start)) => Growing::Code {
                language: language(&self.text[start..body], marker),
                text: self.text[body..].to_owned(),
            },
            Some((_, start)) => Growing::Text(self.text[start..].to_owned()),
            None => Growing::Text(self.text[self.read..].to_owned()),
        }
    }

    /// Adds `piece` to the text, keeping back the bytes of a character it cut.
    fn take(&mut self, piece: &[u8]) {
        self.cut.extend_from_slice(piece);
        let whole = match std::str::from_utf8(&self.cut) {
            Ok(_) => self.cut.len(),
            // A cut character, at most three bytes, waits; anything else is not UTF-8 at all.
            Err(error) if error.error_len().is_none() => error.valid_up_to(),
            Err(_) => {
                self.text.push_str(&String::from_utf8_lossy(&self.cut));
                self.cut.clear();
                return;
            }
        };
        let rest = self.cut.split_off(whole);
        let text = std::mem::replace(&mut self.cut, rest);
        self.text
            .push_str(std::str::from_utf8(&text).expect("checked above"));
    }

    /// Drops the text before what is still needed: the open block, or the line being read.
    fn forget(&mut self) {
        let keep = self.open.map_or(self.read, |(_, start)| start);
        self.text.drain(..keep);
        self.read -= keep;
        if let Some((kind, start)) = &mut self.open {
            *start -= keep;
            if let Kind::Fence { body, .. } = kind {
                *body -= keep;
            }
        }
    }

    fn finish(&mut self, start: usize, end: usize) {
        self.finished.push(self.text[start..end].to_owned());
    }

    /// Reads the complete line from `at` to `end`, its line break included.
    fn line(&mut self, at: usize, end: usize) {
        // Its own copy, as finishing a block changes what the splitter holds: a line is short.
        let owned = self.text[at..end].to_owned();
        let line = Line::new(&owned);
        match self.open {
            None => self.start(at, end, line),
            Some((Kind::Fence { marker, length, .. }, start)) => {
                if fence_closes(line.text, marker, length) {
                    self.finish(start, end);
                    self.open = None;
                }
            }
            Some((Kind::List { blank, fence }, start)) => {
                self.in_list(at, end, line, start, blank, fence)
            }
            Some((Kind::Lines, start)) => {
                if line.is_blank() {
                    self.finish(start, at);
                    self.open = None;
                } else if line.is_underline() {
                    self.finish(start, end);
                    self.open = None;
                } else if line.interrupts() {
                    self.finish(start, at);
                    self.open = None;
                    self.start(at, end, line);
                }
            }
        }
    }

    /// A line while a list is open: blank lines and indented lines stay in it, and so does an
    /// item; after a blank line, anything else starts the next block.
    fn in_list(
        &mut self,
        at: usize,
        end: usize,
        line: Line<'_>,
        start: usize,
        blank: bool,
        fence: Option<(u8, usize)>,
    ) {
        let inner = line.text.trim_start();
        let (blank, fence) = match fence {
            Some((marker, length)) => (
                false,
                (!fence_closes(inner, marker, length)).then_some((marker, length)),
            ),
            None if line.is_blank() => (true, None),
            None if line.is_indented() || line.is_item() => (false, fence_opens(inner)),
            None if !blank && !line.interrupts() => (false, None),
            None => {
                self.finish(start, at);
                self.open = None;
                return self.start(at, end, line);
            }
        };
        self.open = Some((Kind::List { blank, fence }, start));
    }

    /// The first line of a block: a heading and a rule are finished at once.
    fn start(&mut self, at: usize, end: usize, line: Line<'_>) {
        if line.is_blank() {
            return;
        }
        if let Some((marker, length)) = fence_opens(line.text) {
            let kind = Kind::Fence {
                marker,
                length,
                body: end,
            };
            self.open = Some((kind, at));
        } else if line.is_heading() || line.is_rule() {
            self.finish(at, end);
        } else if line.is_item() {
            let kind = Kind::List {
                blank: false,
                fence: None,
            };
            self.open = Some((kind, at));
        } else {
            self.open = Some((Kind::Lines, at));
        }
    }
}

/// A fence's language: the first word after its marks.
fn language(first: &str, marker: u8) -> String {
    first
        .trim()
        .trim_start_matches(char::from(marker))
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_owned()
}
