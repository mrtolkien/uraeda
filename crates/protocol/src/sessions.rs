//! The sessions: the agent runtimes, a session and its turns, a turn's transcript by pages, the
//! sidebar's list and its search. And the actions that send a message, stop a run, allow a
//! blocked action, and move a session.
//!
//! # What a client subscribes to
//!
//! A session's page holds four kinds of record, each of which changes for its own reasons, so
//! that nothing is read again for an event it does not show:
//!
//! - [`Session`], `{ repo, id }`: what the session is, its status, and the ids of its turns. It
//!   changes when a turn starts or ends, never with a turn's events.
//! - [`Turn`], `{ repo, id }`: one turn's state, what it does now, and how many pages its
//!   transcript has. It changes when its state, its activity, or its sub-agents do.
//! - [`TurnLog`], `{ repo, turn, page }`: one page of a turn's transcript, at most [`TURN_PAGE`]
//!   items. A client subscribes to the pages it draws. An item's `id` names it for good: a
//!   reply's text grows as an `append` at `["items", <id>, "text"]`, and never as a new value.
//! - [`SessionList`], `{ repo }`: the sidebar's rows.
//!
//! A time is a number of milliseconds since 1970.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::features::Trigger;
use crate::registry::{Action, Record};
use crate::shared::{
    Capabilities, ChatImage, ModelList, RepositoryArgs, SessionStatus, StatusReason, Wait,
};

/// An action of the sessions whose input is its own type: its name, and what it answers.
macro_rules! action {
    ($input:ident, $name:literal, $output:ty) => {
        impl Action for $input {
            const NAME: &'static str = $name;
            type Input = Self;
            type Output = $output;
        }
    };
}

/// The items in each page of a turn's transcript.
pub const TURN_PAGE: u32 = 100;

/// Which runtimes: on or off as one repository has them, or as every repository does.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AgentArgs {
    /// The repository's name in the list: none for the settings, outside any repository.
    pub repo: Option<String>,
}

/// The agent runtimes sessions run on, in the order they registered: the first one on is the one
/// a new session runs on until another is picked.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub runtimes: Vec<RuntimeRecord>,
}

impl Record for Agent {
    const NAME: &'static str = "Agent";
    type Args = AgentArgs;
    type Value = Self;
}

/// A runtime: what its sessions show, what it can do, and its usage.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeRecord {
    /// The name it is registered as, which its sessions store as their `agent`.
    pub id: String,
    /// Its name for people: `Claude Code`.
    pub name: String,
    /// Its extension's title, which its refusals name it by.
    pub title: String,
    /// The icon of its mark, a name of the app's icon set.
    pub icon: String,
    /// Whether it worked at its last check.
    pub available: bool,
    /// Its version at its last check.
    pub version: Option<String>,
    /// Whether it is on in the repository asked about.
    pub is_on: bool,
    pub capabilities: Capabilities,
    /// Its last model list, kept through a refresh that failed: none before one, or for a
    /// runtime that lists none.
    pub models: Option<ModelList>,
    /// Its usage windows, each from the freshest report of an open process on no account: none
    /// before one.
    pub usage: Vec<UsageWindow>,
    /// Its accounts, in the listed order: none for a runtime that lists none.
    pub accounts: Vec<crate::AccountRecord>,
}

/// One usage window a runtime reports, like five hours or a week.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub id: String,
    pub label: String,
    /// When it resets, in ISO 8601, as the agent gave it.
    pub resets_at: String,
    /// The share used, from 0 to 1.
    pub used: f64,
}

/// Which session, or which turn, of a repository.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionArgs {
    /// The repository's name in the list.
    pub repo: String,
    /// The session's id, or the turn's.
    pub id: String,
}

