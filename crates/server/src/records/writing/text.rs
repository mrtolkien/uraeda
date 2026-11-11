//! A text: a proposal file, a note file, or a feature's proposal, saved as typed over the
//! version read, and committed when the human asks.

use uraeda_core::api;
use uraeda_protocol::{Saved, TextCommit, TextDiscovery, TextSave};

use super::{Write, write};
use crate::live::Registry;

/// Registers the actions `text.save`, `text.discovery`, and `text.commit`.
pub(super) fn register(registry: &Registry) {
    registry.action::<TextSave>(|call, input| {
        write(
            call.shared(),
            &input.repo,
            Write::saving().on_path(&input.path),
            |repo| {
                let hash = api::save_text(repo, &input.path, &input.text, &input.hash)?;
                Ok(Saved { hash })
            },
        )
    });
    registry.action::<TextDiscovery>(|call, input| {
        write(
            call.shared(),
            &input.repo,
            Write::saving().on_path(&input.path),
            |repo| {
                let set = api::set_discovery(repo, &input.path, &input.level, &input.hash)?;
                Ok(Saved { hash: set.hash })
            },
        )
    });
    registry.action::<TextCommit>(|call, input| {
        // A proposal file's commit takes the priorities and the inbox along when they changed.
        let commit = Write::of_lists()
            .file(&input.path)
            .named(input.write)
            .on_path(&input.path);
        write(call.shared(), &input.repo, commit, |repo| {
            api::commit_text(repo, &input.path)?;
            Ok(())
        })
    });
}
