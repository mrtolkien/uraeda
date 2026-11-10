//! A feature or a change: what the core reads of it, its name in the sidebar, its status, and
//! its run options. And the actions on one that start no run: its name, its run options, its
//! record's links, its drop, and a change made a feature.

use uraeda_core::api;
use uraeda_core::view::FeatureView;
use uraeda_protocol::{
    Dropped, Feature, FeatureDrop, FeatureFixLinks, FeaturePromote, FeatureSetRunOptions, ItemArgs,
    ItemSettings, PromotedView,
};

use super::{changed, options, turn, views};
use crate::live::{Call, Fault, Registry};
use crate::records::repositories::{self, Repository};
use crate::records::workspace::status;
use crate::shared::Shared;

/// Registers the record `Feature`, and the actions on a feature that start no run.
pub(super) fn register(registry: &Registry) {
    registry.record::<Feature>(read);
    registry.action::<ItemSettings>(name);
    registry.action::<FeatureSetRunOptions>(set_run_options);
    registry.action::<FeatureFixLinks>(fix_links);
    registry.action::<FeatureDrop>(drop);
    registry.action::<FeaturePromote>(promote);
}

/// The value of the record `Feature`: none for a folder that is no feature's.
fn read(shared: &Shared, args: ItemArgs) -> Result<Option<Feature>, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    let view = views::found(api::read_feature(&repository.path, &args.id))?;
    view.map(|view| record(shared, &repository, &view))
        .transpose()
}

/// A feature's record: the core's view, with what the server knows of it.
fn record(shared: &Shared, repository: &Repository, view: &FeatureView) -> Result<Feature, Fault> {
    let label = repository.items.get(&view.folder);
    // A feature without a worktree follows the main checkout's decision.
    let checkout = repository
        .path
        .join(view.worktree.as_deref().unwrap_or("."));
    Ok(Feature {
        label: label.and_then(|item| item.label.clone()),
        status: status::of(view),
        // A decision that cannot be read is no preview.
        preview: api::preview(&checkout).is_ok_and(|preview| preview.is_some()),
        run_options: options::pair(shared, &repository.path, &view.folder),
        // TASK 15: a feature's sessions. Its latest session and that session's runtime, its
        // sessions' ids, and what a new session runs on, come from the session store. So do the
        // fields `agent` and `tokens`, its sessions' time and tokens, which the record lacks.
        session: None,
        sessions: Vec::new(),
        runtime: None,
        new_pick: None,
        feature: views::sent(view)?,
    })
}

/// The action `item.settings`: the name a feature or a change shows in the sidebar, kept in the
/// list's entry of its repository.
fn name(call: &Call, input: ItemSettings) -> Result<(), Fault> {
    let shared = call.shared();
    api::set_item_settings(shared.data_dir(), &input.repo, &input.folder, input.label)?;
    // The list holds the name: read again, it tells the workspace, whose features carry theirs.
    repositories::reload(shared);
    changed::feature(call.bus(), &input.repo, &input.folder);
    Ok(())
}

/// The action `feature.setRunOptions`: keeps a feature's own run options, which apply from its
/// next run.
fn set_run_options(call: &Call, input: FeatureSetRunOptions) -> Result<(), Fault> {
    let shared = call.shared();
    let repository = repositories::find(shared, &input.repo)?;
    // A folder that is no change's or feature's keeps no options.
    api::read_feature(&repository.path, &input.folder)?;
    let store = shared.get::<options::Store>();
    store.set(&repository.path, &input.folder, input.options)?;
    changed::feature(call.bus(), &input.repo, &input.folder);
    Ok(())
}

/// The action `feature.fixLinks`: repairs a done feature's moved links, without committing.
fn fix_links(call: &Call, input: FeatureFixLinks) -> Result<(), Fault> {
    let repository = repositories::find(call.shared(), &input.repo)?;
    // It commits nothing, but writes the default branch's files: in the repository's turn, so a
    // commit never takes the record half written.
    // JOIN(wave 6): write queue
    turn::in_turn(call.shared(), &repository.path, || {
        Ok(api::fix_links(&repository.path, &input.folder)?)
    })?;
    changed::life(call.bus(), &input.repo, &input.folder);
    Ok(())
}

/// The action `feature.drop`: its proposal leaves the priorities, its worktree goes unless that
/// would lose work, and its branch stays.
fn drop(call: &Call, input: FeatureDrop) -> Result<Dropped, Fault> {
    let repository = repositories::find(call.shared(), &input.repo)?;
    // TASK 15: `feature.drop` holds the feature's sessions while it lands, refused while an
    // agent works on it, and archives them once it landed.
    // JOIN(wave 6): write queue
    let dropped = turn::in_turn(call.shared(), &repository.path, || {
        Ok(api::drop_item(&repository.path, &input.folder)?)
    })?;
    changed::life(call.bus(), &input.repo, &input.folder);
    Ok(Dropped {
        branch: dropped.branch,
        worktree_left: dropped.worktree_left,
        committed: dropped.committed,
    })
}

/// The action `feature.promote`: makes a change a feature, in place.
fn promote(call: &Call, input: FeaturePromote) -> Result<PromotedView, Fault> {
    let repository = repositories::find(call.shared(), &input.repo)?;
    // TASK 15: `feature.promote` moves the change's sessions to the feature, refused while an
    // agent works on it, then sends the feature's first run.
    // JOIN(wave 6): write queue
    let promoted = turn::in_turn(call.shared(), &repository.path, || {
        Ok(api::promote_change(&repository.path, &input.folder)?)
    })?;
    changed::life(call.bus(), &input.repo, &input.folder);
    changed::life(call.bus(), &input.repo, &promoted.folder);
    views::sent(&promoted)
}
