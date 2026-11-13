//! Search: `/`, `?`, `n`, `N`, `*`, and `#`. The text searched for is taken as it is typed, with
//! no pattern language, and a search goes around the text's ends.

use crate::Key;
use crate::motion::{Kind, Target};
use crate::out::Out;
use crate::state::Vim;
use crate::text::{Doc, Pos};
use crate::walk::{Class, class};

/// What is searched for.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Query {
    pub text: String,
    /// Whether it must be a whole word, as `*` and `#` ask.
    pub word: bool,
}

/// The last search: `n` goes its way, `N` the other.
#[derive(Debug, Default)]
pub(crate) struct Search {
    pub last: Option<Query>,
    pub forward: bool,
}

/// A search being typed after `/` or `?`.
#[derive(Debug)]
pub(crate) struct Prompt {
    pub forward: bool,
    pub text: String,
}

fn is_word(c: char) -> bool {
    matches!(class(Some(c), false), Class::Word | Class::Script(_))
}

/// The columns of a line where `query` starts.
fn matches(line: &str, query: &Query) -> Vec<usize> {
    let whole = |start: usize| {
        let end = start + query.text.len();
        !line[..start].chars().next_back().is_some_and(is_word)
            && !line[end..].chars().next().is_some_and(is_word)
    };
    line.match_indices(&query.text)
        .map(|(start, _)| start)
        .filter(|start| !query.word || whole(*start))
        .collect()
}

/// The match after `from`, or before it, going around the text's ends: none when the text has no
/// match. The lines are read from the caret's, which is read twice: for what follows the caret,
/// then at the very end for what precedes it.
fn next(doc: Doc<'_>, from: Pos, query: &Query, forward: bool) -> Option<Pos> {
    let lines = doc.lines();
    for step in 0..=lines {
        let line = if forward {
            (from.line + step) % lines
        } else {
            (from.line + lines - step % lines) % lines
        };
        let starts = matches(&doc.line(line), query);
        let mut on_line = starts.iter().copied().filter(|col| match step {
            0 => (*col > from.col) == forward && *col != from.col,
            _ if step == lines => (*col > from.col) != forward || *col == from.col,
            _ => true,
        });
        let found = if forward {
            on_line.next()
        } else {
            on_line.next_back()
        };
        if let Some(col) = found {
            return Some(Pos::new(line, col));
        }
    }
    None
}

/// The `count`th match from `from`.
pub(crate) fn find(
    doc: Doc<'_>,
    from: Pos,
    query: &Query,
    forward: bool,
    count: usize,
) -> Option<Pos> {
    if query.text.is_empty() {
        return None;
    }
    let mut pos = from;
    for _ in 0..count {
        pos = next(doc, pos, query, forward)?;
    }
    Some(pos)
}

/// The word `*` and `#` search: the one under the caret, or the next one on its line, and where
/// it starts. A run of punctuation counts when the line has no word from the caret on.
fn word_at(doc: Doc<'_>, pos: Pos) -> Option<(Pos, Query)> {
    let line = doc.line(pos.line);
    let from = pos.col.min(line.len());
    let other = |c: char| !c.is_whitespace() && !is_word(c);
    let (start, word) = match line[from..].find(is_word) {
        Some(offset) => (line[..from + offset].trim_end_matches(is_word).len(), true),
        None => (
            line[..from + line[from..].find(other)?]
                .trim_end_matches(other)
                .len(),
            false,
        ),
    };
    let same = |c: char| if word { is_word(c) } else { other(c) };
    let length = line[start..]
        .find(|c| !same(c))
        .unwrap_or(line.len() - start);
    Some((
        Pos::new(pos.line, start),
        Query {
            text: line[start..start + length].to_owned(),
            word,
        },
    ))
}

impl Vim {
    /// A key of the search being typed. True while it is still being typed.
    pub(crate) fn prompt_key(&mut self, key: Key, out: &mut Out<'_>) -> bool {
        let Some(prompt) = &mut self.prompt else {
            return false;
        };
        match key {
            Key::Char(typed) => {
                prompt.text.push(typed);
                self.typed.push(typed);
                true
            }
            Key::Backspace if prompt.text.pop().is_some() => {
                self.typed.pop();
                true
            }
            Key::Enter => {
                self.run_prompt(out);
                false
            }
            Key::Ctrl(_) => true,
            Key::Backspace | Key::Escape => {
                self.prompt = None;
                false
            }
        }
    }

    /// Enter in the search: an empty search is the last one again.
    fn run_prompt(&mut self, out: &mut Out<'_>) {
        let Some(prompt) = self.prompt.take() else {
            return;
        };
        self.record.extend(prompt.text.chars().map(Key::Char));
        self.record.push(Key::Enter);
        if !prompt.text.is_empty() {
            self.search.last = Some(Query {
                text: prompt.text,
                word: false,
            });
        }
        self.search.forward = prompt.forward;
        let target = self.search_again(out.doc, false);
        self.moved(target, out);
    }

    /// `n`, and `N` with `reverse`: the last search again.
    pub(crate) fn search_again(&self, doc: Doc<'_>, reverse: bool) -> Option<Target> {
        let query = self.search.last.as_ref()?;
        let pos = find(
            doc,
            self.cursor,
            query,
            self.search.forward != reverse,
            self.pending.times(),
        )?;
        Some(Target::new(pos, Kind::Exclusive))
    }

    /// `*` and `#`: searches the word under the caret, from that word's start.
    pub(crate) fn search_word(&mut self, doc: Doc<'_>, forward: bool) -> Option<Target> {
        let (start, query) = word_at(doc, self.cursor)?;
        let pos = find(doc, start, &query, forward, self.pending.times());
        self.search = Search {
            last: Some(query),
            forward,
        };
        Some(Target::new(pos?, Kind::Exclusive))
    }
}
