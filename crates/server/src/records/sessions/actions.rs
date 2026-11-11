//! The sessions' actions: a message sent, a session made or moved, a run stopped, a blocked
//! action allowed, and the human's edits of a session. Each is a call of the sessions' manager.

use std::path::Path;

use uraeda_core::api;
use uraeda_protocol::{
    ContinuedAll, FeatureContinueAll, Made, MovedToChange, RepositoryArgs, Retried, Sent,
    SessionAllow, SessionAllowAll, SessionArchive, SessionDismiss, SessionNew, SessionNewChat,
    SessionRename, SessionSeen, SessionSend, SessionSetEffort, SessionStop, SessionTakeBack,
    SessionToChange, Trigger,
};

use super::images;
use super::runs::{self, First, moved_opening};
use crate::live::{Call, Fault, Registry};
use crate::records::features::start_typed_change;
use crate::records::{word, writing};
use crate::runner::send::{Message, Run};
use crate::runner::{Runner, Target, picks};

/// Registers the actions `session.*`, and `feature.continueAll`.
pub(super) fn register(registry: &Registry) {
    registry.action::<SessionSend>(send);
    registry.action::<SessionNew>(new);
    registry.action::<SessionNewChat>(new_chat);
    registry.action::<SessionToChange>(to_change);
    registry.action::<SessionAllow>(allow);
    registry.action::<SessionAllowAll>(allow_all);
    registry.action::<SessionArchive>(|call, input| {
        let (runner, row) = owned(call, &input.repo, &input.session)?;
        runner.archive(&row, input.archived)
    });
    registry.action::<SessionDismiss>(dismiss);
    registry.action::<SessionRename>(|call, input| {
        let (runner, row) = owned(call, &input.repo, &input.session)?;
        runner.rename(&row, &input.title)
    });
    registry.action::<SessionSeen>(|call, input| {
        let (runner, row) = owned(call, &input.repo, &input.session)?;
        runner.seen(&row)
    });
    registry.action::<SessionSetEffort>(|call, input| {
        let (runner, row) = owned(call, &input.repo, &input.session)?;
        runner.set_effort(&row, input.effort)
    });
    registry.action::<SessionStop>(|call, input| {
        let (runner, row) = owned(call, &input.repo, &input.session)?;
        runner.stop(&row);
        Ok(())
    });
    registry.action::<SessionTakeBack>(|call, input| {
        let (runner, row) = owned(call, &input.repo, &input.session)?;
        runner.take_back(&row, &input.message)
    });
    registry.action::<FeatureContinueAll>(continue_all);
}

/// The manager, and a session of a repository.
fn owned(
    call: &Call,
    repository: &str,
    session: &str,
) -> Result<(Runner, crate::runner::Session), Fault> {
    let runner = Runner::of(call.shared());
    let row = runner.own(repository, session)?;
    Ok((runner, row))
}

/// The triggers a workflow message takes from a client: the others are the server's own.
const SENT: [Trigger; 7] = [
    Trigger::Answers,
    Trigger::Approval,
    Trigger::Changes,
    Trigger::Comments,
    Trigger::Proposal,
    Trigger::Start,
    Trigger::Manual,
];

