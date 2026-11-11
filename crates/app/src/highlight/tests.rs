//! What a code block's runs are coloured as, by language.

use super::runs;

/// The runs of `code` in `language` that have a role, as `(text, role)`, in order.
fn coloured(language: &str, code: &str) -> Vec<(String, String)> {
    runs(language, code)
        .into_iter()
        .filter(|run| !run.role.is_empty())
        .map(|run| (run.text.trim().to_owned(), run.role))
        .collect()
}

fn has(found: &[(String, String)], text: &str, role: &str) -> bool {
    found.iter().any(|(t, r)| t == text && r == role)
}

/// A language, its code, and the `(text, role)` runs it must hold.
type Case<'a> = (&'a str, &'a str, &'a [(&'a str, &'a str)]);

#[test]
fn each_language_colours_its_kinds_of_token() {
    let cases: &[Case<'_>] = &[
        (
            "rust",
            "fn main() {\n    let n = 42; // the answer\n    println!(\"{n}\");\n}\n",
            &[
                ("fn", "keyword"),
                ("main", "function"),
                ("let", "keyword"),
                ("42", "number"),
                ("// the answer", "comment"),
            ],
        ),
        (
            "ts",
            "const name: string = \"Ada\";\nexport function greet() { return true; }\n",
            &[
                ("const", "keyword"),
                ("\"Ada\"", "string"),
                ("greet", "function"),
                ("true", "constant"),
            ],
        ),
        ("sh", "# a note\necho \"hi\"\n", &[("# a note", "comment")]),
        ("toml", "[server]\nport = 4320\n", &[("4320", "number")]),
    ];
    for (language, code, expected) in cases {
        let found = coloured(language, code);
        for (text, role) in *expected {
            assert!(
                has(&found, text, role),
                "{language}: `{text}` should be {role}, found {found:?}"
            );
        }
    }
}

#[test]
fn a_language_it_does_not_know_is_one_plain_run() {
    for language in ["", "text", "no-such-language"] {
        let code = "fn main() {}\n";
        let runs = runs(language, code);
        assert_eq!(runs.len(), 1, "{language}");
        assert_eq!(runs[0].text, code);
        assert_eq!(runs[0].role, "");
    }
}

#[test]
fn the_runs_hold_the_code_whole() {
    let code = "let s = \"é ✓\";\n\n// end";
    let joined: String = runs("rust", code).into_iter().map(|run| run.text).collect();
    assert_eq!(joined, code);
}
