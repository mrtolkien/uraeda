mod common;

use uraeda_core::decisions::{Run, compare};

/// The decisions of the repository's `specs/decisions/`, as `(name, text)`.
fn decisions_of_the_repository() -> Vec<(String, String)> {
    let mut decisions: Vec<(String, String)> =
        std::fs::read_dir(common::repository_path("specs/decisions"))
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .filter(|path| path.extension().is_some_and(|ext| ext == "md"))
            .map(|path| {
                let name = path.file_stem().unwrap().to_string_lossy().into_owned();
                (name, std::fs::read_to_string(path).unwrap())
            })
            .collect();
    decisions.sort();
    decisions
}

/// A rule's words and its check, each as plain text.
struct Rule {
    words: String,
    check: String,
}

fn joined(runs: &[Run]) -> String {
    runs.iter()
        .map(|run| run.text.as_str())
        .collect::<Vec<_>>()
        .join(" ")
}

/// The rules of a decision's `## Rules` section, cut as the decisions page cuts them.
fn rules_of(name: &str, text: &str) -> Vec<Rule> {
    compare(name, None, Some(text))
        .sections
        .into_iter()
        .filter(|section| section.title == "Rules")
        .flat_map(|section| section.parts)
        .filter(|part| part.strength.is_some())
        .map(|part| Rule {
            words: joined(&part.runs),
            check: joined(&part.check),
        })
        .collect()
}

/// The text without its `[text](target)` links: neither half counts as a rule's own words.
fn without_links(text: &str) -> String {
    let mut kept = String::new();
    let mut rest = text;
    while let Some(open) = rest.find('[') {
        let end = rest[open..]
            .find("](")
            .and_then(|mid| rest[open + mid..].find(')').map(|end| open + mid + end));
        let Some(end) = end else { break };
        kept.push_str(&rest[..open]);
        rest = &rest[end + 1..];
    }
    kept.push_str(rest);
    kept
}

// Days are left out: a lifetime the human chose, like a session's 30 days, is a hard value that stays.
const UNITS: [&str; 4] = ["second", "seconds", "minute", "minutes"];

fn is_file_name(span: &str) -> bool {
    span.rsplit_once('.').is_some_and(|(stem, extension)| {
        !stem.is_empty()
            && (1..=5).contains(&extension.len())
            && extension.chars().all(|c| c.is_ascii_alphanumeric())
    }) && !span.contains(char::is_whitespace)
        && !span.starts_with('-')
}

/// A `--flag`, a number followed by a unit of time, or a backticked file name with an extension.
fn mechanisms_in(words: &str) -> Vec<String> {
    let plain = without_links(words);
    let tokens: Vec<&str> = plain.split_whitespace().collect();
    let mut found = Vec::new();
    for (at, token) in tokens.iter().enumerate() {
        let bare = token.trim_matches(|c: char| !c.is_alphanumeric() && c != '-');
        if bare.len() > 2 && bare.starts_with("--") {
            found.push(bare.to_string());
        }
        let unit = tokens
            .get(at + 1)
            .map(|next| next.trim_matches(|c: char| !c.is_alphabetic()))
            .filter(|unit| UNITS.contains(unit));
        if let Some(unit) =
            unit.filter(|_| !bare.is_empty() && bare.chars().all(|c| c.is_ascii_digit()))
        {
            found.push(format!("{bare} {unit}"));
        }
    }
    let spans = plain.split('`').skip(1).step_by(2);
    found.extend(spans.filter(|span| is_file_name(span)).map(str::to_string));
    found
}

#[test]
fn no_decision_names_a_mechanism_its_checks_do_not() {
    let decisions = decisions_of_the_repository();
    assert!(decisions.len() >= 20, "the ledger was not read");
    for (name, text) in decisions {
        for rule in rules_of(&name, &text) {
            let named = mechanisms_in(&rule.words);
            let unchecked: Vec<&String> = named
                .iter()
                .filter(|mechanism| !rule.check.contains(mechanism.as_str()))
                .collect();
            assert!(
                unchecked.is_empty(),
                "{name}: a rule names {unchecked:?}, which its check does not: {}",
                rule.words
            );
        }
    }
}

#[test]
fn the_detector_finds_flags_times_and_files_outside_links() {
    let words = "A run MUST NOT pass `--force` or wait 30 seconds, and MUST NOT write `a.json`, \
                 see [`--other` for 5 minutes](x.md) and `ura check`.";
    assert_eq!(
        mechanisms_in(words),
        ["--force", "30 seconds", "a.json"].map(String::from)
    );
}
