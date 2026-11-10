//! A buffer: any Markdown file under `specs/`, read whole on the branch it is written on, and
//! saved there as typed, never committed.

use uraeda_core::api::{self, BufferView};
use uraeda_protocol::{Buffer, BufferSave, Saved};

use super::{Write, write};
use crate::live::Registry;
use crate::records::repositories;

/// Registers the record `Buffer` and the action `buffer.save`.
pub(super) fn register(registry: &Registry) {
    registry.record::<Buffer>(|shared, args| {
        let repo = repositories::path(shared, &args.repo)?;
        Ok(sent(api::read_buffer(&repo, &args.path)?))
    });
    registry.action::<BufferSave>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            let hash = api::save_buffer(repo, &input.path, &input.text, &input.hash)?;
            Ok(Saved { hash })
        })
    });
}

/// A buffer as the record gives it.
fn sent(view: BufferView) -> Buffer {
    Buffer {
        path: view.path,
        text: view.text,
        hash: view.hash,
        branch: view.branch,
    }
}
