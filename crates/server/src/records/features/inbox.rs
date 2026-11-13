//! The inbox: `INBOX.md` read for editing, and the edits of its notes and its categories, each
//! written on the default branch over the inbox read at the input's hash.

use uraeda_core::api::{self, DropAt, undo};
use uraeda_protocol::{
    Inbox, InboxAdd, InboxAddCategory, InboxDrop, InboxEdit, InboxMoveCategory, InboxOutline,
    InboxPlace, InboxRemove, InboxRemoveCategory, InboxRenameCategory, ListWritten, RepositoryArgs,
};

use super::{lists, views};
use crate::live::{Call, Fault, Registry};
use crate::records::repositories;
use crate::records::writing::Write;
use crate::shared::Shared;

/// Registers the record `Inbox`, and the actions that write the inbox alone.
pub(super) fn register(registry: &Registry) {
    registry.record::<Inbox>(read);
    registry.action::<InboxAdd>(add);
    registry.action::<InboxEdit>(edit);
    registry.action::<InboxOutline>(outline);
    registry.action::<InboxMoveCategory>(categorize);
    registry.action::<InboxPlace>(place);
    registry.action::<InboxDrop>(drop);
    registry.action::<InboxRemove>(remove);
    registry.action::<InboxAddCategory>(add_category);
    registry.action::<InboxRenameCategory>(rename_category);
    registry.action::<InboxRemoveCategory>(remove_category);
}

/// The value of the record `Inbox`.
fn read(shared: &Shared, args: RepositoryArgs) -> Result<Inbox, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    views::sent(&api::read_inbox(&repository.path)?)
}

/// The action `inbox.add`: a note at the end of its category.
fn add(call: &Call, input: InboxAdd) -> Result<ListWritten, Fault> {
    let InboxAdd {
        text,
        category,
        about,
        hash,
        ..
    } = &input;
    let write = |repo: &_| api::add_note(repo, category.clone(), about.clone(), text, hash);
    lists::written(call, &input.repo, undo::INBOX, Box::new(write))
}

/// The action `inbox.edit`: a note's text. It is not undone here: the field's own undo is.
fn edit(call: &Call, input: InboxEdit) -> Result<ListWritten, Fault> {
    let write = |repo: &_| api::edit_note(repo, &input.note, &input.text, &input.hash);
    lists::plain(call, &input.repo, Write::saving(), Box::new(write))
}

/// The action `inbox.outline`: an edit of a note's line, or of one of its nested items.
fn outline(call: &Call, input: InboxOutline) -> Result<ListWritten, Fault> {
    let InboxOutline {
        note,
        at,
        kind,
        text,
        hash,
        ..
    } = &input;
    // A removal may take the note's file with it.
    let scope = match kind.as_str() {
        "remove" => undo::NOTES,
        _ => undo::INBOX,
    };
    let write = |repo: &_| api::outline_note(repo, note, *at, kind, text.as_deref(), hash);
    lists::written(call, &input.repo, scope, Box::new(write))
}

/// The action `inbox.category`: a note to the end of a category.
fn categorize(call: &Call, input: InboxMoveCategory) -> Result<ListWritten, Fault> {
    let write = |repo: &_| {
        api::move_note_to_category(repo, &input.note, input.category.clone(), &input.hash)
    };
    lists::written(call, &input.repo, undo::INBOX, Box::new(write))
}

/// The action `inbox.place`: a note before the note at an index of a category.
fn place(call: &Call, input: InboxPlace) -> Result<ListWritten, Fault> {
    let InboxPlace {
        note,
        category,
        index,
        hash,
        ..
    } = &input;
    let write = |repo: &_| api::place_note(repo, note, category.clone(), *index, hash);
    lists::written(call, &input.repo, undo::INBOX, Box::new(write))
}

/// The action `inbox.drop`: what a drag's drop writes.
fn drop(call: &Call, input: InboxDrop) -> Result<ListWritten, Fault> {
    let to = DropAt {
        list: input.category.clone(),
        under: input.under.clone(),
        under_at: input.under_at,
        index: input.index,
    };
    let write = |repo: &_| api::drop_note(repo, &input.note, input.at, &to, &input.hash);
    lists::written(call, &input.repo, undo::INBOX, Box::new(write))
}

/// The action `inbox.remove`: a note, its nested lines and its note file with it.
fn remove(call: &Call, input: InboxRemove) -> Result<ListWritten, Fault> {
    let write = |repo: &_| api::remove_note(repo, &input.note, &input.hash);
    lists::written(call, &input.repo, undo::NOTES, Box::new(write))
}

/// The action `inbox.addCategory`: a category at the end of the inbox.
fn add_category(call: &Call, input: InboxAddCategory) -> Result<ListWritten, Fault> {
    let write = |repo: &_| api::add_category(repo, &input.name, &input.hash);
    lists::written(call, &input.repo, undo::INBOX, Box::new(write))
}

/// The action `inbox.renameCategory`: every heading of a category's name.
fn rename_category(call: &Call, input: InboxRenameCategory) -> Result<ListWritten, Fault> {
    let write = |repo: &_| api::rename_category(repo, &input.from, &input.to, &input.hash);
    lists::written(call, &input.repo, undo::INBOX, Box::new(write))
}

/// The action `inbox.removeCategory`: a category, with its notes or without.
fn remove_category(call: &Call, input: InboxRemoveCategory) -> Result<ListWritten, Fault> {
    let write = |repo: &_| api::remove_category(repo, &input.name, input.keep_notes, &input.hash);
    lists::written(call, &input.repo, undo::NOTES, Box::new(write))
}
