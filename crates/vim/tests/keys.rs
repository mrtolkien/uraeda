//! The Vim layer, key by key: `cases.toml` holds one row per behaviour, as a text before, keys, and
//! the text after, with `|` for the caret. The editor here is a plain string that carries out what
//! the layer returns, as the app's text field does on Native Shell's editor.

use serde::Deserialize;
use uraeda_vim::{Edit, Key, Lines, Mode, Position, SUBSET, TextView, Vim, keys};

#[derive(Deserialize)]
struct Table {
    case: Vec<Case>,
}

/// One row: `before`, then `keys`, gives `after`.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Case {
    /// What the row guards, as a sentence.
    name: String,
    /// The item of the subset this row is the case of, when it is one's.
    key: Option<String>,
    before: String,
    keys: String,
    after: String,
    /// The system clipboard before the keys.
    clipboard: Option<String>,
    /// The system clipboard after the keys.
    copied: Option<String>,
    /// The mode after the keys, as the status line names it: `NORMAL` when absent.
    mode: Option<String>,
    /// What the status line shows as typed and not run yet.
    pending: Option<String>,
    /// The selected text after the keys.
    selected: Option<String>,
    /// The keys the layer left to the field, in the notation of `keys`.
    passed: Option<String>,
}

/// An editor's step of undo: the text and the selection before an edit.
type Snapshot = (String, Position, Position);

/// A text field without a view: a text, a selection, an undo history, and a system clipboard.
struct Field {
    text: String,
    anchor: Position,
    head: Position,
    undo: Vec<Snapshot>,
    redo: Vec<Snapshot>,
    /// Whether the last edit was typing, which an editor groups in one step of undo.
    typing: bool,
    clipboard: String,
    passed: Vec<Key>,
    vim: Vim,
}

impl Field {
    fn new(marked: &str, clipboard: &str) -> Field {
        let at = marked.find('|').expect("a `|` for the caret");
        let text = format!("{}{}", &marked[..at], &marked[at + 1..]);
        let caret = position(&text, at);
        Field {
            text,
            anchor: caret,
            head: caret,
            undo: Vec::new(),
            redo: Vec::new(),
            typing: false,
            clipboard: clipboard.to_owned(),
            passed: Vec::new(),
            vim: Vim::new(),
        }
    }

    fn press(&mut self, key: Key) {
        let lines = Lines::new(&self.text);
        let view = TextView {
            text: &lines,
            anchor: self.anchor,
            head: self.head,
        };
        let edits = self.vim.key(key, &view);
        self.carry_out(edits, key);
    }

    /// Carries out one call's edits as one transaction: every replacement is one step of undo.
    fn carry_out(&mut self, edits: Vec<Edit>, key: Key) {
        let before = (self.text.clone(), self.anchor, self.head);
        let replaced = edits
            .iter()
            .any(|edit| matches!(edit, Edit::Replace { .. }));
        // Replacements are ranges of the text as it was: the last one goes in first.
        for edit in edits.iter().rev() {
            if let Edit::Replace { start, end, text } = edit {
                let range = offset(&before.0, *start)..offset(&before.0, *end);
                self.text.replace_range(range, text);
            }
        }
        if replaced {
            self.record(before, false);
        }
        for edit in edits {
            self.effect(edit, key);
        }
    }

    fn effect(&mut self, edit: Edit, key: Key) {
        match edit {
            Edit::Replace { .. } => {}
            Edit::Select { anchor, head } => (self.anchor, self.head) = (anchor, head),
            Edit::Undo => self.history(true),
            Edit::Redo => self.history(false),
            Edit::Clipboard(text) => self.clipboard = text,
            Edit::ReadClipboard => self.answer_clipboard(),
            Edit::Pass => self.pass(key),
        }
    }

    fn record(&mut self, before: Snapshot, typing: bool) {
        if !(typing && self.typing) {
            self.undo.push(before);
        }
        self.typing = typing;
        self.redo.clear();
    }

    /// One step back or forth, then the layer hears that the text and the selection changed.
    fn history(&mut self, back: bool) {
        let (from, to) = if back {
            (&mut self.undo, &mut self.redo)
        } else {
            (&mut self.redo, &mut self.undo)
        };
        if let Some((text, anchor, head)) = from.pop() {
            to.push((self.text.clone(), self.anchor, self.head));
            (self.text, self.anchor, self.head) = (text, anchor, head);
        }
        self.typing = false;
        let lines = Lines::new(&self.text);
        let view = TextView {
            text: &lines,
            anchor: self.anchor,
            head: self.head,
        };
        let edits = self.vim.sync(&view);
        self.carry_out(edits, Key::Escape);
    }