/// A session: a feature's, a change's, or a chat. Its value is `null` for an id that is no
/// session's of the repository.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    /// The runtime it runs on, by the name it is registered as.
    pub agent: String,
    /// Its change's or feature's folder: none for a chat.
    pub folder: Option<String>,
    /// The session whose run started it, for a sub-session.
    pub parent: Option<String>,
    /// A sub-session's role in its parent's run.
    pub role: Option<SubSessionRole>,
    /// The title the human or its first message gave it: none for a feature's session.
    pub name: Option<String>,
    /// What it shows as: its name, its feature's title, or `New session`.
    pub title: String,
    /// Where it works: `branch <name>`, or `main checkout, branch <name>`.
    pub place: String,
    /// The model picked, by the agent's id: none for the agent's default.
    pub model: Option<String>,
    /// The effort picked, by the agent's id: none for the agent's default.
    pub effort: Option<String>,
    /// The model the agent last said it runs on, by its name for people.
    pub ran_model: Option<String>,
    /// The effort the agent last said it runs on, by its name for people.
    pub ran_effort: Option<String>,
    /// The account it runs on, by its runtime's name for it: none on the server's own login.
    pub account: Option<String>,
    /// That account's id, which finds it among the runtime's accounts: two may share a name.
    pub account_id: Option<String>,
    pub started_at: u64,
    pub archived: bool,
    /// Its automatic continues in a row.
    pub continues: u32,
    pub status: SessionStatus,
    /// The status in words, like `Needs you`.
    pub status_label: String,
    pub status_reason: Option<StatusReason>,
    /// When its run continues by itself, while it waits.
    pub wait: Option<Wait>,
    /// The turn its status follows, which Dismiss names.
    pub status_turn: Option<String>,
    /// How many blocked actions of its latest turn "Allow all" would allow.
    pub allowable: u32,
    /// Whether its latest turn ended after the human last saw it.
    pub unseen: bool,
    /// How many background commands of its run still run.
    pub background_commands: u32,
    /// The files its agent edited, in the order of their first edit.
    pub edited: Vec<EditedFile>,
    /// The sessions its runs started, the first started first.
    pub sub_sessions: Vec<SubSession>,
    /// Its turns' ids, the oldest first: each is a [`Turn`].
    pub turns: Vec<String>,
}

impl Record for Session {
    const NAME: &'static str = "Session";
    type Args = SessionArgs;
    type Value = Option<Self>;
}

/// A file a session's agent edited.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct EditedFile {
    /// Its path, from the session's directory.
    pub id: String,
    /// How many of its edits completed.
    pub edits: u32,
}

/// A sub-session's role in its parent's run.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum SubSessionRole {
    Implementer,
    Reviewer,
}

/// Where a sub-session stands, from its latest turn.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum SubSessionState {
    Working,
    Done,
    Failed,
    Stopped,
}

/// A session a workflow run started for one of its sub-agents, as its parent lists it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SubSession {
    pub id: String,
    /// The session that started it.
    pub parent: String,
    pub role: SubSessionRole,
    /// What it works on: its task, or what it reviews.
    pub about: String,
    /// Its runtime, by the name it is registered as.
    pub agent: String,
    /// Its model's name for people: `Default` on the agent's own, before it said.
    pub model: String,
    /// Its effort's name for people: none on the model's default.
    pub effort: Option<String>,
    pub started_at: u64,
    /// When its latest turn ended: none while it works.
    pub ended_at: Option<u64>,
    pub state: SubSessionState,
    /// Its tokens, as of its last change of state: none before its agent reported any.
    pub usage: Option<TokenUse>,
}

/// Tokens read for the first time, cache writes included, and tokens written.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TokenUse {
    pub input: u64,
    pub output: u64,
}

/// The sessions of a repository, what needs the human first, then the last updated. A
/// sub-session is listed by its parent, not here.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionList {
    pub rows: Vec<SessionRow>,
}

impl Record for SessionList {
    const NAME: &'static str = "SessionList";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// A session's row in the sidebar.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionRow {
    pub id: String,
    pub agent: String,
    pub folder: Option<String>,
    pub title: String,
    pub archived: bool,
    /// Whether a chat is done: idle, and seen since its last turn ended.
    pub done: bool,
    pub status: SessionStatus,
    pub status_label: String,
    /// When its run continues by itself, while it waits.
    pub wait: Option<Wait>,
    /// How many sub-agents of its running turn work.
    pub subagents: u32,
    pub background_commands: u32,
    pub started_at: u64,
    pub updated_at: u64,
}

/// Which search of a repository's sessions.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionSearchArgs {
    /// The repository's name in the list.
    pub repo: String,
    /// What to look for: every session, as [`SessionList`], for a blank one.
    pub query: String,
}

/// The sessions whose title, folder, or messages hold a text, whatever its case, with every
/// session of the features whose title holds it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionSearch {
    pub rows: Vec<SessionRow>,
}

impl Record for SessionSearch {
    const NAME: &'static str = "SessionSearch";
    type Args = SessionSearchArgs;
    type Value = Self;
}

/// Why a turn runs.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum TurnKind {
    /// A workflow step.
    Workflow,
    /// The human's message.
    Chat,
    /// A blocked action the human allowed, tried again.
    Allow,
}

/// Where a turn is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum TurnState {
    /// It waits behind another turn.
    Queued,
    Running,
    Done,
    Failed,
    Stopped,
}

