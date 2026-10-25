//! Text edits of the categories of `INBOX.md`, with no checking: the checked edits are in
//! `actions::inbox::categories`. Lines keep their own endings, so a file's line endings and its
//! final newline stay as they are.

use super::{category_headings, titled};

fn is_blank(line: &str) -> bool {
    line.trim().is_empty()
}

/// Adds the heading `## <name>` at the end, after a blank line, the final newline kept.
pub fn add_category(text: &str, name: &str) -> String {
    let newline = if text.contains("\r\n") { "\r\n" } else { "\n" };
    let titled = titled(text);
    let ends_with_newline = titled.ends_with('\n');
    let body = titled.trim_end_matches(['\n', '\r']);
    let end = if ends_with_newline { newline } else { "" };
    format!("{body}{newline}{newline}## {name}{end}")
}

/// Renames every `##` heading of the name `from` to `to`.
pub fn rename_category(text: &str, from: &str, to: &str) -> String {
    let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
    for (number, name) in category_headings(text) {
        if name == from {
            let line = &mut lines[number - 1];
            let ending = if line.ends_with('\r') { "\r" } else { "" };
            *line = format!("## {to}{ending}");
        }
    }
    lines.join("\n")
}

/// Removes every `##` heading of the name `name`, each with its body, which runs to the next `##`
/// heading. With `keep_notes`, the bodies, without their blank lines around, go instead to the end
/// of the lines before the first heading, in file order: after the notes without a category.
pub fn remove_category(text: &str, name: &str, keep_notes: bool) -> String {
    let lines: Vec<&str> = text.split('\n').collect();
    let headings = category_headings(text);
    let Some(&(first, _)) = headings.first() else {
        return text.to_string();
    };
    let mut kept_notes: Vec<&str> = Vec::new();
    let mut rest: Vec<&str> = Vec::new();
    for (at, (number, heading)) in headings.iter().enumerate() {
        let end = headings
            .get(at + 1)
            .map_or(lines.len(), |(next, _)| next - 1);
        if *heading != name {
            rest.extend(&lines[number - 1..end]);
            continue;
        }
        let body = &lines[*number..end];
        let start = body.iter().position(|line| !is_blank(line));
        let stop = body.iter().rposition(|line| !is_blank(line));
        if let (Some(start), Some(stop)) = (start, stop) {
            kept_notes.extend(&body[start..=stop]);
        }
    }
    let mut before: Vec<&str> = lines[..first - 1].to_vec();
    if keep_notes && !kept_notes.is_empty() {
        let at = before
            .iter()
            .rposition(|line| !is_blank(line))
            .map_or(0, |i| i + 1);
        let mut inserted: Vec<&str> = Vec::new();
        if at > 0 && before[at - 1].starts_with('#') {
            inserted.push("");
        }
        inserted.extend(kept_notes);
        if before.get(at).is_none_or(|line| !is_blank(line)) && !rest.is_empty() {
            inserted.push("");
        }
        before.splice(at..at, inserted);
    }
    before.extend(rest);
    before.join("\n")
}
