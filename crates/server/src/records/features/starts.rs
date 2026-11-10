//! Starting a feature or a change: from a proposal file, a typed text, or a note of the inbox.
//! Each start is a write of the queue, with its steps. A feature's answers once planned, and
//! its write shows it land, or its refusal; a change's answers once it landed.

mod note;
mod queued;
mod steps;

use std::path::Path;
use std::sync::Arc;

use uraeda_core::api::{self, TextStart};
use uraeda_core::view::{PlannedView, StartedView};
use uraeda_core::workspace::Kind;
use uraeda_protocol::{
    ChangeFromNote, ChangeStart, ChangeStartProposal, ChangeStarted, ChatImage, FeatureStart,
    FeatureStartText, RunOptions, StartKind, StartPlan, WriteName,
};

pub(super) use self::queued::Starts;
use self::queued::{Run, Start};

use super::messages::{Subject, run_message};
use super::{messages, options};
use crate::live::{Call, Fault, Registry, locked};
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

/// The page a refused start of a typed feature opens: the New page, whose composer still holds
/// the text. A proposal file's has none.
const NEW_FEATURE: &str = "/new?kind=feature";

/// A start the core planned, to queue: its kind, the client's name for it, the page its refusal
/// opens, and its own run options, kept for its folder once planned.
struct Plannable {
    kind: Kind,
    name: Option<WriteName>,
    href: &'static str,
    options: Option<RunOptions>,
}

/// Plans a start and queues it, one plan at a time for a repository, so a folder or a slug a
/// start still in the queue planned is taken. It answers once queued, with the plan: a refusal
/// of the start stays in the queue's record.
// TASK 15: the messages sent to the planned folder while its start lands are kept, shown in its
// write, and sent to its session once it landed.
fn planned(
    call: &Call,
    repo: &str,
    start: Plannable,
    plan: impl FnOnce(&Path) -> Result<PlannedView, Fault>,
    run: impl FnOnce(&PlannedView) -> Box<dyn Run>,
) -> Result<StartPlan, Fault> {
    let shared = call.shared();
    let root = repositories::path(shared, repo)?;
    let starts = shared.get::<Starts>();
    let turn = starts.plan_turn(&root);
    let _turn = locked(&turn);
    let planned = plan(&root)?;
    starts.free(&root, &planned, start.kind)?;
    // Kept before the start, so a session made for it runs on its first step's pick, and
    // dropped again when the start is refused.
    let store = shared.get::<options::Store>();
    let kept = start.options.is_some();
    if let Some(options) = start.options {
        store.set(&root, &planned.folder, options)?;
    }
    let word = match start.kind {
        Kind::Feature => "feature",
        Kind::Change => "change",
    };
    let queued = Start {
        name: start.name,
        label: format!("Starting the {word} {}", planned.title),
        href: start.href,
        folder: Some(planned.folder.clone()),
        branch: Some(planned.branch.clone()),
        slug: Some(planned.slug.clone()),
    };
    let (run, folder) = (run(&planned), planned.folder.clone());
    let refused = move |root: &Path| {
        if kept {
            forget(&store, root, &folder);
        }
    };
    let queued = queued::queue(shared, repo, queued, move |root, on_step| {
        run(root, on_step).inspect_err(|_| refused(root))
    });
    queued?;
    Ok(plan_of(planned, start.kind))
}

/// The action `feature.start`: starts a proposal file as a feature, or as a change, as the core
/// planned it.
fn proposal(call: &Call, input: FeatureStart) -> Result<StartPlan, Fault> {
    let kind = match input.kind {
        Some(StartKind::Change) => Kind::Change,
        _ => Kind::Feature,
    };
    let start = Plannable {
        kind,
        name: input.write,
        href: "",
        options: None,
    };
    let (proposal, slug) = (input.proposal, input.slug);
    let plan = |root: &Path| Ok(api::plan_start(root, &proposal, slug.as_deref(), kind)?);
    let planned = |planned: &PlannedView| -> Box<dyn Run> {
        let (proposal, slug, day) = (proposal.clone(), planned.slug.clone(), planned.day.clone());
        Box::new(move |root, on_step| {
            api::start_planned(root, &proposal, Some(&slug), kind, &day, on_step)
        })
    };
    self::planned(call, &input.repo, start, plan, planned)
}

/// A typed start's text, images, line of **Now**, and effort, owned: what its landing reads.
struct Typed {
    text: String,
    images: Vec<Vec<u8>>,
    line: Option<String>,
    kind: Kind,
    discovery: Option<String>,
}

impl Typed {
    /// The start as the core takes it.
    fn start(&self) -> TextStart<'_> {
        TextStart {
            text: &self.text,
            images: &self.images,
            line: self.line.as_deref(),
            kind: self.kind,
            discovery: self.discovery.as_deref(),
        }
    }
}

