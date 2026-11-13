//! What needs the human, across every listed repository: what the notifications read.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::Record;

/// Every item, of every listed repository, that needs the human.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct NeedsYouList {
    /// The items, each repository's features first, then its chats.
    pub rows: Vec<NeedsYouRow>,
}

/// An item that needs the human.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct NeedsYouRow {
    /// `<repository>/<folder>`, or `<repository>/sessions/<session id>`.
    pub id: String,
    /// Changes with the reason and the step or the turn, so a new ask notifies again.
    pub key: String,
    /// The repository's name.
    pub repository: String,
    /// The feature's folder: a chat has none.
    pub folder: Option<String>,
    /// Its page, from the server's root: where the human answers it.
    pub href: String,
    /// Its name in the sidebar, or its slug.
    pub label: String,
    /// Its title.
    pub title: String,
    /// What it asks: `Questions to answer`.
    pub message: String,
    /// Why it needs the human.
    pub reason: NeedsYouReason,
    /// Whether Continue all goes on with it: a feature's run that stopped and asks, at a step
    /// that waits on the agent.
    pub continued: bool,
}

/// Why an item needs the human, in the order a notification picks it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum NeedsYouReason {
    /// An agent was refused an action.
    Blocked,
    /// A run ended early: it failed, or was stopped.
    Attention,
    /// A step waits on the human.
    Step,
    /// A pull request is ready for review.
    PullRequest,
    /// A feature of **Now** waits for the human's Continue: its step is an agent's, and no run
    /// follows it. Listed, never notified: the human started it, or put its run aside.
    Continue,
}

impl Record for NeedsYouList {
    const NAME: &'static str = "NeedsYouList";
    type Args = ();
    type Value = Self;
}
