//! Uraeda's Vim layer: a pure state machine from keys to editor commands. It draws nothing: the
//! app's text field runs the commands on Native Shell's editor.
//!
//! [`Vim::key`] takes a key and a [`TextView`], the text and its selection, and returns the
//! [`Edit`]s the editor must carry out. The layer holds no text, and reaches nothing outside
//! itself: the system clipboard and the editor's undo are edits the caller carries out.
//!
//! The keys are a named subset of Vim's, [`SUBSET`], the one the text-editing decision asks for.
//! Where Vim and Neovim differ, the layer follows Neovim's defaults: `Y` yanks to the line's end,
//! and a line opened by `o`, `O`, `cc`, or `S` keeps its line's indent.

mod command;
mod edit;
mod insert;
mod key;
mod motion;
mod object;
mod operator;
mod out;
mod pair;
mod register;
mod repeat;
mod search;
mod select;
mod state;
mod tag;
mod text;
mod visual;
mod walk;
mod word;

pub use command::SUBSET;
pub use key::{Key, keys};
pub use state::Vim;
pub use text::{Lines, Position, Text, TextView};

/// One thing the editor must do for a key. A call's edits are carried out in order, and its
/// replacement is one step of the editor's undo.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Edit {
    /// Replace the text from `start` to `end`, places of the text as it was before the key, with
    /// `text`. A call returns one at most, before any other edit.
    Replace {
        /// Where the replaced text starts.
        start: Position,
        /// Where it ends: equal to `start` when `text` only goes in.
        end: Position,
        /// What takes its place: empty when the range is only deleted.
        text: String,
    },
    /// Set the selection, in the text after the replacement. Equal ends are a caret.
    Select {
        /// Where the selection starts.
        anchor: Position,
        /// Where the caret is.
        head: Position,
    },
    /// Take back the editor's last step, then tell the layer with [`Vim::sync`].
    Undo,
    /// Do again the step last taken back, then tell the layer with [`Vim::sync`].
    Redo,
    /// Write this text to the system clipboard: a yank reaches it, a delete never does.
    Clipboard(String),
    /// Read the system clipboard, and give its text to [`Vim::clipboard`], now or later.
    ReadClipboard,
    /// The key is not the layer's: the field does what the key does without Vim. In insert mode
    /// the editor types it; in normal mode Escape and Enter are the field's own.
    Pass,
}

/// The mode, as the status line names it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Mode {
    /// Keys are commands.
    Normal,
    /// Keys type.
    Insert,
    /// Motions extend a selection of characters.
    Visual,
    /// Motions extend a selection of whole lines.
    VisualLine,
    /// `r` waits for the character that replaces the caret's.
    Replace,
    /// An operator waits for its motion or its object.
    OperatorPending,
}

impl Mode {
    /// The mode's full name, for the status line.
    #[must_use]
    pub fn label(self) -> &'static str {
        match self {
            Mode::Normal => "NORMAL",
            Mode::Insert => "INSERT",
            Mode::Visual => "VISUAL",
            Mode::VisualLine => "VISUAL LINE",
            Mode::Replace => "REPLACE",
            Mode::OperatorPending => "OPERATOR PENDING",
        }
    }
}

/// What the status line shows of the layer.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Status {
    /// The mode.
    pub mode: Mode,
    /// The keys typed of a command that has not run yet, like `2d` or `"a`, or the search being
    /// typed, like `/word`.
    pub pending: String,
}
