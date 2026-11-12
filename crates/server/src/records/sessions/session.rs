//! The record `Session`: what a session is, its status, its turns' ids, the files it edited,
//! and the sessions its runs started.

use std::path::Path;

use uraeda_core::api;
use uraeda_core::view::FeatureView;
use uraeda_protocol::{
    EditedFile, Session, SessionArgs, SubSession, SubSessionRole, SubSessionState, TokenUse,
};

use super::feature::tokens;
use crate::live::{Fault, Registry};
use crate::runner::reads::Turns;
use crate::runner::{self, Runner, TurnState, effort_name, sent};
use crate::shared::Shared;

/// A session's title before its first message.
const NEW_SESSION: &str = "New session";

/// Registers the record `Session`.
pub(super) fn register(registry: &Registry) {
    registry.record::<Session>(read);
}

/// The value of the record `Session`: none for an id that is no session's of the repository.
fn read(shared: &Shared, args: SessionArgs) -> Result<Option<Session>, Fault> {
    let runner = Runner::of(shared);
    let root = runner.root_of(&args.repo)?;
    let found = runner.store().session(&args.id)?;
    let own = found.filter(|row| row.repo == root);
    own.map(|row| record(&runner, &row)).transpose()
}

/// What a session shows as: the name the human gave it, else a chat's own title, or its
/// feature's. A feature's session has a title only once renamed.
pub(super) fn title_of(row: &runner::Session, feature: Option<&FeatureView>) -> String {
    match (&row.title, &row.folder) {
        (Some(title), _) => title.clone(),
        (None, None) => NEW_SESSION.to_owned(),
        (None, Some(folder)) => {
            let title = feature.map(|feature| feature.title.clone());
            title
                .filter(|title| !title.is_empty())
                .unwrap_or_else(|| folder.clone())
        }
    }
}

/// Whether a session is its change's or feature's latest, which its runs go to; a chat is.
pub(super) fn is_latest(runner: &Runner, row: &runner::Session) -> bool {
    let Some(folder) = &row.folder else {
        return true;
    };
    let latest = runner.store().latest_session(&row.repo, folder);
    latest
        .ok()
        .flatten()
        .is_some_and(|latest| latest.id == row.id)
}

/// Whether a session's latest turn ended, with none waiting, after the human last saw it.
fn unseen(row: &runner::Session, turns: &Turns) -> bool {
    let ended = turns.latest().and_then(|turn| turn.ended_at);
    !turns.queued && ended.is_some_and(|ended| row.seen_at.is_none_or(|seen| ended > seen))
}

/// Where a session works: its feature's branch, or the main checkout.
fn place_of(row: &runner::Session, feature: Option<&FeatureView>) -> String {
    if row.folder.is_some() {
        let branch = feature.and_then(|feature| feature.branch.as_ref());
        return branch.map_or_else(
            || "no branch yet".to_owned(),
            |branch| format!("branch {branch}"),
        );
    }
    let workspace = api::read_workspace(Path::new(&row.repo)).ok();
    match workspace.and_then(|workspace| workspace.current_branch) {
        Some(branch) => format!("main checkout, branch {branch}"),
        None => "main checkout".to_owned(),
    }
}

/// A session's record.
fn record(runner: &Runner, row: &runner::Session) -> Result<Session, Fault> {
    let store = runner.store();
    let turns = runner.turns_of(&row.id)?;
    // A feature that is gone, as when it was finished, leaves its session its folder's name.
    let feature = row
        .folder
        .as_ref()
        .and_then(|folder| api::read_feature(Path::new(&row.repo), folder).ok());
    let read = runner.status_of(row, &turns, feature.as_ref(), is_latest(runner, row));
    let latest = turns.latest();
    let edited = store.edited_files(&row.id)?;
    let subs = store.sub_sessions(&row.id)?;
    Ok(Session {
        id: row.id.clone(),
        agent: row.agent.clone(),
        folder: row.folder.clone(),
        parent: row.parent.clone(),
        role: row.role.as_deref().map(role_of),
        name: row.title.clone(),
        title: title_of(row, feature.as_ref()),
        place: place_of(row, feature.as_ref()),
        model: row.model.clone(),
        effort: row.effort.clone(),
        ran_model: row.ran_model.clone(),
        ran_effort: row.ran_effort.clone(),
        account: runner.account_name(row),
        account_id: row.account.clone(),
        started_at: sent(row.created_at),
        archived: row.archived_at.is_some(),
        continues: row.continues,
        status: read.status.status,
        status_label: read.status.label.to_owned(),
        status_reason: read.status.reason,
        wait: read.wait,
        status_turn: latest.map(|turn| turn.id.to_string()),
        allowable: latest.map_or(0, |turn| runner.allowable(turn.id)),
        unseen: unseen(row, &turns),
        background_commands: runner.background_commands(&row.id),
        edited: edited
            .into_iter()
            .map(|(id, edits)| EditedFile { id, edits })
            .collect(),
        sub_sessions: subs.iter().map(|sub| sub_session(runner, sub)).collect(),
        turns: turns.turns.iter().map(|turn| turn.id.to_string()).collect(),
    })
}