/// A turn of a session, without its transcript. Its value is `null` for an id that is no
/// turn's of the repository.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Turn {
    pub id: String,
    pub session: String,
    pub kind: TurnKind,
    pub state: TurnState,
    /// Why it failed or stopped.
    pub reason: Option<String>,
    /// A workflow turn's step when it started.
    pub step: Option<String>,
    /// What started a workflow turn.
    pub trigger: Option<Trigger>,
    /// An allow turn's rules, a line each.
    pub allowed: Option<String>,
    pub started_at: Option<u64>,
    pub ended_at: Option<u64>,
    /// Whether the human dismissed its failure or its stop.
    pub dismissed: bool,
    /// What it does now, while it runs on this server.
    pub activity: Option<TurnActivity>,
    /// Its sub-agents at work, in the order they started, while it runs on this server.
    pub subagents: Vec<Subagent>,
    /// How many pages its transcript has, of [`TURN_PAGE`] items each: each is a [`TurnLog`].
    pub pages: u32,
}

impl Record for Turn {
    const NAME: &'static str = "Turn";
    type Args = SessionArgs;
    type Value = Option<Self>;
}

/// What a running turn does now, like `Thinking` or `Writing spec.md`, and since when nothing
/// new showed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnActivity {
    pub label: String,
    pub since: u64,
}

/// A sub-agent at work in a running turn.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Subagent {
    /// Its tool call's id.
    pub id: String,
    pub description: String,
    /// The sub-agent that started it: none when the main agent did.
    pub parent: Option<String>,
    pub started_at: u64,
    /// Its own tool calls so far, the sub-agents it started included.
    pub calls: u32,
    /// The last of its tool calls: none before the first.
    pub latest: Option<SubagentCall>,
}

/// A sub-agent's tool call, in short.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SubagentCall {
    pub tool_kind: ToolKind,
    pub target: Option<String>,
}

/// What a tool call does, in the Agent Client Protocol's words.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ToolKind {
    Read,
    Edit,
    Delete,
    Move,
    Search,
    Execute,
    Think,
    Fetch,
    Other,
}

/// Which page of a turn's transcript.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnLogArgs {
    /// The repository's name in the list.
    pub repo: String,
    /// The turn's id.
    pub turn: String,
    /// The page, from 0.
    pub page: u32,
}

/// A page of a turn's transcript: its items, in order. Its value is `null` for a turn that is
/// none of the repository's.
///
/// A page is never read again for a piece of a reply: a text being written grows by an `append`
/// at `["items", <id>, "text"]`. A new item, and an item whose state changed, as a tool call
/// that ended, reads its own page again, and no other.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnLog {
    pub items: Vec<Item>,
}

impl Record for TurnLog {
    const NAME: &'static str = "TurnLog";
    type Args = TurnLogArgs;
    type Value = Option<Self>;
}

/// A line of a turn's transcript, whatever the agent. Its `id` is its place in its turn's log,
/// which names it for good.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum Item {
    /// A message sent to the agent: the human's, or the workflow's. One taken back leaves the
    /// transcript.
    Message {
        id: String,
        /// The message's own id, which `session.takeBack` names.
        message: String,
        at: u64,
        origin: MessageOrigin,
        /// Whether the agent read it.
        read: bool,
        text: String,
        /// The chat's opening line, shown above the human's text.
        opening: Option<String>,
        images: Vec<ChatImage>,
    },
    /// A text the agent wrote: `streaming` until it ends.
    Text {
        id: String,
        streaming: bool,
        text: String,
    },
    /// A tool call.
    Tool {
        id: String,
        /// The tool call's own id.
        call: String,
        /// `Bash`, `Read`, ...
        name: String,
        tool_kind: ToolKind,
        /// The command, the path from the session's directory, the address, or the pattern.
        target: Option<String>,
        /// The tool call of the sub-agent that runs it.
        parent: Option<String>,
        /// What the sub-agent it starts is for, when it starts one.
        subagent: Option<String>,
        status: ToolStatus,
        /// Its result's text, cut to its first 4,000 characters.
        output: Option<String>,
        /// How long it took, once it ended, in milliseconds.
        duration_ms: Option<u64>,
    },
    /// A thinking block: its text only when the agent gave one, and how long it lasted.
    Thought {
        id: String,
        /// The tool call of the sub-agent that thought it.
        parent: Option<String>,
        text: Option<String>,
        duration_ms: u64,
    },
    /// A line of Uraeda's, or of the agent's: a new agent session, a retry, skipped lines.
    System { id: String, text: String },
    /// An action the agent's permissions blocked. Without a rule, it cannot be allowed.
    Denial {
        id: String,
        tool: String,
        target: Option<String>,
        rule: Option<String>,
        allowed: bool,
    },
}

/// Who sent a message to the agent.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum MessageOrigin {
    Human,
    Workflow,
}

/// Where a tool call is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum ToolStatus {
    InProgress,
    Completed,
    Failed,
}

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
