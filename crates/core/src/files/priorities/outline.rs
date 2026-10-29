//! The outline of a proposal of `PRIORITIES.md`: the proposal, and the items nested under it at any
//! depth (see [`nested`](super::super::nested)). A proposal indents under the proposal above it in
//! its section, and a proposal's own item outdented becomes the proposal after it.

use super::super::nested::{self, OutlineEdit};
use super::{Proposal, Section, parse, proposal_id};

/// Applies `edit` to the proposal `id`, or with `at`, to the item at `at` of its outline, from 0 in
/// the order of the file. `None` when there is no such proposal or item, or nowhere to go: the
/// first sibling indented, a proposal outdented, the first sibling moved up, the last moved down.
pub fn outline(text: &str, id: &str, at: Option<usize>, edit: &OutlineEdit) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let proposals = parse(text);
        let index = proposals
            .iter()
            .position(|proposal| proposal_id(proposal) == id)
            .ok_or(())?;
        match at {
            None => on_proposal(text, &proposals, index, edit),
            Some(at) => nested::on_nested(text, &proposals[index].item, at, edit),
        }
        .ok_or(())
    })
    .ok()
}

/// Where a dropped item goes: a proposal at `index` of a section, or an item nested under the
/// proposal `proposal`, or with `at` under its nested item at `at`, at `index` among the items
/// there. `index` counts them once the dropped item left them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Drop {
    Proposal {
        section: Section,
        index: usize,
    },
    Under {
        proposal: String,
        at: Option<usize>,
        index: usize,
    },
}

/// Moves the proposal `id`, or with `at` its nested item at `at`, its own items with it, to `to`:
/// what a drag writes. `None` when a proposal or item is missing, it would go under itself, or
/// nested lines cannot be written again.
pub fn drop_item(text: &str, id: &str, at: Option<usize>, to: &Drop) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let proposals = parse(text);
        let position = |id: &str| {
            proposals
                .iter()
                .position(|proposal| proposal_id(proposal) == id)
        };
        let from = position(id).ok_or(())?;
        match (to, at) {
            (Drop::Proposal { section, index }, None) => {
                super::move_proposal(text, id, *section, *index)
            }
            (Drop::Proposal { section, index }, Some(at)) => {
                let (without, lines) = nested::take(text, &proposals[from].item, at).ok_or(())?;
                super::insert_proposal(&without, *section, *index, &lines)
            }
            (
                Drop::Under {
                    proposal,
                    at: to_at,
                    index,
                },
                at,
            ) => {
                let to = position(proposal).ok_or(())?;
                let items: Vec<_> = proposals
                    .iter()
                    .map(|proposal| proposal.item.clone())
                    .collect();
                nested::move_under(text, &items, (from, at), (to, *to_at), *index)
            }
        }
        .ok_or(())
    })
    .ok()
}

/// Adds `written`, an item of another list as its lines, its nested items with it, as the last item
/// nested under the proposal `id`. `None` when there is no such proposal, or nested lines cannot be
/// written again.
pub fn append_under(text: &str, id: &str, written: &[String]) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let proposal = parse(text)
            .into_iter()
            .find(|proposal| proposal_id(proposal) == id)
            .ok_or(())?;
        nested::append_item(text, &proposal.item, written).ok_or(())
    })
    .ok()
}

/// Takes back [`append_under`]: the proposal whose key is `key`, found by it as other edits may
/// have moved it, without the last of its own items that says what `written` says. `None` when
/// there is none.
pub fn remove_under(text: &str, key: &str, written: &[String]) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let proposals = parse(text);
        let at = super::keys(&proposals)
            .iter()
            .position(|one| one == key)
            .ok_or(())?;
        nested::remove_item(text, &proposals[at].item, written).ok_or(())
    })
    .ok()
}

/// An edit of a proposal itself.
fn on_proposal(
    text: &str,
    proposals: &[Proposal],
    index: usize,
    edit: &OutlineEdit,
) -> Option<String> {
    let proposal = &proposals[index];
    let id = proposal_id(proposal);
    match edit {
        OutlineEdit::Edit(line) => super::edit(text, &id, line),
        OutlineEdit::Remove => super::remove(text, &id),
        OutlineEdit::Insert { line, below } => {
            let place = proposals
                .iter()
                .filter(|other| other.section == proposal.section)
                .position(|other| other.line == proposal.line)?;
            let marker = nested::marker_beside(&proposal.item.marker).render();
            super::insert_proposal(
                text,
                proposal.section,
                place + usize::from(*below),
                &[format!("{marker} {line}")],
            )
        }
        OutlineEdit::Append(line) => nested::append_child(text, &proposal.item, line),
        // It becomes the last item of the proposal above it, in its section.
        OutlineEdit::Indent => {
            let above = proposals[..index]
                .iter()
                .rfind(|other| other.section == proposal.section)?;
            nested::indent_under(text, &above.item, &proposal.item)
        }
        OutlineEdit::Outdent | OutlineEdit::Up | OutlineEdit::Down => None,
    }
}
