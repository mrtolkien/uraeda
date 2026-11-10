//! Starting a feature or a change: from a proposal file, a typed text, or a note of the inbox.
//! Each start runs in its repository's turn, and answers once it landed.

mod note;

use std::path::Path;

use uraeda_core::actions::start::StartProgress;
use uraeda_core::api::{self, ApiError, TextStart};
use uraeda_core::view::{PlannedView, StartedView};
use uraeda_core::workspace::Kind;
use uraeda_protocol::RunOptions;
use uraeda_protocol::{
    ChangeFromNote, ChangeStart, ChangeStartProposal, ChangeStarted, ChatImage, FeatureStart,
    FeatureStartText, StartKind, StartPlan,
};

use super::messages::{Subject, run_message};
use super::{messages, options};
use crate::live::{Call, Fault, Registry};
use crate::records::repositories;
use crate::records::writing::{Write, write};

/// Registers the actions that start a feature or a change.
pub(super) fn register(registry: &Registry) {
    registry.action::<FeatureStart>(proposal);
    registry.action::<FeatureStartText>(typed_feature);
    registry.action::<ChangeStart>(typed_change);
    registry.action::<ChangeStartProposal>(proposal_as_change);
    registry.action::<ChangeFromNote>(from_note);
}

/// A start's steps, as the core reaches them.
// JOIN(wave 6): write queue. The queue shows a start's steps in its write, and answers a
// planned start before it lands: here a start answers once it landed, and its steps go nowhere.
fn steps(_: StartProgress) {}

/// Runs a start of the repository listed as `repo` in its turn, after the lists' queued commits:
/// it commits the proposal within its call.
fn landed(
    call: &Call,
    repo: &str,
    start: impl FnOnce() -> Result<StartedView, ApiError>,
) -> Result<StartedView, Fault> {
    // JOIN(wave 6): write queue
    write(call.shared(), repo, Write::of_lists(), |_| Ok(start()?))
}

/// The workflow's message of a planned start's first step: a committed proposal and nothing
/// else is the core's `discovery` step for a feature, and its `change` step for a change.
fn first_message(planned: &PlannedView, kind: Kind) -> String {
    let (word, step, folder) = match kind {
        Kind::Feature => ("feature", "discovery", format!("specs/{}", planned.folder)),
        Kind::Change => (
            "change",
            "change",
            format!("specs/changes/{}", planned.folder),
        ),
    };
    run_message(&messages::Run {
        branch: &planned.branch,
        subject: Subject {
            kind: word,
            path: &folder,
        },
        reference: &format!("skills/uraeda/references/{step}.md"),
        step,
        comments: false,
        plan_review: None,
        catch_up: None,
    })
}

/// What a planned start answers.
fn plan_of(planned: PlannedView, kind: Kind) -> StartPlan {
    StartPlan {
        message: first_message(&planned, kind),
        folder: planned.folder,
        title: planned.title,
    }
}

/// The bytes of a typed start's images.
// JOIN(wave 6): chat images (task 16). The uploads keep an image's bytes in the data folder, by
// its id: until they are joined, a start with images is refused, and one without starts.
fn image_bytes(images: Option<&[ChatImage]>) -> Result<Vec<Vec<u8>>, Fault> {
    match images.unwrap_or_default() {
        [] => Ok(Vec::new()),
        _ => Err(Fault::refused(
            "A start cannot take images yet: start it without them, and attach them after.",
        )),
    }
}

/// The action `feature.start`: starts a proposal file as a feature, or as a change, as the core
/// planned it.
fn proposal(call: &Call, input: FeatureStart) -> Result<StartPlan, Fault> {
    let repository = repositories::find(call.shared(), &input.repo)?;
    let root = &repository.path;
    let kind = match input.kind {
        Some(StartKind::Change) => Kind::Change,
        _ => Kind::Feature,
    };
    let planned = api::plan_start(root, &input.proposal, input.slug.as_deref(), kind)?;
    // TASK 15: `feature.start` keeps the messages sent to the planned folder while its start
    // lands, and sends them to its session once it landed.
    landed(call, &input.repo, || {
        let (slug, day) = (Some(planned.slug.as_str()), planned.day.as_str());
        api::start_planned(root, &input.proposal, slug, kind, day, &steps)
    })?;
    Ok(plan_of(planned, kind))
}

