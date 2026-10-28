//! The outline of a note of `INBOX.md`: the note, and the items nested under it at any depth (see
//! [`nested`](super::super::nested)), and where a drag drops a note or one of its items. A note
//! indents under the note above it in its category, and a note's own item outdented becomes the note
//! after it.

use super::super::lines::Item;
use super::super::nested::{self, OutlineEdit};
use super::super::with_unix_newlines;
use super::{edit, find, insert, parse, place, remove, scan};

/// Applies `change` to the note `id`, or with `at`, to the item at `at` of the items nested under it,
/// in the order of the file (see [`nested`](super::nested)). A note indents under the note above it
/// in its category, its marks kept in its text; a note's own item outdented becomes the note after
/// it. `None` when there is no such note or item, or nowhere to go.
pub fn outline(text: &str, id: &str, at: Option<usize>, change: &OutlineEdit) -> Option<String> {
    if let Some(at) = at {
        return with_unix_newlines(text, |text| {
            let item = find(text, id).ok_or(())?;
            nested::on_nested(text, &item, at, change).ok_or(())
        })
        .ok();
    }
    match change {
        OutlineEdit::Edit(line) => edit(text, id, line),
        OutlineEdit::Remove => remove(text, id),
        OutlineEdit::Insert { line, below } => {
            let (category, index) = place_of(text, id)?;
            let marker = nested::marker_beside(&find(text, id)?.marker).render();
            insert(
                text,
                category.as_deref(),
                index + usize::from(*below),
                &[format!("{marker} {line}")],
            )
        }
        OutlineEdit::Append(line) => with_unix_newlines(text, |text| {
            let item = find(text, id).ok_or(())?;
            nested::append_child(text, &item, line).ok_or(())
        })
        .ok(),
        // It becomes the last item of the note above it, in its category.
        OutlineEdit::Indent => with_unix_newlines(text, |text| {
            let notes = scan(text);
            let number: usize = id
                .strip_prefix("note-")
                .and_then(|n| n.parse().ok())
                .ok_or(())?;
            let index = number.checked_sub(1).ok_or(())?;
            let (heading, item) = notes.get(index).ok_or(())?;
            let (above_heading, above) = notes.get(index.checked_sub(1).ok_or(())?).ok_or(())?;
            if above_heading != heading {
                return Err(());
            }
            nested::indent_under(text, above, item).ok_or(())
        })
        .ok(),
        OutlineEdit::Outdent | OutlineEdit::Up | OutlineEdit::Down => None,
    }
}

/// Where a dropped item goes: a note at `index` of a category, or of the notes without one, or an
/// item nested under the note `note`, or with `at` under its nested item at `at`, at `index` among
/// the items there. `index` counts them once the dropped item left them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Drop {
    Note {
        category: Option<String>,
        index: usize,
    },
    Under {
        note: String,
        at: Option<usize>,
        index: usize,
    },
}

/// Moves the note `id`, or with `at` its nested item at `at`, its own items with it, to `to`: what
/// a drag writes. `None` when a note or item is missing, it would go under itself, or nested lines
/// cannot be written again.
pub fn drop_item(text: &str, id: &str, at: Option<usize>, to: &Drop) -> Option<String> {
    with_unix_newlines(text, |text| {
        let items: Vec<Item> = scan(text).into_iter().map(|(_, item)| item).collect();
        let index_of = |id: &str| {
            let number: usize = id.strip_prefix("note-")?.parse().ok()?;
            number.checked_sub(1).filter(|&index| index < items.len())
        };
        let from = index_of(id).ok_or(())?;
        match (to, at) {
            (Drop::Note { category, index }, None) => place(text, id, category.as_deref(), *index),
            (Drop::Note { category, index }, Some(at)) => {
                let (without, lines) = nested::take(text, &items[from], at).ok_or(())?;
                insert(&without, category.as_deref(), *index, &lines)
            }
            (
                Drop::Under {
                    note,
                    at: to_at,
                    index,
                },
                at,
            ) => {
                let to = index_of(note).ok_or(())?;
                nested::move_under(text, &items, (from, at), (to, *to_at), *index)
            }
        }
        .ok_or(())
    })
    .ok()
}

/// A note's category, and its index among its category's notes.
fn place_of(text: &str, id: &str) -> Option<(Option<String>, usize)> {
    let notes = parse(text);
    let note = notes.iter().find(|note| note.id == id)?;
    let index = notes
        .iter()
        .filter(|other| other.category == note.category)
        .position(|other| other.id == note.id)?;
    Some((note.category.clone(), index))
}
