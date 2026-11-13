//! The scheduled jobs: a repository's `Jobs` record, the jobs that name it with their problem,
//! next run, and history, and the actions that write a job in the settings file or run it now.
//!
//! A job is the human's own, written in `config.toml`, never read from a repository. Every time
//! is the server's local time: `timeZone` names its zone, the one a client reads them in.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::{Action, Record};
use crate::shared::RepositoryArgs;

/// When a job runs, as the core reads its schedule.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobSchedule {
    /// `hourly`, `daily`, `weekdays`, or `weekly`.
    pub kind: String,
    /// The day of a weekly schedule, 1 for Monday to 7 for Sunday.
    pub day: Option<u32>,
    pub hour: u32,
    pub minute: u32,
}

/// What a run of a job came to.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum JobOutcome {
    /// Its session started.
    Started,
    /// Its time was skipped: `reason` says why.
    Skipped,
    /// Its session could not start: `error` says why, and the time is not tried again.
    Failed,
}

/// Why a time was skipped.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum JobSkip {
    /// The job's last run there still works, or waits for a wakeup its agent set.
    Working,
    /// A change one of its runs started there is still open.
    ChangeOpen,
}

/// What started a run.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum JobTrigger {
    Schedule,
    Manual,
}

/// The open change that blocked a skipped time, by the workspace's title for it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobBlockedBy {
    pub folder: String,
    pub title: String,
}

/// A run of a job in the repository, a time it skipped, or a time whose run could not start.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobRun {
    pub id: String,
    /// When it started, was skipped, or failed, in RFC 3339.
    pub at: String,
    /// The scheduled time it answers; none for "Run now".
    pub due: Option<String>,
    pub trigger: JobTrigger,
    pub outcome: JobOutcome,
    pub reason: Option<JobSkip>,
    /// The change that blocked a time skipped as `change-open`, while the workspace lists it.
    pub blocked_by: Option<JobBlockedBy>,
    /// Why a scheduled start failed.
    pub error: Option<String>,
    /// Why the change its run offered could not start by itself: the offer's card waits.
    pub refusal: Option<String>,
    /// The session it started: none once it is gone.
    pub session: Option<String>,
    /// Its session's title.
    pub title: Option<String>,
    /// The folder of the change its session became, when it did.
    pub folder: Option<String>,
}

/// Why a job does not run next.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum JobNotNext {
    /// The job has a problem, or runs nowhere: `problem` says which.
    Problem,
    /// It is paused.
    Paused,
    /// Scheduled jobs are off.
    Off,
    /// Its agent does not run it here: `text` says why.
    AgentOff,
    /// A change one of its runs started here is still open.
    ChangeOpen,
}

/// When a job runs next here, or why it does not.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobNext {
    /// The time, in RFC 3339, when it runs.
    pub at: Option<String>,
    pub why: Option<JobNotNext>,
    /// For `agent-off`, the server's words, like "Not running here: Claude Code is off in this
    /// repository.".
    pub text: Option<String>,
}

/// A job the repository lists: one that names it, or one that names no repository of the list.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub name: String,
    /// Its place in the file, which tells two jobs of one name apart.
    pub index: u32,
    pub prompt: String,
    /// The schedule as written.
    pub schedule_text: String,
    /// The schedule, none when it is not understood.
    pub schedule: Option<JobSchedule>,
    pub repositories: Vec<String>,
    /// Whether it runs at its times: false when paused.
    pub on: bool,
    pub report_only: bool,
    pub agent: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
    /// Why it does not run here, in the card's words.
    pub problem: Option<String>,
    pub next: JobNext,
    /// The latest run here: the latest that started a session, or a start that failed when it is
    /// newer. A skipped time is no run.
    pub last: Option<JobRun>,
    /// Its runs here, the newest first, 50 at most.
    pub history: Vec<JobRun>,
}

/// A repository's jobs.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Jobs {
    /// The switch for all jobs, in force.
    pub enabled: bool,
    /// The jobs here, in the file's order.
    pub jobs: Vec<Job>,
    /// Why no job is read: the settings file cannot be read, or `jobs` is not a list of tables.
    pub problem: Option<String>,
    /// The IANA zone of the server, which the schedules run in and the times read in.
    pub time_zone: String,
}

impl Record for Jobs {
    const NAME: &'static str = "Jobs";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// A job, as the form writes it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobInput {
    pub name: String,
    pub repositories: Vec<String>,
    /// The schedule's text, one of the four forms.
    pub schedule: String,
    pub prompt: String,
    pub report_only: bool,
    pub agent: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
}

/// An action that writes a job in the settings file: it answers nothing, and the record `Jobs`
/// shows the change.
macro_rules! writes {
    ($input:ident, $name:literal) => {
        impl Action for $input {
            const NAME: &'static str = $name;
            type Input = Self;
            type Output = ();
        }
    };
}

/// Adds a job, at the end of the file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobsAdd {
    pub repo: String,
    pub job: JobInput,
}

writes!(JobsAdd, "jobs.add");

/// Rewrites the job of a name: a rename moves its history too.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobsUpdate {
    pub repo: String,
    pub name: String,
    pub job: JobInput,
}

writes!(JobsUpdate, "jobs.update");

/// Pauses or resumes a job.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobsSetOn {
    pub repo: String,
    pub name: String,
    pub on: bool,
}

writes!(JobsSetOn, "jobs.setOn");

/// Removes a job: its sessions stay.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobsRemove {
    pub repo: String,
    pub name: String,
}

writes!(JobsRemove, "jobs.remove");

/// Runs a job in the repository now, whatever its schedule, its pause, or the switch.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobsRunNow {
    pub repo: String,
    pub name: String,
}

/// The session a run by hand started.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct JobsRan {
    pub session: String,
}

impl Action for JobsRunNow {
    const NAME: &'static str = "jobs.runNow";
    type Input = Self;
    type Output = JobsRan;
}
