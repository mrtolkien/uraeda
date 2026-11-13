//! The keys Vim takes, as `keymap` names them, and positions between the layer and the editor.

use nsh_base::editor::EditorPosition;
use uraeda_vim::{Key, Position};

/// The characters of the US layout's keys, without and with Shift, as `keymap` names the keys.
const PLAIN: &str = "abcdefghijklmnopqrstuvwxyz0123456789`-=[]\\;',./";
const SHIFTED: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ)!@#$%^&*(~_+{}|:\"<>?";

/// The keystrokes Vim takes outside insert mode: every key of the US layout that types, with and
/// without Shift, and the named keys of the subset.
pub(super) fn vim_strokes() -> Vec<String> {
    let mut strokes: Vec<String> = PLAIN
        .chars()
        .flat_map(|key| [key.to_string(), format!("shift+{key}")])
        .collect();
    strokes.extend(["space", "enter", "backspace", "ctrl+r"].map(str::to_owned));
    strokes
}

/// The Vim key of a keystroke, `None` for one that is not Vim's.
pub(super) fn vim_key(stroke: &str) -> Option<Key> {
    let key = match stroke {
        "escape" => Key::Escape,
        "enter" => Key::Enter,
        "backspace" => Key::Backspace,
        "space" => Key::Char(' '),
        "ctrl+r" => Key::Ctrl('r'),
        _ => {
            let (shift, base) = match stroke.strip_prefix("shift+") {
                Some(base) => (true, base),
                None => (false, stroke),
            };
            let mut chars = base.chars();
            let (Some(base), None) = (chars.next(), chars.next()) else {
                return None;
            };
            let at = PLAIN.chars().position(|plain| plain == base)?;
            let table = if shift { SHIFTED } else { PLAIN };
            Key::Char(table.chars().nth(at)?)
        }
    };
    Some(key)
}

pub(super) fn position(at: EditorPosition) -> Position {
    Position {
        line: at.line,
        column: at.column,
    }
}

pub(super) fn editor_position(at: Position) -> EditorPosition {
    EditorPosition::new(at.line, at.column)
}