/// A session's role as stored, a sub-session's.
fn role_of(role: &str) -> SubSessionRole {
    match role {
        "reviewer" => SubSessionRole::Reviewer,
        _ => SubSessionRole::Implementer,
    }
}

/// A sub-session, as its parent lists it: where it stands, by the runner's rule, its time, its
/// tokens, and its model and effort by their names for people, from its agent's list, else as
/// its agent reported them.
fn sub_session(runner: &Runner, row: &runner::Session) -> SubSession {
    let turns = runner.store().turns(&row.id).unwrap_or_default();
    let latest = runner::latest_of(&turns, None);
    let works = runner.sub_works(&row.id);
    let state = match latest.map(|turn| turn.state) {
        // Before its first turn, at work while its parent runs the turn that starts it.
        None => {
            let starting = row
                .parent
                .as_ref()
                .is_some_and(|parent| runner.session_working(parent));
            match starting || works {
                true => SubSessionState::Working,
                false => SubSessionState::Stopped,
            }
        }
        Some(_) if works => SubSessionState::Working,
        Some(TurnState::Running | TurnState::Queued) => SubSessionState::Working,
        Some(TurnState::Done) => SubSessionState::Done,
        Some(TurnState::Failed) => SubSessionState::Failed,
        Some(TurnState::Stopped) => SubSessionState::Stopped,
    };
    let listed = runner
        .shared
        .get::<crate::runtimes::Runtimes>()
        .models(&row.agent);
    let models = listed.map(|list| list.models).unwrap_or_default();
    let model = models
        .iter()
        .find(|model| Some(&model.id) == row.model.as_ref());
    let effort = model.and_then(|model| {
        model
            .efforts
            .iter()
            .find(|effort| Some(&effort.id) == row.effort.as_ref())
    });
    let named_effort = row
        .effort
        .as_deref()
        .map(|effort| effort_name(effort).to_owned());
    let used = tokens(&turns);
    SubSession {
        id: row.id.clone(),
        parent: row.parent.clone().unwrap_or_default(),
        role: role_of(row.role.as_deref().unwrap_or_default()),
        about: about(row.title.as_deref().unwrap_or_default()).to_owned(),
        agent: row.agent.clone(),
        model: model
            .map(|model| model.name.clone())
            .or_else(|| row.ran_model.clone())
            .or_else(|| row.model.clone())
            .unwrap_or_else(|| "Default".to_owned()),
        effort: effort
            .map(|effort| effort.name.clone())
            .or_else(|| row.ran_effort.clone())
            .or(named_effort),
        started_at: sent(row.created_at),
        ended_at: match state {
            SubSessionState::Working => None,
            _ => latest.and_then(|turn| turn.ended_at).map(sent),
        },
        state,
        usage: used.map(|used| TokenUse {
            input: used.input,
            output: used.output,
        }),
    }
}

/// What a sub-session is about, as its parent lists it: a reviewer's stored title ends with the
/// commits it reviewed, ` on <base>..<head>`, which tell its reviews apart and are not shown.
fn about(title: &str) -> &str {
    let hex = |text: &str| {
        (7..=64).contains(&text.len())
            && text
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    };
    let Some((about, range)) = title.rsplit_once(" on ") else {
        return title;
    };
    match range.split_once("..") {
        Some((base, head)) if hex(base) && hex(head) => about,
        _ => title,
    }
}
