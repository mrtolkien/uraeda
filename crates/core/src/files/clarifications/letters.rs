//! The option letters an answer starts with, and its comment after them.

/// The joints between two letters.
const JOINTS: [&str; 3] = [", and ", " and ", ", "];

/// The marks ending the letters: the comment follows them.
const END_MARKS: [char; 3] = [':', ',', '.'];

/// The option letters an answer starts with: "B and C: ..." is B and C, "C, we want ..." is C,
/// and "C but ..." is none.
pub fn letters(answer: &str, options: &[char]) -> Vec<char> {
    read(answer, options).0
}

/// An answer split into the option letters it starts with and its comment, everything after the
/// letters and their end mark. An answer starting with no letter is a comment.
pub fn split_answer(answer: &str, options: &[char]) -> (Vec<String>, String) {
    let (letters, comment) = read(answer, options);
    (letters.iter().map(char::to_string).collect(), comment)
}

/// The option letter a text starts with, and the text after it.
fn first_letter<'a>(text: &'a str, options: &[char]) -> Option<(char, &'a str)> {
    let mut chars = text.chars();
    let letter = chars.next().filter(|c| options.contains(c))?;
    Some((letter, chars.as_str()))
}

/// The letters and the comment of an answer. Letters are joined by `, `, `and`, or `, and `, and
/// ended by `:`, `,`, `.`, or the end: the letters are the longest run of joined letters followed
/// by an end mark or the end, and everything after that mark is the comment. With options A to C,
/// "B, C and D" is B, with the comment "C and D", since no run ends after C; "A and B are both
/// bad" and "C but ..." have no letter, and the whole answer is the comment.
fn read(answer: &str, options: &[char]) -> (Vec<char>, String) {
    let answer = answer.trim();
    let mut run = Vec::new();
    let mut longest: Option<(usize, &str)> = None;
    let mut rest = answer;
    while let Some((letter, after)) = first_letter(rest, options) {
        run.push(letter);
        if after.is_empty() {
            longest = Some((run.len(), ""));
            break;
        }
        if let Some(comment) = after.strip_prefix(END_MARKS) {
            longest = Some((run.len(), comment));
        }
        match JOINTS.iter().find_map(|joint| after.strip_prefix(joint)) {
            Some(next) => rest = next,
            None => break,
        }
    }
    match longest {
        Some((count, comment)) => {
            run.truncate(count);
            (run, comment.trim().to_string())
        }
        None => (Vec::new(), answer.to_string()),
    }
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
