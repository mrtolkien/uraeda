//! The option letters an answer starts with, and its comment after them.

/// The option letters an answer starts with: "B and C: ..." is B and C, "C, we want ..." is C.
pub(super) fn picked_letters(answer: &str, options: &[char]) -> Vec<char> {
    let mut picked = Vec::new();
    for word in answer
        .split(|c: char| !(c.is_alphanumeric() || c == '\''))
        .filter(|word| !word.is_empty())
    {
        let mut chars = word.chars();
        match (chars.next(), chars.next()) {
            (Some(letter), None) if options.contains(&letter) => picked.push(letter),
            _ if word.eq_ignore_ascii_case("and") || word.eq_ignore_ascii_case("or") => {}
            _ => break,
        }
    }
    picked
}

/// An answer from the letters picked and a comment, as the web UI composes it: `A`, `B and C`,
/// `A, B and C`, then `: <comment>`; a comment alone is written as it is. A comment starting with
/// a code block starts on the line after the letters, after a blank line.
pub fn compose_answer(letters: &[String], comment: &str) -> String {
    let mut letters: Vec<&str> = letters.iter().map(String::as_str).collect();
    letters.sort_unstable();
    letters.dedup();
    let comment = comment.trim();
    let picked = match letters.as_slice() {
        [] => return comment.to_string(),
        [one] => one.to_string(),
        [rest @ .., last] => format!("{} and {last}", rest.join(", ")),
    };
    if comment.is_empty() {
        picked
    } else if comment.lines().next().is_some_and(crate::files::is_fence) {
        // A fence is one only at the start of its line: a code block starts below the letters.
        format!("{picked}:\n\n{comment}")
    } else {
        format!("{picked}: {comment}")
    }
}

/// An answer split into the option letters it starts with and its comment, when it starts with
/// letters joined by `, ` and ` and `, followed by `:` or its end. Any other answer is a comment.
pub fn split_answer(answer: &str, options: &[char]) -> (Vec<String>, String) {
    let whole = || (Vec::new(), answer.trim().to_string());
    let mut letters = Vec::new();
    let mut rest = answer.trim();
    loop {
        let mut chars = rest.chars();
        let Some(letter) = chars.next().filter(|c| options.contains(c)) else {
            return whole();
        };
        letters.push(letter.to_string());
        rest = chars.as_str();
        if rest.is_empty() {
            return (letters, String::new());
        }
        if let Some(comment) = rest.strip_prefix(':') {
            return (letters, comment.trim().to_string());
        }
        rest = match [", and ", " and ", ", "]
            .iter()
            .find_map(|joint| rest.strip_prefix(joint))
        {
            Some(next) => next,
            None => return whole(),
        };
    }
}
