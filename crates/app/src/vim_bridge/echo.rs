//! A field's value as its owner gives it back, told from an echo that came too late.
//!
//! A field's text goes to its owner, in TSX, at each change, and its owner gives it back as the
//! field's value: the field is the owner's. When TSX lags behind the keys, typed fast, or on a
//! phone busy with a web view, it gives back a text the field has typed past already, and Native
//! Shell's editor took it, which put the caret back and lost the keys since: "127.0.0.1:4431"
//! became "127.0..1:44310". So the field keeps what it told its owner since its owner last caught
//! up: a value among them but not the last is an echo that came late, and is left; the last means
//! the owner caught up; any other is the owner's own, a reset after a send, and is taken.

use std::collections::VecDeque;

/// How many of its texts a field keeps while its owner has not caught up.
const KEPT: usize = 64;

/// What a field told its owner since its owner last gave back the last of it.
#[derive(Default)]
pub(super) struct Told {
    texts: VecDeque<String>,
}

impl Told {
    /// The field changed to `text`, and tells its owner.
    pub(super) fn told(&mut self, text: &str) {
        if self.texts.len() == KEPT {
            self.texts.pop_front();
        }
        self.texts.push_back(text.to_owned());
    }

    /// Whether the field takes `value`, which its owner gives: not when it is a text the field
    /// typed past since.
    pub(super) fn takes(&mut self, value: &str) -> bool {
        if self.texts.back().is_some_and(|last| last == value) {
            self.texts.clear();
            return true;
        }
        if self.texts.iter().any(|text| text == value) {
            return false;
        }
        self.texts.clear();
        true
    }
}

#[cfg(test)]
mod tests {
    use super::Told;

    #[test]
    fn an_echo_the_keys_typed_past_is_left() {
        let mut told = Told::default();
        for text in ["1", "12", "127"] {
            told.told(text);
        }
        assert!(!told.takes("1"));
        assert!(!told.takes("12"));
        assert!(told.takes("127"));
    }

    #[test]
    fn the_owners_own_value_is_taken_once_it_caught_up() {
        let mut told = Told::default();
        // Cleared by the keys, then typed again: "" is one of its texts.
        for text in ["a", "", "a", "ab"] {
            told.told(text);
        }
        assert!(told.takes("ab"));
        // A reset after a send, once the owner caught up.
        assert!(told.takes(""));
    }

    #[test]
    fn a_value_never_typed_is_taken_at_once() {
        let mut told = Told::default();
        told.told("draft");
        assert!(told.takes("a text restored"));
        assert!(told.takes("draft"));
    }
}
