//! The `allowed_hosts` array edited as a human would edit it: each name keeps the comments above
//! it and the one ending its line, and a name added or removed takes only its own with it.
//!
//! In `toml_edit`, the comment ending a name's line, after its comma, opens the next name's prefix,
//! or the array's trailing text after the last name: a name's line ends in the first line of what
//! follows it.

use toml_edit::{Array, Value};

/// Adds `name` at the end: on a line of its own, indented like the last name, when the names are
/// one per line; after a space otherwise.
pub fn push(hosts: &mut Array, name: &str) {
    let Some(last) = hosts.iter().last() else {
        hosts.push(name);
        return;
    };
    let last_prefix = prefix(last);
    let Some(end) = last_prefix.rfind('\n') else {
        hosts.push(name);
        return;
    };
    let indent = &last_prefix[end + 1..];
    let after = format!("{}{}", suffix(last), text(hosts.trailing()));
    let (line, rest) = first_line(&after);
    let (prefix, trailing) = if line.ends_with('\n') {
        (format!("{line}{indent}"), format!("\n{rest}"))
    } else {
        (format!("\n{indent}"), after.clone())
    };
    if let Some(last) = hosts.iter_mut().last() {
        last.decor_mut().set_suffix("");
    }
    let mut added = Value::from(name);
    added.decor_mut().set_prefix(prefix);
    added.decor_mut().set_suffix("");
    hosts.push_formatted(added);
    hosts.set_trailing(trailing);
}

/// Removes the name at `index` with the comments above it and the one ending its line; the comment
/// ending the line before stays.
pub fn remove(hosts: &mut Array, index: usize) {
    let removed = hosts.remove(index);
    let removed_prefix = prefix(&removed);
    let (before, _) = first_line(&removed_prefix);
    if let Some(next) = hosts.get_mut(index) {
        let next_prefix = prefix(next);
        let (_, own) = first_line(&next_prefix);
        let joined = format!("{before}{own}");
        next.decor_mut().set_prefix(joined);
    } else if before.ends_with('\n') {
        let after = format!("{}{}", suffix(&removed), text(hosts.trailing()));
        let (_, rest) = first_line(&after);
        hosts.set_trailing(format!("{before}{rest}"));
    }
    if hosts.is_empty() {
        hosts.set_trailing("");
        hosts.set_trailing_comma(false);
    }
}

/// `text` split after its first line end; all of it first when it has none.
fn first_line(text: &str) -> (&str, &str) {
    match text.find('\n') {
        Some(end) => text.split_at(end + 1),
        None => (text, ""),
    }
}

fn prefix(value: &Value) -> String {
    value.decor().prefix().map(text).unwrap_or_default()
}

fn suffix(value: &Value) -> String {
    value.decor().suffix().map(text).unwrap_or_default()
}

/// A raw text of a document parsed for editing, which holds its text rather than a span.
fn text(raw: &toml_edit::RawString) -> String {
    raw.as_str().unwrap_or_default().to_owned()
}
