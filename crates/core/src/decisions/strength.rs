//! A rule's strength: its first RFC 2119 keyword, read here and nowhere else.

/// The strength of a rule, from its first RFC 2119 keyword.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Strength {
    Must,
    MustNot,
    Should,
    ShouldNot,
    May,
}

impl Strength {
    /// Rules order MUST and MUST NOT first, then SHOULD and SHOULD NOT, then MAY.
    pub fn rank(self) -> u8 {
        match self {
            Strength::Must | Strength::MustNot => 0,
            Strength::Should | Strength::ShouldNot => 1,
            Strength::May => 2,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Strength::Must => "must",
            Strength::MustNot => "must-not",
            Strength::Should => "should",
            Strength::ShouldNot => "should-not",
            Strength::May => "may",
        }
    }
}

/// The first of `MUST NOT`, `MUST`, `SHOULD NOT`, `SHOULD`, and `MAY` in `text`, as whole
/// upper-case words. `NOT` counts only right after its keyword, with nothing but a space between.
pub fn strength(text: &str) -> Option<Strength> {
    let mut words = text.split_whitespace().peekable();
    while let Some(word) = words.next() {
        let bare = word.trim_matches(|c: char| !c.is_alphanumeric());
        let negated = bare == word && words.peek().is_some_and(|next| is_not(next));
        let found = match (bare, negated) {
            ("MUST", true) => Strength::MustNot,
            ("MUST", false) => Strength::Must,
            ("SHOULD", true) => Strength::ShouldNot,
            ("SHOULD", false) => Strength::Should,
            ("MAY", _) => Strength::May,
            _ => continue,
        };
        return Some(found);
    }
    None
}

fn is_not(word: &str) -> bool {
    word.trim_end_matches(|c: char| !c.is_alphanumeric()) == "NOT"
}
