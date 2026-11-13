//! The keys Vim takes, as `keymap` names them, positions between the layer and the editor, and
//! the caret's box.

use nsh_base::editor::{EditorApi, EditorPosition};
use uraeda_vim::{Edit, Key, Position, TextView, Vim};

use super::CaretBox;

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

/// The layer for a field that takes the focus: typing, or in normal mode as a buffer opens.
pub(super) fn open_vim(vim: &mut Vim, view: &TextView<'_>, normal: bool) -> Vec<Edit> {
    if normal {
        vim.reset();
        vim.sync(view)
    } else {
        vim.insert(view)
    }
}

/// The caret's box in the field, when it is laid out.
pub(super) fn caret_box(api: &EditorApi) -> Option<CaretBox> {
    let bounds = api.caret_bounds()?.bounds;
    Some(CaretBox {
        x: f64::from(bounds.origin.x.0),
        y: f64::from(bounds.origin.y.0),
        width: f64::from(bounds.size.width.0),
        height: f64::from(bounds.size.height.0),
    })
}