    fn answer_clipboard(&mut self) {
        let lines = Lines::new(&self.text);
        let view = TextView {
            text: &lines,
            anchor: self.anchor,
            head: self.head,
        };
        let edits = self.vim.clipboard(&self.clipboard.clone(), &view);
        self.carry_out(edits, Key::Escape);
    }

    /// A key the layer leaves to the field: in insert mode the editor types it.
    fn pass(&mut self, key: Key) {
        if self.vim.status().mode != Mode::Insert {
            self.passed.push(key);
            return;
        }
        let before = (self.text.clone(), self.anchor, self.head);
        let at = offset(&self.text, self.head);
        let end = match key {
            Key::Char(typed) => {
                self.text.insert(at, typed);
                at + typed.len_utf8()
            }
            Key::Enter => {
                self.text.insert(at, '\n');
                at + 1
            }
            Key::Backspace => {
                let start = self.text[..at]
                    .char_indices()
                    .next_back()
                    .map_or(at, |(index, _)| index);
                self.text.replace_range(start..at, "");
                start
            }
            _ => return,
        };
        self.head = position(&self.text, end);
        self.anchor = self.head;
        self.record(before, true);
    }

    /// The text with `|` at the caret.
    fn marked(&self) -> String {
        let at = offset(&self.text, self.head);
        format!("{}|{}", &self.text[..at], &self.text[at..])
    }

    fn selected(&self) -> &str {
        let (from, to) = (
            offset(&self.text, self.anchor),
            offset(&self.text, self.head),
        );
        &self.text[from.min(to)..from.max(to)]
    }
}

/// The byte offset of a position, counted as an editor does: lines, then UTF-16 code units.
fn offset(text: &str, position: Position) -> usize {
    let mut start = 0;
    for _ in 0..position.line {
        start += text[start..].find('\n').expect("a line of the text") + 1;
    }
    let line = text[start..].split('\n').next().unwrap_or_default();
    let mut units = 0;
    for (index, c) in line.char_indices() {
        if units >= position.column as usize {
            return start + index;
        }
        units += c.len_utf16();
    }
    start + line.len()
}

/// The position of a byte offset.
fn position(text: &str, offset: usize) -> Position {
    let before = &text[..offset];
    let line = before.matches('\n').count();
    let start = before.rfind('\n').map_or(0, |at| at + 1);
    let column = before[start..].encode_utf16().count();
    Position {
        line: u32::try_from(line).unwrap_or(u32::MAX),
        column: u32::try_from(column).unwrap_or(u32::MAX),
    }
}

fn table() -> Vec<Case> {
    let table: Table =
        toml_edit::de::from_str(include_str!("cases.toml")).expect("cases.toml parses");
    table.case
}

/// Runs one row, and says what differs.
fn run(case: &Case) -> Vec<String> {
    let mut field = Field::new(&case.before, case.clipboard.as_deref().unwrap_or_default());
    for key in keys(&case.keys) {
        field.press(key);
    }
    let status = field.vim.status();
    let mut wrong = Vec::new();
    let mut check = |what: &str, got: &str, expected: &str| {
        if got != expected {
            wrong.push(format!("{what}: got {got:?}, expected {expected:?}"));
        }
    };
    check("text", &field.marked(), &case.after);
    check(
        "mode",
        status.mode.label(),
        case.mode.as_deref().unwrap_or("NORMAL"),
    );
    check(
        "pending",
        &status.pending,
        case.pending.as_deref().unwrap_or_default(),
    );
    if let Some(copied) = &case.copied {
        check("clipboard", &field.clipboard, copied);
    }
    if let Some(selected) = &case.selected {
        check("selected", field.selected(), selected);
    }
    let passed = keys(case.passed.as_deref().unwrap_or_default());
    if field.passed != passed {
        wrong.push(format!(
            "passed: got {:?}, expected {passed:?}",
            field.passed
        ));
    }
    wrong
}

#[test]
fn every_case_gives_its_text() {
    let failures: Vec<String> = table()
        .iter()
        .filter_map(|case| {
            let wrong = run(case);
            (!wrong.is_empty()).then(|| {
                format!(
                    "{} ({:?} on {:?})\n    {}",
                    case.name,
                    case.keys,
                    case.before,
                    wrong.join("\n    ")
                )
            })
        })
        .collect();
    assert!(
        failures.is_empty(),
        "{} cases fail:\n{}",
        failures.len(),
        failures.join("\n")
    );
}

/// The text-editing decision: every key the layer supports has a row in its table of cases.
#[test]
fn every_key_of_the_subset_has_a_case() {
    let cases = table();
    let missing: Vec<&str> = SUBSET
        .iter()
        .copied()
        .filter(|item| {
            !cases
                .iter()
                .any(|case| case.key.as_deref() == Some(item) && types(&case.keys, item))
        })
        .collect();
    assert!(
        missing.is_empty(),
        "add a row to cases.toml, with `key`, for each of: {missing:?}"
    );
    let unknown: Vec<&str> = cases
        .iter()
        .filter_map(|case| case.key.as_deref())
        .filter(|key| !SUBSET.contains(key))
        .collect();
    assert!(
        unknown.is_empty(),
        "rows name keys the subset does not have: {unknown:?}"
    );
}