/// The action `session.send`: a message to a session, or to a feature, whose session is made
/// with it. It waits for the feature's queued commits, so its agent never starts on a file
/// written but not committed yet, and is kept for a feature whose start still lands.
fn send(call: &Call, input: SessionSend) -> Result<Sent, Fault> {
    let shared = call.shared();
    let runner = Runner::of(shared);
    let root = runner.root_of(&input.repo)?;
    let store = runner.store();
    if let Some(workflow) = &input.workflow
        && !SENT.contains(&workflow.trigger)
    {
        let refusal = format!("no trigger {}", word(&workflow.trigger));
        return Err(Fault::refused(refusal));
    }
    let own = input
        .session
        .as_deref()
        .map(|session| runner.own(&input.repo, session));
    let own = own.transpose()?;
    let folder = match (&own, &input.folder) {
        (Some(row), _) => row.folder.clone(),
        (None, Some(folder)) => Some(folder.clone()),
        (None, None) => return Err(Fault::refused("a message goes to a session or a feature")),
    };
    let new_session = input.new_session == Some(true);
    // The runtime the message goes to: the session's, else the feature's latest session's,
    // else the one a new session runs on.
    let latest = match (&own, &folder) {
        (Some(row), _) => Some(row.clone()),
        (None, Some(folder)) if !new_session => store.latest_session(&root, folder)?,
        _ => None,
    };
    let chosen = input.pick.runtime.as_deref();
    let runtimes = shared.get::<crate::runtimes::Runtimes>();
    let named = latest.as_ref().map(|row| row.agent.clone());
    let named = named.or_else(|| chosen.map(str::to_owned));
    let named = named.or_else(|| runner.new_session_runtime(&root, None).ok());
    let runtime = named.and_then(|name| runtimes.get(&name));
    let reads = runtime.is_none_or(|runtime| runtime.capabilities().images);
    let workflow = input.workflow.map(|workflow| Run {
        trigger: word(&workflow.trigger),
        step: workflow.step,
        fresh: workflow.fresh == Some(true),
        line: None,
    });
    let message = Message {
        text: input.text,
        images: images::sent(shared, input.images, workflow.is_some(), reads)?,
        opening: None,
        workflow,
    };
    // A feature whose start is still in the queue keeps the message until it lands.
    if let Some(folder) = folder
        .as_deref()
        .filter(|folder| runner.start_waits(&root, folder))
    {
        picks::message_runtime(&runner, &root, latest.as_ref(), chosen)?;
        if message.text.trim().is_empty() && message.images.is_empty() {
            return Err(Fault::refused(crate::runner::refusals::BLANK));
        }
        let made = own.is_none() && store.folder_sessions(&root, folder)?.is_empty();
        let session = match &own {
            Some(row) => row.id.clone(),
            None => runner.feature_session(&root, folder, &input.pick)?.id,
        };
        if runner
            .keep_for_start(&root, folder, &session, message.clone())
            .is_some()
        {
            return Ok(Sent {
                session,
                turn: None,
            });
        }
        // The start landed or was refused meanwhile: the message goes as to any feature,
        // which makes its session again.
        if made {
            store.remove_empty_session(&session)?;
        }
    }
    if let Some(folder) = &folder {
        let waited = writing::settled(shared, &input.repo, folder);
        waited.map_err(|_| Fault::refused("The commit it waited for was refused."))?;
    }
    let row = match (own, &folder) {
        (Some(row), _) => row,
        (None, Some(folder)) => {
            picks::message_runtime(&runner, &root, latest.as_ref(), chosen)?;
            // A folder that is no feature's gets no session.
            api::read_feature(Path::new(&root), folder)?;
            match new_session {
                true => runner.new_session(&root, folder, &input.pick)?,
                false => runner.feature_session(&root, folder, &input.pick)?,
            }
        }
        (None, None) => return Err(Fault::refused("a message goes to a session or a feature")),
    };
    // A run may go to a new session of its step: the one it went to answers.
    let went = runner.send(&row, message)?;
    Ok(Sent {
        session: went.session,
        turn: Some(went.turn.to_string()),
    })
}

/// The action `session.new`: a new session of a change or a feature, which becomes its latest.
fn new(call: &Call, input: SessionNew) -> Result<Made, Fault> {
    let runner = Runner::of(call.shared());
    let root = runner.root_of(&input.repo)?;
    // A folder that is no change's or feature's gets no session.
    api::read_feature(Path::new(&root), &input.folder)?;
    let row = runner.new_session(&root, &input.folder, &input.pick)?;
    Ok(Made { session: row.id })
}

/// The action `session.newChat`: a new chat, without a feature.
fn new_chat(call: &Call, input: SessionNewChat) -> Result<Made, Fault> {
    let runner = Runner::of(call.shared());
    let root = runner.root_of(&input.repo)?;
    let row = runner.new_chat(&root, &input.pick)?;
    Ok(Made { session: row.id })
}

