//! A repository's workspace, as the core reads it, each feature with its name in the sidebar and
//! its status. And the slug the core proposes for a typed start.

use uraeda_core::api;
use uraeda_core::files::proposal::discovery_levels;
use uraeda_core::view::{FeatureView, WorkspaceView};
use uraeda_protocol::{SlugProposal, Workspace, WorkspaceArgs, WorkspaceFeature};

use super::repositories::{self, Repository};
use super::{status, views};
use crate::live::{Fault, Registry};
use crate::shared::Shared;

/// Registers the records `Workspace` and `SlugProposal`.
pub(super) fn register(registry: &Registry) {
    registry.record::<Workspace>(workspace);
    registry.record::<SlugProposal>(|_, args| {
        Ok(SlugProposal {
            slug: api::propose_slug(&args.text),
            discovery_levels: discovery_levels().iter().map(ToString::to_string).collect(),
        })
    });
}

/// The value of the record `Workspace`, of the repository its arguments name.
fn workspace(shared: &Shared, args: WorkspaceArgs) -> Result<Workspace, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    let WorkspaceView {
        root,
        default_branch,
        current_branch,
        features,
        priorities,
        priorities_hash,
        proposals,
        no_specs,
        setup,
    } = api::read_workspace(&repository.path)?;
    let features = features.iter().map(|view| feature(&repository, view));
    Ok(Workspace {
        root,
        default_branch,
        current_branch,
        features: features.collect::<Result<_, _>>()?,
        priorities: views::sent(&priorities)?,
        priorities_hash,
        proposals,
        no_specs,
        setup: views::sent(&setup)?,
        // A decision that cannot be read is no preview.
        preview: api::preview(&repository.path).is_ok_and(|preview| preview.is_some()),
    })
}

/// A feature of a workspace: the core's view, its name in the list's entry, and its status.
fn feature(repository: &Repository, view: &FeatureView) -> Result<WorkspaceFeature, Fault> {
    Ok(WorkspaceFeature {
        id: view.folder.clone(),
        label: repositories::label(repository, &view.folder),
        status: status::of(view),
        feature: views::sent(view)?,
    })
}
