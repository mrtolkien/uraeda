//! Writing the `[keyboard]` table: its switches, and the lines of Vim's commands, a list whose
//! layout and comments the human's file keeps.

use std::path::Path;

use toml_edit::{Array, Item, Value};

use super::{Settings, change_table, set};
use crate::api::ApiError;

/// Sets whether the keys of one printable character act, in `[keyboard]`.
pub fn set_single_key_shortcuts(dir: &Path, on: bool) -> Result<Settings, ApiError> {
    change_table(dir, "keyboard", |keyboard| {
        set(keyboard, "single_key_shortcuts", Value::from(on));
        Ok(())
    })
}

/// Sets whether the text fields edit with Vim's keys, in `[keyboard]`.
pub fn set_vim_mode(dir: &Path, on: bool) -> Result<Settings, ApiError> {
    change_table(dir, "keyboard", |keyboard| {
        set(keyboard, "vim_mode", Value::from(on));
        Ok(())
    })
}

/// Sets the lines of Vim's commands run when Vim starts, in `[keyboard]`.
pub fn set_vim_commands(dir: &Path, lines: &[String]) -> Result<Settings, ApiError> {
    change_table(dir, "keyboard", |keyboard| {
        let old = keyboard.get("vim_commands").and_then(Item::as_array);
        let lines = old.map_or_else(
            || lines.iter().map(String::as_str).collect(),
            |old| kept_layout(old, lines),
        );
        set(keyboard, "vim_commands", Value::Array(lines));
        Ok(())
    })
}

/// The text of a decor, empty when it has none.
fn decor_text(raw: Option<&toml_edit::RawString>) -> &str {
    raw.and_then(toml_edit::RawString::as_str).unwrap_or("")
}

/// The text between two items, or around them, cut at its first line break: the end of the line
/// before, a same-line comment among it, and the lines after, comments and indent.
fn split_lines(between: &str) -> (&str, &str) {
    between.split_once('\n').unwrap_or(("", between))
}

/// `lines` as an array laid out as the human's list `old` was, when it was on several lines: each
/// line still there keeps its comments, the lines above it and the end of its own, and a new line
/// takes the first one's indent. A list on one line is written on one line.
fn kept_layout(old: &Array, lines: &[String]) -> Array {
    let items: Vec<&Value> = old.iter().collect();
    let prefixes: Vec<&str> = items
        .iter()
        .map(|item| decor_text(item.decor().prefix()))
        .collect();
    if !prefixes.iter().any(|prefix| prefix.contains('\n')) {
        return lines.iter().map(String::as_str).collect();
    }
    // Each item's lines above it, and the end of its own line, read in the text after it.
    let (head, _) = split_lines(prefixes[0]);
    let leads: Vec<&str> = prefixes
        .iter()
        .map(|prefix| split_lines(prefix).1)
        .collect();
    let mut tails: Vec<&str> = prefixes
        .iter()
        .skip(1)
        .map(|prefix| split_lines(prefix).0)
        .collect();
    let (last_tail, closing) = split_lines(decor_text(Some(old.trailing())));
    tails.push(last_tail);
    let indent = leads[0].rsplit('\n').next().unwrap_or("");
    // Each line, by the old item it still is, the first not yet taken with its text.
    let mut taken = vec![false; items.len()];
    let kept: Vec<Option<usize>> = lines
        .iter()
        .map(|line| {
            let found = (0..items.len())
                .find(|&index| !taken[index] && items[index].as_str() == Some(line.as_str()));
            if let Some(index) = found {
                taken[index] = true;
            }
            found
        })
        .collect();
    let tail_of = |at: Option<usize>| at.map_or("", |index| tails[index]);
    let mut array = Array::new();
    let mut before = head;
    for (line, &at) in lines.iter().zip(&kept) {
        let mut value = Value::from(line.as_str());
        let lead = at.map_or(indent, |index| leads[index]);
        value.decor_mut().set_prefix(format!("{before}\n{lead}"));
        let suffix = at.map_or("", |index| decor_text(items[index].decor().suffix()));
        value.decor_mut().set_suffix(suffix);
        array.push_formatted(value);
        before = tail_of(at);
    }
    array.set_trailing(format!("{before}\n{closing}"));
    array.set_trailing_comma(old.trailing_comma());
    array
}
