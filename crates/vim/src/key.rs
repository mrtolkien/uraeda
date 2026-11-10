//! The keys the layer takes, and Vim's notation for them.

use std::fmt;

/// One key press, as the layer takes it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Key {
    /// A key that types a character, with Shift already applied: `d`, `G`, `$`, a space.
    Char(char),
    /// Escape.
    Escape,
    /// Enter.
    Enter,
    /// Backspace.
    Backspace,
    /// Control with a letter: `Ctrl('r')`.
    Ctrl(char),
}

impl fmt::Display for Key {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Key::Char(typed) => write!(formatter, "{typed}"),
            Key::Escape => formatter.write_str("<Esc>"),
            Key::Enter => formatter.write_str("<CR>"),
            Key::Backspace => formatter.write_str("<BS>"),
            Key::Ctrl(letter) => write!(formatter, "<C-{letter}>"),
        }
    }
}

/// The keys of a text in Vim's notation: `d2w`, `cwone<Esc>`, `<C-r>`, `<CR>`, `<BS>`, and `<lt>`
/// for `<`. Anything else is the character itself.
#[must_use]
pub fn keys(notation: &str) -> Vec<Key> {
    let mut keys = Vec::new();
    let mut rest = notation;
    while let Some(first) = rest.chars().next() {
        let (key, length) = named(rest).unwrap_or((Key::Char(first), first.len_utf8()));
        keys.push(key);
        rest = &rest[length..];
    }
    keys
}

/// The key a text starts with when it is a name between `<` and `>`, and the name's length.
fn named(text: &str) -> Option<(Key, usize)> {
    let name = text.strip_prefix('<')?.split_once('>')?.0;
    let key = match name {
        "Esc" => Key::Escape,
        "CR" => Key::Enter,
        "BS" => Key::Backspace,
        "lt" => Key::Char('<'),
        _ => {
            let mut letters = name.strip_prefix("C-")?.chars();
            let (Some(letter), None) = (letters.next(), letters.next()) else {
                return None;
            };
            Key::Ctrl(letter)
        }
    };
    Some((key, name.len() + 2))
}