/// The action `feature.startText`: starts a feature typed as a text, its own run options kept
/// for the folder its plan gives, and dropped again when the start is refused.
fn typed_feature(call: &Call, input: FeatureStartText) -> Result<StartPlan, Fault> {
    let repository = repositories::find(call.shared(), &input.repo)?;
    let root = &repository.path;
    let images = image_bytes(input.images.as_deref())?;
    let typed = TextStart {
        text: &input.text,
        images: &images,
        line: input.line.as_deref(),
        kind: Kind::Feature,
        discovery: input.discovery.as_deref(),
    };
    let planned = api::plan_text_start(root, &typed, Some(&input.slug))?;
    let store = call.shared().get::<options::Store>();
    // Kept before the start, so a session made for it runs on its first step's pick.
    if let Some(options) = input.options {
        store.set(root, &planned.folder, options)?;
    }
    // TASK 15: `feature.startText` keeps the messages sent to the planned folder while its
    // start lands, and sends them to its session once it landed.
    let started = landed(call, &input.repo, || {
        api::start_text(root, &typed, Some(&input.slug), Some(&planned.day), &steps)
    });
    if let Err(refusal) = started {
        forget(&store, root, &planned.folder);
        return Err(refusal);
    }
    Ok(plan_of(planned, Kind::Feature))
}

/// Drops the run options kept for a start that was refused.
fn forget(store: &options::Store, root: &Path, folder: &str) {
    if let Err(fault) = store.set(root, folder, RunOptions::default()) {
        let why = fault.message();
        eprintln!("uraeda: the run options of {folder}, whose start was refused, stay: {why}");
    }
}

/// A change started: its own run options kept, and its first run sent.
fn change_started(
    call: &Call,
    root: &Path,
    started: StartedView,
    options: Option<RunOptions>,
) -> ChangeStarted {
    // Once the change exists, options that cannot be kept are printed, not refused.
    let store = call.shared().get::<options::Store>();
    if let Some(options) = options
        && let Err(fault) = store.set(root, &started.folder, options)
    {
        let (folder, why) = (&started.folder, fault.message());
        eprintln!("uraeda: {folder} started, but its run options were not kept: {why}");
    }
    // TASK 15: `change.start`, `change.startProposal`, and `change.fromNote` send the started
    // change's first run to a session made for it, on its build step's pick, and answer that
    // session: none when no run was sent. Run options whose build step no new session could
    // run on are refused before the start.
    ChangeStarted {
        folder: started.folder,
        session: None,
    }
}

/// The action `change.start`: starts a change typed as a text.
fn typed_change(call: &Call, input: ChangeStart) -> Result<ChangeStarted, Fault> {
    let repository = repositories::find(call.shared(), &input.repo)?;
    let root = &repository.path;
    // Options the store would refuse are refused before the change starts.
    if let Some(options) = &input.options {
        options::check(options.clone())?;
    }
    let images = image_bytes(input.images.as_deref())?;
    let typed = TextStart {
        text: &input.text,
        images: &images,
        line: input.line.as_deref(),
        kind: Kind::Change,
        discovery: None,
    };
    let started = landed(call, &input.repo, || {
        api::start_text(root, &typed, input.slug.as_deref(), None, &steps)
    })?;
    Ok(change_started(call, root, started, input.options))
}

/// The action `change.startProposal`: starts a proposal file as a change.
fn proposal_as_change(call: &Call, input: ChangeStartProposal) -> Result<ChangeStarted, Fault> {
    let repository = repositories::find(call.shared(), &input.repo)?;
    let root = &repository.path;
    let started = landed(call, &input.repo, || {
        let slug = input.slug.as_deref();
        api::start_feature(root, &input.proposal, slug, Kind::Change, &steps)
    })?;
    Ok(change_started(call, root, started, None))
}

/// The action `change.fromNote`: starts a change from a note of the inbox, as from a typed text
/// with the note file's images, then takes the note out of the inbox, committing `INBOX.md`
/// alone when it had no other change. A refused start leaves the note in the inbox; a note that
/// cannot leave it once the change started is printed, and stays.
fn from_note(call: &Call, input: ChangeFromNote) -> Result<ChangeStarted, Fault> {
    let repository = repositories::find(call.shared(), &input.repo)?;
    let root = &repository.path;
    let note = note::as_change(root, &input.note, &input.hash)?;
    let typed = TextStart {
        text: &note.text,
        images: &note.images,
        line: None,
        kind: Kind::Change,
        discovery: None,
    };
    let started = landed(call, &input.repo, || {
        api::start_text(root, &typed, input.slug.as_deref(), None, &steps)
    })?;
    let removed = write(call.shared(), &input.repo, Write::of_lists(), |root| {
        Ok(api::remove_note_and_commit(root, &input.note, &input.hash)?)
    });
    if let Err(fault) = removed {
        let (folder, why) = (&started.folder, fault.message());
        eprintln!("uraeda: {folder} started, but its note stayed in the inbox: {why}");
    }
    Ok(change_started(call, root, started, None))
}
