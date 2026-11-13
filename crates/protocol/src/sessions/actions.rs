//! The sessions' actions: what sends a message, makes a session, stops a run, allows a blocked
//! action, and moves a session; Continue all; and a feature's agent time and tokens.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::features::Trigger;
use crate::registry::Action;
use crate::shared::{ChatImage, RepositoryArgs};

/// What a new session runs on, as the human picked it where it starts: each one left out for
/// the default.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct SessionPick {
    /// The runtime, by the name it is registered as: the first one on when left out.
    pub runtime: Option<String>,
    /// A model the runtime lists.
    pub model: Option<String>,
    /// An effort the model takes.
    pub effort: Option<String>,
}

/// The workflow's message, which starts a feature's step.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct SentWorkflow {
    /// What sending it counts as.
    pub trigger: Trigger,
    /// The step it was read at: once the feature moved on, it runs as a chat.
    pub step: Option<String>,
    /// Always start a new session of the change or the feature.
    pub fresh: Option<bool>,
}

/// Sends a message: to a session, or to a feature, whose session is made with its first
/// message. Idle, the session starts a turn. During one, the human's message joins it, and the
/// workflow's waits for the next. A workflow run goes to the session its step's options give,
/// which may be a new one.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct SessionSend {
    /// The repository's name in the list.
    pub repo: String,
    /// The session to send to.
    pub session: Option<String>,
    /// Or the change or the feature, by its folder.
    pub folder: Option<String>,
    /// With `folder`: a new session of it, made with this message.
    pub new_session: Option<bool>,
    pub text: String,
    /// Its chat images, as their upload answered them.
    pub images: Option<Vec<ChatImage>>,
    /// What a session made with this message runs on.
    #[serde(flatten)]
    pub pick: SessionPick,
    pub workflow: Option<SentWorkflow>,
}

action!(SessionSend, "session.send", Sent);

/// Where a message went: its session, which a workflow run's may have been made for it, and its
/// turn. A message kept while its feature's start lands has no turn yet.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Sent {
    pub session: String,
    pub turn: Option<String>,
}

/// A session made.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Made {
    pub session: String,
}

/// Makes a new session of a change or a feature, which becomes its latest: its runs go to it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionNew {
    /// The repository's name in the list.
    pub repo: String,
    /// The change's or the feature's folder.
    pub folder: String,
    #[serde(flatten)]
    pub pick: SessionPick,
}

action!(SessionNew, "session.new", Made);

/// Makes a new chat, without a feature, titled by its first message.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionNewChat {
    /// The repository's name in the list.
    pub repo: String,
    #[serde(flatten)]
    pub pick: SessionPick,
}

action!(SessionNewChat, "session.newChat", Made);

/// Makes a chat the change of a text: the change starts, the session moves to it, and its first
/// run goes to the session.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(optional_fields = nullable)]
pub struct SessionToChange {
    /// The repository's name in the list.
    pub repo: String,
    pub session: String,
    /// The change's proposal, as typed.
    pub text: String,
    /// Its slug: the one the core proposes when none is given.
    pub slug: Option<String>,
}

action!(SessionToChange, "session.toChange", MovedToChange);

/// The change a session became.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MovedToChange {
    pub folder: String,
}

/// Allows one blocked action: the session's process opens again with its rule, and a turn of
/// its own asks the agent to try again.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionAllow {
    /// The repository's name in the list.
    pub repo: String,
    pub session: String,
    /// The turn the action was blocked in.
    pub turn: String,
    /// The blocked action's item, by its `id`.
    pub denial: String,
}

action!(SessionAllow, "session.allow", Retried);

/// Allows every blocked action of the session's latest turn that has a rule, in one turn.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionAllowAll {
    /// The repository's name in the list.
    pub repo: String,
    pub session: String,
}

action!(SessionAllowAll, "session.allowAll", Retried);

/// The turn that tries the allowed actions again.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Retried {
    pub turn: String,
}

/// Archives a chat, or brings it back.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionArchive {
    /// The repository's name in the list.
    pub repo: String,
    pub session: String,
    pub archived: bool,
}

action!(SessionArchive, "session.archive", ());

/// Dismisses a failed or stopped turn: it no longer asks for the human.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionDismiss {
    /// The repository's name in the list.
    pub repo: String,
    pub turn: String,
}

action!(SessionDismiss, "session.dismiss", ());

/// Renames a session, by the title's first line that is not blank.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionRename {
    /// The repository's name in the list.
    pub repo: String,
    pub session: String,
    pub title: String,
}

action!(SessionRename, "session.rename", ());

/// Records that the human saw the session.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionSeen {
    /// The repository's name in the list.
    pub repo: String,
    pub session: String,
}

action!(SessionSeen, "session.seen", ());

/// Changes the effort a session runs on, from its next turn.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionSetEffort {
    /// The repository's name in the list.
    pub repo: String,
    pub session: String,
    /// The effort, by the agent's id: none for the agent's default.
    pub effort: Option<String>,
}

action!(SessionSetEffort, "session.setEffort", ());

/// Stops the session's running turn and the turns waiting after it, or its run's wait to
/// continue. Its sub-sessions stop too.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionStop {
    /// The repository's name in the list.
    pub repo: String,
    pub session: String,
}

action!(SessionStop, "session.stop", ());

/// Takes back a message the agent has not read.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionTakeBack {
    /// The repository's name in the list.
    pub repo: String,
    pub session: String,
    /// The message's own id.
    pub message: String,
}

action!(SessionTakeBack, "session.takeBack", ());

/// Asks each runtime for its model list again, at most once a minute, without waiting for it:
/// the lists that changed reach the record `Agent`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AgentRefreshModels;

impl Action for AgentRefreshModels {
    const NAME: &'static str = "agent.refreshModels";
    type Input = ();
    type Output = ();
}

/// Continues every feature of a repository whose run stopped and asks for the human: each gets
/// its step's message, in its latest session.
pub struct FeatureContinueAll;

impl Action for FeatureContinueAll {
    const NAME: &'static str = "feature.continueAll";
    type Input = RepositoryArgs;
    type Output = ContinuedAll;
}

/// What Continue all could not continue.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContinuedAll {
    pub refused: Vec<RefusedRun>,
}

/// A run Continue all could not continue, and why.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RefusedRun {
    /// The feature's folder.
    pub id: String,
    /// Its slug.
    pub name: String,
    pub reason: String,
}

/// A feature's agent time: the seconds its ended turns ran, and the start of the one running
/// now, which a client counts to the present.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FeatureAgent {
    pub seconds: u64,
    pub running_since: Option<u64>,
}

/// A feature's tokens, over its sessions' turns: what the model read for the first time, cache
/// writes included, and what it wrote.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FeatureTokens {
    pub input: u64,
    pub output: u64,
    /// Whether a turn done before the first counted one has no counts.
    pub partial: bool,
    /// The first counted turn's start.
    pub since: u64,
}