/// The action `session.toChange`: makes a session without a workflow the change of a text and
/// a slug: the change starts, the session moves to it, and its first run goes to the session,
/// after the line telling the agent where it works now and which files to carry over. Refused
/// while the agent is unavailable. A session that cannot move once the change started stays
/// without a workflow, and the refusal names the change.
fn to_change(call: &Call, input: SessionToChange) -> Result<MovedToChange, Fault> {
    let (runner, row) = owned(call, &input.repo, &input.session)?;
    if let Some(folder) = &row.folder {
        let refusal = format!("the session already belongs to {folder}");
        return Err(Fault::refused(refusal));
    }
    // Without its runtime, the run telling it where it works now could not be sent: the move
    // waits for it, as a run does.
    picks::message_runtime(&runner, &row.repo, Some(&row), None)?;
    let started = {
        let _moving = runner.hold(&row.repo, Target::Session(&row.id))?;
        let started = start_typed_change(call, &input.repo, input.text, input.slug)?;
        runner.attach(&row, &started.folder).map_err(|fault| {
            Fault::refused(format!(
                "The change {} started, but this session could not move to it: {}",
                started.folder,
                fault.message()
            ))
        })?;
        started
    };
    // The files its agent edited or wrote with its tools, by their paths from the main
    // checkout: one changed through a shell command is not among them.
    let edited = runner.store().edited_files(&row.id)?;
    let relative = |path: &String| !Path::new(path).is_absolute();
    let edited: Vec<String> = edited
        .into_iter()
        .map(|(path, _)| path)
        .filter(relative)
        .collect();
    let first = First {
        session: Some(&row.id),
        opening: Some(moved_opening(
            &row.repo,
            &started.folder,
            &started.branch,
            &edited,
        )),
        ..First::default()
    };
    runs::sent_or_said(
        call.shared(),
        &input.repo,
        &started.folder,
        Trigger::Start,
        first,
    );
    Ok(MovedToChange {
        folder: started.folder,
    })
}

/// A turn's id, as a client names it.
fn turn_of(id: &str) -> Result<i64, Fault> {
    id.parse()
        .map_err(|_| Fault::refused(format!("no turn {id}")))
}

/// The action `session.allow`: allows one blocked action, tried again in a turn of its own.
fn allow(call: &Call, input: SessionAllow) -> Result<Retried, Fault> {
    let (runner, row) = owned(call, &input.repo, &input.session)?;
    let turn = turn_of(&input.turn)?;
    let none = || Fault::refused(format!("no blocked action {} in turn {turn}", input.denial));
    let denial = input.denial.parse().map_err(|_| none())?;
    let retried = runner.allow(&row, turn, denial)?;
    Ok(Retried {
        turn: retried.to_string(),
    })
}

/// The action `session.allowAll`: allows every blocked action of the latest turn that has a
/// rule.
fn allow_all(call: &Call, input: SessionAllowAll) -> Result<Retried, Fault> {
    let (runner, row) = owned(call, &input.repo, &input.session)?;
    let retried = runner.allow_all(&row)?;
    Ok(Retried {
        turn: retried.to_string(),
    })
}

/// The action `session.dismiss`: a failed or stopped turn no longer asks for the human.
fn dismiss(call: &Call, input: SessionDismiss) -> Result<(), Fault> {
    let runner = Runner::of(call.shared());
    let turn = turn_of(&input.turn)?;
    let found = runner.store().turn(turn)?;
    let found = found.ok_or_else(|| Fault::refused(format!("no turn {turn}")))?;
    let row = runner.own(&input.repo, &found.session_id)?;
    runner.dismiss(&row, turn)
}

/// The action `feature.continueAll`: each feature whose run stopped and asks for the human
/// gets its step's message. It answers the runs it could not continue.
fn continue_all(call: &Call, input: RepositoryArgs) -> Result<ContinuedAll, Fault> {
    let runner = Runner::of(call.shared());
    let root = runner.root_of(&input.repo)?;
    Ok(ContinuedAll {
        refused: runner.continue_all(&root)?,
    })
}
