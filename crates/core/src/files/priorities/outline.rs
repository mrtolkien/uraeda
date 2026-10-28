//! The outline of an entry of `PRIORITIES.md`: the entry, and the items nested under it at any
//! depth (see [`nested`](super::super::nested)). An entry indents under the entry above it in its
//! section, and an entry's own item outdented becomes the entry after it.

use super::super::nested::{self, OutlineEdit};
use super::{Entry, Section, entry_id, parse};

/// Applies `edit` to the entry `id`, or with `at`, to the item at `at` of its outline, from 0 in
/// the order of the file. `None` when there is no such entry or item, or nowhere to go: the first
/// sibling indented, an entry outdented, the first sibling moved up, the last moved down.
pub fn outline(text: &str, id: &str, at: Option<usize>, edit: &OutlineEdit) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let entries = parse(text);
        let index = entries
            .iter()
            .position(|entry| entry_id(entry) == id)
            .ok_or(())?;
        match at {
            None => on_entry(text, &entries, index, edit),
            Some(at) => nested::on_nested(text, &entries[index].item, at, edit),
        }
        .ok_or(())
    })
    .ok()
}

/// Where a dropped item goes: an entry at `index` of a section, or an item nested under the entry
/// `entry`, or with `at` under its nested item at `at`, at `index` among the items there. `index`
/// counts them once the dropped item left them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Drop {
    Entry {
        section: Section,
        index: usize,
    },
    Under {
        entry: String,
        at: Option<usize>,
        index: usize,
    },
}

/// Moves the entry `id`, or with `at` its nested item at `at`, its own items with it, to `to`: what
/// a drag writes. `None` when an entry or item is missing, it would go under itself, or nested
/// lines cannot be written again.
pub fn drop_item(text: &str, id: &str, at: Option<usize>, to: &Drop) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let entries = parse(text);
        let position = |id: &str| entries.iter().position(|entry| entry_id(entry) == id);
        let from = position(id).ok_or(())?;
        match (to, at) {
            (Drop::Entry { section, index }, None) => {
                super::move_entry(text, id, *section, *index)
            }
            (Drop::Entry { section, index }, Some(at)) => {
                let (without, lines) = nested::take(text, &entries[from].item, at).ok_or(())?;
                super::insert_entry(&without, *section, *index, &lines)
            }
            (Drop::Under { entry, at: to_at, index }, at) => {
                let to = position(entry).ok_or(())?;
                let items: Vec<_> = entries.iter().map(|entry| entry.item.clone()).collect();
                nested::move_under(text, &items, (from, at), (to, *to_at), *index)
            }
        }
        .ok_or(())
    })
    .ok()
}

/// An edit of an entry itself.
fn on_entry(text: &str, entries: &[Entry], index: usize, edit: &OutlineEdit) -> Option<String> {
    let entry = &entries[index];
    let id = entry_id(entry);
    match edit {
        OutlineEdit::Edit(line) => super::edit(text, &id, line),
        OutlineEdit::Remove => super::remove(text, &id),
        OutlineEdit::Insert { line, below } => {
            let place = entries
                .iter()
                .filter(|other| other.section == entry.section)
                .position(|other| other.line == entry.line)?;
            let marker = nested::marker_beside(&entry.item.marker).render();
            super::insert_entry(
                text,
                entry.section,
                place + usize::from(*below),
                &[format!("{marker} {line}")],
            )
        }
        OutlineEdit::Append(line) => nested::append_child(text, &entry.item, line),
        // It becomes the last item of the entry above it, in its section.
        OutlineEdit::Indent => {
            let above = entries[..index]
                .iter()
                .rfind(|other| other.section == entry.section)?;
            nested::indent_under(text, &above.item, &entry.item)
        }
        OutlineEdit::Outdent | OutlineEdit::Up | OutlineEdit::Down => None,
    }
}
