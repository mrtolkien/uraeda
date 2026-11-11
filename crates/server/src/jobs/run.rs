//! A job's run: its row in the record of runs, then its session. The row goes first, so the
//! unique index of a job, a repository, and a time stops a second start of one time, from two
//! ticks, two servers, or a clock set back.

use std::time::SystemTime;

use uraeda_core::jobs::Job;
use uraeda_protocol::{SessionList, SessionPick};

use crate::live::{Bus, Fault};
use crate::records::repositories;
use crate::runner::send::Message;
use crate::runner::{NewJobRun, Runner};
use crate::shared::Shared;

/// What started a run, and the time it answers: none for "Run now".
pub(crate) struct Started {
    pub due: Option<SystemTime>,
    pub manual: bool,
}

/// The line a run's turn opens with: why it started.
fn opening(job: &str, manual: bool) -> String {
    match manual {
        true => format!("Started by “Run now” of the job “{job}”."),
        false => format!("Started by the schedule “{job}”."),
    }
}

/// The line the turn of a job's run ends with once Uraeda started the change it offered.
pub(crate) fn change_line(job: &str, title: &str) -> String {
    format!("The job “{job}” started the change “{title}”.")
}

/// The message of a job's run: its prompt, a rule, then Uraeda's note. Nobody follows the
/// session, it changes no file, as it works in the main checkout where the human's edits are,
/// and its offer of a change is the human's yes given in advance, unless the job reports only.
pub(crate) fn message(job: &Job) -> String {
    let offer = match job.report_only {
        true => ": the job is report only, so the offer waits for the human.",
        false => {
            ", then stop: the human gave their yes by scheduling this job, so Uraeda starts the \
             change from your offer, and the next message continues in its worktree."
        }
    };
    format!(
        "{}\n\n---\n\nThis session was started by the scheduled job “{}”. Nobody follows it live: \
         the human reads it later. Change no file. If a code change is needed, offer it once, as \
         a change, with its `uraeda-offer change` block{offer} When nothing needs doing, answer \
         in one line.\n",
        job.prompt, job.name
    )
}

/// Starts the run of `job` in the main checkout `root`, which the caller read: nothing is read
/// before the row, so what the caller decided on last holds when it is written. Opens a chat on
/// the job's agent, model, and effort, titled by its name, and sends it the job's message. None
/// when its time is recorded already. A chat that does not start removes the row, so its time
/// is not marked run, and the chat with it.
pub(crate) fn start(
    shared: &Shared,
    job: &Job,
    started: &Started,
    root: &str,
) -> Result<Option<String>, Fault> {
    let runner = Runner::of(shared);
    let store = runner.store();
    let row = NewJobRun {
        job: job.name.clone(),
        repository: root.to_owned(),
        due: started.due,
        trigger: if started.manual { "manual" } else { "schedule" },
        outcome: "started",
        ..NewJobRun::default()
    };
    let Some(run) = store.add_job_run(&row, shared.now())? else {
        return Ok(None);
    };
    let mut made = None;
    let sent = (|| {
        let pick = SessionPick {
            runtime: job.agent.clone(),
            model: job.model.clone(),
            effort: job.effort.clone(),
        };
        let session = made.insert(runner.new_chat(root, &pick)?).clone();
        // Before its first turn: the turn's end, which reads the row by its session, finds it.
        store.set_job_run_session(run.id, &session.id)?;
        runner.rename(&session, &job.name)?;
        let input = Message {
            text: message(job),
            job: Some(opening(&job.name, started.manual)),
            ..Message::default()
        };
        runner.send(&session, input)?;
        Ok::<_, Fault>(session.id)
    })();
    match sent {
        Ok(session) => {
            super::announce(shared);
            Ok(Some(session))
        }
        Err(fault) => {
            let _ = store.remove_job_run(run.id);
            // A chat made and not started holds no turn: it goes with its row.
            if let Some(session) = made {
                let _ = store.remove_empty_session(&session.id);
                if let Some(repo) = runner.name_of(root) {
                    let args = uraeda_protocol::RepositoryArgs { repo };
                    shared.get::<Bus>().changed::<SessionList>(&args);
                }
            }
            Err(fault)
        }
    }
}

/// The name in the list of the repository whose main checkout is `root`.
pub(crate) fn name_of(shared: &Shared, root: &str) -> Option<String> {
    let listed = repositories::all(shared).into_iter();
    let mut listed = listed.filter(|repository| !repository.missing);
    let found = listed.find(|repository| repository.path.to_string_lossy() == root);
    found.map(|repository| repository.name)
}
