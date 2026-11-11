//! Code blocks' colours, in Rust: the text of a finished code block cut into runs, each with the
//! theme's `syntax-*` role it is drawn in. It reads with syntect and two-face's syntaxes (bat's
//! set), the ones Native Shell's editor highlights with, so the app holds one highlighter: Native
//! Shell keeps its own tokenizer private, and colours it with a palette of its own, where the app
//! takes its theme's roles.

mod scopes;
#[cfg(test)]
mod tests;

use std::sync::OnceLock;

use nsh_core::prelude::*;
use syntect::parsing::{ParseState, ScopeStack, SyntaxReference, SyntaxSet};

/// A run of a code block's text, in one colour.
#[derive(Clone, Debug, PartialEq, Eq, JsObject)]
pub struct CodeRun {
    pub text: String,
    /// The theme's role it is drawn in, without `syntax-`: `keyword`, `string`, `comment`,
    /// `number`, `constant`, `function`, `type`, `operator`, `property`, `punctuation`, `tag`,
    /// `attribute`, or `variable`; empty for the code's own colour.
    pub role: String,
}

/// bat's syntaxes, read once, on the first block with a language: tens of milliseconds.
fn syntaxes() -> &'static SyntaxSet {
    static SYNTAXES: OnceLock<SyntaxSet> = OnceLock::new();
    SYNTAXES.get_or_init(two_face::syntax::extra_newlines)
}

/// The syntax of a fence's language, by its extension or its name, or the other names fences use.
fn syntax(language: &str) -> Option<&'static SyntaxReference> {
    let language = language.trim();
    if ["", "text", "txt", "plain", "plaintext"]
        .iter()
        .any(|plain| language.eq_ignore_ascii_case(plain))
    {
        return None;
    }
    let alias = match language.to_ascii_lowercase().as_str() {
        "shell" | "console" | "shellscript" | "zsh" | "fish" => "sh",
        "golang" => "go",
        "jsx" => "tsx",
        "mjs" | "cjs" => "js",
        "c++" => "cpp",
        "c#" | "csharp" => "cs",
        "jsonc" | "json5" => "json",
        "docker" => "Dockerfile",
        "make" => "Makefile",
        "vue" | "svelte" => "html",
        _ => language,
    };
    syntaxes()
        .find_syntax_by_token(alias)
        .filter(|syntax| syntax.name != "Plain Text")
}

/// `code`, written in `language`, cut into runs of one role each, which hold the code whole. A
/// language it does not know, or none, is one plain run.
pub(crate) fn runs(language: &str, code: &str) -> Vec<CodeRun> {
    let Some(syntax) = syntax(language) else {
        return vec![run(code, "")];
    };
    let mut state = ParseState::new(syntax);
    let mut stack = ScopeStack::new();
    let mut runs: Vec<CodeRun> = Vec::new();
    for line in code.split_inclusive('\n') {
        // A line it cannot read keeps its own colour, and the rest of the block is read on.
        let Ok(changes) = state.parse_line(line, syntaxes()) else {
            push(&mut runs, line, "");
            continue;
        };
        let mut at = 0;
        for (end, change) in changes {
            if end > at {
                let text = &line[at..end];
                push(&mut runs, text, scopes::role(&stack, text));
                at = end;
            }
            // An operation it cannot apply leaves the scopes as they were.
            let _ = stack.apply(&change);
        }
        if at < line.len() {
            let text = &line[at..];
            push(&mut runs, text, scopes::role(&stack, text));
        }
    }
    runs
}

fn run(text: &str, role: &str) -> CodeRun {
    CodeRun {
        text: text.to_owned(),
        role: role.to_owned(),
    }
}

/// Adds `text` in `role`, to the last run when it has that role: whitespace takes the last run's.
fn push(runs: &mut Vec<CodeRun>, text: &str, role: &str) {
    let role = if text.trim().is_empty() {
        runs.last().map_or("", |last| last.role.as_str()).to_owned()
    } else {
        role.to_owned()
    };
    match runs.last_mut() {
        Some(last) if last.role == role => last.text.push_str(text),
        _ => runs.push(CodeRun {
            text: text.to_owned(),
            role,
        }),
    }
}

/// Code blocks' colours.
#[module]
pub(crate) struct Highlight;

#[module(flat)]
impl Highlight {
    /// The runs of a finished code block, `code` in `language` as its fence names it, each in one
    /// of the theme's `syntax-*` roles, which together hold the code whole. Read once per block,
    /// on a thread of its own: the first block with a language reads the syntaxes, in tens of
    /// milliseconds, and a long block takes as many.
    pub(crate) async fn highlight_code(
        code: String,
        language: String,
    ) -> Result<Vec<CodeRun>, String> {
        blocking(move || runs(&language, &code))
            .await
            .map_err(|error| error.to_string())
    }
}
