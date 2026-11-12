//! Starting a feature or a change: from a proposal file, a typed text, or a note of the inbox.
//! Each start is a write of the queue, with its steps. A feature's answers once planned, and
//! its write shows it land, or its refusal; a change's answers once it landed.

mod note;
mod queued;
mod steps;

use std::path::Path;
use std::sync::Arc;

use uraeda_core::actions::start::StartProgress;
use uraeda_core::api::{self, TextStart};
use uraeda_core::view::{PlannedView, StartedView};
use uraeda_core::workspace::Kind;
use uraeda_protocol::{
    ChangeFromNote, ChangeStart, ChangeStartProposal, ChangeStarted, ChatImage, FeatureStart,
    FeatureStartText, RunOptions, SessionPick, StartKind, StartPlan, Trigger, WriteName,
};

pub(super) use self::queued::Starts;
use self::queued::{Landed, Run, Start, Then};

use super::messages::{Subject, run_message};
use super::{messages, options};
use crate::files::chat_images::ChatImages;
use crate::live::{Call, Fault, Registry, locked};
use crate::records::repositories;
use crate::records::sessions::runs::{self, First};
use crate::records::writing::{Write, write};
use crate::runner::{Runner, picks};
use crate::shared::Shared;

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

/// The bytes of a typed start's images, as their upload kept them in the data folder, each
/// once: an image whose file is gone refuses the start, before anything is written.
fn image_bytes(shared: &Shared, images: Option<&[ChatImage]>) -> Result<Vec<Vec<u8>>, Fault> {
    let store = ChatImages::of(shared);
    let mut read: Vec<&str> = Vec::new();
    let mut bytes = Vec::new();
    for image in images.unwrap_or_default() {
        if read.contains(&image.id.as_str()) {
            continue;
        }
        let gone = || Fault::refused("This image is gone: add it again.");
        bytes.push(store.read(&image.id).ok_or_else(gone)?);
        read.push(&image.id);
    }
    Ok(bytes)
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
/// of the start stays in the queue's record. The messages sent to the planned folder while its
/// start lands are kept, and sent to its session once it landed.
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
        options::keep(shared, &root, &planned.folder, options)?;
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
    // The messages sent to it meanwhile wait for it: a session made for them runs on the pick
    // of the step its start begins with.
    let runner = Runner::find(shared);
    let main = root.to_string_lossy().into_owned();
    let begins = match start.kind {
        Kind::Feature => "discovery",
        Kind::Change => "build",
    };
    if let Some(runner) = &runner {
        runner.open_start(&main, &folder, begins);
    }
    let dropping = (runner.clone(), main.clone(), folder.clone());
    let refused = move |root: &Path| {
        let (runner, main, folder) = &dropping;
        if let Some(runner) = runner {
            runner.drop_start(main, folder);
        }
        if kept {
            forget(&store, root, folder);
        }
    };
    let then = move |_: &StartedView| {
        if let Some(runner) = &runner {
            send_kept(runner, &main, &folder);
        }
        None
    };
    let running = move |root: &Path, on_step: &dyn Fn(StartProgress)| {
        run(root, on_step).inspect_err(|_| refused(root))
    };
    queued::queue(shared, repo, queued, running, then)?;
    Ok(plan_of(planned, start.kind))
}

