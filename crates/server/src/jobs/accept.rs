//! The acceptance of a job's offer: scheduling a job is the human's yes for the change its run
//! offers (the agents decision), so a run whose turn ends on a change offer has that change
//! started, as the offer's card would start it, unless the job only reports. Every way the human
//! could have stepped in, or the offer could be less than the run's last word, leaves the card
//! waiting.

use uraeda_core::jobs::{self, Job};
use uraeda_core::offers::{OfferKind, ending_offer, proposal_title};

use super::Scheduler;
use super::guards::works;
use super::place::EXTENSION;
use super::problem::impossible;
use super::run::{change_line, name_of};
use crate::live::locked;
use crate::runner::{Event, JobRun, Origin, Runner, Session, TurnState, refusals};
use crate::shared::Shared;

/// A turn of a session ended: when a job's run started the session, its record changed, and a
/// turn that ended done in a chat is read for the change it offers. The job is held busy from
/// now until the acceptance ends, whatever it decides: the change being opened is the run still
/// working. Called as the change is published: it reads the store, and leaves the rest to a
/// thread of its own.
pub(crate) fn turn_ended(
    runner: &Runner,
    session: &str,
    chat: bool,
    turn: Option<i64>,
    done: bool,
) {
    let Some(scheduler) = runner.shared.find::<Scheduler>() else {
        return;
    };
    let Ok(Some(run)) = runner.store().job_run_of(session) else {
        return;
    };
    super::announce(&runner.shared);
    let (Some(turn), true, true) = (turn, chat, done) else {
        return;
    };
    let key = (run.job.clone(), run.repository.clone());
    locked(&scheduler.starts).enter(key.clone());
    let session = session.to_owned();
    runner.spawn(move |runner| {
        {
            let _one = locked(&scheduler.accepting);
            if !scheduler.stopped() {
                accept(runner, &session, turn);
            }
        }
        locked(&scheduler.starts).leave(&key);
    });
}

/// The session moved to a change: a job's run shows its change, and what it could not start is
/// the past.
pub(crate) fn moved(shared: &Shared, session: &str) {
    let store = shared.get::<crate::runner::Store>();
    let Ok(Some(run)) = store.job_run_of(session) else {
        return;
    };
    if run.refusal.is_some() {
        let _ = store.set_job_refusal(run.id, None);
    }
    super::announce(shared);
}

/// The agent's text that is the turn's last word: the last of its texts and of its own agent's
/// tool calls, when it is a text. A call after the text, or a sub-agent's text, is not.
fn last_word(events: impl Iterator<Item = Event>) -> Option<String> {
    let mut last: Option<Option<String>> = None;
    let mut growing = false;
    for event in events {
        match event {
            Event::TextDelta { text } => match (&mut last, growing) {
                (Some(Some(grown)), true) => grown.push_str(&text),
                _ => {
                    last = Some(Some(text));
                    growing = true;
                }
            },
            Event::Text { text } => {
                last = Some(Some(text));
                growing = false;
            }
            Event::ToolStart { parent: None, .. } => {
                last = Some(None);
                growing = false;
            }
            _ => {}
        }
    }
    last.flatten()
}

/// Whether the human wrote in the session: any message of theirs, in any turn.
fn human_wrote(runner: &Runner, session: &str) -> bool {
    let store = runner.store();
    let turns = store.turns(session).unwrap_or_default();
    turns.iter().any(|turn| {
        let log = store.log(turn.id, 0).unwrap_or_default();
        log.into_iter().any(|logged| {
            matches!(
                logged.event,
                Event::Message {
                    origin: Origin::Human,
                    ..
                }
            )
        })
    })
}

