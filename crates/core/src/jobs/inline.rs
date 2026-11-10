//! An inline `jobs = [ ... ]` list on several lines: each entry keeps its comments, the lines above
//! it and the end of its own line, when an entry is added or removed. A comment after an entry's
//! comma is read in the text before the next entry, so the text between two entries is cut at its
//! first line break: the end of the line before, then the lines after. A list on one line is left
//! to `toml_edit`.

use toml_edit::{Array, RawString, Value};

/// The text of a decor, empty when it has none.
fn text(raw: Option<&RawString>) -> &str {
    raw.and_then(RawString::as_str).unwrap_or_default()
}

/// The text cut at its first line break; the whole text is the lines after when it has none.
fn split(between: &str) -> (&str, &str) {
    between.split_once('\n').unwrap_or(("", between))
}

/// A list's layout, entry by entry.
struct Lines {
    /// The end of the line the `[` is on.
    head: String,
    /// The lines above each entry, and its indent, with whether the entry starts a line.
    leads: Vec<(String, bool)>,
    /// The end of the line each entry's comma is on.
    tails: Vec<String>,
    /// The text before the `]`, after its line break.
    closing: String,
    /// The entry whose suffix is already in `tails`: the last one of a list without a trailing
    /// comma. Every other suffix is a comment between a value and its comma, and stays where it is.
    consumed: Option<usize>,
}

impl Lines {
    /// The layout of `list`, `None` when it is empty or on one line.
    fn of(list: &Array) -> Option<Self> {
        let prefixes: Vec<&str> = list.iter().map(|v| text(v.decor().prefix())).collect();
        let last = list.iter().last()?;
        let end = if list.trailing_comma() {
            text(Some(list.trailing())).to_owned()
        } else {
            format!(
                "{}{}",
                text(last.decor().suffix()),
                text(Some(list.trailing()))
            )
        };
        if !end.contains('\n') && !prefixes.iter().any(|prefix| prefix.contains('\n')) {
            return None;
        }
        let ends = prefixes.iter().skip(1).copied().chain([end.as_str()]);
        Some(Self {
            head: split(prefixes[0]).0.to_owned(),
            leads: prefixes
                .iter()
                .map(|prefix| (split(prefix).1.to_owned(), prefix.contains('\n')))
                .collect(),
            tails: ends.clone().map(|end| split(end).0.to_owned()).collect(),
            closing: split(&end).1.to_owned(),
            consumed: (!list.trailing_comma()).then(|| list.len() - 1),
        })
    }

    /// Writes this layout on the entries of `list`, one per lead. A comment is never dropped: an
    /// entry that follows one starts its own line, even when it shared its line.
    fn apply(&self, list: &mut Array) {
        for (at, value) in list.iter_mut().enumerate() {
            let (lead, breaks) = &self.leads[at];
            let before = if at == 0 {
                &self.head
            } else {
                &self.tails[at - 1]
            };
            let prefix = if *breaks || !before.trim().is_empty() {
                format!("{before}\n{lead}")
            } else {
                lead.clone()
            };
            value.decor_mut().set_prefix(prefix);
            if self.consumed == Some(at) {
                value.decor_mut().set_suffix("");
            }
        }
        let tail = self.tails.last().map_or("", String::as_str);
        list.set_trailing(format!("{tail}\n{}", self.closing));
    }
}

/// Removes the entry at `place` of `list`, with its comments: the lines above it and the end of
/// its own line.
pub(super) fn remove(list: &mut Array, place: usize) {
    let lines = Lines::of(list);
    list.remove(place);
    if let Some(mut lines) = lines {
        lines.leads.remove(place);
        lines.tails.remove(place);
        lines.consumed = match lines.consumed {
            Some(at) if at == place => None,
            Some(at) if at > place => Some(at - 1),
            other => other,
        };
        if !list.is_empty() {
            lines.apply(list);
        }
    }
}

/// Adds `value` as the last entry of `list`, on a line of its own, indented as the first entry is.
pub(super) fn push(list: &mut Array, value: Value) {
    let lines = Lines::of(list);
    list.push(value);
    if let Some(mut lines) = lines {
        let indent = lines.leads[0].0.rsplit('\n').next().unwrap_or_default();
        lines.leads.push((indent.to_owned(), true));
        lines.tails.push(String::new());
        lines.apply(list);
    }
}