/// Sends the messages kept for a started folder, in order, to the session they were kept for:
/// a run its step starts anew goes to a new session, which the next messages follow. One that
/// cannot be sent is printed, with the ones after it, as a started change's first run is not
/// refused.
fn send_kept(runner: &Runner, root: &str, folder: &str) {
    let Some((mut session, messages)) = runner.take_kept(root, folder) else {
        return;
    };
    // The start lands on the write queue's own thread: an agent's process starts where the
    // server's runtime is.
    let _runtime = runner.entered();
    for message in messages {
        let sent = runner.store().session(&session).map_err(Fault::from);
        let sent = sent.and_then(|row| {
            let row = row.ok_or_else(|| Fault::refused(format!("no session {session}")))?;
            runner.send(&row, message)
        });
        match sent {
            Ok(went) => session = went.session,
            Err(fault) => {
                let why = fault.message();
                return eprintln!("uraeda: a message to {folder} was not sent: {why}");
            }
        }
    }
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
        options: input.options,
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
        images: image_bytes(call.shared(), input.images.as_deref())?,
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
/// leaves the queue's record. Its slug, when named, is taken while it is in the queue. Once it
/// ran, `then` starts its agent.
fn landed(
    shared: &Shared,
    repo: &str,
    slug: Option<String>,
    run: impl Run,
    then: impl Then,
) -> Result<Landed, Fault> {
    let start = Start {
        name: None,
        label: "Starting a change".to_owned(),
        href: "",
        folder: None,
        branch: None,
        slug,
    };
    queued::queue(shared, repo, start, run, then)?.answered()
}

/// What follows a change that started: its own run options kept, then its first run sent to a
/// session made for it, on its build step's pick. It gives that session: none when no run was
/// sent, and the change's page offers the message unsent. Once the change exists, options that
/// cannot be kept, or a run that cannot be sent, are printed, not refused.
fn first_run(shared: &Shared, repo: &str, options: Option<RunOptions>) -> impl Then + use<> {
    let (shared, repo) = (shared.clone(), repo.to_owned());
    move |started: &StartedView| {
        let folder = &started.folder;
        if let (Some(options), Ok(root)) = (options, repositories::path(&shared, &repo))
            && let Err(fault) = options::keep(&shared, &root, folder, options)
        {
            let why = fault.message();
            eprintln!("uraeda: {folder} started, but its run options were not kept: {why}");
        }
        let sent = runs::send(&shared, &repo, folder, Trigger::Start, First::default());
        sent.unwrap_or_else(|fault| {
            let why = fault.message();
            eprintln!("uraeda: {folder} started, but its first run was not sent: {why}");
            None
        })
    }
}

/// Refuses run options whose build step a new session could not run on, an agent off, a model
/// its agent does not list, an effort the model does not take, before the change starts: once
/// committed, a first run that cannot be sent is only printed. A build step the options leave
/// to the settings is never refused here.
fn check_build(shared: &Shared, repo: &str, options: &RunOptions) -> Result<(), Fault> {
    if !options.steps.iter().any(|step| step.step == "build") {
        return Ok(());
    }
    let Some(runner) = Runner::find(shared) else {
        return Ok(());
    };
    let root = runner.root_of(repo)?;
    let resolved = options::over(shared, options.clone());
    let fallback = runner.new_session_runtime(&root, None).unwrap_or_default();
    let map = picks::to_map(&resolved, &fallback);
    let Some(build) = map.step("build") else {
        return Ok(());
    };
    let pick = SessionPick {
        runtime: Some(build.runtime.clone()),
        model: build.model.clone(),
        effort: build.effort.clone(),
    };
    runner.new_session_pick(&root, &pick).map(|_| ())
}

/// What a started change answers.
fn change_started(landed: Landed) -> ChangeStarted {
    ChangeStarted {
        folder: landed.started.folder,
        session: landed.session,
    }
}

/// The core's refusals of a taken name: a record, a branch, or a folder, or the worktree's
/// folder. The dated folder is the name, whatever letters its slug holds.
fn taken_name(message: &str) -> Option<&str> {
    let name = match message.strip_prefix("cannot create the worktree: .worktrees/") {
        Some(rest) => rest.strip_suffix(" exists")?,
        None => {
            let (name, _) = message.split_once(" exists: ")?;
            let name = name.strip_prefix("specs/done/").unwrap_or(name);
            name.strip_suffix(".md").unwrap_or(name)
        }
    };
    let dated = name.len() > 11
        && name
            .bytes()
            .take(10)
            .enumerate()
            .all(|(at, byte)| match at {
                4 | 7 => byte == b'-',
                _ => byte.is_ascii_digit(),
            })
        && name.as_bytes()[10] == b'-'
        && !name.contains(|letter: char| letter.is_whitespace() || letter == '/');
    dated.then_some(name)
}

/// Starts the change of a text and a slug for a session that becomes it: a taken slug is
/// refused in the card's words. The session's own run follows its move, so the start sends
/// none.
pub(crate) fn start_typed_change(
    shared: &Shared,
    repo: &str,
    text: String,
    slug: Option<String>,
) -> Result<StartedView, Fault> {
    let typed = Typed {
        text,
        images: Vec::new(),
        line: None,
        kind: Kind::Change,
        discovery: None,
    };
    let named = slug.clone();
    let landed = landed(
        shared,
        repo,
        slug,
        move |root, on_step| api::start_text(root, &typed.start(), named.as_deref(), None, on_step),
        |_: &StartedView| None,
    );
    landed
        .map(|landed| landed.started)
        .map_err(|fault| match taken_name(fault.message()) {
            Some(name) => Fault::refused(format!(
                "A branch or folder named {name} exists: pick another slug"
            )),
            None => fault,
        })
}

/// The action `change.start`: starts a change typed as a text.
fn typed_change(call: &Call, input: ChangeStart) -> Result<ChangeStarted, Fault> {
    // Options the store would refuse, or whose build step no new session could run on, are
    // refused before the change starts.
    if let Some(options) = &input.options {
        options::check(call.shared(), options.clone())?;
        check_build(call.shared(), &input.repo, options)?;
    }
    let typed = Typed {
        text: input.text,
        images: image_bytes(call.shared(), input.images.as_deref())?,
        line: input.line,
        kind: Kind::Change,
        discovery: None,
    };
    let slug = input.slug.clone();
    let run = move |root: &Path, on_step: &dyn Fn(StartProgress)| {
        api::start_text(root, &typed.start(), slug.as_deref(), None, on_step)
    };
    let then = first_run(call.shared(), &input.repo, input.options);
    landed(call.shared(), &input.repo, input.slug, run, then).map(change_started)
}

/// The action `change.startProposal`: starts a proposal file as a change.
fn proposal_as_change(call: &Call, input: ChangeStartProposal) -> Result<ChangeStarted, Fault> {
    let (proposal, slug) = (input.proposal, input.slug.clone());
    let run = move |root: &Path, on_step: &dyn Fn(StartProgress)| {
        api::start_feature(root, &proposal, slug.as_deref(), Kind::Change, on_step)
    };
    let then = first_run(call.shared(), &input.repo, input.options);
    landed(call.shared(), &input.repo, input.slug, run, then).map(change_started)
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
    let run = move |root: &Path, on_step: &dyn Fn(StartProgress)| {
        api::start_text(root, &typed.start(), slug.as_deref(), None, on_step)
    };
    // Its first run follows the note's removal, whose commit it would otherwise start under.
    let started = landed(
        call.shared(),
        &input.repo,
        input.slug,
        run,
        |_: &StartedView| None,
    )?
    .started;
    let removed = write(call.shared(), &input.repo, Write::of_lists(), |root| {
        Ok(api::remove_note_and_commit(root, &input.note, &input.hash)?)
    });
    if let Err(fault) = removed {
        let (folder, why) = (&started.folder, fault.message());
        eprintln!("uraeda: {folder} started, but its note stayed in the inbox: {why}");
    }
    let session = first_run(call.shared(), &input.repo, None)(&started);
    Ok(ChangeStarted {
        folder: started.folder,
        session,
    })
}
