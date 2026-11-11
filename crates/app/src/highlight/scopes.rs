//! Which of the theme's `syntax-*` roles a TextMate scope is drawn in: the innermost scope that
//! names one decides, as Native Shell's highlighter reads them.

use std::cell::RefCell;
use std::collections::HashMap;

use syntect::parsing::{Scope, ScopeStack};

/// Scopes by the start of their name, the first that matches deciding, most precise first.
const ROLES: &[(&str, &str)] = &[
    ("comment", "comment"),
    ("punctuation.definition.comment", "comment"),
    ("punctuation.definition.string", "string"),
    ("string", "string"),
    ("constant.character.escape", "string"),
    ("markup.inserted", "string"),
    ("constant.numeric", "number"),
    ("constant.language", "constant"),
    ("constant", "constant"),
    ("support.constant", "constant"),
    ("variable.other.constant", "constant"),
    ("variable.language", "variable"),
    ("variable.parameter", "variable"),
    ("variable.function", "function"),
    ("variable.other.property", "property"),
    ("variable.other.member", "property"),
    ("variable.other.object.property", "property"),
    ("meta.object-literal.key", "property"),
    ("support.type.property-name", "property"),
    ("meta.mapping.key", "property"),
    ("entity.name.tag", "tag"),
    ("entity.other.attribute-name", "attribute"),
    ("entity.name.function", "function"),
    ("support.function", "function"),
    ("meta.function-call", "function"),
    ("entity.name.type", "type"),
    ("entity.name.class", "type"),
    ("entity.name.struct", "type"),
    ("entity.name.enum", "type"),
    ("entity.name.trait", "type"),
    ("entity.name.namespace", "type"),
    ("entity.other.inherited-class", "type"),
    ("support.type", "type"),
    ("support.class", "type"),
    ("storage.type", "storage"),
    ("storage.modifier", "keyword"),
    ("keyword.operator", "operator"),
    ("keyword", "keyword"),
    ("markup.heading", "keyword"),
    ("entity.name.section", "keyword"),
    ("punctuation", "punctuation"),
];

/// Words a grammar scopes as a type that declare something: a keyword.
const DECLARING: &[&str] = &[
    "fn",
    "let",
    "const",
    "var",
    "class",
    "struct",
    "enum",
    "trait",
    "impl",
    "type",
    "interface",
    "function",
    "def",
    "mod",
    "static",
    "union",
    "namespace",
    "module",
    "macro_rules!",
    "async",
    "await",
    "func",
    "local",
];

thread_local! {
    /// The role of each scope met: building a scope's name is slow.
    static KNOWN: RefCell<HashMap<Scope, Option<&'static str>>> = RefCell::default();
}

/// The role of `text` under `scopes`: that of its innermost scope that has one, settled by its
/// text. Empty for the code's own colour.
pub(super) fn role(scopes: &ScopeStack, text: &str) -> &'static str {
    let found = KNOWN.with_borrow_mut(|known| {
        scopes
            .as_slice()
            .iter()
            .rev()
            .find_map(|scope| *known.entry(*scope).or_insert_with(|| of(*scope)))
    });
    match found {
        // Some grammars give declarations and types one scope: Rust's `fn` and `f32`.
        Some("storage") if DECLARING.contains(&text.trim()) => "keyword",
        Some("storage") => "type",
        // `as` and `typeof` are words, where `+` and `=` are signs.
        Some("operator") if text.trim().chars().all(|c| c.is_ascii_alphabetic()) => "keyword",
        Some(role) => role,
        None => "",
    }
}

fn of(scope: Scope) -> Option<&'static str> {
    let name = scope.build_string();
    ROLES
        .iter()
        .find(|(start, _)| {
            name == *start
                || name
                    .strip_prefix(start)
                    .is_some_and(|rest| rest.starts_with('.'))
        })
        .map(|(_, role)| *role)
}