/// The action `feature.startText`: starts a feature typed as a text, its own run options kept
/// for the folder its plan gives, and dropped again when the start is refused.
fn typed_feature(call: &Call, input: FeatureStartText) -> Result<StartPlan, Fault> {
    let typed = Arc::new(Typed {
        text: input.text,
        images: image_bytes(input.images.as_deref())?,
        line: input.line,
        kind: Kind::Feature,
        discovery: input.discovery,
    });
    let start = Plannable {
        kind: Kind::Feature,
        name: input.write,
        href: NEW_FEATURE,
        options: input.options,
    };
    let slug = input.slug;
    let plan = |root: &Path| Ok(api::plan_text_start(root, &typed.start(), Some(&slug))?);
    let planned = |planned: &PlannedView| -> Box<dyn Run> {
        let (typed, slug, day) = (typed.clone(), planned.slug.clone(), planned.day.clone());
        Box::new(move |root, on_step| {
            api::start_text(root, &typed.start(), Some(&slug), Some(&day), on_step)
        })
    };
    self::planned(call, &input.repo, start, plan, planned)
}

/// Drops the run options kept for a start that was refused.
fn forget(store: &options::Store, root: &Path, folder: &str) {
    if let Err(fault) = store.set(root, folder, RunOptions::default()) {
        let why = fault.message();
        eprintln!("uraeda: the run options of {folder}, whose start was refused, stay: {why}");
    }
}

/// Queues a change's start, which answers once it landed: a refusal is its call's alone, and
/// leaves the queue's record. Its slug, when named, is taken while it is in the queue.
fn landed(
    call: &Call,
    repo: &str,
    slug: Option<String>,
    run: impl Run,
) -> Result<StartedView, Fault> {
    let start = Start {
        name: None,
        label: "Starting a change".to_owned(),
        href: "",
        folder: None,
        branch: None,
        slug,
    };
    queued::queue(call.shared(), repo, start, run)?.answered()
}

/// A change started: its own run options kept, and its first run sent.
fn change_started(
    call: &Call,
    repo: &str,
    started: StartedView,
    options: Option<RunOptions>,
) -> Result<ChangeStarted, Fault> {
    // Once the change exists, options that cannot be kept are printed, not refused.
    let root = repositories::path(call.shared(), repo)?;
    let store = call.shared().get::<options::Store>();
    if let Some(options) = options
        && let Err(fault) = store.set(&root, &started.folder, options)
    {
        let (folder, why) = (&started.folder, fault.message());
        eprintln!("uraeda: {folder} started, but its run options were not kept: {why}");
    }
    // TASK 15: `change.start`, `change.startProposal`, and `change.fromNote` send the started
    // change's first run to a session made for it, on its build step's pick, and answer that
    // session: none when no run was sent. Run options whose build step no new session could
    // run on are refused before the start.
    Ok(ChangeStarted {
        folder: started.folder,
        session: None,
    })
}

/// The action `change.start`: starts a change typed as a text.
fn typed_change(call: &Call, input: ChangeStart) -> Result<ChangeStarted, Fault> {
    // Options the store would refuse are refused before the change starts.
    if let Some(options) = &input.options {
        options::check(options.clone())?;
    }
    let typed = Typed {
        text: input.text,
        images: image_bytes(input.images.as_deref())?,
        line: input.line,
        kind: Kind::Change,
        discovery: None,
    };
    let slug = input.slug.clone();
    let started = landed(call, &input.repo, input.slug, move |root, on_step| {
        api::start_text(root, &typed.start(), slug.as_deref(), None, on_step)
    })?;
    change_started(call, &input.repo, started, input.options)
}

/// The action `change.startProposal`: starts a proposal file as a change.
fn proposal_as_change(call: &Call, input: ChangeStartProposal) -> Result<ChangeStarted, Fault> {
    let (proposal, slug) = (input.proposal, input.slug.clone());
    let started = landed(call, &input.repo, input.slug, move |root, on_step| {
        api::start_feature(root, &proposal, slug.as_deref(), Kind::Change, on_step)
    })?;
    change_started(call, &input.repo, started, None)
}

/// The action `change.fromNote`: starts a change from a note of the inbox, as from a typed text
/// with the note file's images, then takes the note out of the inbox, committing `INBOX.md`
/// alone when it had no other change. A refused start leaves the note in the inbox; a note that
/// cannot leave it once the change started is printed, and stays.
fn from_note(call: &Call, input: ChangeFromNote) -> Result<ChangeStarted, Fault> {
    let root = repositories::path(call.shared(), &input.repo)?;
    let note = note::as_change(&root, &input.note, &input.hash)?;
    let typed = Typed {
        text: note.text,
        images: note.images,
        line: None,
        kind: Kind::Change,
        discovery: None,
    };
    let slug = input.slug.clone();
    let started = landed(call, &input.repo, input.slug, move |root, on_step| {
        api::start_text(root, &typed.start(), slug.as_deref(), None, on_step)
    })?;
    let removed = write(call.shared(), &input.repo, Write::of_lists(), |root| {
        Ok(api::remove_note_and_commit(root, &input.note, &input.hash)?)
    });
    if let Err(fault) = removed {
        let (folder, why) = (&started.folder, fault.message());
        eprintln!("uraeda: {folder} started, but its note stayed in the inbox: {why}");
    }
    change_started(call, &input.repo, started, None)
}
