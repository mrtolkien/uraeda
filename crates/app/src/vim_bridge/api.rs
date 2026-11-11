//! The methods of a field's editor, a ref's in TSX: `focus`, `blur`, `insert`, `press`.

use nsh_base::editor::{EditorPosition, EditorSelection};
use nsh_core::prelude::*;

use super::Field;

/// The methods of a field's editor.
pub struct TextEditorApi {
    field: Field,
}

impl TextEditorApi {
    pub(super) fn new(field: Field) -> Self {
        Self { field }
    }
}

#[methods]
impl TextEditorApi {
    /// Takes the focus, the caret at the text's end when it was at its start.
    pub fn focus(&self) {
        if let Some(api) = self.field.api() {
            let at = api.selections().last().copied().unwrap_or_default();
            if at.head == EditorPosition::default() {
                let end = api.offset_to_position(u32::MAX);
                api.set_selections(vec![EditorSelection::new(end, end)]);
            }
            api.focus();
        }
    }

    /// Gives the focus up.
    pub fn blur(&self) {
        if let Some(api) = self.field.api() {
            api.blur();
        }
    }

    /// Types `text` at the caret, as a paste does: an image's link a screen dropped in.
    pub fn insert(&self, text: String) {
        if let Some(api) = self.field.api() {
            api.insert(text);
        }
    }

    /// Presses `stroke` in the field as if it came from the keyboard: Vim's first, then the
    /// field's. For the Escape an overlay takes before any view (`Float`'s `onCancel`).
    pub fn press(&self, stroke: String) {
        self.field.press(&stroke);
    }
}
