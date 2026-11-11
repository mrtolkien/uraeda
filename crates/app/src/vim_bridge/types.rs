//! What a field's editor and TSX pass each other: its props, its events, and what they carry.

use nsh_base::editor::EditorStyles;
use nsh_core::element::Style;
use nsh_core::prelude::*;

/// What a field's editor takes from TSX.
#[derive(Clone, Copy, PartialEq, Props)]
pub struct TextEditorProps {
    /// The text: the field's owner sets it again from `onChange`.
    pub value: Prop<SharedString>,
    /// Shown while the text is empty.
    pub placeholder: Prop<Option<SharedString>>,
    /// The language its text is highlighted as: a name, an extension, or a file's name, as
    /// `main.rs`; Markdown when none is named.
    pub language: Prop<Option<SharedString>>,
    /// The text is read and copied, not changed.
    #[prop(default)]
    pub read_only: Prop<bool>,
    /// One line: Enter never adds a line, and is told as `enter`.
    #[prop(default)]
    pub one_line: Prop<bool>,
    /// Enter is told as `enter`, and Shift+Enter adds a line: a composer that sends on Enter.
    #[prop(default)]
    pub takes_enter: Prop<bool>,
    /// Vim's keys are on.
    #[prop(default)]
    pub vim: Prop<bool>,
    /// With Vim, the field opens in normal mode, as a buffer: else it opens typing.
    #[prop(default)]
    pub normal_first: Prop<bool>,
    /// The keystrokes the field's owner hears in it, before the editor, as `keymap` names them.
    #[prop(default)]
    pub keys: Prop<Vec<SharedString>>,
    /// The rows it is at least, growing with its text.
    pub min_rows: Prop<Option<u32>>,
    /// The rows it grows to, after which its text scrolls.
    pub max_rows: Prop<Option<u32>>,
    /// The font of the text.
    pub font_family: Prop<Option<SharedString>>,
    /// The size of the text, in points.
    #[prop(default = Points(15.0))]
    pub font_size: Prop<Points>,
    /// The height of a row, in points.
    #[prop(default = Points(24.0))]
    pub line_height: Prop<Points>,
    /// The styles of the editor's parts: the caret's colour in the mode's, the selection's.
    #[prop(default)]
    pub styles: Prop<EditorStyles>,
    /// The character under the caret outside insert mode, as a terminal's block.
    pub block: Prop<Option<Style>>,
    /// Whether a jump of the caret is told as `onTrail`.
    #[prop(default)]
    pub trail: Prop<bool>,
    /// What screen readers call the field.
    pub accessibility_label: Prop<Option<SharedString>>,
}

/// The Vim layer's state, as the status line shows it.
#[derive(Clone, Debug, Default, PartialEq, JsObject)]
pub struct VimStatus {
    /// `NORMAL`, `INSERT`, `VISUAL`, `VISUAL LINE`, `REPLACE`, `OPERATOR PENDING`, or `COMMAND`
    /// while `:` is typed.
    pub mode: String,
    /// The keys typed of a command that has not run yet: `2d`, `/word`, `:w`.
    pub pending: String,
}

/// A box in the field, in points: the caret's.
#[derive(Clone, Copy, Debug, Default, PartialEq, JsObject)]
pub struct CaretBox {
    /// From the field's left edge.
    pub x: f64,
    /// From the field's top edge.
    pub y: f64,
    /// Its width.
    pub width: f64,
    /// Its height.
    pub height: f64,
}

/// A jump of the caret: where it was, and where it is.
#[derive(Clone, Copy, Debug, Default, PartialEq, JsObject)]
pub struct CaretTrail {
    /// Where it was.
    pub from: CaretBox,
    /// Where it is.
    pub to: CaretBox,
}

/// What a field's editor tells TSX.
#[derive(Clone, Debug, PartialEq, Event)]
pub enum TextEditorEvent {
    /// The text changed: the whole new text.
    #[args(value)]
    Change(SharedString),
    /// The field took the focus.
    Focus,
    /// The field lost the focus.
    Blur,
    /// The Vim layer's mode or pending keys changed.
    #[args(status)]
    Status(VimStatus),
    /// A key the field gives its owner: `escape`, `quit`, `leave`, `save`, `enter`, `down`, `up`,
    /// or one of `keys`.
    #[args(key)]
    Key(SharedString),
    /// The caret jumped, with no edit: more than one cell, or to another line.
    #[args(trail)]
    Trail(CaretTrail),
}

/// How many times the Vim layer was called since the app started, and how long those calls took.
#[derive(Clone, Copy, Debug, Default, PartialEq, JsObject)]
pub struct VimCount {
    /// The calls: one a key, and one for each selection made outside the layer.
    pub keys: f64,
    /// The microseconds they took, their edits carried out on the editor.
    pub micros: f64,
}
