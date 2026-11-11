//! A feature or a change: what the core reads of it, its name in the sidebar, its status, and
//! its run options. And the actions on one that start no run: its name, its run options, its
//! record's links, its drop, and a change made a feature.

use uraeda_core::api;
use uraeda_core::view::FeatureView;
use uraeda_protocol::{
    Dropped, Feature, FeatureDrop, FeatureFixLinks, FeaturePromote, FeatureSetRunOptions, ItemArgs,
    ItemSettings, PromotedView, Trigger,
};

use super::{changed, options, views};
use crate::live::{Call, Fault, Registry};
use crate::records::repositories::{self, Repository};
use crate::records::sessions::feature::sessions_of;
use crate::records::sessions::runs::{self, First};
use crate::records::workspace::status;
use crate::records::writing::{self, Write, land, write};
use crate::runner::{Runner, Target};
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
    let sessions = sessions_of(shared, &repository.path.to_string_lossy(), view);
    Ok(Feature {
        label: label.and_then(|item| item.label.clone()),
        status: status::of(shared, &repository.path, view),
        // A decision that cannot be read is no preview.
        preview: api::preview(&checkout).is_ok_and(|preview| preview.is_some()),
        run_options: options::pair(shared, &repository.path, &view.folder),
        session: sessions.session,
        sessions: sessions.sessions,
        runtime: sessions.runtime,
        new_pick: sessions.new_pick,
        agent: sessions.agent,
        tokens: sessions.tokens,
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
    // It commits nothing, but writes the default branch's files: after their queued commits and
    // the feature's, so a commit never takes the record half written.
    let fix = Write::of_lists().and_feature(&input.folder);
    write(call.shared(), &input.repo, fix, |root| {
        Ok(api::fix_links(root, &input.folder)?)
    })?;
    Ok(())
}

/// The action `feature.drop`: its proposal leaves the priorities, its worktree goes unless that
/// would lose work, and its branch stays.
fn drop(call: &Call, input: FeatureDrop) -> Result<Dropped, Fault> {
    let shared = call.shared();
    // Held until its commit landed or was refused: refused while an agent works on it, and its
    // sessions take no message meanwhile.
    let runner = Runner::find(shared);
    let root = repositories::path(shared, &input.repo)?
        .to_string_lossy()
        .into_owned();
    let held = runner
        .as_ref()
        .map(|runner| runner.hold(&root, Target::Folder(&input.folder)))
        .transpose()?;
    // A drop takes the proposal's line out of the priorities too.
    let drop = Write::of_lists()
        .and_feature(&input.folder)
        .named(input.write);
    let dropped = write(shared, &input.repo, drop, |root| {
        Ok(api::drop_item(root, &input.folder)?)
    })?;
    // Its sessions are archived once its commit landed: a refused drop's comes back with them.
    if let Some(runner) = runner {
        let (repo, folder) = (input.repo.clone(), input.folder.clone());
        runner.clone().spawn(move |_| {
            let _held = held;
            let landed = writing::settled(&runner.shared, &repo, &folder);
            let archived = landed.and_then(|()| runner.archive_folder(&root, &folder));
            if let Err(fault) = archived {
                let why = fault.message();
                eprintln!("uraeda: {folder} dropped, but its sessions stay: {why}");
            }
        });
    }
    Ok(Dropped {
        branch: dropped.branch,
        worktree_left: dropped.worktree_left,
        committed: dropped.committed,
    })
}

/// The action `feature.promote`: makes a change a feature, in place.
fn promote(call: &Call, input: FeaturePromote) -> Result<PromotedView, Fault> {
    let shared = call.shared();
    // Held while it moves: refused while an agent works on it, and its sessions, which stay
    // the feature's, as its folder keeps its name, take no message meanwhile.
    let runner = Runner::find(shared);
    let root = repositories::path(shared, &input.repo)?
        .to_string_lossy()
        .into_owned();
    let held = runner
        .as_ref()
        .map(|runner| runner.hold(&root, Target::Folder(&input.folder)))
        .transpose()?;
    // Its commits, on the default branch and the change's, are made within its landing: they
    // never run while another commit lands, and the priorities' wait for them.
    let folder = input.folder;
    let promote = Write::of_lists()
        .and_feature(&folder)
        .named(input.write)
        .or_named(format!("Making the change {folder} a feature"), "");
    let promoting = land(shared, &input.repo, promote, move |root, _| {
        Ok(api::promote_change(root, &folder)?)
    })?;
    // A refusal is the call's alone: it leaves the queue's record.
    let promoted = promoting.answered()?;
    std::mem::drop(held);
    // The feature's first run: one that cannot be sent is printed, and its page offers it.
    let first = First::default();
    runs::sent_or_said(
        shared,
        &input.repo,
        &promoted.folder,
        Trigger::Manual,
        first,
    );
    views::sent(&promoted)
}
