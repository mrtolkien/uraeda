//! The write queue's record: a repository's writes still landing, one after another, and the
//! refused ones, until dismissed. And a start's steps, which its write shows.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::{Action, Record};
use crate::shared::RepositoryArgs;

/// A repository's write queue: its commits still landing, one after another, and the refused
/// ones, until dismissed.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WriteQueue {
    /// In the order they were made.
    pub writes: Vec<QueuedWrite>,
}

impl Record for WriteQueue {
    const NAME: &'static str = "WriteQueue";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// A write of the queue: its name, where it is, and the feature and file it concerns.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct QueuedWrite {
    pub id: String,
    /// What it does, as the UI named it, or its commit's subject.
    pub label: String,
    /// The page it opens: empty when the UI named none.
    pub href: String,
    /// The feature or the change it concerns.
    pub folder: Option<String>,
    /// The file it concerns: a feature's file by its name, any other by its path.
    pub file: Option<String>,
    pub state: WriteState,
    /// Once refused, why.
    pub failure: Option<WriteFailure>,
    /// What git and the hooks printed: as it comes, then the refusal's whole message.
    pub output: Option<String>,
    /// For a start, its steps, in order: none for any other write.
    pub steps: Option<Vec<StartStep>>,
}

/// A step of a start, and where it is.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StartStep {
    /// What it does, as "Commit the proposal on main, running your hooks".
    pub label: String,
    pub state: StepState,
    /// When it started to run, in milliseconds since 1970: a client counts its seconds from
    /// there while it runs.
    pub started_at: Option<u64>,
    /// The seconds it took, once it ended.
    pub seconds: Option<u32>,
    /// What the commit and its hooks printed, for the commit's step, or why it was refused.
    pub output: Option<String>,
}

/// Where a step of a start is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum StepState {
    /// Behind another step.
    Waiting,
    /// It runs.
    Running,
    /// It ended well.
    Done,
    /// It refused the start: the steps after it never ran.
    Refused,
}

/// Where a queued write is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum WriteState {
    /// Behind another write.
    Waiting,
    /// Its commit runs, with the hooks.
    Running,
    /// It did not land, and stays until dismissed.
    Refused,
}

/// Why a refused write did not land.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum WriteFailure {
    /// A hook refused its commit, and its files are back as they were.
    Hook,
    /// Anything else: its files are left written, uncommitted, listed on the Git page.
    Failed,
}

/// Takes a refused write out of the write queue.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WritesDismiss {
    pub repo: String,
    pub id: String,
}

action!(WritesDismiss, "writes.dismiss", ());