/// The job of a run, as it is now, when it still gives the human's yes in the repository of
/// this name: it exists, has no problem but maybe its schedule, does not only report, still
/// names the repository, and the Jobs extension is on there.
fn still_yes(shared: &Shared, run: &JobRun, name: &str) -> Option<Job> {
    let read = jobs::read(shared.config_dir());
    if read.problem.is_some() {
        return None;
    }
    let job = read.jobs.iter().find(|job| job.name == run.job)?;
    let named = job.repositories.iter().any(|one| one == name);
    let on = crate::extensions::is_on(shared, EXTENSION, name);
    let yes = impossible(&read.jobs, job).is_none() && !job.report_only && named && on;
    yes.then(|| job.clone())
}

/// Whether the turn is the session's last, ended done and not dismissed, in a chat of the run's
/// own main checkout, whose earlier offer was never refused, the human never wrote in, and whose
/// agent no longer works, as a wakeup it set.
fn still_its_word(runner: &Runner, run: &JobRun, row: &Session, turn: i64) -> bool {
    let store = runner.store();
    let turns = store.turns(&row.id).unwrap_or_default();
    let ended = crate::runner::latest_of(&turns, None);
    let ended = ended.filter(|ended| {
        ended.id == turn && ended.state == TurnState::Done && ended.dismissed_at.is_none()
    });
    row.repo == run.repository
        && row.folder.is_none()
        && row.archived_at.is_none()
        && ended.is_some()
        && run.refused_turn.is_none()
        && !human_wrote(runner, &row.id)
        && !works(runner, &row.id)
}

/// Starts the change the run's turn offered, when the run, the job, and the session allow it.
/// The checks of what the human may have done meanwhile come right before the start.
fn accept(runner: &Runner, session: &str, turn: i64) {
    let shared = &runner.shared;
    let store = runner.store();
    let Ok(Some(run)) = store.job_run_of(session) else {
        return;
    };
    let log = store.log(turn, 0).unwrap_or_default();
    let word = last_word(log.into_iter().map(|logged| logged.event));
    let offer = word.as_deref().and_then(ending_offer);
    let Some(proposal) = offer.filter(|offer| offer.kind == OfferKind::Change) else {
        return;
    };
    let Ok(Some(row)) = store.session(session) else {
        return;
    };
    let Some(name) = name_of(shared, &row.repo) else {
        return;
    };
    let Some(job) = still_yes(shared, &run, &name) else {
        return;
    };
    if !still_its_word(runner, &run, &row, turn) {
        return;
    }
    let title = proposal_title(&proposal.body);
    match crate::records::move_to_change(runner, &name, &row, proposal.body, None) {
        Ok(_) => {
            runner.note(session, turn, &change_line(&job.name, &title));
        }
        Err(fault) => {
            // The human got to the session first, by a message or by the card: that one decides.
            let why = fault.message();
            if human_wrote(runner, session) || why.ends_with(refusals::AGENT_WORKING) {
                return;
            }
            let why = why.strip_prefix("refused: ").unwrap_or(why);
            if store.set_job_refusal(run.id, Some((why, turn))).is_ok() {
                runner.session_changed(session);
                super::announce(shared);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn event(value: serde_json::Value) -> Event {
        serde_json::from_value(value).unwrap()
    }

    #[test]
    fn the_last_word_is_the_last_text_after_any_call_of_the_agent() {
        let text = |text: &str| event(json!({ "type": "text", "text": text }));
        let piece = |text: &str| event(json!({ "type": "textDelta", "text": text }));
        let call = |parent: Option<&str>| {
            event(
                json!({ "type": "toolStart", "id": "t", "kind": "execute", "name": "Bash",
                          "parent": parent }),
            )
        };
        let rows = [
            (
                "a whole text",
                vec![call(None), text("Done.")],
                Some("Done."),
            ),
            ("pieces", vec![piece("Do"), piece("ne.")], Some("Done.")),
            ("a call after it", vec![text("Done."), call(None)], None),
            (
                "a sub-agent's call after it",
                vec![text("Done."), call(Some("a"))],
                Some("Done."),
            ),
            ("nothing", vec![], None),
        ];
        for (name, events, expected) in rows {
            let found = last_word(events.into_iter());
            assert_eq!(found.as_deref(), expected, "{name}");
        }
    }
}