/// Whether the keys of `item` are among `typed`, in their order.
fn types(typed: &str, item: &str) -> bool {
    let mut typed = keys(typed).into_iter();
    keys(item)
        .into_iter()
        .all(|key| typed.any(|other| other == key))
}

/// A key outside the subset does nothing in normal mode: it never types, and starts no command.
#[test]
fn a_key_outside_the_subset_does_nothing() {
    let firsts: Vec<Key> = SUBSET
        .iter()
        .filter_map(|item| keys(item).first().copied())
        .collect();
    let typed = (' '..='~').map(Key::Char).chain(('a'..='z').map(Key::Ctrl));
    let alive: Vec<Key> = typed
        .filter(|key| !firsts.contains(key) && !matches!(key, Key::Char('1'..='9')))
        .filter(|key| {
            let mut field = Field::new("one (two) |three four\nfive six\n\nseven", "");
            field.press(Key::Char('x'));
            field.press(Key::Char('u'));
            let before = field.marked();
            field.press(*key);
            let status = field.vim.status();
            field.marked() != before || status.mode != Mode::Normal || !status.pending.is_empty()
        })
        .collect();
    assert!(
        alive.is_empty(),
        "keys outside the subset act: remove them, or add them to SUBSET with a row: {alive:?}"
    );
}

/// A drag of the pointer selects in the editor, outside the layer: the layer takes the selection
/// as visual mode's, and a click that ends it brings normal mode back.
#[test]
fn a_selection_made_outside_is_visual_mode() {
    let mut field = Field::new("|one two three", "");
    field.head = Position { line: 0, column: 7 };
    let lines = Lines::new(&field.text);
    let edits = field.vim.sync(&TextView {
        text: &lines,
        anchor: field.anchor,
        head: field.head,
    });
    assert_eq!(
        edits,
        Vec::new(),
        "the selection is already what visual mode shows"
    );
    assert_eq!(field.vim.status().mode, Mode::Visual);
    field.press(Key::Char('d'));
    assert_eq!(field.marked(), "| three");

    field.press(Key::Char('v'));
    field.anchor = Position { line: 0, column: 9 };
    field.head = field.anchor;
    let lines = Lines::new(&field.text);
    let edits = field.vim.sync(&TextView {
        text: &lines,
        anchor: field.anchor,
        head: field.head,
    });
    assert_eq!(field.vim.status().mode, Mode::Normal);
    let on_last = Position { line: 0, column: 5 };
    assert_eq!(
        edits,
        vec![Edit::Select {
            anchor: on_last,
            head: on_last
        }],
        "the caret goes back on a character"
    );
}

/// One layer serves every field: a reset for the next field keeps what was yanked, and drops the
/// command half typed.
#[test]
fn a_reset_keeps_the_registers_for_the_next_field() {
    let mut first = Field::new("|one two", "");
    for key in keys("yiw2d") {
        first.press(key);
    }
    let mut second = Field::new("|three", "");
    second.vim = std::mem::take(&mut first.vim);
    second.vim.reset();
    assert_eq!(second.vim.status().pending, "");
    second.press(Key::Char('P'));
    assert_eq!(second.marked(), "on|ethree");
}

/// The clipboard's text is put only when the layer asked for it.
#[test]
fn a_clipboard_text_nobody_asked_for_is_not_put() {
    let mut field = Field::new("|one", "");
    let lines = Lines::new(&field.text);
    let view = TextView {
        text: &lines,
        anchor: field.anchor,
        head: field.head,
    };
    assert_eq!(field.vim.clipboard("text", &view), Vec::new());
}

/// A field opens typing where its caret is, at a line's end too, and what is typed then is the
/// change `.` repeats.
#[test]
fn a_field_opens_typing_at_its_caret() {
    let mut field = Field::new("one|", "");
    let lines = Lines::new(&field.text);
    let view = TextView {
        text: &lines,
        anchor: field.anchor,
        head: field.head,
    };
    let edits = field.vim.insert(&view);
    assert_eq!(field.vim.status().mode, Mode::Insert);
    assert!(
        edits
            .iter()
            .all(|edit| !matches!(edit, Edit::Replace { .. })),
        "opening types nothing: {edits:?}"
    );
    for key in keys(" two") {
        field.press(key);
    }
    for key in keys("<Esc>.") {
        field.press(key);
    }
    assert_eq!(field.marked(), "one tw tw|oo");
}
