//! The runs the server sends by itself once a change or a feature moved: a started change's
//! first run, a promoted change's, and the run of a session that became a change.

use std::path::Path;

use uraeda_core::api;
use uraeda_protocol::{SessionPick, Trigger};

use crate::live::Fault;
use crate::records::features::workflow_message;
use crate::records::word;
use crate::runner::send::{Message, Run};
use crate::runner::{Runner, picks};
use crate::shared::Shared;

/// A run to send to a change or a feature.
#[derive(Default)]
pub(crate) struct First<'a> {
    /// The session it goes to: the folder's latest, made when it has none, without one.
    pub session: Option<&'a str>,
    /// A line the server puts before the message.
    pub opening: Option<String>,
    /// What a session made for it runs on.
    pub pick: SessionPick,
}

/// Sends a folder's workflow run for `trigger`, with the agent available and a run to start:
/// the session it went to, none when no run was sent, and its page offers the message unsent.
///
/// # Errors
///
/// The refusal of a run that could not be sent.
pub(crate) fn send(
    shared: &Shared,
    repository: &str,
    folder: &str,
    trigger: Trigger,
    first: First<'_>,
) -> Result<Option<String>, Fault> {
    let Some(runner) = Runner::find(shared) else {
        return Ok(None);
    };
    // A start's landing sends its first run from the write queue's own thread.
    let _runtime = runner.entered();
    let root = runner.root_of(repository)?;
    let store = runner.store();
    let to = match first.session {
        Some(session) => store.session(session)?,
        None => store.latest_session(&root, folder)?,
    };
    // Without the agent, or a run to start, the page offers its message unsent.
    let chosen = first.pick.runtime.clone().or_else(|| {
        let pick = runner.step_pick(&root, folder, Some("build"));
        pick.map(|pick| pick.runtime)
    });
    let chosen = chosen.as_deref().filter(|_| to.is_none());
    if picks::message_runtime(&runner, &root, to.as_ref(), chosen).is_err() {
        return Ok(None);
    }
    let message = workflow_message(shared, repository, folder, trigger)?;
    let Some(text) = message
        .map(|message| message.text)
        .filter(|text| !text.is_empty())
    else {
        return Ok(None);
    };
    let row = match to {
        Some(row) => row,
        None => runner.feature_session(&root, folder, &first.pick)?,
    };
    let run = Run {
        trigger: word(&trigger),
        ..Run::default()
    };
    let input = Message {
        text,
        opening: first.opening,
        workflow: Some(run),
        ..Message::default()
    };
    Ok(Some(runner.send(&row, input)?.session))
}

/// [`send`], for a run that follows a move that is done: one that could not be sent is
/// printed, not refused, and the page offers it unsent.
pub(crate) fn sent_or_said(
    shared: &Shared,
    repository: &str,
    folder: &str,
    trigger: Trigger,
    first: First<'_>,
) -> Option<String> {
    let sent = send(shared, repository, folder, trigger, first);
    sent.unwrap_or_else(|fault| {
        let why = fault.message();
        eprintln!("uraeda: {folder} moved, but its run was not sent: {why}");
        None
    })
}

/// The line before a session's first run in the change it became: where it works now, and the
/// files it edited in the main checkout, to carry over, or to merge by hand when they changed
/// there since.
pub(super) fn moved_opening(root: &str, folder: &str, branch: &str, edited: &[String]) -> String {
    let worktree = api::work_dir(Path::new(root), folder).unwrap_or_default();
    let moved = format!(
        "This session is now the change specs/changes/{folder}/, on branch {branch}, in its \
         worktree {worktree}: work there from now on, not in the main checkout."
    );
    if edited.is_empty() {
        return moved;
    }
    format!(
        "{moved} You edited these files in the main checkout: {}. Carry each over to the \
         worktree, then restore it in the main checkout, unless it changed there since your \
         edit: then leave it there, and merge your edit into the worktree's copy by hand.",
        edited.join(", ")
    )
}
